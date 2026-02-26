import { ApifyClient } from 'apify-client';

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
        metrics?: {
            likes: number;
            comments: number;
            views?: number;
        }
    }[];
    metrics?: {
        followers: number;
        following: number;
        posts: number;
    }
}

export class ScoutAgent {
    private client: ApifyClient | null;

    constructor() {
        // Inicializa o Apify apenas se o token existir (senão roda em Mock Mode)
        if (process.env.APIFY_API_TOKEN) {
            this.client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
        } else {
            console.warn("⚠️ APIFY_API_TOKEN não encontrado no .env. ScoutAgent rodará em Mock Mode.");
            this.client = null;
        }
    }

    async analyzeProfile(username: string): Promise<ProfileAnalysis> {
        console.log(`[ScoutAgent] Iniciando Extração para @${username}...`);

        if (!this.client) {
            return this.getMockData(username);
        }

        try {
            console.log(`[ScoutAgent] Chamando Apify Actor (instagram-profile-scraper)...`);

            // Call the official Apify actor. 
            // We use 'apify/instagram-profile-scraper' or 'apify/instagram-scraper'.
            // The profile scraper is faster and cheaper for just getting profile + latest posts.
            const run = await this.client.actor('apify/instagram-profile-scraper').call({
                usernames: [username],
                resultsLimit: 9 // Limit to 9 recent posts to save time/credits
            });

            const { items } = await this.client.dataset(run.defaultDatasetId!).listItems();

            if (!items || items.length === 0) {
                throw new Error(`Nenhum dado retornado do Apify para @${username}`);
            }

            const profile = items[0] as any;

            console.log(`[ScoutAgent] Sucesso! ${profile.followersCount} seguidores e ${profile.latestPosts?.length || 0} posts extraídos.`);

            // Map Apify rich data to our internal representation
            const posts = (profile.latestPosts || []).slice(0, 9).map((p: any, i: number) => ({
                id: i + 1,
                type: p.type === 'Video' ? 'Video' : (p.images ? 'Carousel' : 'Image'),
                caption: p.caption || '',
                visual_desc: `URL da visualização: ${p.displayUrl}`,
                metrics: {
                    likes: p.likesCount || 0,
                    comments: p.commentsCount || 0,
                    views: p.videoPlayCount || p.videoViewCount || 0
                }
            }));

            return {
                username,
                bio: {
                    text: profile.biography || '',
                    links: profile.externalUrl ? [profile.externalUrl] : [],
                    detected_promise: profile.fullName || ''
                },
                highlights: {
                    has_highlights: profile.highlightReelsCount > 0 || profile.hasHighlights,
                    titles: [], // Deep highlight extraction is usually a separate expensive crawler step
                    key_summary: profile.highlightReelsCount ? `${profile.highlightReelsCount} coleções de destaque detectadas.` : 'Sem informações de destaques.'
                },
                recent_posts: posts,
                metrics: {
                    followers: profile.followersCount || 0,
                    following: profile.followsCount || 0,
                    posts: profile.postsCount || 0
                }
            };

        } catch (error) {
            console.error("Scout Apify Error:", error);
            console.log("Voltando para dados mockados (Safe fallback)...");
            return this.getMockData(username);
        }
    }

    private getMockData(username: string): ProfileAnalysis {
        // Return rich mock data so the pipeline development isn't blocked 
        // while waiting for an API token.
        return {
            username,
            bio: {
                text: "🚀 Ajudo você a fechar R$ 100k/mês usando funis invisíveis. Link abaixo 👇",
                links: ["linktr.ee/maverick"],
                detected_promise: "Maverick | Especialista B2B"
            },
            highlights: {
                has_highlights: true,
                titles: ["Resultados", "Mentoria", "O Bastidor"],
                key_summary: "Foco forte em prova social e autoridade através de resultados diários."
            },
            recent_posts: [
                {
                    id: 1, type: 'Carousel',
                    caption: "Não poste conteúdo se você não tem essa estrutura no seu perfil...",
                    visual_desc: "Visual de diagrama de funil simples.",
                    metrics: { likes: 342, comments: 45 }
                },
                {
                    id: 2, type: 'Video',
                    caption: "O erro número 1 de agências tentando escalar...",
                    visual_desc: "Vídeo selfie, ambiente com iluminação dinâmica.",
                    metrics: { likes: 1205, comments: 210, views: 15400 }
                },
                {
                    id: 3, type: 'Image',
                    caption: "Ontem batemos a meta do trimestre. E foi usando apenas DMs autênticas.",
                    visual_desc: "Foto no escritório tomando café.",
                    metrics: { likes: 580, comments: 89 }
                }
            ],
            metrics: {
                followers: 12500,
                following: 340,
                posts: 412
            }
        }
    }
}
