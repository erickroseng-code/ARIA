import { InstagramScraper } from './instagram.scraper';

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.error('Usage: ts-node src/index.ts <instagram_username>');
    process.exit(1);
  }

  const scraper = new InstagramScraper({
    headless: true, // Mude para false para ver o browser abrindo
    timeout: 30000,
  });

  try {
    console.log(`🚀 [Scout-CLI] Iniciando análise do perfil: ${username}...`);
    const profile = await scraper.scrapeProfile(username);

    if (profile) {
      console.log('✅ [Scout-CLI] Perfil extraído com sucesso:');
      console.log(JSON.stringify(profile, null, 2));
    } else {
      console.error('❌ [Scout-CLI] Falha ao extrair perfil.');
    }

  } catch (error: any) {
    console.error(`💥 [Scout-CLI] Erro fatal: ${error.message}`);
  } finally {
    await scraper.close();
  }
}

// Executa o script se for chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export * from './instagram.scraper';
export * from './types';
