import { BrowserService } from './browser';
import * as cheerio from 'cheerio';

// Interfaces baseadas nas Tasks
export interface ProfileAnalysis {
    username: string;
    stats: {
        followers: string;
        following: string;
        posts_count: string;
    };
    bio: {
        text: string;
        links: string[];
        detected_promise: string; // "O que ele promete"
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
        visual_desc: string; // Descrição simulada
    }[];
}

function parseInstagramStats(ogDesc: string): { followers: string; following: string; posts_count: string } {
    // EN: "1,234,567 Followers, 567 Following, 89 Posts"
    const enMatch = ogDesc.match(/^([\d,.]+[KkMmBb]?)\s+Followers?,\s*([\d,.]+[KkMmBb]?)\s+Following,\s*([\d,.]+[KkMmBb]?)\s+Posts?/i);
    if (enMatch) return { followers: enMatch[1], following: enMatch[2], posts_count: enMatch[3] };

    // PT: "1.234.567 seguidores, 567 seguindo, 89 publicações"
    const ptMatch = ogDesc.match(/^([\d,.]+[KkMmBb]?)\s+seguidores?,\s*([\d,.]+[KkMmBb]?)\s+seguindo,\s*([\d,.]+[KkMmBb]?)\s+publica/i);
    if (ptMatch) return { followers: ptMatch[1], following: ptMatch[2], posts_count: ptMatch[3] };

    return { followers: 'N/D', following: 'N/D', posts_count: 'N/D' };
}

export class ScoutAgent {
    private browser: BrowserService;

    constructor() {
        this.browser = new BrowserService();
    }

    async analyzeProfile(username: string): Promise<ProfileAnalysis> {
        const url = `https://www.instagram.com/${username}/`;
        
        try {
            await this.browser.init();
            await this.browser.navigateTo(url);

            // Extract Bio & Meta
            const content = await this.browser.getPageContent();
            const $ = cheerio.load(content);

            // Check if blocked (Login Page redirect)
            const title = $('title').text();
            if (title.includes('Login') || title.includes('Entrar')) {
                console.error("⛔ Scout: Bloqueio de Login detectado.");
                throw new Error("ACESSO NEGADO: O Instagram exigiu login. Para corrigir: rode 'npx ts-node squads/maverick/src/login-tool.ts', faça login na janela que abrir e tente novamente.");
            }

            // Check private profile text
            if ($('body').text().includes('This account is private') || $('body').text().includes('Esta conta é privada')) {
                 console.error("🔒 Scout: Perfil Privado.");
                 throw new Error(`ACESSO NEGADO: O perfil @${username} é privado. O Scout só pode analisar perfis públicos.`);
            }

            // --- 1. Bio Analysis & Stats ---
            // Note: Classes change dynamically on IG. Using Meta Tags is safer for public profiles.
            const bioText = $('meta[property="og:description"]').attr('content') || '';
            const profileStats = parseInstagramStats(bioText);
            
            // Try to find highlights (class search is brittle, checking for canvas elements usually works for stories)
            const hasHighlights = $('canvas').length > 0 || $('div[role="menuitem"]').length > 0;

            // --- 2. Posts Analysis ---
            await this.browser.autoScroll(2);
            // Re-load content after scroll
            const contentAfterScroll = await this.browser.getPageContent();
            const $$ = cheerio.load(contentAfterScroll);
            
            // Extracting post captions from alt text in images (Instagram puts caption in alt text often)
            const posts: ProfileAnalysis['recent_posts'] = [];
            
            $$('article img').each((i, el) => {
                if (i >= 9) return; // Limit to 9 posts
                const caption = $$(el).attr('alt') || '';
                
                posts.push({
                    id: i + 1,
                    type: 'Image', // Default inference without deeper parsing
                    caption: caption.substring(0, 100) + "...",
                    visual_desc: "Visual content extracted from Image Alt Text"
                });
            });

            await this.browser.close();

            if (posts.length === 0 && !bioText) {
                 throw new Error("FALHA DE LEITURA: Não foi possível extrair dados. O layout da página pode ter mudado ou o IP foi rate-limited.");
            }

            return {
                username,
                stats: {
                    followers: profileStats.followers,
                    following: profileStats.following,
                    posts_count: profileStats.posts_count !== 'N/D' ? profileStats.posts_count : `${posts.length}+`,
                },
                bio: {
                    text: bioText,
                    links: [],
                    detected_promise: this.inferPromise(bioText)
                },
                highlights: {
                    has_highlights: hasHighlights,
                    titles: hasHighlights ? ["Detectado (Títulos ocultos sem login)"] : [],
                    key_summary: "Estrutura de destaques detectada visualmente."
                },
                recent_posts: posts
            };

        } catch (error) {
            console.error("Scout Error:", error);
            await this.browser.close();
            throw error; // Re-throw to be handled by the caller/UI
        }
    }

    // Simple heuristic to guess promise from bio
    private inferPromise(bio: string): string {
        if (bio.toLowerCase().includes("ajudo")) return "Promessa de ajuda direta/mentoria.";
        if (bio.toLowerCase().includes("ensino")) return "Promessa educacional.";
        return "Promessa de marca pessoal/lifestyle.";
    }
}
