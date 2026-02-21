/**
 * Document upload guidance messages
 * Provides contextual tips based on document count
 */

export interface DocumentGuidanceContext {
  documentCount: number;
  totalLimit: number;
  label: string;
  fileName: string;
}

export function getDocumentGuidance(context: DocumentGuidanceContext): string {
  const { documentCount, totalLimit, label } = context;
  const remaining = totalLimit - documentCount;

  if (documentCount === 1) {
    return `
🎯 *Ótimo! Primeiro documento enviado*

_Label: ${label}_

📌 *Dicas para melhor análise:*
• Envie documentos de diferentes setores (Comercial, Marketing, RH)
• Inclua relatórios recentes (últimos 3-6 meses)
• Documentos com mais contexto = análise mais completa

📈 Pode enviar até ${totalLimit} documentos no total
    `;
  }

  if (documentCount < totalLimit) {
    const docsLeft = remaining > 1 ? `${remaining} documentos` : "1 documento";
    return `
✅ *Documento ${documentCount} adicionado com sucesso*

_Label: ${label}_

📊 *Progresso: ${documentCount}/${totalLimit} documentos_

${remaining === 1 ? "⏰ *Último documento disponível!*" : `📝 Pode enviar mais ${docsLeft}`}

⏭️ Opções:
• Enviar mais documentos
• **/docs** — Ver documentos acumulados
• **/pronto** — Gerar Plano de Ataque agora
    `;
  }

  // documentCount === totalLimit
  return `
🎉 *PRONTO! ${totalLimit} Documentos Recebidos*

_Label: ${label}_

📊 *Análise está pronta com:*
${Array.from({ length: documentCount }, (_, i) => `  ${i + 1}. ${i === documentCount - 1 ? `${label} ✓` : `Documento ${i + 1}`}`).join('\n')}

🚀 *Próximo passo:*
• **/pronto** — Gerar Plano de Ataque com todos os documentos
• **/docs** — Revisar antes de gerar
• **/cancelar** — Limpar e começar novamente
  `;
}

export function getLimitReachedMessage(): string {
  return `
⚠️ *LIMITE DE 5 DOCUMENTOS ATINGIDO*

Você tem 5 documentos na fila para análise.

🎯 *O que fazer agora?*

✅ **/pronto**
   ↳ Gerar Plano de Ataque com os 5 documentos

🔄 **/cancelar**
   ↳ Limpar documentos e começar nova análise

📋 **/docs**
   ↳ Revisar documentos antes de gerar
  `;
}

export function getDocumentsListMessage(documents: Array<{ label: string; fileName: string }>): string {
  const list = documents
    .map((doc, idx) => `${idx + 1}. *${doc.label}* \`${doc.fileName}\``)
    .join('\n');

  return `
📄 *Documentos Acumulados (${documents.length}/5)*

${list}

🔧 *Opções:*
• Enviar mais documentos
• /pronto — Gerar Plano de Ataque
• /cancelar — Limpar tudo
  `;
}

export function getReadyToGenerateMessage(documents: Array<{ label: string }>): string {
  const docList = documents.map((doc, idx) => `${idx + 1}. ${doc.label}`).join('\n');

  return `
✅ *Documentos Prontos para Análise*

${docList}

🚀 *Gerando Plano de Ataque...*

⏳ Isso pode levar alguns segundos. Aguarde...
  `;
}
