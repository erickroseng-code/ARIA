const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const scripts = [
  {
    title: 'IA vs. Trabalho Manual: O Choque do Futuro',
    hook: 'Você está passando horas em tarefas repetitivas enquanto seu concorrente usa IA para multiplicar resultados em tempo recorde — e você nem percebeu.',
    body: 'Você passa horas configurando campanhas, ajustando lances e otimizando criativos, mas o retorno continua pífio. Eu vejo empresário perdendo o sono por causa de planilhas que não param de crescer. O problema não é só o tempo perdido — é que enquanto você está atolado em trabalho manual, seus concorrentes já automatizaram processos inteiros com IA. Eles escalam campanhas sem mexer um dedo, enquanto você ainda batalha com planilhas e relatórios manuais. Abre o seu gerenciador de anúncios agora e veja quantas campanhas você tem pausadas ou com baixo desempenho por falta de otimização manual. Anote esse número. Agora, imagine se você tivesse uma ferramenta que ajustasse automaticamente os lances e otimizasse seus criativos em tempo real. Isso significaria mais conversões e menos desperdício de verba. A estrutura certa de automação tira o peso do trabalho braçal, permitindo que você foque apenas no que realmente importa: criar conteúdo de impacto e escalar o negócio de forma previsível.',
    cta: 'Agora você tem duas escolhas. Pode continuar perdendo tempo precioso em tarefas repetitivas e manter-se atrás da concorrência. Ou pode dar o salto e começar a automatizar seus processos hoje mesmo. Comenta AUTOMAÇÃO e eu te mostro o caminho.',
    technique: 'Future Pacing + Polarização',
    word_count: 268
  },
  {
    title: 'Um Dia na Vida de um Negócio com IA',
    hook: 'Você está passando horas em tarefas repetitivas, enquanto a maioria dos seus concorrentes já automatizou 70% de suas operações.',
    body: 'Eu vejo dono de negócio perdendo o final de semana respondendo qual o preço e me dá dó. Você acorda às sete da manhã no domingo. Abre o celular antes de tomar café. Tem 40 mensagens acumuladas. Você responde uma por uma. No final, 38 te deixam no vácuo. A culpa de você estar escravizado no próprio celular não é sua. As grandes agências de lançamento criaram esse mito de que venda precisa de toque humano porque elas lucram te vendendo equipes de SDR e suporte caríssimas. Você gasta R$ 5.000 por mês só para ter alguém que responde aguarde um minutinho o dia inteiro. E o pior: o cliente fica frustrado esperando. Para o vídeo agora e veja quantas dessas respostas automáticas você já mandou hoje. É exatamente esse desperdício que as empresas de automação resolveram. Em vez de ter uma equipe que só repete o mesmo, você pode ter um sistema que aprende com seus melhores vendedores e replica isso 24 horas por dia. No primeiro mês, você elimina a equipe de suporte. No terceiro mês, nota que os clientes estão mais satisfeitos porque a resposta é instantânea. No sexto mês, você tem uma máquina que escala sozinha.',
    cta: 'Você sabe que automação é essencial. O que falta é saber por onde começar. Nós construímos um diagnóstico personalizado que identifica exatamente onde a automação vai cortar seus custos. Para ter o seu, comenta AUTOMAÇÃO e te mando o link do diagnóstico gratuito.',
    technique: 'Sincronização Neural + Inimigo Comum',
    word_count: 310
  },
  {
    title: 'E se Você Continuar Assim?',
    hook: 'Enquanto seus concorrentes já estão usando IA para gerar 30% mais vendas, você ainda está hesitando. E isso pode custar a sua posição no mercado.',
    body: 'Você acorda todo dia e confere as métricas. Vê que o engajamento caiu novamente e que as vendas não acompanham o esforço. A sensação é de que você está fazendo tudo certo, mas o resultado não aparece. É como se estivesse empurrando uma pedra montanha acima, mas ela sempre rola de volta. A culpa disso não é sua inexperiência ou falta de criatividade. O problema é que você está competindo com quem já domina as ferramentas certas. Pega o celular agora e pesquisa estratégias de marketing com IA. Veja quantos resultados prometem virar o jogo. Não é só buzz. É o que está acontecendo de verdade no mercado. Daqui a 6 meses, se você continuar parado, a diferença será brutal. Seus concorrentes estarão com estratégias refinadas, campanhas otimizadas e tráfego qualificado. Você estará exatamente onde está hoje, só que mais para trás na corrida. É injusto que tenha que lidar com isso. Você trabalha duro, cria conteúdo relevante e mesmo assim sente que está sendo engolido pela concorrência. A verdade é que não é só trabalho duro que resolve. É preciso ter as ferramentas certas e saber usá-las.',
    cta: 'Agora você tem duas escolhas. Pode fechar este Reel e continuar tentando adivinhar como fazer seus anúncios renderem mais. Ou pode começar a usar as ferramentas certas e mudar o jogo. Comenta IA aqui embaixo e eu te mostro o primeiro passo.',
    technique: 'Protagonista Reverso + Stakes',
    word_count: 353
  },
  {
    title: 'Chatbot: O Segredo para Dobrar Conversões',
    hook: 'O que a maioria dos empreendedores digitais ignora sobre chatbots? Eles não apenas economizam horas de trabalho, mas podem dobrar suas conversões sem você precisar fazer nada a mais.',
    body: 'Eu vejo empreendedores digitais passando horas criando conteúdo e fazendo anúncios, mas o que realmente aumenta a conversão é algo que a maioria ignora: chatbots. Você acorda de manhã e já tem dezenas de mensagens no WhatsApp, mas quantas são de gente querendo comprar? Poucas. O resto é gente perdendo tempo seu com perguntas básicas. Abre seu WhatsApp agora e veja quantas dessas mensagens são só perguntas que você responde sempre da mesma forma. Faça um teste: conte quantas mensagens você recebeu hoje que começam com oi, gostaria de saber mais sobre. É um número que te surpreende? Esse é o tempo que você está perdendo. A verdade é que um chatbot bem configurado atende essas perguntas todas sozinho, sem que você precise gastar uma hora do seu dia. No primeiro dia, você vai criar fluxos de resposta automática para as 5 perguntas mais frequentes do seu negócio. Na segunda semana, vai ver que as perguntas repetitivas sumiram. E no final do mês, terá dobrado suas conversões sem ter feito mais nada além de configurar uma vez. Você recupera o tempo perdido e multiplica seus resultados.',
    cta: 'Agora você tem duas escolhas. Pode continuar perdendo tempo respondendo as mesmas perguntas todos os dias, ou pode seguir o caminho inteligente e clicar no link da bio para descobrir como configurar seu chatbot em 5 minutos.',
    technique: 'Expansão Temporal + Bifurcação',
    word_count: 292
  }
];

const ANALYSIS_ID = 'e89985f1-028c-4f24-91a7-4a33b8c2fb7c';

const stmt = db.prepare('UPDATE MaverickAnalysis SET scripts = ? WHERE id = ?');
const result = stmt.run(JSON.stringify(scripts), ANALYSIS_ID);

if (result.changes === 1) {
  console.log('✅ 4 roteiros salvos com sucesso na análise do erickroseng!\n');

  const saved = db.prepare('SELECT username, scripts FROM MaverickAnalysis WHERE id = ?').get(ANALYSIS_ID);
  const parsed = JSON.parse(saved.scripts);
  console.log(`📊 Verificação: ${parsed.length} roteiros salvos para @${saved.username}`);
  parsed.forEach((s, i) => console.log(`  #${i+1}: ${s.title}`));
} else {
  console.log('❌ Nenhum registro atualizado');
}

db.close();
