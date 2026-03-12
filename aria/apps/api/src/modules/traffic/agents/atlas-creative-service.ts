import Groq from 'groq-sdk';
import { DriveService, DriveFile } from '@aria/integrations';



// Supported creative file types by Meta Ads
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/avi',
];

export interface CreativeFile extends DriveFile {
  fileType: 'image' | 'video' | 'unknown';
}

export interface GeneratedCopy {
  primaryText: string;
  title: string;
  description: string;
}

export interface CreativeProposal {
  file: CreativeFile;
  copy: GeneratedCopy;
  reason: string;
}

// ── Drive: list creatives from folder ─────────────────────────────────────────

export async function listCreativesFromDrive(folderId?: string): Promise<CreativeFile[]> {
  const targetFolder = folderId ?? process.env.ATLAS_CREATIVE_DRIVE_FOLDER_ID;
  if (!targetFolder) {
    console.warn('[AtlasCreative] ATLAS_CREATIVE_DRIVE_FOLDER_ID not configured');
    return [];
  }

  try {
    const drive = new DriveService();
    const files = await drive.listFilesInFolder(targetFolder);

    return files
      .filter(f => SUPPORTED_MIME_TYPES.includes(f.mimeType))
      .map(f => ({
        ...f,
        fileType: f.mimeType.startsWith('video/') ? 'video' : f.mimeType.startsWith('image/') ? 'image' : 'unknown',
      } as CreativeFile));
  } catch (err: any) {
    console.error('[AtlasCreative] Error listing Drive files:', err.message);
    return [];
  }
}

// ── LLM: generate copy for a creative ─────────────────────────────────────────

export async function generateCreativeCopy(context: {
  adName: string;
  campaignName?: string;
  productContext?: string;
  reason?: string;
  currentCopy?: string;
  changingElement?: 'full' | 'hook_only';
}): Promise<GeneratedCopy> {
  const { adName, campaignName, productContext, reason, currentCopy, changingElement = 'full' } = context;

  const systemPrompt = `Você é um especialista em copywriting para anúncios Meta (Facebook/Instagram).
Crie copy persuasiva, direta e com foco em conversão.
Siga as restrições de caracteres da Meta:
- Texto principal: máximo 125 caracteres recomendados
- Título: máximo 40 caracteres
- Descrição: máximo 30 caracteres
Responda SOMENTE com JSON válido no formato: {"primaryText": "...", "title": "...", "description": "..."}`;

  const hookNote = changingElement === 'hook_only'
    ? 'IMPORTANTE: Mantenha o corpo do conteúdo similar ao atual, mas reescreva SOMENTE o gancho inicial (primeiras palavras) para ser mais chamativo.'
    : '';

  const userPrompt = `Crie nova copy para o anúncio "${adName}"${campaignName ? ` da campanha "${campaignName}"` : ''}.
${productContext ? `Contexto do produto: ${productContext}` : ''}
${reason ? `Motivo da troca: ${reason}` : ''}
${currentCopy ? `Copy atual (para referência): ${currentCopy}` : ''}
${hookNote}`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    // Extract JSON block if wrapped in markdown
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : raw);

    return {
      primaryText: parsed.primaryText ?? 'Conheça agora e transforme seus resultados.',
      title: parsed.title ?? 'Oferta especial',
      description: parsed.description ?? 'Saiba mais',
    };
  } catch (err: any) {
    console.error('[AtlasCreative] Error generating copy:', err.message);
    return {
      primaryText: 'Conheça agora e transforme seus resultados.',
      title: 'Oferta especial',
      description: 'Saiba mais',
    };
  }
}

// ── Format proposal message for Telegram ──────────────────────────────────────

export function formatCreativeProposalMessage(
  adName: string,
  adId: string,
  file: CreativeFile,
  copy: GeneratedCopy,
  reason: string,
): string {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const fileIcon = file.fileType === 'video' ? '🎬' : '🖼';

  return (
    `🎨 <b>Atlas — Proposta de Rotação de Criativo</b>\n` +
    `📅 ${now}\n\n` +
    `📊 <b>Diagnóstico:</b>\n` +
    `Anúncio: <b>"${adName}"</b> (ID: ${adId})\n` +
    `└ ${reason}\n\n` +
    `${fileIcon} <b>Novo criativo selecionado:</b>\n` +
    `📁 ${file.name}\n` +
    (file.webViewLink ? `🔗 <a href="${file.webViewLink}">Ver no Drive</a>\n` : '') +
    `\n✍️ <b>Copy proposta:</b>\n` +
    `Texto principal: <i>${copy.primaryText}</i>\n` +
    `Título: <i>${copy.title}</i>\n` +
    `Descrição: <i>${copy.description}</i>`
  );
}
