import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock factory that returns a constructor
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();

  class MockAnthropic {
    messages = {
      create: mockCreate,
    };
  }

  return {
    default: MockAnthropic,
  };
});

// Now import after the mock is set up
import { MetadataExtractor } from '../MetadataExtractor';
import Anthropic from '@anthropic-ai/sdk';

describe('MetadataExtractor', () => {
  let mockCreate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the mock's create method
    const mockAnthropic = new (Anthropic as any)();
    mockCreate = mockAnthropic.messages.create;
  });

  it('should extract client metadata from analysis text', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            segmento: 'Varejo',
            metas: ['Aumentar vendas em 30%', 'Expandir para novas regiões'],
            responsavel_comercial: 'João Silva',
          }),
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const analysisText = `
      Empresa: Varejo Moda
      Responsável Comercial: João Silva
      Metas principais: Aumentar vendas em 30%, Expandir para novas regiões
    `;

    const metadata = await MetadataExtractor.extractClientMetadata(analysisText);

    expect(metadata.segmento).toBe('Varejo');
    expect(metadata.metas).toEqual(['Aumentar vendas em 30%', 'Expandir para novas regiões']);
    expect(metadata.responsavel_comercial).toBe('João Silva');
  });

  it('should return partial metadata when only some fields are found', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            segmento: 'Tecnologia',
          }),
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const metadata = await MetadataExtractor.extractClientMetadata('Some text');

    expect(metadata.segmento).toBe('Tecnologia');
    expect(metadata.responsavel_comercial).toBeUndefined();
  });

  it('should return empty object on JSON parsing error', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Invalid JSON {not valid}',
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const metadata = await MetadataExtractor.extractClientMetadata('Some text');

    expect(metadata).toEqual({});
  });

  it('should return empty object on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API Error'));

    const metadata = await MetadataExtractor.extractClientMetadata('Some text');

    expect(metadata).toEqual({});
  });

  it('should handle non-text response content', async () => {
    const mockResponse = {
      content: [
        {
          type: 'image',
          image: {},
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const metadata = await MetadataExtractor.extractClientMetadata('Some text');

    expect(metadata).toEqual({});
  });
});
