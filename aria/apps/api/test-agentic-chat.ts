import fetch from 'node-fetch';

async function testAgenticChat() {
    console.log('Enviando mensagem para ARIA...');

    // Testa o endpoint do Chat para ver se a LLM engatilha a tool de calendar.
    const res = await fetch('http://localhost:3001/api/chat/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: 'Agende uma reunião chamada Teste Agentic AI para amanhã as 15h.',
            sessionId: 'test-agentic-session-123',
            userId: 'test-user'
        })
    });

    if (!res.ok) {
        console.error('Erro HTTP:', res.status, await res.text());
        return;
    }

    // Lê o stream de resposta
    const text = await res.text();
    console.log('\n--- RESPOSTA DA ARIA COM TOOL CALLING ---');
    console.log(text);
    console.log('\n--- FIM ---');

    if (text.includes('[Ação de Sistema via API Executada]')) {
        console.log('✅ TOOL CALLING SUCESSO! A LLM invocou a função autonôma.');
    } else {
        console.log('❌ TOOL CALLING NÃO INVOCADO ou FALHOU. A LLM apenas respondeu texto.');
    }
}

testAgenticChat();
