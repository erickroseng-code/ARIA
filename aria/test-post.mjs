const body = JSON.stringify({ content: "exclua Test Event DirectAPI 2 de amanhã na minha agenda", sessionId: "test-delete" });

fetch('http://localhost:3001/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
}).then(async res => {
    const text = await res.text();
    console.log(text);
}).catch(console.error);
