import fastifyHelmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export async function registerHelmetPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyHelmet, {
    // CSP desativado intencionalmente: a API é consumida por SPAs que definem seu próprio CSP.
    // Habilite aqui se o servidor servir HTML/páginas diretamente.
    contentSecurityPolicy: false,
    // Permite que a API responda a requests cross-origin (necessário para SPAs em domínios diferentes)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Isola a janela de navegação para prevenir ataques Spectre
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  });
}
