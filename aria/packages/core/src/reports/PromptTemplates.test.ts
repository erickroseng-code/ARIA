/**
 * Prompt Templates Tests
 * Task 2: Prompt generation and response parsing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptTemplates, PromptContext } from './PromptTemplates';
import { ReportData } from './ReportDataAggregationService';

describe('PromptTemplates', () => {
  let context: PromptContext;
  let mockReportData: ReportData;

  beforeEach(() => {
    mockReportData = {
      period: { start: new Date('2026-02-01'), end: new Date('2026-02-28') },
      clickup: {
        tasksCompleted: 25,
        tasksPending: 8,
        tasksOverdue: 2,
        tasksCreated: 15,
      },
      notion: {
        activeClients: 12,
        plansCreated: 4,
        meetingsRecorded: 8,
        propertiesFilled: 45,
        propertyConflicts: 2,
      },
      calendar: {
        meetingsScheduled: 18,
        meetingsCompleted: 15,
        hoursInMeetings: 28.5,
      },
      generatedAt: new Date(),
      cacheExpiresAt: new Date(),
      isPartialData: false,
    };

    context = PromptTemplates.buildPromptContext(mockReportData, 'user123');
  });

  // Task 2.1: Prompt structure tests
  describe('Prompt generation', () => {
    it('should generate executive summary prompt', () => {
      const prompt = PromptTemplates.generateExecutiveSummaryPrompt(context);

      expect(prompt).toContain('executive summary');
      expect(prompt).toContain('ClickUp');
      expect(prompt).toContain('Notion');
      expect(prompt).toContain('Google Calendar');
      expect(prompt).toContain('25'); // tasks completed
    });

    it('should generate key metrics prompt', () => {
      const prompt = PromptTemplates.generateKeyMetricsPrompt(context);

      expect(prompt).toContain('key metrics');
      expect(prompt).toContain('25'); // tasks completed
      expect(prompt).toContain('12'); // active clients
      expect(prompt).toContain('28.5'); // hours in meetings
    });

    it('should generate insights prompt', () => {
      const prompt = PromptTemplates.generateInsightsPrompt(context);

      expect(prompt).toContain('insights');
      expect(prompt).toContain('Completion Rate');
      expect(prompt).toContain('Bottleneck');
      expect(prompt).toContain('Opportunit');
    });

    it('should generate recommendations prompt', () => {
      const prompt = PromptTemplates.generateRecommendationsPrompt(context);

      expect(prompt).toContain('recommendations');
      expect(prompt).toContain('actionable');
      expect(prompt).toContain('action verb');
    });
  });

  // Task 2.2-2.5: Prompt content tests
  describe('Prompt content', () => {
    it('summary prompt should include all metrics', () => {
      const prompt = PromptTemplates.generateExecutiveSummaryPrompt(context);

      // Check metrics presence
      expect(prompt).toContain(`${mockReportData.clickup.tasksCompleted}`);
      expect(prompt).toContain(`${mockReportData.notion.activeClients}`);
      expect(prompt).toContain(`${mockReportData.calendar.hoursInMeetings}`);
    });

    it('metrics prompt should request JSON output', () => {
      const prompt = PromptTemplates.generateKeyMetricsPrompt(context);

      expect(prompt).toContain('JSON array');
    });

    it('insights prompt should mention trends, bottlenecks, opportunities', () => {
      const prompt = PromptTemplates.generateInsightsPrompt(context);

      expect(prompt).toContain('Trends');
      expect(prompt).toContain('Bottleneck');
      expect(prompt).toContain('Opportunit');
    });

    it('recommendations prompt should emphasize actionability', () => {
      const prompt = PromptTemplates.generateRecommendationsPrompt(context);

      expect(prompt).toContain('actionable');
      expect(prompt).toContain('Action');
    });
  });

  // Task 2.6: Response parsing tests
  describe('Response parsing', () => {
    it('should parse JSON array metrics', () => {
      const jsonResponse = '["Metric 1: 25 tasks", "Metric 2: 12 clients"]';
      const parsed = PromptTemplates.parseMetricsResponse(jsonResponse);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0]).toContain('Metric 1');
    });

    it('should parse bullet point metrics', () => {
      const bulletResponse = '- Metric 1: 25 tasks\n- Metric 2: 12 clients\n* Metric 3: 8 items';
      const parsed = PromptTemplates.parseMetricsResponse(bulletResponse);

      expect(parsed.length).toBeGreaterThanOrEqual(3);
      expect(parsed[0]).not.toContain('-');
      expect(parsed[0]).toContain('Metric 1');
    });

    it('should parse plain text metrics', () => {
      const plainResponse = 'Metric 1: 25 tasks\nMetric 2: 12 clients\nMetric 3: 8 items';
      const parsed = PromptTemplates.parseMetricsResponse(plainResponse);

      expect(parsed.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle empty lines in parsing', () => {
      const response = 'Item 1: Value\n\n\nItem 2: Value\n\n';
      const parsed = PromptTemplates.parseMetricsResponse(response);

      expect(parsed.length).toBe(2);
      expect(parsed[0]).toContain('Item 1');
    });

    it('should parse summary response', () => {
      const response = '  \n  Summary text here  \n  ';
      const parsed = PromptTemplates.parseSummaryResponse(response);

      expect(parsed).toBe('Summary text here');
    });

    it('should parse insights response', () => {
      const response = '["Insight 1", "Insight 2", "Insight 3"]';
      const parsed = PromptTemplates.parseInsightsResponse(response);

      expect(parsed.length).toBe(3);
    });

    it('should parse recommendations response', () => {
      const response = '["Do X", "Do Y", "Do Z"]';
      const parsed = PromptTemplates.parseRecommendationsResponse(response);

      expect(parsed.length).toBe(3);
    });
  });

  // Task 2.1: Prompt context building
  describe('Prompt context', () => {
    it('should build complete prompt context', () => {
      const builtContext = PromptTemplates.buildPromptContext(mockReportData, 'user456');

      expect(builtContext.reportData).toBe(mockReportData);
      expect(builtContext.userId).toBe('user456');
      expect(builtContext.generatedAt).toBeInstanceOf(Date);
    });

    it('should include all metrics in context', () => {
      const ctx = PromptTemplates.buildPromptContext(mockReportData, 'user123');

      expect(ctx.reportData.clickup.tasksCompleted).toBe(25);
      expect(ctx.reportData.notion.activeClients).toBe(12);
      expect(ctx.reportData.calendar.hoursInMeetings).toBe(28.5);
    });
  });

  // Task 6: Integration tests for prompts
  describe('Full prompt pipeline', () => {
    it('should generate all prompt types for a single context', () => {
      const summaryPrompt = PromptTemplates.generateExecutiveSummaryPrompt(context);
      const metricsPrompt = PromptTemplates.generateKeyMetricsPrompt(context);
      const insightsPrompt = PromptTemplates.generateInsightsPrompt(context);
      const recsPrompt = PromptTemplates.generateRecommendationsPrompt(context);

      expect(summaryPrompt).toBeDefined();
      expect(metricsPrompt).toBeDefined();
      expect(insightsPrompt).toBeDefined();
      expect(recsPrompt).toBeDefined();

      // All prompts should include the period
      expect(summaryPrompt).toContain('02/01/2026');
      expect(metricsPrompt).toContain('02/01/2026');
      expect(insightsPrompt).toContain('02/01/2026');
      expect(recsPrompt).toContain('02/01/2026');
    });

    it('should handle different report data in prompts', () => {
      const smallData: ReportData = { ...mockReportData, clickup: { ...mockReportData.clickup, tasksCompleted: 5 } };
      const smallContext = PromptTemplates.buildPromptContext(smallData, 'user123');

      const prompt = PromptTemplates.generateKeyMetricsPrompt(smallContext);

      expect(prompt).toContain('5'); // small number
      expect(prompt).not.toContain('25'); // original number
    });
  });
});
