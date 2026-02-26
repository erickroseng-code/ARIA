#!/bin/bash

echo "=================================================="
echo "🔄 ARIA ASSISTENTE - RESTART COMPLETO"
echo "=================================================="
echo ""

echo "[1/4] Matando processos antigos..."
taskkill /IM node.exe /F 2>/dev/null || true
taskkill /IM npm.exe /F 2>/dev/null || true
sleep 2

echo "[2/4] Reconstruindo código..."
cd /c/Users/erick/Projects/aios-core/aria
npm run build 2>&1 | tail -5

echo ""
echo "[3/4] Iniciando servidor..."
cd /c/Users/erick/Projects/aios-core/aria/apps/api
npm run dev &
sleep 8

echo ""
echo "[4/4] Verificando saúde do servidor..."
HEALTH=$(curl -s http://localhost:3001/health)
echo "$HEALTH"

if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo ""
    echo "=================================================="
    echo "✅ SERVIDOR ESTÁ ONLINE E FUNCIONANDO!"
    echo "=================================================="
    echo ""
    echo "🌐 Acesse seu assistente em:"
    echo "   http://localhost:3000"
    echo ""
    echo "📊 Dashboard de saúde:"
    echo "   http://localhost:3001/health"
    echo ""
else
    echo ""
    echo "⚠️  Servidor respondeu mas pode não estar pronto"
    echo "Aguarde 5 segundos e tente novamente..."
fi
