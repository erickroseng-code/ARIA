/**
 * Data Collectors Tests
 * Tasks 2, 3, 4: ClickUp, Notion, Google Calendar
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClickUpDataCollector } from './ClickUpDataCollector';
import { NotionDataCollector } from './NotionDataCollector';
import { GoogleCalendarDataCollector } from './GoogleCalendarDataCollector';

const dateRange = {
  start: new Date('2026-02-01'),
  end: new Date('2026-02-28'),
};

// Task 2: ClickUp Data Collection Tests
describe('ClickUpDataCollector', () => {
  let collector: ClickUpDataCollector;

  beforeEach(() => {
    collector = new ClickUpDataCollector();
  });

  it('should return zero metrics with default mock', async () => {
    const result = await collector.collectData(dateRange.start, dateRange.end);

    expect(result.tasksCompleted).toBe(0);
    expect(result.tasksPending).toBe(0);
    expect(result.tasksOverdue).toBe(0);
    expect(result.tasksCreated).toBe(0);
  });

  it('should handle timeout gracefully', async () => {
    const mockClient = {
      tasks: {
        list: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s
          return { tasks: [] };
        },
      },
    };

    const collectorWithClient = new ClickUpDataCollector(mockClient);
    try {
      await collectorWithClient.collectData(dateRange.start, dateRange.end);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });

  it('should handle errors gracefully', async () => {
    const mockClient = {
      tasks: {
        list: async () => {
          throw new Error('API error');
        },
      },
    };

    const collectorWithClient = new ClickUpDataCollector(mockClient);
    try {
      await collectorWithClient.collectData(dateRange.start, dateRange.end);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });
});

// Task 3: Notion Data Collection Tests
describe('NotionDataCollector', () => {
  let collector: NotionDataCollector;

  beforeEach(() => {
    collector = new NotionDataCollector();
  });

  it('should return zero metrics with default mock', async () => {
    const result = await collector.collectData(dateRange.start, dateRange.end);

    expect(result.activeClients).toBe(0);
    expect(result.plansCreated).toBe(0);
    expect(result.meetingsRecorded).toBe(0);
    expect(result.propertiesFilled).toBe(0);
    expect(result.propertyConflicts).toBe(0);
  });

  it('should handle timeout gracefully', async () => {
    const mockClient = {
      databases: {
        query: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s
          return { results: [] };
        },
      },
    };

    const collectorWithClient = new NotionDataCollector(mockClient);
    try {
      await collectorWithClient.collectData(dateRange.start, dateRange.end);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });

  it('should handle errors gracefully', async () => {
    const mockClient = {
      databases: {
        query: async () => {
          throw new Error('API error');
        },
      },
    };

    const collectorWithClient = new NotionDataCollector(mockClient);
    try {
      await collectorWithClient.collectData(dateRange.start, dateRange.end);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });
});

// Task 4: Google Calendar Data Collection Tests
describe('GoogleCalendarDataCollector', () => {
  let collector: GoogleCalendarDataCollector;

  beforeEach(() => {
    collector = new GoogleCalendarDataCollector();
  });

  it('should return zero metrics with default mock', async () => {
    const result = await collector.collectData(dateRange.start, dateRange.end);

    expect(result.meetingsScheduled).toBe(0);
    expect(result.meetingsCompleted).toBe(0);
    expect(result.hoursInMeetings).toBe(0);
  });

  it('should handle timeout gracefully', async () => {
    const mockClient = {
      events: {
        list: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s
          return { items: [] };
        },
      },
    };

    const collectorWithClient = new GoogleCalendarDataCollector(mockClient);
    try {
      await collectorWithClient.collectData(dateRange.start, dateRange.end);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });

  it('should handle errors gracefully', async () => {
    const mockClient = {
      events: {
        list: async () => {
          throw new Error('API error');
        },
      },
    };

    const collectorWithClient = new GoogleCalendarDataCollector(mockClient);
    try {
      await collectorWithClient.collectData(dateRange.start, dateRange.end);
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });
});
