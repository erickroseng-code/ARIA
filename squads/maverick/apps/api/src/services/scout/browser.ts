import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

interface BrowserOptions {
    sessionDir?: string;
    headless?: boolean;
}

export class BrowserService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private options: BrowserOptions;

    constructor(options: BrowserOptions = {}) {
        const defaultSessionDir = path.resolve(__dirname, '../../../.aios/browser-session');
        
        if (!fs.existsSync(defaultSessionDir)) {
            fs.mkdirSync(defaultSessionDir, { recursive: true });
        }

        this.options = {
            sessionDir: options.sessionDir || defaultSessionDir,
            headless: options.headless !== undefined ? options.headless : true // Headless by default for API
        };
    }

    updateOptions(newOptions: Partial<BrowserOptions>) {
        this.options = { ...this.options, ...newOptions };
    }

    async waitForLoginSuccess() {
        if (!this.page) return;
        console.log("🧭 Scout: Waiting for user to log in...");
        try {
            // Wait for standard Instagram logged-in elements (Home icon, Search, etc.)
            // We look for multiple possible selectors that indicate a valid session
            await this.page.waitForSelector('svg[aria-label="Página inicial"], svg[aria-label="Home"], a[href="/"]', { timeout: 300000 }); // 5 minutes to login
            console.log("🧭 Scout: Login detected! Resuming...");
            await this.randomWait(2000, 4000); // Wait for animations to settle
        } catch (e) {
            console.warn("🧭 Scout: Login wait timed out or failed.");
            throw new Error("Timeout aguardando login do usuário.");
        }
    }

    async init() {
        if (!this.browser) {
            console.log(`🧭 Scout: Launching Browser (Headless: ${this.options.headless}, Session: ${this.options.sessionDir})...`);
            
            this.browser = await puppeteer.launch({
                headless: this.options.headless, // 'new' is default now
                userDataDir: this.options.sessionDir,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--window-size=1280,800',
                    '--disable-notifications'
                ]
            });
            
            const pages = await this.browser.pages();
            this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
            
            await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await this.page.setViewport({ width: 1280, height: 800 });
        }
    }

    async navigateTo(url: string) {
        if (!this.page) await this.init();
        console.log(`🧭 Scout: Navigating to ${url}...`);
        
        try {
            await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await this.randomWait(1000, 3000);
        } catch (e) {
            console.warn(`🧭 Scout Warning: Navigation timeout or error on ${url}. Proceeding anyway.`);
        }
    }

    async getPageContent(): Promise<string> {
        if (!this.page) return '';
        return await this.page.content();
    }

    async autoScroll(scrollAmount: number = 3) {
        if (!this.page) return;
        console.log("🧭 Scout: Scrolling down...");

        await this.page.evaluate(async (maxScrolls) => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let distance = 100;
                let scrolls = 0;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    scrolls++;

                    if (totalHeight >= scrollHeight || scrolls >= maxScrolls * 10) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        }, scrollAmount);
    }

    async randomWait(min: number, max: number) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(r => setTimeout(r, delay));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log("🧭 Scout: Browser closed.");
        }
    }
}
