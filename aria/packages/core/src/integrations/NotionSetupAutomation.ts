/**
 * Notion Setup Automation
 * Automatically configure Notion integration using Playwright
 *
 * Usage: npm run setup:notion
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export class NotionSetupAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Step 1: Open Notion Integrations page and create integration
   */
  async createIntegration(): Promise<string> {
    console.log('🔑 Notion Setup Automation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();

    console.log('📱 Abrindo https://www.notion.so/my-integrations...');
    await this.page.goto('https://www.notion.so/my-integrations', {
      waitUntil: 'networkidle',
    });

    console.log('⏳ Aguardando você fazer login (se necessário)...');
    console.log('   Depois clique em "+ New integration"');
    console.log('   Eu vou esperar você clicar...\n');

    // Wait for user to click "New integration" button
    try {
      await this.page.waitForURL(
        (url) => url.toString().includes('/integrations/'),
        { timeout: 60000 }
      );
    } catch {
      console.log('⏱️  Timeout esperando criação de integração');
      return '';
    }

    console.log('✅ Integração criada! Preenchendo formulário...\n');

    // Fill integration form
    await this.fillIntegrationForm();

    console.log('⏳ Aguardando página de confirmação...\n');
    await this.page.waitForTimeout(2000);

    // Get the token from the page
    const token = await this.extractToken();

    if (token) {
      console.log('✅ Token obtido com sucesso!\n');
      await this.saveToken(token);
      return token;
    }

    console.log('❌ Falha ao extrair token');
    return '';
  }

  /**
   * Step 2: Fill integration form automatically
   */
  private async fillIntegrationForm(): Promise<void> {
    if (!this.page) return;

    try {
      // Set integration name
      const nameInput = await this.page.$('input[placeholder*="name" i]');
      if (nameInput) {
        await nameInput.fill('ARIA Report Generation');
        console.log('📝 Nome da integração: ARIA Report Generation');
      }

      // Click Submit
      const submitBtn = await this.page.$(
        'button:has-text("Submit"), button:has-text("Create")'
      );
      if (submitBtn) {
        await submitBtn.click();
        console.log('✓ Formulário enviado');
      }
    } catch (error) {
      console.log(
        '⚠️  Preenchimento manual necessário (campo pode ter mudado)'
      );
    }
  }

  /**
   * Step 3: Extract token from page
   */
  private async extractToken(): Promise<string> {
    if (!this.page) return '';

    try {
      // Look for token input or display
      const tokenElement = await this.page.$(
        'input[value*="secret_"], code, pre, [data-test*="token"]'
      );

      if (tokenElement) {
        const value = await tokenElement.inputValue().catch(() =>
          tokenElement.textContent()
        );
        return (value as string) || '';
      }

      // Alternative: look for any text that starts with "secret_"
      const pageText = await this.page.content();
      const match = pageText.match(/secret_[a-zA-Z0-9_]+/);
      return match ? match[0] : '';
    } catch (error) {
      console.log('⚠️  Erro ao extrair token:', error);
      return '';
    }
  }

  /**
   * Step 4: Save token to .env file
   */
  private async saveToken(token: string): Promise<void> {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, 'utf-8')
      : '';

    let updatedContent = envContent;

    if (updatedContent.includes('NOTION_API_TOKEN=')) {
      // Update existing token
      updatedContent = updatedContent.replace(
        /NOTION_API_TOKEN=.*/,
        `NOTION_API_TOKEN=${token}`
      );
    } else {
      // Add new token
      updatedContent += `\nNOTION_API_TOKEN=${token}\n`;
    }

    fs.writeFileSync(envPath, updatedContent);
    console.log(`💾 Token salvo em ${envPath}`);
    console.log(`   Variável: NOTION_API_TOKEN`);
  }

  /**
   * Step 5: Connect integration to workspace (semi-automated)
   */
  async connectToWorkspace(): Promise<void> {
    if (!this.page) return;

    console.log('\n📌 Próximo passo: Conectar integração ao workspace');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Abra qualquer página no Notion');
    console.log('2. Clique nos 3 pontinhos (...) → Connections');
    console.log('3. Procure por "ARIA Report Generation"');
    console.log('4. Clique em "Connect"');
    console.log('5. Feche o navegador quando terminar\n');

    console.log('⏳ Aguardando...\n');
    await this.page.waitForTimeout(30000); // Wait 30s for user to complete
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Main setup flow
   */
  async setup(): Promise<string> {
    try {
      const token = await this.createIntegration();

      if (token) {
        await this.connectToWorkspace();
      }

      return token;
    } finally {
      await this.cleanup();
    }
  }
}

/**
 * CLI entrypoint
 */
if (require.main === module) {
  const setup = new NotionSetupAutomation();

  setup
    .setup()
    .then((token) => {
      if (token) {
        console.log('✅ Configuração do Notion concluída!');
        console.log(`📌 Token: ${token.substring(0, 20)}...`);
        process.exit(0);
      } else {
        console.log('❌ Configuração falhou');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Erro:', error);
      process.exit(1);
    });
}
