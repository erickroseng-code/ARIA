import {
  GmailService,
  CalendarService,
  SheetsService,
  DocsService,
  DriveService,
  type GmailMessage,
  type CalendarEvent,
} from '@aria/integrations';
import {
  parseSheetCommand,
  parseCalendarCommand,
  parseEmailCommand,
  parseDocCommand,
} from './workspace-nlp';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEmail(e: GmailMessage, idx: number): string {
  const unread = e.unread ? '🔵 ' : '';
  return `${unread}<b>${idx + 1}. ${e.subject || '(sem assunto)'}</b>\n` +
    `└ De: ${e.from}\n` +
    `└ ${e.date}\n` +
    `└ <i>${e.snippet?.slice(0, 120)}${(e.snippet?.length ?? 0) > 120 ? '…' : ''}</i>`;
}

function fmtEvent(e: CalendarEvent, idx: number): string {
  const start = e.startTime ? new Date(e.startTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';
  const end   = e.endTime   ? new Date(e.endTime).toLocaleString('pt-BR',   { timeZone: 'America/Sao_Paulo', timeStyle: 'short' }) : '';
  return `📅 <b>${idx + 1}. ${e.title || '(sem título)'}</b>\n└ ${start}${end ? ` → ${end}` : ''}${e.description ? `\n└ <i>${e.description.slice(0, 80)}</i>` : ''}`;
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────

export async function handleEmailCommand(text: string): Promise<string> {
  const gmail = new GmailService();

  // Use NLP to extract intent
  const intent = await parseEmailCommand(text);

  if (intent.operation === 'send') {
    if (!intent.to || !intent.subject || !intent.body) {
      return '⚠️ Para enviar um email preciso de: destinatário, assunto e corpo.\n\nExemplo: <i>envia email pro joao@mail.com sobre Proposta dizendo Segue o orçamento</i>';
    }
    const id = await gmail.sendEmail({ to: intent.to, subject: intent.subject, body: intent.body });
    return `✅ Email enviado!\n└ Para: ${intent.to}\n└ Assunto: ${intent.subject}\n└ ID: <code>${id}</code>`;
  }

  if (intent.operation === 'search' && intent.query) {
    const emails = await gmail.searchEmails(intent.query, 5);
    if (emails.length === 0) return `📭 Nenhum email encontrado para "<b>${intent.query}</b>".`;
    return `🔍 <b>Resultados para "${intent.query}":</b>\n\n` + emails.map(fmtEmail).join('\n\n');
  }

  if (intent.operation === 'unread') {
    const emails = await gmail.listRecentEmails(5, true);
    if (emails.length === 0) return '📭 Nenhum email não lido. Caixa limpa! ✨';
    return `📬 <b>Emails não lidos (${emails.length}):</b>\n\n` + emails.map(fmtEmail).join('\n\n');
  }

  // list (default)
  const emails = await gmail.listRecentEmails(5);
  if (emails.length === 0) return '📭 Nenhum email recente encontrado.';
  return `📧 <b>Emails recentes:</b>\n\n` + emails.map(fmtEmail).join('\n\n');
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────

export async function handleAgendaCommand(text: string): Promise<string> {
  const cal = new CalendarService();

  // Use NLP to extract intent
  const intent = await parseCalendarCommand(text);

  if (intent.operation === 'create') {
    if (!intent.title || !intent.start || !intent.end) {
      return '⚠️ Para criar um evento preciso de: título, data/hora de início e fim.\n\nExemplo: <i>cria reunião Sync de time amanhã às 14h até 15h</i>';
    }
    const event = await cal.createEvent(intent.title, intent.start, intent.end, intent.description);
    const startFmt = new Date(intent.start).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    const endFmt   = new Date(intent.end).toLocaleString('pt-BR',   { timeZone: 'America/Sao_Paulo', timeStyle: 'short' });
    return `✅ Evento criado!\n└ <b>${event.title}</b>\n└ ${startFmt} → ${endFmt}`;
  }

  if (intent.operation === 'today') {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const events = await cal.listEvents(todayStart, todayEnd, 20);
    if (events.length === 0) return '📭 Nenhum evento hoje.';
    return `📅 <b>Agenda de hoje (${events.length} evento${events.length > 1 ? 's' : ''}):</b>\n\n` + events.map(fmtEvent).join('\n\n');
  }

  // list (próximos 7 dias)
  const from = new Date();
  const to   = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await cal.listEvents(from, to, 10);
  if (events.length === 0) return '📭 Nenhum evento nos próximos 7 dias.';
  return `📅 <b>Próximos 7 dias (${events.length} evento${events.length > 1 ? 's' : ''}):</b>\n\n` + events.map(fmtEvent).join('\n\n');
}

// ── SHEETS ────────────────────────────────────────────────────────────────────

export async function handlePlanilhaCommand(text: string): Promise<string> {
  // Use NLP to extract intent
  const intent = await parseSheetCommand(text);
  const sheets = new SheetsService();
  const drive  = new DriveService();

  // Search for spreadsheet by name via Drive
  const files = await drive.searchByName(intent.sheetName, 'application/vnd.google-apps.spreadsheet');

  if (files.length === 0) {
    return `⚠️ Não encontrei nenhuma planilha com o nome "<b>${intent.sheetName}</b>" no Drive.\n\nVerifique o nome ou use o ID diretamente: <code>planilha ID_DA_PLANILHA</code>`;
  }

  const spreadsheetId    = files[0].id;
  const spreadsheetTitle = files[0].name;

  // Warn if multiple sheets found
  const multiWarning = files.length > 1
    ? `\n⚠️ Encontrei ${files.length} planilhas com esse nome. Usando a mais recente: "<b>${spreadsheetTitle}</b>".`
    : '';

  if (intent.operation === 'append' && intent.values && intent.values.length > 0) {
    await sheets.appendRows(spreadsheetId, 'A1', [intent.values]);
    return `✅ Linha adicionada em "<b>${spreadsheetTitle}</b>"!${multiWarning}\n└ Valores: ${intent.values.join(' | ')}`;
  }

  // read
  const range = intent.range || 'A1:Z20';
  const data  = await sheets.readRange(spreadsheetId, range);
  if (!data.values || data.values.length === 0) {
    return `📊 A planilha "<b>${spreadsheetTitle}</b>" (${range}) está vazia.${multiWarning}`;
  }
  const rows  = data.values.slice(0, 20);
  const lines = rows.map(row => row.join('   '));
  return `📊 <b>${spreadsheetTitle}</b> — ${range}:${multiWarning}\n\n<code>${lines.join('\n')}</code>`;
}

// ── DOCS ─────────────────────────────────────────────────────────────────────

export async function handleDocCommand(text: string): Promise<string> {
  // Use NLP to extract intent
  const intent = await parseDocCommand(text);
  const docs   = new DocsService();
  const drive  = new DriveService();

  // Search for document by name via Drive
  const files = await drive.searchByName(intent.docName, 'application/vnd.google-apps.document');

  if (files.length === 0) {
    return `⚠️ Não encontrei nenhum documento com o nome "<b>${intent.docName}</b>" no Drive.\n\nUse o ID diretamente: <code>doc ID_DO_DOC</code>`;
  }

  const docId    = files[0].id;
  const docTitle = files[0].name;

  if (intent.operation === 'append' && intent.text) {
    await docs.appendText(docId, '\n' + intent.text);
    return `✅ Texto adicionado ao documento "<b>${docTitle}</b>"!\n└ <i>${intent.text.slice(0, 100)}${intent.text.length > 100 ? '…' : ''}</i>`;
  }

  // read
  const doc     = await docs.readDocument(docId);
  const preview = (doc.text ?? '').slice(0, 800);
  return `📄 <b>${doc.title ?? docTitle}</b>\n\n<i>${preview}${(doc.text?.length ?? 0) > 800 ? '\n… (truncado)' : ''}</i>`;
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Main entry point: routes Workspace-mode messages.
 * Returns the response string to be sent to Telegram.
 */
export async function handleWorkspaceMessage(text: string): Promise<string> {
  const lower = text.toLowerCase().trim();

  if (lower.startsWith('/email') || lower.startsWith('email ') || lower === 'email') {
    const args = text.replace(/^\/email\s*/i, '').replace(/^email\s*/i, '').trim();
    return handleEmailCommand(args || text);
  }

  if (lower.startsWith('/agenda') || lower.startsWith('agenda ') || lower === 'agenda') {
    const args = text.replace(/^\/agenda\s*/i, '').replace(/^agenda\s*/i, '').trim();
    return handleAgendaCommand(args || text);
  }

  if (lower.startsWith('/planilha') || lower.startsWith('planilha ')) {
    const args = text.replace(/^\/planilha\s*/i, '').replace(/^planilha\s*/i, '').trim();
    return handlePlanilhaCommand(args || text);
  }

  if (lower.startsWith('/doc') || lower.startsWith('doc ') || lower === 'doc') {
    const args = text.replace(/^\/doc\s*/i, '').replace(/^doc\s*/i, '').trim();
    return handleDocCommand(args || text);
  }

  // Fallback: try NLP to detect which workspace tool the user wants
  // (handles cases where the NLP router sends natural language without prefix)
  const lowerFull = lower;
  if (lowerFull.includes('email') || lowerFull.includes('gmail') || lowerFull.includes('mensagem')) {
    return handleEmailCommand(text);
  }
  if (lowerFull.includes('agenda') || lowerFull.includes('calend') || lowerFull.includes('evento') || lowerFull.includes('reunião')) {
    return handleAgendaCommand(text);
  }
  if (lowerFull.includes('planilha') || lowerFull.includes('sheet') || lowerFull.includes('tabela')) {
    return handlePlanilhaCommand(text);
  }
  if (lowerFull.includes('doc') || lowerFull.includes('documento')) {
    return handleDocCommand(text);
  }

  return (
    `🗂️ <b>Google Workspace</b>\n\n` +
    `Você pode falar naturalmente! Exemplos:\n\n` +
    `📧 <i>"mostra meus emails não lidos"</i>\n` +
    `📅 <i>"o que tenho hoje na agenda?"</i>\n` +
    `📊 <i>"adiciona 150,00 em 15/03 na planilha Controle"</i>\n` +
    `📄 <i>"lê o documento Ata de Reunião"</i>`
  );
}
