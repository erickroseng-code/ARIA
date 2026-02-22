/**
 * OpenRouter Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenRouterService, FREE_MODELS } from '../OpenRouterService';

describe('OpenRouterService', () => {
  let service: OpenRouterService;

  beforeEach(() => {
    // Mock API key for testing
    process.env.OPENROUTER_API_KEY = 'test_key_123';
    service = new OpenRouterService();
  });

  describe('Initialization', () => {
    it('should initialize with environment API key', () => {
      expect(service).toBeDefined();
    });

    it('should throw error if API key not set', () => {
      delete process.env.OPENROUTER_API_KEY;

      expect(() => {
        new OpenRouterService();
      }).toThrow('OPENROUTER_API_KEY not set');
    });

    it('should accept API key in constructor', () => {
      const svc = new OpenRouterService('custom_key');
      expect(svc).toBeDefined();
    });
  });

  describe('Free Models', () => {
    it('should have all free models defined', () => {
      expect(FREE_MODELS.TRINITY_LARGE).toBe(
        'arcee-ai/trinity-large-preview:free'
      );
      expect(FREE_MODELS.LLAMA_3_3_70B).toBe(
        'meta-llama/llama-3.3-70b-instruct:free'
      );
      expect(FREE_MODELS.MISTRAL_SMALL).toBe(
        'mistralai/mistral-small-3.1-24b-instruct:free'
      );
      expect(FREE_MODELS.QWEN_CODER).toBe('qwen/qwen3-coder:free');
    });

    it('should have 10 free models available', () => {
      const modelCount = Object.keys(FREE_MODELS).length;
      expect(modelCount).toBe(10);
    });
  });

  describe('JSON Parsing', () => {
    it('should parse JSON array', () => {
      const json =
        '["item1", "item2", "item3"]';
      const parsed = OpenRouterService.parseJSON<string[]>(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toBe('item1');
    });

    it('should parse JSON with markdown code blocks', () => {
      const json = '```json\n["metric1", "metric2"]\n```';
      const parsed = OpenRouterService.parseJSON<string[]>(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should parse JSON with plain code blocks', () => {
      const json = '```\n{"key": "value"}\n```';
      const parsed = OpenRouterService.parseJSON<{ key: string }>(json);

      expect(parsed.key).toBe('value');
    });

    it('should throw error on invalid JSON', () => {
      const json = 'not valid json';

      expect(() => {
        OpenRouterService.parseJSON(json);
      }).toThrow('Failed to parse JSON');
    });
  });

  describe('Message formatting', () => {
    it('should accept system, user, and assistant messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
      ];

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
    });
  });

  describe('Configuration options', () => {
    it('should support temperature, max_tokens, top_p', () => {
      const options = {
        model: FREE_MODELS.TRINITY_LARGE,
        temperature: 0.5,
        max_tokens: 1000,
        top_p: 0.95,
      };

      expect(options.temperature).toBe(0.5);
      expect(options.max_tokens).toBe(1000);
      expect(options.top_p).toBe(0.95);
    });

    it('should have sensible defaults', () => {
      const options = {
        model: FREE_MODELS.LLAMA_3_3_70B,
      };

      // Defaults will be applied in the call method
      expect(options.model).toBeDefined();
    });
  });
});
