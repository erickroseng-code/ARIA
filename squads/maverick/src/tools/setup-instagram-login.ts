/**
 * Setup Instagram Login — roda UMA VEZ no terminal para salvar a sessão.
 *
 * Uso:
 *   npx ts-node src/tools/setup-instagram-login.ts
 *
 * O que faz:
 *   1. Abre o Chromium com a pasta de dados do scraper
 *   2. Navega para instagram.com
 *   3. Aguarda você fazer login manualmente
 *   4. Detecta automaticamente quando o feed carregou
 *   5. Salva a sessão e fecha
 *
 * Após isso, o Maverick já usa a sessão salva automaticamente.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as path from 'path';
import * as os from 'os';

chromium.use(StealthPlugin());

const STORAGE_PATH = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'Playwright',
  'instagram-scraper'
);

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  SETUP INSTAGRAM — Login para o Maverick Scraper');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`Pasta de sessão: ${STORAGE_PATH}\n`);
  console.log('Abrindo Chromium...\n');

  const context = await chromium.launchPersistentContext(STORAGE_PATH, {
    headless: false,
    viewport: { width: 1080, height: 900 },
    locale: 'pt-BR',
    args: ['--no-sandbox'], // stealth já remove AutomationControlled
  });

  const [page] = context.pages();
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Verifica se já está logado
  const isAlreadyLogged = await page.evaluate(() => {
    return !document.querySelector('input[name="username"]') &&
           window.location.pathname !== '/accounts/login/';
  });

  if (isAlreadyLogged) {
    console.log('✅ Já logado no Instagram! Sessão válida.\n');
    await context.close();
    process.exit(0);
  }

  console.log('──────────────────────────────────────────────────────');
  console.log('  Faça login no Instagram na janela que abriu.');
  console.log('  Aguardando você entrar no feed...');
  console.log('──────────────────────────────────────────────────────\n');

  // Aguarda o feed carregar (detecta automaticamente após login)
  await page.waitForFunction(
    () => {
      const url = window.location.href;
      return (
        url === 'https://www.instagram.com/' ||
        url.startsWith('https://www.instagram.com/?')
      ) && !document.querySelector('input[name="username"]');
    },
    { timeout: 300_000, polling: 2000 } // aguarda até 5 minutos
  );

  console.log('\n✅ Login detectado! Salvando sessão...');

  // Aguarda um momento para o Instagram salvar os cookies de sessão
  await new Promise(r => setTimeout(r, 3000));

  await context.close();

  // Remove lockfile residual se existir
  const lockfile = path.join(STORAGE_PATH, 'lockfile');
  if (fs.existsSync(lockfile)) fs.unlinkSync(lockfile);

  console.log('✅ Sessão salva com sucesso!');
  console.log('\nO Maverick Scraper já está configurado para usar essa sessão.');
  console.log('Você não precisa fazer isso de novo (a menos que saia do Instagram).\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Erro:', err.message);
  // Tenta remover lockfile mesmo em caso de erro
  const lockfile = path.join(STORAGE_PATH, 'lockfile');
  try { if (fs.existsSync(lockfile)) fs.unlinkSync(lockfile); } catch {}
  process.exit(1);
});
