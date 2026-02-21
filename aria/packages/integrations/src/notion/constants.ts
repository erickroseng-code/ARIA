import type { ClientMetadata } from '@aria/shared';

export const CLIENT_PROPERTY_MAP: Record<
  keyof ClientMetadata,
  {
    notionName: string;
    type: 'rich_text' | 'select' | 'multi_select';
  }
> = {
  responsavel_comercial: {
    notionName: 'Responsável Comercial',
    type: 'rich_text',
  },
  responsavel_marketing: {
    notionName: 'Responsável Marketing',
    type: 'rich_text',
  },
  segmento: {
    notionName: 'Segmento',
    type: 'select',
  },
  metas: {
    notionName: 'Metas',
    type: 'rich_text',
  },
  desafios: {
    notionName: 'Desafios',
    type: 'rich_text',
  },
};
