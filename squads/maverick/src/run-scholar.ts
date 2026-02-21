import { ScholarEngine } from './scholar/engine';

async function main() {
    const query = process.argv[2] || 'segredo engajamento';
    console.log(`📚 Pergunta ao Scholar: "${query}"`);

    const scholar = new ScholarEngine();
    await scholar.loadKnowledgeBase(); // Lê o manifesto.txt

    const results = scholar.search(query);

    console.log("
--- 💡 Respostas Encontradas ---");
    if (results.length === 0) {
        console.log("Nenhum conhecimento relevante encontrado para este termo.");
    } else {
        results.forEach((r, i) => {
            console.log(`
[${i + 1}] (Fonte: ${r.source})`);
            console.log(`"${r.content}"`);
        });
    }
}

main();
