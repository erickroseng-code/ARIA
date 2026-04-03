import 'dotenv/config';
import Groq from 'groq-sdk';

const campaigns = [
  { adName: '[ENG][CAÇA-AOS-OVOS][1-2-1] — Campanha 04', reason: 'Fadiga de criativo: CTR abaixo de 1%, alta frequência' },
  { adName: '[SR][CONVR][ABERTO][MAR]', reason: 'Taxa de conversas iniciadas estagnada, fatigue detectado' },
  { adName: '[ENG][PROMODEZ][1-2-1] - Campanha 01', reason: 'Queda de CTR após 3 semanas, criativo possivelmente esgotado' },
];

async function main() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  for (const c of campaigns) {
    const systemPrompt = `Você é um especialista em copywriting para anúncios Meta (Facebook/Instagram).
Crie copy persuasiva, direta e com foco em conversão.
Siga as restrições: Texto principal: máximo 125 caracteres. Título: máximo 40 caracteres. Descrição: máximo 30 caracteres.
Responda SOMENTE com JSON válido no formato: {"primaryText": "...", "title": "...", "description": "..."}`;

    const userPrompt = `Crie nova copy para o anúncio "${c.adName}".
Motivo da troca: ${c.reason}
Este é um anúncio de engajamento e conversação via mensagens (WhatsApp/Messenger) para uma empresa chamada Pety Paio.`;

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 256,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : raw);
      
      console.log(`\n📢 Anúncio: ${c.adName}`);
      console.log(`   Motivo: ${c.reason}`);
      console.log(`   ✍️ Texto Principal: ${parsed.primaryText}`);
      console.log(`   📌 Título:          ${parsed.title}`);
      console.log(`   ℹ️ Descrição:        ${parsed.description}`);
    } catch(err: any) {
      console.error(`Erro ao gerar copy para ${c.adName}:`, err.message);
    }
  }
}

main();
