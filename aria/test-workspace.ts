import 'dotenv/config';
import { handleEmailCommand, handleAgendaCommand } from './apps/api/src/modules/telegram/workspace-handler';

async function main() {
  console.log('\n━━━ 📧 GMAIL — Últimos 5 emails ━━━');
  try {
    const emailResult = await handleEmailCommand('');
    console.log(emailResult.replace(/<[^>]+>/g, '').slice(0, 600));
  } catch (err: any) {
    console.error('❌ Gmail falhou:', err.message);
  }

  console.log('\n━━━ 📅 CALENDAR — Próximos 7 dias ━━━');
  try {
    const calResult = await handleAgendaCommand('');
    console.log(calResult.replace(/<[^>]+>/g, '').slice(0, 600));
  } catch (err: any) {
    console.error('❌ Calendar falhou:', err.message);
  }
}

main();
