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
