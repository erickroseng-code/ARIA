import { bot } from './bot';

// Error handling
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start bot with better logging
console.log('🤖 Iniciando bot Telegram...');
console.log('⏳ Conectando ao servidor do Telegram...');

try {
  // Start polling
  bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: () => {
      console.log('✅ Bot iniciado com sucesso!');
      console.log('📱 Esperando mensagens... (polling ativo)');
    },
  });
} catch (error) {
  console.error('❌ Erro ao iniciar bot:', error);
  process.exit(1);
}
