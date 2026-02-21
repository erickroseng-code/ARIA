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
        // Default path relative to the package root if not provided
        const defaultSessionDir = path.resolve(__dirname, '../../.aios/browser-session');
        
        // Ensure directory exists
        if (!fs.existsSync(defaultSessionDir)) {
            fs.mkdirSync(defaultSessionDir, { recursive: true });
        }

        this.options = {
            sessionDir: options.sessionDir || defaultSessionDir,
            headless: options.headless !== undefined ? options.headless : true
        };
    }

    async init() {
        if (!this.browser) {
            const isHeadless = this.options.headless ? "new" : false;
            console.log(`🧭 Scout: Launching Browser (Headless: ${isHeadless}, Session: ${this.options.sessionDir})...`);
            
            this.browser = await puppeteer.launch({
                headless: isHeadless as any, 
                userDataDir: this.options.sessionDir,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--window-size=1280,800',
                    '--disable-notifications'
                ]
            });
            
            // Re-use the first page if available (often created by default) or create new
            const pages = await this.browser.pages();
            this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
            
            // Set User Agent to appear as a standard Mac Desktop User
            await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Set Viewport
            await this.page.setViewport({ width: 1280, height: 800 });
        }
    }

    async navigateTo(url: string) {
        if (!this.page) await this.init();
        console.log(`🧭 Scout: Navigating to ${url}...`);
        
        // Human-like navigation: Go to URL and wait for network idle
        await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Random wait to simulate "looking around"
        await this.randomWait(1000, 3000);
    }

    async getPageContent(): Promise<string> {
        if (!this.page) return '';
        return await this.page.content();
    }

    // Simulate human scrolling to load dynamic content (posts)
    async autoScroll(scrollAmount: number = 3) {
        if (!this.page) return;
        console.log("compass Scout: Scrolling down to see more posts...");

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

                    // Scroll logic
                    if (totalHeight >= scrollHeight || scrolls >= maxScrolls * 10) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        }, scrollAmount);
    }

    // Utility for random delays
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

    // Helper to extract data via selector
    async extractText(selector: string): Promise<string | null> {
        if (!this.page) return null;
        try {
            return await this.page.$eval(selector, el => el.textContent?.trim() || null);
        } catch (e) {
            return null; // Selector not found
        }
    }

    async extractAttribute(selector: string, attribute: string): Promise<string | null> {
        if (!this.page) return null;
        try {
            return await this.page.$eval(selector, (el, attr) => el.getAttribute(attr as string), attribute);
        } catch (e) {
            return null;
        }
    }
}
