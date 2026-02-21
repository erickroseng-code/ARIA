import Anthropic from '@anthropic-ai/sdk';
import { ClientMetadata } from '@aria/shared';

const claudeClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const METADATA_EXTRACTION_PROMPT = `
Analise o texto a seguir e extraia informações do cliente em formato JSON estrito.
Retorne APENAS os campos que encontrar explicitamente — não invente ou infira.

Campos a extrair:
- responsavel_comercial: nome do responsável pelo setor comercial
- responsavel_marketing: nome do responsável pelo setor de marketing
- segmento: segmento de mercado/nicho da empresa
- metas: array de strings com as principais metas mencionadas
- desafios: array de strings com os principais desafios mencionados

Responda APENAS com JSON válido. Exemplo:
{
  "segmento": "Varejo",
  "metas": ["Aumentar vendas em 30%", "Expandir para novas regiões"]
}

Texto para análise:
---
{analysisText}
---
`;

export class MetadataExtractor {
  static async extractClientMetadata(analysisText: string): Promise<ClientMetadata> {
    try {
      const prompt = METADATA_EXTRACTION_PROMPT.replace('{analysisText}', analysisText);

      const response = await claudeClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        console.warn('Unexpected response type from Claude, returning empty metadata');
        return {};
      }

      // Try to parse the JSON response
      try {
        const textContent = 'text' in content ? content.text : '';
        const metadata = JSON.parse(textContent);
        return metadata as ClientMetadata;
      } catch (_parseError) {
        console.warn('Failed to parse metadata JSON from Claude response');
        return {};
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {};
    }
  }
}
