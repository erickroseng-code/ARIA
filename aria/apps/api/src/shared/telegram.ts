/**
 * Centralised Telegram messaging utility.
 * Uses HTML parse mode — safe and no special escaping needed for plain text.
 */
export async function sendTelegram(chatId: string | number, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — message not sent');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[Telegram] Failed to send message:', err);
  }
}

/**
 * Send a file buffer as a Telegram document (e.g. PDF, ZIP).
 */
export async function sendTelegramDocument(
  chatId: string | number,
  buffer: Buffer,
  filename: string,
  caption?: string,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — document not sent');
    return;
  }
  try {
    const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('document', new Blob([buffer.buffer as ArrayBuffer], { type: mimeType }), filename);
    if (caption) form.append('caption', caption);
    await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    console.error('[Telegram] Failed to send document:', err);
  }
}
