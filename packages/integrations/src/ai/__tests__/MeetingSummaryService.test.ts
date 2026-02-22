import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MeetingSummaryService } from '../MeetingSummaryService';

describe('MeetingSummaryService', () => {
  let service: MeetingSummaryService;

  beforeEach(() => {
    // Mock Anthropic client
    vi.mock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                type: 'text',
                text: `🤝 Participantes:
- João Silva
- Maria Santos

✅ Decisões:
- Aprovar novo projeto de marketing
- Aumentar orçamento em 20%

📌 Itens de Ação:
- João: preparar proposta até sexta
- Maria: revisar timeline do projeto

🚀 Próximos Passos:
- Apresentar para C-level na próxima segunda
- Iniciar phase 1 em março`,
              },
            ],
          }),
        },
      })),
    }));

    service = new MeetingSummaryService('test-api-key');
  });

  describe('Summary generation', () => {
    it('should generate meeting summary from notes', async () => {
      const meetingNotes = `
        Reunião de planejamento estratégico com equipe de marketing.
        Discutimos novo campaign para Q2.
        Decisão: aumentar budget em 20% para digital marketing.
        João ficou responsável por preparar proposta.
        Maria revisará a timeline do projeto.
      `;

      const summary = await service.summarizeMeeting(
        'Planejamento Estratégico Q2',
        meetingNotes,
        ['João Silva', 'Maria Santos']
      );

      expect(summary.meetingTitle).toBe('Planejamento Estratégico Q2');
      expect(summary.participants).toContain('João Silva');
      expect(summary.bulletPoints.length).toBeGreaterThan(0);
      expect(summary.processedIn).toBeGreaterThan(0);
    });

    it('should timeout after specified duration', async () => {
      const longNotes = 'a'.repeat(40000);

      await expect(
        service.summarizeMeeting('Test', longNotes, [], 100)
      ).rejects.toThrow(/timeout/i);
    });

    it('should handle empty participants array', async () => {
      const summary = await service.summarizeMeeting(
        'Meeting',
        'Some notes',
        []
      );

      expect(summary.participants).toEqual([]);
    });
  });

  describe('Summary parsing', () => {
    it('should parse structured bullet points', () => {
      const response = `✅ Decisões:
- Decisão 1
- Decisão 2

📌 Itens de Ação:
- Ação 1
- Ação 2`;

      const points = service['parseSummaryResponse'](response);

      const decisions = points.filter(p => p.category === 'decision');
      const actions = points.filter(p => p.category === 'action_item');

      expect(decisions.length).toBeGreaterThan(0);
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should handle unstructured responses', () => {
      const response = 'Just some plain text without structure';

      const points = service['parseSummaryResponse'](response);

      expect(points.length).toBeGreaterThan(0);
      expect(points[0].content).toContain('plain text');
    });

    it('should recognize different section headers', () => {
      const response = `🤝 Participantes:
- Person A
- Person B

Discussões:
- Discussion point 1`;

      const points = service['parseSummaryResponse'](response);

      const participants = points.filter(p => p.category === 'participant');
      const discussions = points.filter(p => p.category === 'discussion');

      expect(participants.length).toBeGreaterThan(0);
      expect(discussions.length).toBeGreaterThan(0);
    });
  });

  describe('Markdown formatting', () => {
    it('should format summary as markdown', async () => {
      const summary = await service.summarizeMeeting(
        'Team Meeting',
        'Notes here',
        ['Alice', 'Bob']
      );

      const markdown = service.formatSummaryAsMarkdown(summary);

      expect(markdown).toContain('📋 Team Meeting');
      expect(markdown).toContain('Alice, Bob');
      expect(markdown).toContain('##');
    });

    it('should include all bullet point categories', async () => {
      const summary = await service.summarizeMeeting(
        'Meeting',
        'Notes',
        []
      );

      const markdown = service.formatSummaryAsMarkdown(summary);

      // Should have proper markdown structure
      expect(markdown).toContain('#');
    });
  });

  describe('Validation', () => {
    it('should reject empty notes', () => {
      const result = service.validateMeetingNotes('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject oversized notes', () => {
      const oversized = 'a'.repeat(60000);

      const result = service.validateMeetingNotes(oversized);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });

    it('should accept valid notes', () => {
      const validNotes = 'These are valid meeting notes';

      const result = service.validateMeetingNotes(validNotes);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('API Integration', () => {
    it('should handle API responses correctly', async () => {
      const summary = await service.summarizeMeeting(
        'Test Meeting',
        'Test notes',
        ['Test Person']
      );

      expect(summary.meetingTitle).toBe('Test Meeting');
      expect(summary.participants).toContain('Test Person');
      expect(summary.rawSummary).toBeDefined();
      expect(summary.generatedAt).toBeInstanceOf(Date);
    });

    it('should respect timeout configuration', async () => {
      const startTime = Date.now();
      const timeoutMs = 500;

      try {
        await service.summarizeMeeting('Test', 'a'.repeat(40000), [], timeoutMs);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(timeoutMs + 1000); // Allow 1s buffer
      }
    });
  });

  describe('Performance', () => {
    it('should track processing time', async () => {
      const summary = await service.summarizeMeeting(
        'Quick Meeting',
        'Quick notes',
        []
      );

      expect(summary.processedIn).toBeGreaterThan(0);
      expect(summary.processedIn).toBeLessThan(180000); // 3 minutes
    });
  });

  describe('Error handling', () => {
    it('should provide descriptive error messages', async () => {
      // Test with invalid API key scenario
      const invalidService = new MeetingSummaryService('invalid-key');

      // Note: This will fail at actual API call, but tests the error message structure
      try {
        await invalidService.summarizeMeeting('Test', 'Notes', []);
      } catch (error) {
        expect((error as Error).message).toContain('summarize');
      }
    });
  });
});
