import {
  GmailService,
  CalendarService,
  SheetsService,
  DocsService,
  type GmailMessage,
  type CalendarEvent,
} from '@aria/integrations';

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

// Parse "DD/MM/YYYY HH:mm" or ISO string → Date
function parseDate(raw: string): Date {
  // try ISO first
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  // try dd/mm/yyyy hh:mm
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`);
  }
  throw new Error(`Não consegui entender a data/hora: "${raw}". Use o formato DD/MM/YYYY HH:mm ou ISO.`);
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────

export async function handleEmailCommand(text: string): Promise<string> {
  const gmail = new GmailService();
  const lower = text.toLowerCase().trim();

  // /email enviar <para> | <assunto> | <corpo>
  if (lower.startsWith('enviar ')) {
    const args = text.slice('enviar '.length).split('|').map(s => s.trim());
    if (args.length < 3) {
      return '⚠️ Formato: <code>enviar destinatario@email.com | Assunto | Corpo do email</code>';
    }
    const [to, subject, ...bodyParts] = args;
    const body = bodyParts.join(' | ');
    const id = await gmail.sendEmail({ to, subject, body });
    return `✅ Email enviado com sucesso!\n└ ID: <code>${id}</code>`;
  }

  // /email buscar <query>
  if (lower.startsWith('buscar ')) {
    const query = text.slice('buscar '.length).trim();
    const emails = await gmail.searchEmails(query, 5);
    if (emails.length === 0) return `📭 Nenhum email encontrado para "<b>${query}</b>".`;
    return `🔍 <b>Resultados para "${query}":</b>\n\n` + emails.map(fmtEmail).join('\n\n');
  }

  // /email não lidos
  if (lower === 'não lidos' || lower === 'nao lidos' || lower === 'unread') {
    const emails = await gmail.listRecentEmails(5, true);
    if (emails.length === 0) return '📭 Nenhum email não lido. Caixa limpa! ✨';
    return `📬 <b>Emails não lidos (${emails.length}):</b>\n\n` + emails.map(fmtEmail).join('\n\n');
  }

  // /email (sem argumentos) → 5 mais recentes
  const emails = await gmail.listRecentEmails(5);
  if (emails.length === 0) return '📭 Nenhum email recente encontrado.';
  return `📧 <b>Emails recentes:</b>\n\n` + emails.map(fmtEmail).join('\n\n');
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────

export async function handleAgendaCommand(text: string): Promise<string> {
  const cal = new CalendarService();
  const lower = text.toLowerCase().trim();

  // /agenda criar <título> | <início> | <fim> [| <descrição>]
  if (lower.startsWith('criar ')) {
    const args = text.slice('criar '.length).split('|').map(s => s.trim());
    if (args.length < 3) {
      return '⚠️ Formato: <code>criar Título | DD/MM/YYYY HH:mm | DD/MM/YYYY HH:mm [| Descrição]</code>';
    }
    const [title, startRaw, endRaw, description] = args;
    const start = parseDate(startRaw).toISOString();
    const end   = parseDate(endRaw).toISOString();
    const event = await cal.createEvent(title, start, end, description);
    return `✅ Evento criado!\n└ <b>${event.title}</b>\n└ ${startRaw} → ${endRaw}`;
  }

  // /agenda hoje
  if (lower === 'hoje') {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
    const events = await cal.listEvents(todayStart, todayEnd, 20);
    if (events.length === 0) return '📭 Nenhum evento hoje.';
    return `📅 <b>Agenda de hoje (${events.length} evento${events.length > 1 ? 's' : ''}):</b>\n\n` + events.map(fmtEvent).join('\n\n');
  }

  // /agenda → próximos 7 dias
  const from = new Date();
  const to   = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await cal.listEvents(from, to, 10);
  if (events.length === 0) return '📭 Nenhum evento nos próximos 7 dias.';
  return `📅 <b>Próximos 7 dias (${events.length} evento${events.length > 1 ? 's' : ''}):</b>\n\n` + events.map(fmtEvent).join('\n\n');
}

// ── SHEETS ────────────────────────────────────────────────────────────────────

export async function handlePlanilhaCommand(text: string): Promise<string> {
  const sheets = new SheetsService();
  const parts  = text.trim().split(/\s+/);

  if (parts.length === 0 || !parts[0]) {
    return '⚠️ Informe o ID da planilha: <code>/planilha ID_DA_PLANILHA [range]</code>';
  }

  const id = parts[0];

  // /planilha <ID> adicionar val1 | val2 | ...
  const rest = parts.slice(1).join(' ');
  if (rest.toLowerCase().startsWith('adicionar ')) {
    const rowRaw = rest.slice('adicionar '.length).trim();
    const values = rowRaw.split('|').map(v => v.trim());
    await sheets.appendRows(id, 'A1', [values]);
    return `✅ Linha adicionada!\n└ Valores: ${values.join(' | ')}`;
  }

  // /planilha <ID> [range]  → leitura
  const range = rest || 'A1:Z20';
  const data  = await sheets.readRange(id, range);
  if (!data.values || data.values.length === 0) {
    return `📊 A planilha <code>${id}</code> (${range}) está vazia.`;
  }
  // Format as simple table text (first 20 rows)
  const rows = data.values.slice(0, 20);
  const lines = rows.map(row => row.join('   '));
  return `📊 <b>Planilha</b> <code>${id}</code> — ${range}:\n\n<code>${lines.join('\n')}</code>`;
}

// ── DOCS ─────────────────────────────────────────────────────────────────────

export async function handleDocCommand(text: string): Promise<string> {
  const docs  = new DocsService();
  const parts = text.trim().split(/\s+/);

  if (parts.length === 0 || !parts[0]) {
    return '⚠️ Informe o ID do documento: <code>/doc ID_DO_DOC</code>';
  }

  const id   = parts[0];
  const rest = parts.slice(1).join(' ');

  // /doc <ID> adicionar <texto>
  if (rest.toLowerCase().startsWith('adicionar ')) {
    const appendText = rest.slice('adicionar '.length).trim();
    await docs.appendText(id, '\n' + appendText);
    return `✅ Texto adicionado ao documento!\n└ <i>${appendText.slice(0, 100)}${appendText.length > 100 ? '…' : ''}</i>`;
  }

  // /doc <ID>  → leitura
  const doc = await docs.readDocument(id);
  const preview = (doc.text ?? '').slice(0, 800);
  return `📄 <b>${doc.title ?? 'Documento'}</b>\n\n<i>${preview}${(doc.text?.length ?? 0) > 800 ? '\n… (truncado)' : ''}</i>`;
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
    return handleEmailCommand(args);
  }

  if (lower.startsWith('/agenda') || lower.startsWith('agenda ') || lower === 'agenda') {
    const args = text.replace(/^\/agenda\s*/i, '').replace(/^agenda\s*/i, '').trim();
    return handleAgendaCommand(args);
  }

  if (lower.startsWith('/planilha') || lower.startsWith('planilha ')) {
    const args = text.replace(/^\/planilha\s*/i, '').replace(/^planilha\s*/i, '').trim();
    return handlePlanilhaCommand(args);
  }

  if (lower.startsWith('/doc') || lower.startsWith('doc ') || lower === 'doc') {
    const args = text.replace(/^\/doc\s*/i, '').replace(/^doc\s*/i, '').trim();
    return handleDocCommand(args);
  }

  return (
    `🗂️ <b>Google Workspace — Comandos disponíveis:</b>\n\n` +
    `📧 <b>Email</b>\n` +
    `  <code>/email</code> — últimos 5 emails\n` +
    `  <code>/email não lidos</code> — apenas não lidos\n` +
    `  <code>/email buscar query</code> — busca\n` +
    `  <code>/email enviar dest@email.com | Assunto | Corpo</code>\n\n` +
    `📅 <b>Agenda</b>\n` +
    `  <code>/agenda</code> — próximos 7 dias\n` +
    `  <code>/agenda hoje</code> — só hoje\n` +
    `  <code>/agenda criar Título | DD/MM HH:mm | DD/MM HH:mm</code>\n\n` +
    `📊 <b>Planilha</b>\n` +
    `  <code>/planilha ID</code> — lê A1:Z20\n` +
    `  <code>/planilha ID [range]</code> — lê range específico\n` +
    `  <code>/planilha ID adicionar val1 | val2</code> — adiciona linha\n\n` +
    `📄 <b>Documento</b>\n` +
    `  <code>/doc ID</code> — lê conteúdo\n` +
    `  <code>/doc ID adicionar texto</code> — faz append`
  );
}
