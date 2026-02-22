/**
 * OpenRouter Prompt Templates
 * Task 2: Prompt engineering for report section generation
 * Uses free models from OpenRouter (Trinity, Llama, Mistral, etc.)
 */

import { ReportData } from './ReportDataAggregationService';
import { OpenRouterService, FREE_MODELS } from '../ai/OpenRouterService';

export interface PromptContext {
  reportData: ReportData;
  userId: string;
  generatedAt: Date;
}

/**
 * Task 2.1: Design prompt structure: context → instructions → output format
 */
export class PromptTemplates {
  /**
   * Task 2.2: Generate prompt for Executive Summary
   */
  static generateExecutiveSummaryPrompt(context: PromptContext): string {
    const formatDate = (date: Date) => {
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${month}/${day}/${year}`;
    };

    return `You are a business analyst generating executive summaries from performance data.

## Context
Report Period: ${formatDate(context.reportData.period.start)} to ${formatDate(context.reportData.period.end)}
User: ${context.userId}
Generated: ${context.generatedAt.toISOString()}

## Performance Data
**ClickUp Metrics:**
- Tasks Completed: ${context.reportData.clickup.tasksCompleted}
- Tasks Pending: ${context.reportData.clickup.tasksPending}
- Tasks Overdue: ${context.reportData.clickup.tasksOverdue}
- Tasks Created: ${context.reportData.clickup.tasksCreated}

**Notion Metrics:**
- Active Clients: ${context.reportData.notion.activeClients}
- Plans Created: ${context.reportData.notion.plansCreated}
- Meetings Recorded: ${context.reportData.notion.meetingsRecorded}
- Properties Filled: ${context.reportData.notion.propertiesFilled}
- Property Conflicts: ${context.reportData.notion.propertyConflicts}

**Google Calendar Metrics:**
- Meetings Scheduled: ${context.reportData.calendar.meetingsScheduled}
- Meetings Completed: ${context.reportData.calendar.meetingsCompleted}
- Hours in Meetings: ${context.reportData.calendar.hoursInMeetings}

## Instructions
Write a 2-3 paragraph executive summary that:
1. Provides a high-level overview of the reporting period
2. Highlights key achievements and areas of focus
3. Identifies major trends or changes

Use professional, concise language. Focus on business impact.

## Output Format
Return ONLY the executive summary text (plain text, no markdown, no line breaks except paragraph breaks).`;
  }

  /**
   * Task 2.3: Generate prompt for Key Metrics
   */
  static generateKeyMetricsPrompt(context: PromptContext): string {
    const formatDate = (date: Date) => {
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${month}/${day}/${year}`;
    };

    return `You are a business analyst extracting key metrics from performance data.

## Context
Report Period: ${formatDate(context.reportData.period.start)} to ${formatDate(context.reportData.period.end)}

## Performance Data
**ClickUp Metrics:**
- Tasks Completed: ${context.reportData.clickup.tasksCompleted}
- Tasks Pending: ${context.reportData.clickup.tasksPending}
- Tasks Overdue: ${context.reportData.clickup.tasksOverdue}
- Tasks Created: ${context.reportData.clickup.tasksCreated}

**Notion Metrics:**
- Active Clients: ${context.reportData.notion.activeClients}
- Plans Created: ${context.reportData.notion.plansCreated}
- Meetings Recorded: ${context.reportData.notion.meetingsRecorded}

**Google Calendar Metrics:**
- Meetings Scheduled: ${context.reportData.calendar.meetingsScheduled}
- Meetings Completed: ${context.reportData.calendar.meetingsCompleted}
- Hours in Meetings: ${context.reportData.calendar.hoursInMeetings}

## Instructions
Extract 5-7 key metrics as bullet points. Each metric should:
1. Use a clear label followed by the number
2. Include context (e.g., "completed vs pending", "percentage")
3. Highlight business significance

## Output Format
Return a JSON array of strings (no markdown, just plain text metrics).
Example: ["Metric 1: Value", "Metric 2: Value with context"]`;
  }

