import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const config = dotenv.parse(fs.readFileSync(envPath));
    for (const k in config) process.env[k] = config[k];
}

export interface PostMetrics {
    likes: number;
    comments: number;
    views?: number;
    engagement_rate: number; // (likes + comments) / followers * 100
}

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
        metrics?: PostMetrics;
    }[];
    engagement_summary?: {
        avg_engagement_rate: number;
        best_format: string;
        top_post_id: number;
        worst_post_id: number;
    };
}

export class ScoutAgent {
    private client: ApifyClient;

    constructor() {
        const token = process.env.APIFY_API_TOKEN;
        if (!token) throw new Error('APIFY_API_TOKEN não encontrado no .env');
        this.client = new ApifyClient({ token });
    }

    async analyzeProfile(username: string): Promise<ProfileAnalysis> {
        const run = await this.client.actor('apify/instagram-profile-scraper').call({
            usernames: [username],
            resultsLimit: 12,
        });

        const { items } = await this.client.dataset(run.defaultDatasetId!).listItems();

        if (!items || items.length === 0) {
            throw new Error(`Nenhum dado retornado do Apify para @${username}. Perfil pode ser privado ou inexistente.`);
        }

        const profile = items[0] as any;
        const followers = profile.followersCount || 0;

        const posts = (profile.latestPosts || []).slice(0, 12).map((p: any, i: number) => {
            const likes = p.likesCount || 0;
            const comments = p.commentsCount || 0;
            const engagement_rate = followers > 0
                ? parseFloat(((likes + comments) / followers * 100).toFixed(2))
                : 0;

            return {
                id: i + 1,
                type: (p.type === 'Video' ? 'Video' : p.images?.length > 1 ? 'Carousel' : 'Image') as 'Image' | 'Video' | 'Carousel',
                caption: (p.caption || '').substring(0, 300),
                visual_desc: p.displayUrl ? `Imagem: ${p.displayUrl}` : 'Visual não disponível',
                metrics: { likes, comments, views: p.videoPlayCount || p.videoViewCount, engagement_rate },
            };
        });

        const engagement_summary = this.computeEngagementSummary(posts, followers);

        return {
            username: profile.username || username,
            stats: {
                followers: (followers as number).toLocaleString('pt-BR'),
                following: (profile.followsCount || 0).toLocaleString('pt-BR'),
                posts_count: (profile.postsCount || posts.length).toLocaleString('pt-BR'),
            },
            bio: {
                text: profile.biography || '',
                links: profile.externalUrl ? [profile.externalUrl] : [],
                detected_promise: this.inferPromise(profile.biography || ''),
            },
            highlights: {
                has_highlights: (profile.highlightReelsCount || 0) > 0,
                titles: [],
                key_summary: profile.highlightReelsCount
                    ? `${profile.highlightReelsCount} coleções de destaques detectadas.`
                    : 'Sem destaques detectados.',
            },
            recent_posts: posts,
            engagement_summary,
        };
    }

    private computeEngagementSummary(
        posts: ProfileAnalysis['recent_posts'],
        followers: number,
    ): ProfileAnalysis['engagement_summary'] {
        if (posts.length === 0 || followers === 0) return undefined;

        const withMetrics = posts.filter(p => p.metrics);
        if (withMetrics.length === 0) return undefined;

        const avg = withMetrics.reduce((sum, p) => sum + (p.metrics!.engagement_rate), 0) / withMetrics.length;

        // Best format by avg engagement
        const byFormat: Record<string, number[]> = {};
        for (const p of withMetrics) {
            if (!byFormat[p.type]) byFormat[p.type] = [];
            byFormat[p.type].push(p.metrics!.engagement_rate);
        }
        const formatAvgs = Object.entries(byFormat).map(([fmt, rates]) => ({
            fmt,
            avg: rates.reduce((a, b) => a + b, 0) / rates.length,
        }));
        const best_format = formatAvgs.sort((a, b) => b.avg - a.avg)[0]?.fmt || 'Image';

        const sorted = [...withMetrics].sort((a, b) => b.metrics!.engagement_rate - a.metrics!.engagement_rate);

        return {
            avg_engagement_rate: parseFloat(avg.toFixed(2)),
            best_format,
            top_post_id: sorted[0].id,
            worst_post_id: sorted[sorted.length - 1].id,
        };
    }

    private inferPromise(bio: string): string {
        const b = bio.toLowerCase();
        if (b.includes('ajudo')) return 'Promessa de ajuda direta/mentoria.';
        if (b.includes('ensino')) return 'Promessa educacional.';
        if (b.includes('vendas') || b.includes('fatur')) return 'Promessa de resultado financeiro.';
        return 'Marca pessoal/lifestyle.';
    }
}
