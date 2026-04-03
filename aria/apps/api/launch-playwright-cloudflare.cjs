const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext('C:/Users/erick/.playwright-cloudflare', {
    headless: false,
    args: ['--start-maximized'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://dash.cloudflare.com/', { waitUntil: 'domcontentloaded' });
  console.log('PLAYWRIGHT_CLOUDFLARE_READY');

  // Keep browser session alive for manual login and follow-up automation.
  await new Promise(() => {});
})();