  /**
   * Task 2.4: Generate prompt for Insights
   */
  static generateInsightsPrompt(context: PromptContext): string {
    const formatDate = (date: Date) => {
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${month}/${day}/${year}`;
    };

    const completionRate = (
      (context.reportData.clickup.tasksCompleted /
        (context.reportData.clickup.tasksCompleted + context.reportData.clickup.tasksPending)) *
      100
    ).toFixed(1);

    const overduePercentage = (
      (context.reportData.clickup.tasksOverdue / context.reportData.clickup.tasksPending) *
      100
    ).toFixed(1);

    return `You are a business intelligence analyst generating insights from performance data.

## Context
Report Period: ${formatDate(context.reportData.period.start)} to ${formatDate(context.reportData.period.end)}

## Performance Data
**Task Metrics:**
- Completion Rate: ${completionRate}%
- Overdue Rate: ${overduePercentage}%
- Tasks Created: ${context.reportData.clickup.tasksCreated}

**Client Engagement:**
- Active Clients: ${context.reportData.notion.activeClients}
- New Plans: ${context.reportData.notion.plansCreated}
- Meetings: ${context.reportData.calendar.meetingsCompleted}/${context.reportData.calendar.meetingsScheduled}

## Instructions
Identify 3-5 insights that reveal:
1. **Trends**: Patterns in task completion, client engagement, or planning activity
2. **Bottlenecks**: Areas where work is slowing down (high overdue rate, pending tasks)
3. **Opportunities**: Underutilized capacity or growth areas

Each insight should:
- Be specific and data-driven
- Connect to business outcomes
- Suggest actionable areas for improvement

## Output Format
Return a JSON array of strings (insights as plain text, no bullet points).
Example: ["Insight 1: Data-driven observation", "Insight 2: Trend identified"]`;
  }

  /**
   * Task 2.5: Generate prompt for Recommendations
   */
  static generateRecommendationsPrompt(context: PromptContext): string {
    const formatDate = (date: Date) => {
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${month}/${day}/${year}`;
    };

    const pendingRatio = (
      (context.reportData.clickup.tasksPending /
        (context.reportData.clickup.tasksCompleted + context.reportData.clickup.tasksPending)) *
      100
    ).toFixed(1);

    return `You are a business consultant providing actionable recommendations.

## Context
Report Period: ${formatDate(context.reportData.period.start)} to ${formatDate(context.reportData.period.end)}

## Key Findings
- Task Completion Rate: ${100 - parseInt(pendingRatio)}%
- Pending Tasks: ${context.reportData.clickup.tasksPending}
- Active Clients: ${context.reportData.notion.activeClients}
- Meeting Hours: ${context.reportData.calendar.hoursInMeetings}

## Instructions
Generate 3-5 actionable recommendations that:
1. Address identified bottlenecks
2. Capitalize on opportunities
3. Are realistic and implementable
4. Have clear business value

Each recommendation should:
- Start with an action verb
- Be specific (not vague)
- Include expected benefit
- Be prioritized (most important first)

## Output Format
Return a JSON array of strings (recommendations as action items).
Example: ["Action 1: Clear description of what to do and why", "Action 2: Next priority item"]`;
  }

  /**
   * Task 2.6: Implement response parsing (JSON → structured format)
   */
  static parseMetricsResponse(response: string): string[] {
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0);
      }
    } catch (e) {
      // Fallback: split by newline and filter
      return response
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter((line) => line.length > 0);
    }
    return [];
  }

  /**
   * Task 2.6: Parse executive summary response
   */
  static parseSummaryResponse(response: string): string {
    return response.trim();
  }

  /**
   * Task 2.6: Parse insights response
   */
  static parseInsightsResponse(response: string): string[] {
    return this.parseMetricsResponse(response);
  }

  /**
   * Task 2.6: Parse recommendations response
   */
  static parseRecommendationsResponse(response: string): string[] {
    return this.parseMetricsResponse(response);
  }

  /**
   * Utility: Build complete prompt context
   */
  static buildPromptContext(
    reportData: ReportData,
    userId: string,
    generatedAt: Date = new Date()
  ): PromptContext {
    return {
      reportData,
      userId,
      generatedAt,
    };
  }

  /**
   * Task 2 Integration: Call OpenRouter with ExecutiveSummary prompt
   */
  static async generateExecutiveSummaryWithOpenRouter(
    context: PromptContext,
    model: string = FREE_MODELS.TRINITY_LARGE
  ): Promise<string> {
    const service = new OpenRouterService();
    const prompt = this.generateExecutiveSummaryPrompt(context);

    return service.generateSection(
      'You are a business analyst generating executive summaries from performance data.',
      prompt,
      model
    );
  }

  /**
   * Task 2 Integration: Call OpenRouter with KeyMetrics prompt
   */
  static async generateKeyMetricsWithOpenRouter(
    context: PromptContext,
    model: string = FREE_MODELS.LLAMA_3_3_70B
  ): Promise<string[]> {
    const service = new OpenRouterService();
    const prompt = this.generateKeyMetricsPrompt(context);

    const response = await service.generateSection(
      'You are a business analyst extracting key metrics from performance data. Return JSON array only.',
      prompt,
      model
    );

    return this.parseMetricsResponse(response);
  }

  /**
   * Task 2 Integration: Call OpenRouter with Insights prompt
   */
  static async generateInsightsWithOpenRouter(
    context: PromptContext,
    model: string = FREE_MODELS.MISTRAL_SMALL
  ): Promise<string[]> {
    const service = new OpenRouterService();
    const prompt = this.generateInsightsPrompt(context);

    const response = await service.generateSection(
      'You are a business intelligence analyst generating insights from performance data. Return JSON array only.',
      prompt,
      model
    );

    return this.parseInsightsResponse(response);
  }

  /**
   * Task 2 Integration: Call OpenRouter with Recommendations prompt
   */
  static async generateRecommendationsWithOpenRouter(
    context: PromptContext,
    model: string = FREE_MODELS.QWEN_CODER
  ): Promise<string[]> {
    const service = new OpenRouterService();
    const prompt = this.generateRecommendationsPrompt(context);

    const response = await service.generateSection(
      'You are a business consultant providing actionable recommendations. Return JSON array only.',
      prompt,
      model
    );

    return this.parseRecommendationsResponse(response);
  }
}
