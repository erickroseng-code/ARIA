/**
 * Telegram MarkdownV2 response templates
 * All special characters must be escaped: . ! - ( ) [ ] { } + = | # > ~ \ * _ ` ~
 */

export const WELCOME_MESSAGE = `Olá\\! Eu sou *ARIA*\\.

Sou seu assistente pessoal profissional, sempre pronto para ajudar você a:
• 📋 Gerenciar tarefas e projetos
• 📅 Organizar sua agenda
• 📊 Analisar documentos
• 💬 Responder suas dúvidas

Use /help para conhecer meus comandos\\.`;

export const HELP_MESSAGE = `*Comandos Disponíveis:*

/start \\- Mensagem de boas\\-vindas
/help \\- Este menu de ajuda
/status \\- Seu status atual

*Como usar:*
Envie uma mensagem qualquer e responderei com a melhor resposta possível\\.`;

export const ERROR_MESSAGE = `Desculpe, ocorreu um erro ao processar sua mensagem\\. Tente novamente mais tarde\\.`;

/**
 * Escape MarkdownV2 special characters
 */
export function escapeMarkdownV2(text: string): string {
  const specialChars = ['.', '!', '-', '(', ')', '[', ']', '{', '}', '+', '=', '|', '#', '>', '~', '\\', '*', '_', '`'];
  let escaped = text;
  specialChars.forEach((char) => {
    escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  });
  return escaped;
}
