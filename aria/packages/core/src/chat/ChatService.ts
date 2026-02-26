import Anthropic from '@anthropic-ai/sdk';
import { ContextStore } from './ContextStore';
import { PlanOfAttackService } from '../clients/PlanOfAttackService';
import { getNotionClient, ClientProfileService, getClickUpQueryService, DriveService, GmailService, SheetsService, DocsService, CalendarService, isWorkspaceConfigured } from '@aria/integrations';
import { getTaskIntentParser, type TaskIntent, type ParseResult } from './TaskIntentParser';
import { getClientMatcher } from '../utils/client-matcher';
import { AmbiguityResolver } from './AmbiguityResolver';
import { getPriorityExtractor } from '../utils/priority-extractor';
import { getRateLimitCoordinator } from '../utils/rate-limit-coordinator';

export interface TaskCreationRequest {
  text: string;
  userId?: string;
  sessionId: string;
}

export interface TaskCreationResponse {
  status: 'pending_clarification' | 'preview_ready' | 'created' | 'error';
  preview?: string | undefined;
  clarificationQuestion?: string | undefined;
  intent?: TaskIntent | undefined;
  confidence?: number | undefined;
  error?: string | undefined;
  taskId?: string | undefined;
  notionUrl?: string | undefined;
}

export class ChatService {
  constructor(
    private claude: Anthropic,
    private contextStore: ContextStore,
    private clickupQueryService?: any, // Using any here to avoid circular dep, typed in server.ts
  ) { }

  /**
   * Detect if the user message is asking about ClickUp tasks/pipeline.
   */
  private isClickUpQuery(message: string): boolean {
    const lower = message.toLowerCase();
    const keywords = [
      'tarefa', 'tarefas', 'clickup', 'pipeline', 'acelerada', 'acelerado',
      'cliente', 'clientes', 'em andamento', 'aguardando', 'pendente',
      'pipe', 'etapa', 'status', 'lista', 'listar',
    ];
    const isQuery = keywords.some((kw) => lower.includes(kw));
    console.log('[ChatService.isClickUpQuery]', { message, isQuery });
    return isQuery;
  }

