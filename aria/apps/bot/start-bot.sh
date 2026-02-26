#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Iniciando bot Telegram..."
echo "📝 Logs serão salvos em bot.log"
npm run dev 2>&1 | tee bot.log
