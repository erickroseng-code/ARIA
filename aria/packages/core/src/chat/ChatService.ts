import Anthropic from '@anthropic-ai/sdk';
import { ContextStore } from './ContextStore';
import { PlanOfAttackService } from '../clients/PlanOfAttackService';
import { getNotionClient, ClientProfileService, getClickUpQueryService } from '@aria/integrations';
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

  /**
   * Fetch ClickUp context and format it for injection into the system prompt.
   */
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
      console.error('[ChatService.buildClickUpContext] ClickUp context fetch failed:', err);
      return '';
    }
  }

  async *streamResponse(
    userMessage: string,
    sessionId: string,
    userId?: string,
  ): AsyncGenerator<string> {
    const context = await this.contextStore.get(sessionId);
    let systemPrompt = 'Você é ARIA, um assistente pessoal profissional. Responda sempre em português.';

    if (userId) {
      const activeClientId = await this.contextStore.getActiveClient(userId);
      if (activeClientId) {
        systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
      }
    }

    // Inject live ClickUp data when the user asks about tasks/clients
    if (this.isClickUpQuery(userMessage)) {
      const clickupContext = await this.buildClickUpContext(userMessage);
      if (clickupContext) systemPrompt += clickupContext;
    }

    const stream = this.claude.messages.stream({
      model: process.env.OPENROUTER_MODEL_DEFAULT || 'meta-llama/llama-3.3-70b-instruct:free',
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

  async completeResponse(userMessage: string, sessionId: string, userId?: string): Promise<string> {
    const context = await this.contextStore.get(sessionId);
    let systemPrompt = 'Você é ARIA, um assistente pessoal profissional. Responda sempre em português.';

    if (userId) {
      const activeClientId = await this.contextStore.getActiveClient(userId);
      if (activeClientId) {
        systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
      }
    }

    const message = await this.claude.messages.create({
      model: process.env.OPENROUTER_MODEL_DEFAULT || 'meta-llama/llama-3.3-70b-instruct:free',
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

    const response =
      message.content[0]?.type === 'text' && 'text' in message.content[0]
        ? message.content[0].text
        : '';

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