  /** Detect if user is asking about reports */
  private isReportQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('relatório') || lower.includes('relatorio') || lower.includes('report');
  }

  /** Detect if user is asking about calendar/agenda */
  private isCalendarQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('agenda') ||
      lower.includes('calendário') || lower.includes('calendario') ||
      lower.includes('calendar') ||
      lower.includes('reunião') || lower.includes('reuniao') || lower.includes('reuniões') ||
      lower.includes('evento') || lower.includes('eventos') ||
      lower.includes('compromisso') || lower.includes('compromissos') ||
      lower.includes('chamada') || lower.includes('meeting') || lower.includes('call') ||
      lower.includes('horário') || lower.includes('horario') ||
      lower.includes('agendar') || lower.includes('marcar') || lower.includes('bloqueie');
  }

  /** Detect if user is asking about Gmail */
  private isGmailQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('email') || lower.includes('e-mail') || lower.includes('gmail') || lower.includes('inbox') || lower.includes('mensagen') || lower.includes('mensagem') || lower.includes('leia meu email') || lower.includes('meus emails');
  }

  /** Detect if user is asking about Google Drive */
  private isDriveQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('drive') || lower.includes('arquivo') || lower.includes('arquivos') || lower.includes('pasta') || lower.includes('documento no drive') || lower.includes('arquivos recentes');
  }

  /** Detect if user is asking about Google Sheets */
  private isSheetsQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('planilha') || lower.includes('sheets') || lower.includes('spreadsheet') || lower.includes('excel') || lower.includes('tabela');
  }

  /** Detect if user is asking about Google Docs */
  private isDocsQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('documento') || lower.includes('google doc') || lower.includes('docs') || lower.includes('texto do doc') || lower.includes('leia o documento');
  }

  /** Build Google Workspace context (Drive, Gmail, Sheets, Docs) */
  private async buildWorkspaceContext(message: string): Promise<string> {
    if (!(await isWorkspaceConfigured())) {
      return '\n\n---\n⚠️ GOOGLE WORKSPACE: O GOOGLE_REFRESH_TOKEN não está configurado. Informe ao usuário que ele precisa autorizar o acesso em http://localhost:3001/api/auth/google/url\n---';
    }

    const parts: string[] = [];
    const lower = message.toLowerCase();

    try {
      if (this.isGmailQuery(message)) {
        const gmailSvc = new GmailService();
        const onlyUnread = lower.includes('não lido') || lower.includes('nao lido') || lower.includes('unread');
        const emails = await gmailSvc.listRecentEmails(5, onlyUnread);
        parts.push(gmailSvc.formatForAI(emails, onlyUnread ? 'não lidos' : 'recentes'));
      }

      if (this.isDriveQuery(message)) {
        const driveSvc = new DriveService();
        // Check if there's a search query within the message
        const searchMatch = lower.match(/(?:buscar?|procurar?|encontrar?|pesquisar?)\s+(.+?)(?:\s+no drive|$)/i);
        if (searchMatch) {
          const files = await driveSvc.searchFiles(searchMatch[1]);
          parts.push(driveSvc.formatForAI(files, `busca: "${searchMatch[1]}"`));
        } else {
          const files = await driveSvc.listRecentFiles(8);
          parts.push(driveSvc.formatForAI(files, 'recentes'));
        }
      }

      if (this.isSheetsQuery(message)) {
        parts.push('📊 GOOGLE SHEETS: Para ler uma planilha específica, informe o ID do documento. Exemplo: "leia a planilha [ID_DA_PLANILHA]".');
      }

      if (this.isDocsQuery(message)) {
        parts.push('📄 GOOGLE DOCS: Para ler um documento específico, informe o ID. Exemplo: "leia o documento [ID_DO_DOC]".');
      }

      if (this.isCalendarQuery(message)) {
        const calendarSvc = new CalendarService();
        const events = await calendarSvc.listEvents();
        parts.push(calendarSvc.formatForAI(events, 'próximos eventos na agenda'));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[ChatService.buildWorkspaceContext] Error:', errorMsg);

      let aiInstruction = '';
      if (errorMsg.includes('Insufficient Permission') || errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
        aiInstruction = '\n[INSTRUÇÃO IMPORTANTE PARA A IA]: O token atual do usuário não tem permissão para acessar este serviço (escopo desatualizado). Como você opera usando o OAuth do próprio usuário, NÃO peça para ele compartilhar a agenda com seu email. Diga exatamente o seguinte: "Parece que minhas permissões de acesso ao seu Google Workspace estão desatualizadas. Para que eu possa ler sua agenda e documentos, por favor, clique para reconectar o Google Workspace no painel, ou acesse diretamente: http://localhost:3001/api/auth/google/url para aprovar as permissões finais."';
      }

      parts.push(`⚠️ Erro ao acessar Google Workspace: ${errorMsg}${aiInstruction}`);
    }

    const contextResult = parts.length > 0
      ? `\n\n---\n⚠️ DADOS DO GOOGLE WORKSPACE — Use exclusivamente estes dados para responder:\n\n${parts.join('\n\n')}\n---`
      : '';

    console.log('[ChatService.buildWorkspaceContext] Context built, length:', contextResult.length, 'parts:', parts.length);
    return contextResult;
  }

  private async buildClickUpContext(message: string): Promise<string> {
    const qs = this.clickupQueryService || getClickUpQueryService();
    console.log('[ChatService.buildClickUpContext] qs available?', !!qs);
    if (!qs) {
      console.warn('[ChatService.buildClickUpContext] ClickUpQueryService is null/undefined!');
      return '';
    }

    try {
      const lower = message.toLowerCase();
      // More explicit task keywords so "meus clientes" does not false trigger it
      const isMyTasks = lower.includes('minha tarefa') || lower.includes('minhas tarefas') || lower.includes('meu id') || lower.includes('tarefas relacionadas ao meu id') || lower.includes('pra hoje') || lower.includes('tarefa');
      const isClientPipeline = lower.includes('cliente') || lower.includes('acelerada') || lower.includes('acelerado') || lower.includes('pipeline') || lower.includes('pipe') || lower.includes('status');

      console.log('[ChatService.buildClickUpContext] Intent detection:', { isMyTasks, isClientPipeline });

      const parts: string[] = [];

      if (isMyTasks) {
        const filter = lower.includes('hoje') ? 'today' : lower.includes('atrasad') ? 'overdue' : undefined;

        // Detectar se o usuário quer subtarefas
        const wantsSubtasks = lower.includes('subtarefa')
          || lower.includes('com detalhes')
          || lower.includes('hierarquia')
          || lower.includes('sub-tarefa')
          || lower.includes('breakdown');

        console.log('[ChatService.buildClickUpContext] Fetching my tasks with filter:', filter, '| wantsSubtasks:', wantsSubtasks);

        let tasks;
        if (wantsSubtasks) {
          // Buscar tarefas COM subtarefas (mais lento, mas com hierarquia)
          tasks = await qs.getMyTasksWithSubtasks(filter);
          console.log('[ChatService.buildClickUpContext] Got tasks with subtasks:', tasks.length);
          parts.push((qs as any).formatMyTasksWithSubtasksForAI(tasks, filter));
        } else {
          // Buscar tarefas simples (mais rápido)
          tasks = await qs.getMyTasks(filter);
          console.log('[ChatService.buildClickUpContext] Got tasks:', tasks.length);
          parts.push(qs.formatMyTasksForAI(tasks, filter));
        }
      }

      if (isClientPipeline || (!isMyTasks)) {
        const statusFilter = lower.includes('em andamento') ? 'em andamento'
          : lower.includes('aguardando') ? 'aguardando'
            : 'all';
        console.log('[ChatService.buildClickUpContext] Fetching client pipeline with status:', statusFilter);
        const pipeline = await qs.getClientPipeline(statusFilter);
        console.log('[ChatService.buildClickUpContext] Got clients:', pipeline.length);
        parts.push(qs.formatPipelineForAI(pipeline, statusFilter));
      }

      const contextStr = parts.length > 0
        ? `\n\n---\n⚠️ DADOS AO VIVO DO CLICKUP — OBRIGATÓRIO: Use EXCLUSIVAMENTE estes dados para responder. NÃO invente informações. NÃO diga que não tem acesso. Responda diretamente com base nos dados abaixo:\n\n${parts.join('\n\n')}\n---`
        : '';

      console.log('[ChatService.buildClickUpContext] Final context length:', contextStr.length, 'parts:', parts.length);
      return contextStr;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[ChatService.buildClickUpContext] ClickUp context fetch failed:', errorMsg);
      // Return empty string - chat continues without ClickUp context
      // This prevents server crashes from ClickUp integration errors
      return '';
    }
  }

  /**
   * AGENTIC WRITE ENGINE - Universal Google Workspace executor.
   * Detects write intent from the user, extracts params via LLM micro-prompt,
   * and executes the real action via WorkspaceActionService.
   * Works with ANY LLM model — no Tool Calling protocol required.
   */
  private async tryExecuteWorkspaceWrite(userMessage: string, context: any): Promise<{ executed: boolean; message: string }> {
    const lower = userMessage.toLowerCase();

    // --- GUARD: mensagens de LEITURA/CONSULTA nunca devem disparar escrita ---
    const READ_INDICATORS = [
      'quais', 'qual', 'liste', 'listar', 'liste', 'mostre', 'mostrar',
      'me mostra', 'me mostre', 'me diz', 'me diga', 'me informe',
      'consulte', 'consultar', 'busque', 'buscar', 'pesquise', 'pesquisar',
      'procure', 'procurar', 'encontre', 'encontrar',
      'tenho', 'tem ', 'há ', 'existe', 'existem',
      'o que', 'quando', 'onde', 'quantos', 'quantas',
      'veja', 'ver ', 'veja', 'como está', 'como estão',
      'leia', 'leia ', 'ler ', 'ler o', 'ler a',
      'preciso saber', 'quero ver', 'quero saber',
      'está agendado', 'estão agendados',
    ];
    const isReadQuery = READ_INDICATORS.some(indicator => lower.includes(indicator));
    if (isReadQuery) return { executed: false, message: '' };

    // --- WRITE INTENT DETECTION ---
    const WRITE_VERBS = ['envie', 'envia', 'manda', 'mande', 'send',
      'exclua', 'exclui', 'delete', 'apague', 'apaga', 'remova', 'remove',
      'mova', 'move', 'mover', 'renomeie', 'renomeia', 'rename',
      'copie', 'copia', 'copy', 'crie', 'criar', 'create', 'adicione', 'adiciona', 'add',
      'escreva', 'escreve', 'write', 'acrescente', 'acrescenta', 'append',
      'agende', 'agenda', 'marque', 'marca', 'schedule',
      'cancele', 'cancela', 'cancel', 'desfaça', 'deletar', 'arquivar',
      'arquiva', 'archive', 'restaure', 'restaura', 'restore',
      'substitua', 'substitui', 'replace', 'atualize', 'atualiza', 'update',
      // Verbos adicionais — PT-BR comuns que os usuários usam
      'incluir', 'inclua', 'incluí', 'incluo', 'incluindo',
      'inserir', 'insira', 'insiro', 'inserindo',
      'editar', 'edite', 'editando',
      'alterar', 'altere', 'alterando',
      'colocar', 'coloque', 'coloca', 'colocando',
      'adicionar', 'acrescentar', 'colocar',
      'registrar', 'registre', 'registro',
      'anotar', 'anote', 'anota',
      'salvar', 'salve', 'salva',
      'fazer', 'faça', 'faz',
      'colocar', 'coloque',
      'lançar', 'lance', 'lança',
      'marcar', 'ajustar', 'organize', 'organizar'];
    const WRITE_TARGETS = ['email', 'e-mail', 'mensagem', 'mail',
      'evento', 'reunião', 'reuniao', 'compromisso', 'meeting', 'lembrete', 'agenda', 'call',
      'arquivo', 'pasta', 'folder', 'file',
      'planilha', 'spreadsheet', 'sheet', 'aba',
      'documento', 'doc', 'texto',
      'tarefa', 'task'];

    const hasVerb = WRITE_VERBS.some(v => lower.includes(v));
    const hasTarget = WRITE_TARGETS.some(t => lower.includes(t));

    console.log('[AgenticWrite] Initial check:', { userMessage: userMessage.substring(0, 50), hasVerb, hasTarget });

    if (!hasVerb || !hasTarget) return { executed: false, message: '' };

    // --- HEURISTIC CALENDAR DETECTION (faster & more reliable than LLM) ---
    const now = new Date();
    const BRT_OFFSET = -3;
    const brtNow = new Date(now.getTime() + BRT_OFFSET * 60 * 60 * 1000);

    // Guard against deletion and update verbs so they fall through to the LLM Micro-Prompt
    const isDeletionVerb = ['exclua', 'excluir', 'delete', 'deletar', 'apague', 'apagar', 'remova', 'remover', 'cancele', 'cancelar', 'tire', 'tirar'].some(v => lower.includes(v));
    const isUpdateVerb = ['altere', 'alterar', 'mude', 'mudar', 'atualize', 'atualizar', 'remarque', 'remarcar'].some(v => lower.includes(v));

    const isCalendarKeywords = lower.includes('evento') || lower.includes('reunião') || lower.includes('reuniao') ||
      lower.includes('agendar') || lower.includes('agenda') || lower.includes('marcar') ||
      lower.includes('compromisso') || lower.includes('meeting') || lower.includes('reuniões') ||
      lower.includes('horário') || lower.includes('horario') ||
      lower.includes('calendário') || lower.includes('calendario') ||
      lower.includes('disponibilidade') || lower.includes('encontro') ||
      // 'chamada' e 'call' apenas quando contexto não for de Drive/Docs/Sheets
      (lower.includes('chamada') && !lower.includes('drive') && !lower.includes('pasta') && !lower.includes('arquivo') && !lower.includes('chamada de')) ||
      (lower.includes('call') && !lower.includes('drive') && !lower.includes('callback'));

    const isCalendarCreateAction = isCalendarKeywords && !isDeletionVerb && !isUpdateVerb;
    const isCalendarDeleteAction = isCalendarKeywords && isDeletionVerb;
    console.log('[AgenticWrite] Calendar heuristics:', { create: isCalendarCreateAction, delete: isCalendarDeleteAction, update: isUpdateVerb });

    const isoDate = (d: Date) => d.toISOString().split('T')[0];
    const amanha = new Date(brtNow); amanha.setDate(amanha.getDate() + 1);

    // --- HEURISTIC CALENDAR DELETE (Smart Fuzzy Matching via LLM) ---
    if (isCalendarDeleteAction) {
      console.log('[AgenticWrite] 🎯 Heuristic calendar delete matched');
      try {
        const searchPrompt = `Hoje é ${isoDate(brtNow)}. O usuário quer excluir um evento da agenda. Mensagem: "${userMessage}"
Extraia o título do evento e a data aproximada. Responda APENAS JSON:
{"title":"nome do evento","dateHint":"YYYY-MM-DD ou vazio se não sei"}`;

        const searchExtract = await this.claude.messages.create({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          max_tokens: 100,
          messages: [{ role: 'user', content: searchPrompt }],
        });

        const searchRaw = searchExtract.content[0]?.type === 'text' ? searchExtract.content[0].text : '';
        const searchJson = searchRaw.match(/\{[\s\S]*\}/);
        const { title: searchTitle = '', dateHint = '' } = searchJson ? JSON.parse(searchJson[0]) : {};

        if (!searchTitle) {
          return { executed: true, message: `⚠️ Não consegui identificar o nome do evento para excluir. Por favor, seja mais específico.` };
        }

        const { CalendarService } = await import('@aria/integrations');
        const calSvc = new CalendarService();
        const searchFrom = dateHint ? new Date(`${dateHint}T00:00:00-03:00`) : new Date(brtNow.getTime() - 24 * 60 * 60 * 1000);
        const searchTo = new Date(searchFrom.getTime() + 60 * 24 * 60 * 60 * 1000);
        const events = await calSvc.listEvents(searchFrom, searchTo, 30);

        // Fuzzy match by title AND optionally by date
        const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const titleNorm = normalize(searchTitle);
        const match = events.find(e => {
          const eventNorm = normalize(e.title);
          const titleMatches = eventNorm.includes(titleNorm) || titleNorm.includes(eventNorm);

          // Se o LLM cravou uma data exata (YYYY-MM-DD), garantir que o evento cai neste dia (resolvendo Timezones)
          if (titleMatches && dateHint) {
            const eventDateObj = new Date(e.startTime);
            const localIsoDate = new Date(eventDateObj.getTime() + BRT_OFFSET * 60 * 60 * 1000).toISOString().split('T')[0];
            return localIsoDate === dateHint;
          }
          return titleMatches;
        });

        if (!match) {
          return { executed: true, message: `⚠️ Não encontrei nenhum evento chamado **"${searchTitle}"**${dateHint ? ` na data (${dateHint})` : ''} na sua agenda. Verifique o nome real.` };
        }

        const { WorkspaceActionService } = await import('@aria/integrations');
        const actionSvc = new WorkspaceActionService();
        const result = await actionSvc.execute({ service: 'calendar', action: 'deleteEvent', params: { eventId: match.id } } as any);

        if (result.success) {
          const startFormatted = new Date(match.startTime).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
          return { executed: true, message: `✅ Evento **"${match.title}"** excluído com sucesso!\n- **Estava em:** ${startFormatted}` };
        } else {
          return { executed: true, message: `⚠️ ${result.message}` };
        }
      } catch (err: any) {
        console.error('[AgenticWrite] ❌ Delete execution error:', err.message);
        return { executed: true, message: `⚠️ Erro ao procurar o evento para excluir: ${err.message}` };
      }
    }

    if (isCalendarCreateAction) {
      // Extract time: "14h", "14:30", "2pm"
      let timeStr = '10:00';
      const timeMatch = lower.match(/(\d{1,2}):?(\d{0,2})(?:h|:00)?/);
      if (timeMatch) {
        const hours = timeMatch[1];
        const mins = timeMatch[2] || '00';
        timeStr = `${hours.padStart(2, '0')}:${mins.padStart(2, '0')}`;
      }

      // Extract date
      let targetDate = new Date(brtNow);
      if (lower.includes('amanhã') || lower.includes('amanha')) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (lower.includes('hoje')) {
        // Use today
      } else if (lower.includes('segunda')) {
        const days = (1 - targetDate.getDay() + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (days === 0 ? 7 : days));
      } else if (lower.includes('terça') || lower.includes('terca')) {
        const days = (2 - targetDate.getDay() + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (days === 0 ? 7 : days));
      } else if (lower.includes('quarta')) {
        const days = (3 - targetDate.getDay() + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (days === 0 ? 7 : days));
      } else if (lower.includes('quinta')) {
        const days = (4 - targetDate.getDay() + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (days === 0 ? 7 : days));
      } else if (lower.includes('sexta')) {
        const days = (5 - targetDate.getDay() + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (days === 0 ? 7 : days));
      }

      // Extract title (quoted text or first words after keywords)
      let title = 'Evento';
      const quotedMatch = userMessage.match(/"([^"]+)"|'([^']+)'/);
      if (quotedMatch) {
        title = quotedMatch[1] || quotedMatch[2];
      } else {
        const afterKeyword = userMessage.split(/agendar|reunião|reuniao|evento|compromisso|chamada/i)[1] || '';
        const titlePart = afterKeyword.split(/para|às|a |em /i)[0]?.trim();
        if (titlePart && titlePart.length > 2) {
          title = titlePart.substring(0, 100);
        }
      }

      // Set time on target date
      const [hours, mins] = timeStr.split(':').map(Number);
      targetDate.setHours(hours, mins || 0, 0, 0);

      // Build end time (1 hour default)
      const endDate = new Date(targetDate.getTime() + 60 * 60 * 1000);

      const calendarAction = {
        service: 'calendar',
        action: 'createEvent',
        params: {
          title: title.trim() || 'Evento',
          startTime: targetDate.toISOString(),
          endTime: endDate.toISOString(),
          description: 'Evento criado via ARIA Assistant'
        }
      };

      console.log('[AgenticWrite] 🎯 Heuristic calendar detection matched:', { title, time: timeStr });
      try {
        const { WorkspaceActionService } = await import('@aria/integrations');
        const actionSvc = new WorkspaceActionService();
        const result = await actionSvc.execute(calendarAction as any);
        console.log('[AgenticWrite] 📊 Heuristic execution result:', result);
        if (result.success) {
          return { executed: true, message: `✅ ${result.message}` };
        } else {
          return { executed: true, message: `⚠️ ${result.message}` };
        }
      } catch (err: any) {
        console.error('[AgenticWrite] ❌ Heuristic execution error:', err.message);
        return { executed: false, message: '' };
      }
    }

    // --- EXTRACTION VIA MICRO-PROMPT (fallback for non-calendar actions) ---
    const recentHistory = context?.history?.slice(-5).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n') || '';

    const extractionPrompt = `Hoje é ${isoDate(brtNow)} (amanhã: ${isoDate(amanha)}). 

Histórico recente da conversa (use para encontrar IDs e referências se o usuário não informar diretamente):
${recentHistory}

Mensagem atual do usuário: "${userMessage}"

Identifique a ação de escrita e retorne APENAS JSON válido, sem outros textos:

Para Gmail: {"service":"gmail","action":"sendEmail","params":{"to":"email@dominio.com","subject":"assunto","body":"corpo"}}
Para Gmail excluir: {"service":"gmail","action":"trashEmail","params":{"messageId":"ID"}}
Para Gmail marcar lido: {"service":"gmail","action":"markAsRead","params":{"messageId":"ID"}}
Para Calendar criar: {"service":"calendar","action":"createEvent","params":{"title":"título","startTime":"YYYY-MM-DDTHH:MM:00-03:00","endTime":"YYYY-MM-DDTHH:MM:00-03:00","description":""}}
Para Calendar excluir: {"service":"calendar","action":"deleteEvent","params":{"eventId":"ID ou DESCONHECIDO se o usuario não informou um ID. Use o nome do evento com a intenção 'deleteEvent' de qualquer forma"}}
Para Calendar atualizar: {"service":"calendar","action":"updateEvent","params":{"eventId":"ID ou DESCONHECIDO","title":"novo título","startTime":"YYYY-MM-DDTHH:MM:00-03:00","endTime":"YYYY-MM-DDTHH:MM:00-03:00"}}
Para Drive renomear: {"service":"drive","action":"renameFile","params":{"fileId":"ID","newName":"novo nome"}}
Para Drive mover lixeira: {"service":"drive","action":"trashFile","params":{"fileId":"ID"}}
Para Drive criar pasta: {"service":"drive","action":"createFolder","params":{"name":"nome da pasta"}}
Para Sheets escrever: {"service":"sheets","action":"writeRange","params":{"spreadsheetId":"ID","range":"A1","values":[["dado"]]}}
Para Sheets adicionar linhas: {"service":"sheets","action":"appendRows","params":{"spreadsheetId":"ID","range":"A1","values":[["linha"]]}}
Para Docs criar: {"service":"docs","action":"createDocument","params":{"title":"título"}}
Para Docs adicionar texto: {"service":"docs","action":"appendText","params":{"documentId":"ID","text":"texto"}}

Se a mensagem pede para ENVIAR email mas não tem destinatário/assunto, retorne: {"service":"gmail","action":"sendEmail","params":{"to":"DESCONHECIDO","subject":"DESCONHECIDO","body":"DESCONHECIDO"}}
Se a mensagem pede criar evento no calendário, calcule startTime e endTime em ISO 8601 com fuso -03:00.
Retorne apenas o JSON da ação identificada, sem mais texto.`;

    try {
      const extractionMsg = await this.claude.messages.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        max_tokens: 300,
        system: 'Você é um extrator JSON altamente preciso. Responda SEMPRE com apenas JSON válido, sem explicações.',
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      const raw = extractionMsg.content[0]?.type === 'text' ? extractionMsg.content[0].text.trim() : '';
      console.log('[AgenticWrite] Raw LLM response for user msg:', userMessage.substring(0, 50), '...', 'Response:', raw.substring(0, 200)); // DEBUG
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[AgenticWrite] No JSON found, skipping agentic execution');
        return { executed: false, message: '' };
      }

      const action = JSON.parse(jsonMatch[0]);
      console.log('[AgenticWrite] ✅ Extracted action:', JSON.stringify(action));

      // --- GUARD: if critical params are DESCONHECIDO, ask the user ---
      const paramsStr = JSON.stringify(action.params || {});
      if (paramsStr.includes('DESCONHECIDO')) {
        let isPardonable = false;
        if (action.service === 'calendar' && (action.action === 'deleteEvent' || action.action === 'updateEvent')) {
          // It's pardonable to not know the eventId, because the smart matching logic below handles it
          const missingKeys = Object.entries(action.params).filter(([, v]) => typeof v === 'string' && v.includes('DESCONHECIDO')).map(([k]) => k);
          if (missingKeys.every(k => k === 'eventId')) isPardonable = true;
        }

        if (!isPardonable) {
          const missingFields = Object.entries(action.params)
            .filter(([, v]) => typeof v === 'string' && v.includes('DESCONHECIDO'))
            .map(([k]) => k);
          console.log('[AgenticWrite] ⚠️  Missing fields detected:', missingFields);
          return {
            executed: true,
            message: `Para executar essa ação preciso de mais informações. Por favor, informe:\n${missingFields.map(f => `- **${f}**`).join('\n')}`,
          };
        }
      }

      // --- END SMART CALENDAR DELETE (Moved to Heuristic Block) ---

      // --- EXECUTE via WorkspaceActionService (all other actions) ---
      console.log('[AgenticWrite] 🚀 Executing action via WorkspaceActionService:', action.service, action.action);
      const { WorkspaceActionService } = await import('@aria/integrations');
      const actionSvc = new WorkspaceActionService();
      const result = await actionSvc.execute(action);
      console.log('[AgenticWrite] 📊 Action result:', result);

      if (result.success) {
        console.log('[AgenticWrite] ✅ Action succeeded');
        return { executed: true, message: `✅ ${result.message}` };
      } else {
        console.log('[AgenticWrite] ⚠️  Action failed');
        return { executed: true, message: `⚠️ ${result.message}` };
      }

    } catch (err: any) {
      console.error('[AgenticWrite] ❌ ERROR in extraction/execution:', err.message);
      console.error('[AgenticWrite] Stack:', err.stack?.substring(0, 200));
      // Don't block the user — let the LLM handle it as fallback
      return { executed: false, message: '' };
    }
  }

  async * streamResponse(
    userMessage: string,
    sessionId: string,
    userId?: string,
  ): AsyncGenerator<string> {
    const context = await this.contextStore.get(sessionId);

    // --- AGENTIC WRITE: Detecta e executa ações REAIS no Google Workspace ANTES do stream ---
    const agenticResult = await this.tryExecuteWorkspaceWrite(userMessage, context);
    if (agenticResult.executed) {
      yield agenticResult.message;
      await this.contextStore.append(sessionId, { role: 'user', content: userMessage });
      await this.contextStore.append(sessionId, { role: 'assistant', content: agenticResult.message });
      return;
    }
    // --- FIM AGENTIC WRITE ---


    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'long' });
    const dataAtual = formatter.format(now);

    let systemPrompt = `Você é ARIA, um assistente pessoal profissional. Responda sempre em português.
[INFORMAÇÃO TEMPORAL]: Hoje é ${dataAtual}. Use esta data/hora real como base matemática para calcular "hoje", "amanhã" e agendamentos futuros.

Você tem acesso ao Google Workspace do usuário com estas capacidades:
📧 Gmail: ler emails, enviar, responder, mover para lixeira, excluir, marcar como lido/não lido, estrelar, mover entre labels.
📁 Drive: listar/buscar arquivos, renomear, mover, copiar, mover para lixeira, excluir, criar pastas.
📊 Sheets: ler dados de planilhas, escrever em células, acrescentar linhas, limpar intervalos, criar abas.
📄 Docs: ler documentos, adicionar texto no final, substituir texto, criar novo documento.
📝 ClickUp: pesquisar pastas, tarefas, pipelines, mudar status, acessar clientes.
📅 Calendar: ler, criar, editar e excluir eventos da agenda.

REGRA CRÍTICA — DADOS DO GOOGLE WORKSPACE:
- Os dados do Workspace já foram buscados ANTES desta mensagem e aparecem no contexto do sistema.
- NUNCA diga "vou buscar", "estou verificando" ou "deixe-me pesquisar". Os dados já estão aqui.
- Se o contexto diz que não há eventos/emails/arquivos, informe isso DIRETAMENTE ao usuário.
- Se o contexto contém dados reais (eventos, emails, arquivos), use-os diretamente na resposta.
- Jamais invente dados que não estejam no contexto.

REGRA CRÍTICA — AÇÕES DE ESCRITA (Agendar, Enviar, Excluir, Incluir, Editar, etc):
- O sistema já processou e EXECUTOU automaticamente a ação antes desta mensagem chegar aqui.
- Se uma ação foi executada, o resultado já foi enviado diretamente ao usuário. NÃO repita nem simule a ação.
- Se chegou a esta mensagem, é porque a ação não foi necessária — responda normalmente à pergunta do usuário.
- NUNCA simule sucesso de uma ação (ex: "Evento criado!") sem que o sistema tenha confirmado a execução real.`;

    if (userId) {
      const activeClientId = await this.contextStore.getActiveClient(userId);
      if (activeClientId) {
        systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
      }
    }

    if (this.isClickUpQuery(userMessage)) {
      const clickupContext = await this.buildClickUpContext(userMessage);
      if (clickupContext) systemPrompt += clickupContext;
    }

    if (this.isReportQuery(userMessage)) {
      systemPrompt += `\n\n---\n⚠️ DADOS DO SISTEMA DE RELATÓRIOS:\nVocê tem 2 relatórios recentes disponíveis:\n- ID: report_weekly_latest (Período: Última semana, Status: Pronto)\n- ID: report_monthly_latest (Período: Últimos 30 dias, Status: Pronto)\nInforme isso ao usuário se ele perguntar.\n---`;
    }

    if (this.isCalendarQuery(userMessage) || this.isGmailQuery(userMessage) || this.isDriveQuery(userMessage) || this.isSheetsQuery(userMessage) || this.isDocsQuery(userMessage)) {
      const workspaceContext = await this.buildWorkspaceContext(userMessage);
      if (workspaceContext) systemPrompt += workspaceContext;
    }

    // The Claude tools definition is no longer strictly required for Groq because we use Agentic Write (pre-processor)
    // However, if we keep them, the GroqAdapter needs to support `tool_calls` mapping. For now, since Agentic Write handles all actions,
    // we just use Groq for the conversational stream.
    const stream = this.claude.messages.stream({
      model: process.env.GROQ_MODEL || process.env.OPENROUTER_MODEL_DEFAULT || 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        ...context.history.slice(-10).map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullResponse += chunk.delta.text;
        yield chunk.delta.text;
      }
    }

    await this.contextStore.append(sessionId, {
      role: 'user',
      content: userMessage,
    });
    await this.contextStore.append(sessionId, {
      role: 'assistant',
      content: fullResponse,
    });
  }

  /**
   * Process user message and route to appropriate handler
   * Checks if it's a status update request first
     */
  async processMessage(userMessage: string, sessionId: string, userId?: string): Promise<{ type: 'update' | 'response'; result: TaskCreationResponse | string }> {
    // Check if this is a status update request
    if (this.isStatusUpdateQuery(userMessage)) {
      console.log('[ChatService.processMessage] Detected STATUS UPDATE query');
      const updateResponse = await this.handleTaskStatusUpdate({
        text: userMessage,
        sessionId: sessionId,
        userId,
      });

      return { type: 'update', result: updateResponse };
    }

    // Otherwise, treat as normal response
    const response = await this.completeResponse(userMessage, sessionId, userId);
    return { type: 'response', result: response };
  }

  async completeResponse(userMessage: string, sessionId: string, userId?: string): Promise<string> {
    const context = await this.contextStore.get(sessionId);

    // --- AGENTIC WRITE: Detecta e executa ações REAIS no Google Workspace ANTES de fazer a chamada ao modelo ---
    const agenticResult = await this.tryExecuteWorkspaceWrite(userMessage, context);
    if (agenticResult.executed) {
      // If agentic write was successful, include its message in response and save to history
      await this.contextStore.append(sessionId, { role: 'user', content: userMessage });
      await this.contextStore.append(sessionId, { role: 'assistant', content: agenticResult.message });
      return agenticResult.message;
    }

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'long' });
    const dataAtual = formatter.format(now);

    let systemPrompt = `Você é ARIA, um assistente pessoal profissional. Responda sempre em português.\n[INFORMAÇÃO TEMPORAL]: Hoje é ${dataAtual}. Use esta data/hora real como base matemática para calcular dias e agendamentos.`;

    if (userId) {
      const activeClientId = await this.contextStore.getActiveClient(userId);
      if (activeClientId) {
        systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
      }
    }

    // Inject contexts
    if (this.isClickUpQuery(userMessage)) {
      const clickupContext = await this.buildClickUpContext(userMessage);
      if (clickupContext) systemPrompt += clickupContext;
    }

    if (this.isReportQuery(userMessage)) {
      systemPrompt += `\n\n---\n⚠️ DADOS DO SISTEMA DE RELATÓRIOS:\nVocê tem 2 relatórios recentes disponíveis:\n- ID: report_weekly_latest (Período: Última semana, Status: Pronto)\n- ID: report_monthly_latest (Período: Últimos 30 dias, Status: Pronto)\nInforme isso ao usuário se ele perguntar.\n---`;
    }

    if (this.isCalendarQuery(userMessage) || this.isGmailQuery(userMessage) || this.isDriveQuery(userMessage) || this.isSheetsQuery(userMessage) || this.isDocsQuery(userMessage)) {
      const workspaceContext = await this.buildWorkspaceContext(userMessage);
      if (workspaceContext) systemPrompt += workspaceContext;
    }

    // Ações de escrita já tratadas por tryExecuteWorkspaceWrite acima (sem tool calling - compatível com Groq)
    const message = await this.claude.messages.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        ...context.history.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    });

    let response = '';

    for (const block of message.content) {
      if (block.type === 'text') {
        response += block.text;
      }
    }

    await this.contextStore.append(sessionId, {
      role: 'user',
      content: userMessage,
    });
    await this.contextStore.append(sessionId, {
      role: 'assistant',
      content: response,
    });

    return response;
  }

  async handlePlanOfAttackConfirm(sessionId: string, clientPageId: string): Promise<{ pageId: string; notionUrl: string }> {
    const pendingAnalysis = await this.contextStore.getPendingAnalysis(sessionId);

    if (!pendingAnalysis) {
      throw new Error('Nenhuma análise pendente para confirmar. Execute uma análise primeiro.');
    }

    const notionClient = getNotionClient();
    const planService = new PlanOfAttackService(notionClient);

    const pageId = await planService.createPlanPage(
      clientPageId,
      pendingAnalysis
    );

    const notionUrl = planService.formatNotionUrl(pageId);

    // Clear pending analysis after successful creation
    await this.contextStore.clearPendingAnalysis(sessionId);

    return { pageId, notionUrl };
  }

  async handlePropertyUpdateAll(sessionId: string): Promise<string> {
    const pendingConflicts = await this.contextStore.getPendingConflicts(sessionId);

    if (!pendingConflicts) {
      return 'Não há campos pendentes de atualização.';
    }

    const notionClient = getNotionClient();
    const clientProfileService = new ClientProfileService(notionClient);

    const result = await clientProfileService.forceUpdateAll(
      pendingConflicts.pageId,
      pendingConflicts.metadata
    );

    // Clear pending conflicts after update
    await this.contextStore.clearPendingConflicts(sessionId);

    const updatedFields = result.updated.join(', ');
    return `✅ Perfil atualizado com ${result.updated.length} campos: ${updatedFields}`;
  }

  /**
   * Detect if user is trying to update a task status
   */
  private isStatusUpdateQuery(message: string): boolean {
    const lower = message.toLowerCase();
    const updateKeywords = ['altere', 'mude', 'atualize', 'change', 'update', 'modifique', 'troque'];
    const statusKeywords = ['status', 'situação', 'estado'];

    return updateKeywords.some(kw => lower.includes(kw)) &&
      (statusKeywords.some(kw => lower.includes(kw)) ||
        lower.includes('para ') ||
        lower.includes('->'));
  }

  /**
   * Extract task name and new status from message
   */
  private extractStatusUpdate(message: string): { taskName?: string; newStatus?: string } {
    const patterns = [
      /(?:altere|mude|atualize|modifique)\s+(?:o status de\s+)?['\"]?([^'\"]+?)['\"]?\s+(?:para|de)\s+['\"]?([^'\"]+?)['\"]?$/i,
      /['\"]?([^'\"]+?)['\"]?\s+(?:para|->)\s+['\"]?([^'\"]+?)['\"]?$/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          taskName: match[1]?.trim(),
          newStatus: match[2]?.trim(),
        };
      }
    }

    return {};
  }

  /**
   * Parse user text and start task creation flow
   */
  async parseAndCreateTask(request: TaskCreationRequest): Promise<TaskCreationResponse> {
    try {
      // Step 1: Parse task intent from text
      const parser = getTaskIntentParser();
      const parseResult = await parser.parseTaskIntent(request.text);

      // Step 2: Check rate limiting
      const rateLimiter = getRateLimitCoordinator();
      const canProceed = rateLimiter.canProceed('clickup') && rateLimiter.canProceed('notion');

      if (!canProceed) {
        const limitedServices = rateLimiter.getLimitedServices();
        return {
          status: 'error',
          error: `Taxa de requisições excedida para: ${limitedServices.join(', ')}. Aguarde alguns instantes.`,
        };
      }

      // Step 3: Handle incomplete/ambiguous cases
      const ambiguityResolver = new AmbiguityResolver();

      if (parseResult.intent.completeness === 'incomplete') {
        // Ask for basic clarification
        return {
          status: 'pending_clarification',
          clarificationQuestion: parseResult.intent.clarificationNeeded,
          intent: parseResult.intent,
          confidence: parseResult.confidence,
        };
      }

      // Step 4: If clientName provided, use ClientMatcher to find best match
      if (parseResult.intent.clientName) {
        const clientMatcher = getClientMatcher();
        const matches = await clientMatcher.findMatches(parseResult.intent.clientName, 1);

        if (matches.length > 0 && matches[0]!.confidence !== 'low') {
          parseResult.intent.clientId = matches[0]!.client.notionPageId;
        }
      }

      // Step 5: Check for ambiguities in complete/ambiguous intents
      const ambiguityCheck = ambiguityResolver.checkAmbiguity(parseResult.intent);

      if (ambiguityCheck.hasAmbiguity && parseResult.intent.completeness !== 'complete') {
        return {
          status: 'pending_clarification',
          preview: ambiguityCheck.clarificationMessage || 'Informação incompleta',
          clarificationQuestion: ambiguityCheck.clarificationMessage || 'Complete os dados da tarefa',
          intent: parseResult.intent,
          confidence: parseResult.confidence,
        };
      }

      // Step 6: Refine priority with PriorityExtractor
      const priorityExtractor = getPriorityExtractor();
      const priorityResult = priorityExtractor.extractPriority(request.text);
      if (priorityResult.priority !== 'medium') {
        parseResult.intent.priority = priorityResult.priority;
      }

      // Step 7: Store parsed intent in context for confirmation
      await this.contextStore.appendPendingTask(request.sessionId, {
        intent: parseResult.intent,
        confidence: parseResult.confidence,
        preview: parseResult.preview,
      });

      return {
        status: 'preview_ready',
        preview: parseResult.preview,
        intent: parseResult.intent,
        confidence: parseResult.confidence,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido ao processar tarefa';
      return {
        status: 'error',
        error: `Erro ao processar tarefa: ${errorMsg}`,
      };
    }
  }

  /**
   * Handle task status update request
   */
  async handleTaskStatusUpdate(request: TaskCreationRequest): Promise<TaskCreationResponse> {
    try {
      // Extract task name and new status
      const { taskName, newStatus } = this.extractStatusUpdate(request.text);

      if (!taskName || !newStatus) {
        return {
          status: 'error',
          error: 'Não consegui entender qual tarefa mudar e para qual status. Tente: "Altere [tarefa] para [status]"',
        };
      }

      // Get all tasks to find by name
      const qs = this.clickupQueryService || getClickUpQueryService();
      if (!qs) {
        return {
          status: 'error',
          error: 'Serviço ClickUp não disponível.',
        };
      }

      const allTasks = await qs.getMyTasks();
      const matchingTask = allTasks.find((t: any) =>
        t.name.toLowerCase().includes(taskName.toLowerCase()) ||
        taskName.toLowerCase().includes(t.name.toLowerCase())
      );

      if (!matchingTask) {
        return {
          status: 'error',
          error: `Não encontrei nenhuma tarefa com o nome "${taskName}". Tarefas disponíveis: ${allTasks.slice(0, 3).map((t: any) => `"${t.name}"`).join(', ')}...`,
        };
      }

      // Map user-friendly status names to ClickUp status
      const statusMap: Record<string, string> = {
        'concluído': 'concluído',
        'completo': 'concluído',
        'done': 'concluído',
        'finalizado': 'concluído',
        'em andamento': 'em andamento',
        'andando': 'em andamento',
        'in progress': 'em andamento',
        'aguardando': 'aguardando',
        'waiting': 'aguardando',
        'pendente': 'aguardando',
      };

      const normalizedStatus = statusMap[newStatus.toLowerCase()] || newStatus;

      // Store for confirmation
      await this.contextStore.appendPendingTask(request.sessionId, {
        intent: {
          actionType: 'update',
          targetTaskName: matchingTask.name,
          targetTaskId: matchingTask.id,
          updateField: 'status',
          updateValue: normalizedStatus,
          completeness: 'complete',
          rawText: request.text,
        } as any,
        confidence: 0.9,
        preview: `Status de "${matchingTask.name}" será alterado de "${matchingTask.status}" para "${normalizedStatus}"`,
      });

      return {
        status: 'pending_clarification',
        preview: `✅ Encontrei a tarefa "${matchingTask.name}"\n\n📝 Alteração:\n   Status atual: "${matchingTask.status}"\n   Novo status: "${normalizedStatus}"\n\nTem certeza? (sim/não)`,
        clarificationQuestion: 'Confirma a alteração?',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        status: 'error',
        error: `Erro ao processar atualização: ${errorMsg}`,
      };
    }
  }

  /**
   * Confirm and execute task status update
   */
  async confirmAndExecuteStatusUpdate(
    sessionId: string,
    confirmed: boolean,
  ): Promise<TaskCreationResponse> {
    try {
      const pendingTask = await this.contextStore.getPendingTask(sessionId);

      if (!pendingTask) {
        return {
          status: 'error',
          error: 'Nenhuma alteração pendente de confirmação.',
        };
      }

      if (!confirmed) {
        await this.contextStore.clearPendingTask(sessionId);
        return {
          status: 'error',
          error: 'Alteração cancelada.',
        };
      }

      const intent = pendingTask.intent as any;

      if (intent.actionType !== 'update' || !intent.targetTaskId) {
        return {
          status: 'error',
          error: 'Operação inválida.',
        };
      }

      // Execute the update
      const qs = this.clickupQueryService || getClickUpQueryService();
      if (!qs) {
        return {
          status: 'error',
          error: 'Serviço ClickUp não disponível.',
        };
      }

      const result = await qs.updateTaskStatus(intent.targetTaskId, intent.updateValue);

      await this.contextStore.clearPendingTask(sessionId);

      return {
        status: 'created',
        preview: `✅ ${result}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        status: 'error',
        error: `Erro ao atualizar tarefa: ${errorMsg}`,
      };
    }
  }

  /**
   * Confirm pending task and create it
   */
  async confirmAndCreateTask(
    sessionId: string,
    confirmed: boolean,
    clarification?: string
  ): Promise<TaskCreationResponse> {
    try {
      // Get pending task from context
      const pendingTask = await this.contextStore.getPendingTask(sessionId);

      if (!pendingTask) {
        return {
          status: 'error',
          error: 'Nenhuma tarefa pendente para confirmar. Execute uma análise primeiro.',
        };
      }

      if (!confirmed) {
        // Clear pending task if user declined
        await this.contextStore.clearPendingTask(sessionId);
        return {
          status: 'error',
          error: 'Tarefa cancelada pelo usuário.',
        };
      }

      const intent = pendingTask.intent as TaskIntent;

      // Apply clarification if provided
      if (clarification) {
        const ambiguityResolver = new AmbiguityResolver();
        const response = ambiguityResolver.validateConfirmationResponse(clarification);

        if (!response.isValid) {
          return {
            status: 'pending_clarification',
            clarificationQuestion: 'Por favor, responda com "sim", "não" ou a informação solicitada.',
            intent,
          };
        }
      }

      // Record the request for rate limiting
      const rateLimiter = getRateLimitCoordinator();
      const destination = intent.destination || 'both';

      if (destination === 'clickup' || destination === 'both') {
        rateLimiter.recordRequest('clickup');
      }
      if (destination === 'notion' || destination === 'both') {
        rateLimiter.recordRequest('notion');
      }

      // TODO: Create task in ClickUp/Notion
      // This will be implemented in Task 8 (integration with actual services)

      // For now, simulate successful creation
      const taskId = `TASK-${Date.now()}`;
      const notionUrl = `https://notion.so/${taskId}`;

      // Clear pending task after success
      await this.contextStore.clearPendingTask(sessionId);

      return {
        status: 'created',
        taskId,
        notionUrl,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        status: 'error',
        error: `Erro ao criar tarefa: ${errorMsg}`,
      };
    }
  }
}
