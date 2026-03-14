import Groq from 'groq-sdk';

const groq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });

const todayBR = () =>
  new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

const currentYear = () => new Date().getFullYear();

// ── Sheets NLP ────────────────────────────────────────────────────────────────

export interface SheetIntent {
  operation: 'read' | 'append';
  /** Name of the spreadsheet as mentioned by the user */
  sheetName: string;
  /** Values to append (in order). null for read ops. */
  values: string[] | null;
  /** Range for read ops. null = use default A1:Z20 */
  range: string | null;
}

export async function parseSheetCommand(text: string): Promise<SheetIntent> {
  const prompt = `Hoje é ${todayBR()} (ano ${currentYear()}). Extraia a intenção de planilha e retorne SOMENTE JSON:
{"operation":"read ou append","sheetName":"nome da planilha","values":["val1","val2"] ou null,"range":"A1:Z20" ou null}

Regras:
- "append" quando o usuário quer adicionar/inserir/registrar/lançar dados
- "read" quando quer ver/consultar/listar dados
- "sheetName": nome da planilha mencionada (sem aspas)
- "values": array na ordem natural para a planilha. Para finanças use ["data DD/MM/AAAA","descrição/categoria","valor"]. Para datas sem ano adicione ${currentYear()}. null se read.
- "range": só preencha se o usuário especificou um range. null caso contrário.

Exemplos:
- "adicione 100,00 no dia 15/03 na planilha Erick Controle Pety" → {"operation":"append","sheetName":"Erick Controle Pety","values":["15/03/${currentYear()}","Sem descrição","100,00"],"range":null}
- "mostra a planilha Vendas" → {"operation":"read","sheetName":"Vendas","values":null,"range":null}
- "lança 89,90 academia 10/03 em Gastos Março" → {"operation":"append","sheetName":"Gastos Março","values":["10/03/${currentYear()}","Academia","89,90"],"range":null}
- "vê as linhas A1:C10 da planilha Budget" → {"operation":"read","sheetName":"Budget","values":null,"range":"A1:C10"}

Usuário: "${text}"
Responda SOMENTE com o JSON.`;

  try {
    const res = await groq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as SheetIntent;
  } catch {
    return { operation: 'read', sheetName: text, values: null, range: null };
  }
}

// ── Calendar NLP ──────────────────────────────────────────────────────────────

export interface CalendarIntent {
  operation: 'list' | 'today' | 'create';
  title?: string;
  /** ISO datetime string (UTC) */
  start?: string;
  /** ISO datetime string (UTC) */
  end?: string;
  description?: string;
}

export async function parseCalendarCommand(text: string): Promise<CalendarIntent> {
  const prompt = `Hoje é ${todayBR()} (ano ${currentYear()}). Fuso horário: America/Sao_Paulo (UTC-3). Extraia intenção de agenda e retorne SOMENTE JSON:
{"operation":"list ou today ou create","title":string ou null,"start":"ISO8601 em UTC" ou null,"end":"ISO8601 em UTC" ou null,"description":string ou null}

Regras:
- "today": ver eventos de hoje
- "list": ver próximos eventos (sem data específica ou "próximos N dias")
- "create": criar evento/reunião/compromisso
- Para datas sem ano assuma ${currentYear()}. Converta horários de BRT (UTC-3) para UTC somando 3h.
- Se só informar hora de início, assuma duração de 1h para o fim.

Exemplos:
- "o que tenho hoje?" → {"operation":"today","title":null,"start":null,"end":null,"description":null}
- "cria reunião amanhã às 14h chamada Sync de time" → {"operation":"create","title":"Sync de time","start":"${currentYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()+1).padStart(2,'0')}T17:00:00Z","end":"${currentYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()+1).padStart(2,'0')}T18:00:00Z","description":null}

Usuário: "${text}"
Responda SOMENTE com o JSON.`;

  try {
    const res = await groq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as CalendarIntent;
  } catch {
    return { operation: 'list' };
  }
}

// ── Email NLP ─────────────────────────────────────────────────────────────────

export interface EmailIntent {
  operation: 'list' | 'unread' | 'search' | 'send';
  query?: string;
  to?: string;
  subject?: string;
  body?: string;
}

export async function parseEmailCommand(text: string): Promise<EmailIntent> {
  const prompt = `Extraia intenção de email e retorne SOMENTE JSON:
{"operation":"list ou unread ou search ou send","query":string ou null,"to":string ou null,"subject":string ou null,"body":string ou null}

Exemplos:
- "mostra meus emails" → {"operation":"list","query":null,"to":null,"subject":null,"body":null}
- "emails não lidos" → {"operation":"unread","query":null,"to":null,"subject":null,"body":null}
- "busca email sobre reunião de marketing" → {"operation":"search","query":"reunião de marketing","to":null,"subject":null,"body":null}
- "envia email pro joao@mail.com sobre Proposta dizendo Segue em anexo nossa proposta" → {"operation":"send","query":null,"to":"joao@mail.com","subject":"Proposta","body":"Segue em anexo nossa proposta"}

Usuário: "${text}"
Responda SOMENTE com o JSON.`;

  try {
    const res = await groq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as EmailIntent;
  } catch {
    return { operation: 'list' };
  }
}

// ── Docs NLP ──────────────────────────────────────────────────────────────────

export interface DocIntent {
  operation: 'read' | 'append';
  /** Name of the document as mentioned by the user */
  docName: string;
  /** Text to append. null for read ops. */
  text: string | null;
}

export async function parseDocCommand(text: string): Promise<DocIntent> {
  const prompt = `Extraia intenção de documento Google Docs e retorne SOMENTE JSON:
{"operation":"read ou append","docName":"nome do documento","text":"texto a adicionar" ou null}

Exemplos:
- "lê o doc Ata de Reunião" → {"operation":"read","docName":"Ata de Reunião","text":null}
- "adiciona ao documento Diário: hoje foi um dia produtivo" → {"operation":"append","docName":"Diário","text":"hoje foi um dia produtivo"}

Usuário: "${text}"
Responda SOMENTE com o JSON.`;

  try {
    const res = await groq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 120,
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as DocIntent;
  } catch {
    return { operation: 'read', docName: text, text: null };
  }
}
