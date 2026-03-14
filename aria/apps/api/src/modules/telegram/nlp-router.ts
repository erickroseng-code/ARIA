import Groq from 'groq-sdk';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NlpAgent = 'atlas' | 'graham' | 'workspace_email' | 'workspace_agenda' | 'workspace_planilha' | 'workspace_doc' | 'aria';

export interface NlpIntent {
  agent: NlpAgent;
  /** Refined command text to pass to the handler */
  command: string;
  /** Whether the AI was confident about the intent */
  confident: boolean;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o roteador de intenção da IA ARIA. Sua tarefa é classificar a mensagem do usuário e retornar SOMENTE um JSON válido no formato:
{"agent": "<agente>", "command": "<texto refinado>"}

Agentes disponíveis:
- "atlas": tráfego pago, Meta Ads, campanhas, anúncios, CTR, CPC, ROAS, orçamento, criativo, performance
- "graham": finanças pessoais, gastos, saldo, orçamento pessoal, extrato, despesas, receitas
- "workspace_email": emails, Gmail, caixa de entrada, mensagens recebidas, enviar email
- "workspace_agenda": agenda, Google Calendar, eventos, reuniões, compromissos, horários, calendário
- "workspace_planilha": planilhas, Google Sheets, tabelas, dados, células
- "workspace_doc": documentos, Google Docs, textos, relatórios para ler ou editar
- "aria": qualquer coisa que não se encaixe acima, conversas gerais, dúvidas

Para o campo "command", reescreva a intenção do usuário em inglês simples ou português claro adaptado ao contexto do agente. Exemplos:
- "mostra meus emails" → {"agent": "workspace_email", "command": ""}
- "quero ver meus emails não lidos" → {"agent": "workspace_email", "command": "não lidos"}
- "agenda de amanhã" → {"agent": "workspace_agenda", "command": "amanhã"}
- "como estão minhas campanhas do Meta?" → {"agent": "atlas", "command": "como estão minhas campanhas?"}
- "gastei R$200 no supermercado" → {"agent": "graham", "command": "gastei R$200 no supermercado"}
- "lê o doc 1AbCdEf" → {"agent": "workspace_doc", "command": "1AbCdEf"}
- "oi tudo bem" → {"agent": "aria", "command": "oi tudo bem"}

Responda SOMENTE com o JSON, sem explicações.`;

// ── Main Router Function ───────────────────────────────────────────────────────

export async function routeByNlp(userText: string): Promise<NlpIntent> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      temperature: 0.1,
      max_tokens: 80,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const jsonMatch = raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : raw);

    const agent = parsed.agent as NlpAgent;
    const validAgents: NlpAgent[] = ['atlas', 'graham', 'workspace_email', 'workspace_agenda', 'workspace_planilha', 'workspace_doc', 'aria'];

    return {
      agent: validAgents.includes(agent) ? agent : 'aria',
      command: parsed.command ?? userText,
      confident: true,
    };
  } catch {
    // Fallback graceful: treat as aria
    return { agent: 'aria', command: userText, confident: false };
  }
}

// ── Audio Transcription (Groq Whisper) ────────────────────────────────────────

/**
 * Downloads a Telegram voice message and transcribes it with Groq Whisper.
 * @param fileId Telegram file_id from message.voice.file_id
 * @param botToken Telegram bot token
 * @returns Transcribed text
 */
export async function transcribeVoice(fileId: string, botToken: string): Promise<string> {
  // 1. Get file path from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json() as any;
  if (!fileData.ok) throw new Error('Telegram getFile falhou: ' + JSON.stringify(fileData));

  const filePath = fileData.result.file_path;

  // 2. Download the OGG/MP4 audio
  const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!audioRes.ok) throw new Error('Download do áudio falhou');

  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  // 3. Transcribe with Groq Whisper
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Groq SDK accepts a File-like object: use a Blob with filename
  const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
  const file = new File([blob], 'voice.ogg', { type: 'audio/ogg' });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language: 'pt',
    response_format: 'text',
  });

  return (transcription as unknown as string).trim();
}
