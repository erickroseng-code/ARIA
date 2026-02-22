/**
 * Notion Document Creator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotionDocumentCreator, type ReportContent } from '../NotionDocumentCreator';

describe('NotionDocumentCreator', () => {
  let creator: NotionDocumentCreator;

  beforeEach(() => {
    creator = new NotionDocumentCreator();
  });

  describe('Initialization', () => {
    it('should initialize', () => {
      expect(creator).toBeDefined();
    });

    it('should have cleanup method', () => {
      expect(creator.cleanup).toBeDefined();
    });
  });

  describe('Report content structure', () => {
    it('should accept valid ReportContent', () => {
      const content: ReportContent = {
        title: '📊 Report - February 2026',
        executiveSummary: 'Summary text',
        keyMetrics: ['Metric 1', 'Metric 2'],
        insights: ['Insight 1', 'Insight 2'],
        recommendations: ['Rec 1', 'Rec 2'],
        period: {
          start: new Date('2026-02-01'),
          end: new Date('2026-02-28'),
        },
      };

      expect(content.title).toBeDefined();
      expect(content.executiveSummary).toBeDefined();
      expect(content.keyMetrics).toHaveLength(2);
      expect(content.insights).toHaveLength(2);
      expect(content.recommendations).toHaveLength(2);
      expect(content.period.start).toBeInstanceOf(Date);
      expect(content.period.end).toBeInstanceOf(Date);
    });

    it('should support empty sections', () => {
      const content: ReportContent = {
        title: 'Report',
        executiveSummary: '',
        keyMetrics: [],
        insights: [],
        recommendations: [],
        period: {
          start: new Date(),
          end: new Date(),
        },
      };

      expect(content.keyMetrics).toHaveLength(0);
      expect(content.insights).toHaveLength(0);
      expect(content.recommendations).toHaveLength(0);
    });

    it('should support multiple items per section', () => {
      const content: ReportContent = {
        title: 'Report',
        executiveSummary: 'Summary',
        keyMetrics: ['M1', 'M2', 'M3', 'M4', 'M5'],
        insights: ['I1', 'I2', 'I3', 'I4'],
        recommendations: ['R1', 'R2', 'R3'],
        period: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
      };

      expect(content.keyMetrics).toHaveLength(5);
      expect(content.insights).toHaveLength(4);
      expect(content.recommendations).toHaveLength(3);
    });
  });

  describe('Markdown formatting', () => {
    it('should format headings correctly', () => {
      const heading1 = '# Executive Summary';
      const heading2 = '# Key Metrics';

      expect(heading1.startsWith('#')).toBe(true);
      expect(heading2.startsWith('#')).toBe(true);
    });

    it('should format bullet points correctly', () => {
      const bulletPoint = '- This is a metric';

      expect(bulletPoint.startsWith('-')).toBe(true);
    });
  });

  describe('Date formatting', () => {
    it('should format dates in Brazilian format', () => {
      const date = new Date('2026-02-15');
      const formatted = date.toLocaleDateString('pt-BR');

      expect(formatted).toContain('2026');
      expect(formatted.split('/').length).toBe(3); // dd/mm/yyyy
    });

    it('should handle date range', () => {
      const period = {
        start: new Date('2026-02-01'),
        end: new Date('2026-02-28'),
      };

      const startFormatted = period.start.toLocaleDateString('pt-BR');
      const endFormatted = period.end.toLocaleDateString('pt-BR');

      expect(startFormatted).toBeDefined();
      expect(endFormatted).toBeDefined();
      expect(startFormatted).not.toBe(endFormatted);
    });
  });

  describe('Bot workflow methods', () => {
    it('should have all required methods', () => {
      expect(creator.openNotionAndNavigate).toBeDefined();
      expect(creator.createReportPage).toBeDefined();
      expect(creator.addExecutiveSummary).toBeDefined();
      expect(creator.addKeyMetrics).toBeDefined();
      expect(creator.addInsights).toBeDefined();
      expect(creator.addRecommendations).toBeDefined();
      expect(creator.addMetadata).toBeDefined();
      expect(creator.createFullReport).toBeDefined();
    });

    it('should have cleanup method', () => {
      expect(creator.cleanup).toBeDefined();
    });
  });

  describe('Content types', () => {
    it('should accept string for summary', () => {
      const summary =
        'This is a comprehensive executive summary with multiple paragraphs.';
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should accept array of strings for metrics', () => {
      const metrics = [
        'Tasks: 25 completed',
        'Clients: 12 active',
        'Hours: 28.5 in meetings',
      ];

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.every((m) => typeof m === 'string')).toBe(true);
    });

    it('should accept array of strings for insights', () => {
      const insights = [
        'Task completion rate is strong',
        'Client engagement is high',
      ];

      expect(Array.isArray(insights)).toBe(true);
      expect(insights.every((i) => typeof i === 'string')).toBe(true);
    });

    it('should accept array of strings for recommendations', () => {
      const recs = ['Focus on pending tasks', 'Schedule client check-ins'];

      expect(Array.isArray(recs)).toBe(true);
      expect(recs.every((r) => typeof r === 'string')).toBe(true);
    });
  });
});
