import { BrowserService } from './browser';
import * as cheerio from 'cheerio';

export interface ProfileAnalysis {
    username: string;
    bio: {
        text: string;
        links: string[];
        detected_promise: string; 
    };
    highlights: {
        has_highlights: boolean;
        titles: string[];
        key_summary?: string;
    };
    recent_posts: {
        id: number;
        type: 'Image' | 'Video' | 'Carousel';
        caption: string;
        visual_desc: string; 
    }[];
}

export class ScoutAgent {
    private browser: BrowserService;

    constructor() {
        this.browser = new BrowserService({ headless: true }); // Headless for API usage
    }

    async analyzeProfile(username: string): Promise<ProfileAnalysis> {
        const url = `https://www.instagram.com/${username}/`;
        
        try {
            // First attempt: Headless
            await this.browser.init();
            await this.browser.navigateTo(url);

            let content = await this.browser.getPageContent();
            let $ = cheerio.load(content);

            // --- LOGIN DETECTION & RECOVERY ---
            const isLoginPage = $('input[name="username"]').length > 0 || $('title').text().includes('Login');
            
            if (isLoginPage) {
                console.log("⛔ Scout: Login Wall detected! Switching to interactive mode...");
                await this.browser.close();

                // Relaunch Visible
                this.browser.updateOptions({ headless: false });
                await this.browser.init();
                await this.browser.navigateTo(url);

                // Wait for user to login manually
                await this.browser.waitForLoginSuccess();
                
                // Refresh content after login
                content = await this.browser.getPageContent();
                $ = cheerio.load(content);
            }
            // ----------------------------------

            // Check private profile text
            if ($('h2').text().includes('This account is private') || $('body').text().includes('Esta conta é privada')) {
                 console.warn("🔒 Scout: Private Profile detected even after potential login.");
                 // We can still try to return basic info if available (bio often visible)
            }

            // Extract Bio from Meta Tags (safest for public view without login)
            const bioText = $('meta[property="og:description"]').attr('content') || $('div.-vDIg span').text() || '';
            const bioTitle = $('meta[property="og:title"]').attr('content') || ''; 
            
            // Check Highlights presence (heuristic)
            const hasHighlights = $('canvas').length > 0 || $('div[role="menuitem"]').length > 0;

            // Scroll for posts
            await this.browser.autoScroll(2);
            
            const contentAfterScroll = await this.browser.getPageContent();
            const $$ = cheerio.load(contentAfterScroll);
            
            const posts: ProfileAnalysis['recent_posts'] = [];
            
            $$('article img').each((i, el) => {
                if (i >= 9) return; 
                const altText = $$(el).attr('alt') || '';
                
                // Filter out likely profile pics or tiny images
                if (altText.length > 10) {
                    posts.push({
                        id: i + 1,
                        type: 'Image', 
                        caption: altText.substring(0, 150) + "...",
                        visual_desc: "Visual extracted from alt text"
                    });
                }
            });

            await this.browser.close();

            return {
                username,
                bio: {
                    text: bioText,
                    links: [], 
                    detected_promise: bioTitle // Using title as proxy for name/promise
                },
                highlights: {
                    has_highlights: hasHighlights,
                    titles: hasHighlights ? ["Detectados"] : [], 
                    key_summary: hasHighlights ? "Destaques presentes" : "Sem destaques visíveis"
                },
                recent_posts: posts
            };

        } catch (error) {
            console.error("Scout Error:", error);
            await this.browser.close();
            throw error; 
        }
    }
}
