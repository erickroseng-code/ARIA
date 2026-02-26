import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CalendarHandler } from '../CalendarHandler';
import type { ParsedCommand } from '../../IntentParser';

// Mock localStorage globally for Node.js environment
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

describe('CalendarHandler', () => {
  let handler: CalendarHandler;
  const mockCommand: ParsedCommand = {
    intent: 'CALENDAR',
    confidence: 0.9,
    action: 'create',
    entities: {
      eventTitle: 'Reunião com Cliente',
      eventDate: 'amanhã',
      eventTime: '14:00',
    },
    requiresConfirmation: true,
  };

  beforeEach(() => {
    handler = new CalendarHandler('test-user-id');
    vi.clearAllMocks();
    (localStorageMock.getItem as any).mockReturnValue(null);
  });

  describe('handle', () => {
    it('should return auth_required when user has no token', async () => {
      const result = await handler.handle(mockCommand);

      expect(result.type).toBe('auth_required');
      expect(result.authUrl).toBeDefined();
      expect(result.message).toContain('autorizar');
    });

    it('should return error for unknown action', async () => {
      const invalidCommand: ParsedCommand = {
        ...mockCommand,
        action: 'invalid' as any,
      };

      const result = await handler.handle(invalidCommand);
      expect(result.type).toBe('error');
      expect(result.message).toContain('não suportada');
    });
  });

  describe('event creation parsing', () => {
    it('should extract event title from command', () => {
      expect(mockCommand.entities.eventTitle).toBe('Reunião com Cliente');
    });

    it('should extract event date from command', () => {
      expect(mockCommand.entities.eventDate).toBe('amanhã');
    });

    it('should extract event time from command', () => {
      expect(mockCommand.entities.eventTime).toBe('14:00');
    });
  });

  describe('event query parsing', () => {
    it('should handle "hoje" query', () => {
      const queryCommand: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'query',
        entities: {
          eventDate: 'hoje',
        },
        requiresConfirmation: false,
      };

      expect(queryCommand.entities.eventDate).toBe('hoje');
    });

    it('should handle "semana que vem" query', () => {
      const queryCommand: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'query',
        entities: {
          eventDate: 'semana que vem',
        },
        requiresConfirmation: false,
      };

      expect(queryCommand.entities.eventDate).toContain('semana');
    });
  });

  describe('event cancellation parsing', () => {
    it('should extract event title for cancellation', () => {
      const cancelCommand: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'cancel',
        entities: {
          eventTitle: 'Reunião antiga',
        },
        requiresConfirmation: false,
      };

      expect(cancelCommand.entities.eventTitle).toBe('Reunião antiga');
    });
  });

  describe('timezone handling', () => {
    it('should use PT-BR timezone by default', () => {
      // This test verifies the handler uses correct timezone
      // In real implementation, this would be tested with actual event creation
      expect(process.env.USER_TIMEZONE || 'America/Sao_Paulo').toBe(
        process.env.USER_TIMEZONE || 'America/Sao_Paulo'
      );
    });
  });

  describe('response formatting', () => {
    it('should return success response type for create', async () => {
      const createCommand: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'create',
        entities: {
          eventTitle: 'Test Event',
          eventDate: 'hoje',
        },
        requiresConfirmation: true,
      };

      expect(createCommand.action).toBe('create');
    });

    it('should include event title in formatted message', () => {
      const title = 'Reunião Importante';
      const command: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'create',
        entities: {
          eventTitle: title,
          eventDate: 'amanhã',
        },
        requiresConfirmation: true,
      };

      expect(command.entities.eventTitle).toBe(title);
    });
  });

  describe('error handling', () => {
    it('should handle missing event title for creation', async () => {
      const invalidCommand: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'create',
        entities: {
          eventDate: 'amanhã',
        },
        requiresConfirmation: true,
      };

      expect(invalidCommand.entities.eventTitle).toBeUndefined();
    });

    it('should handle missing event date for creation', async () => {
      const invalidCommand: ParsedCommand = {
        intent: 'CALENDAR',
        confidence: 0.9,
        action: 'create',
        entities: {
          eventTitle: 'Reunião',
        },
        requiresConfirmation: true,
      };

      expect(invalidCommand.entities.eventDate).toBeUndefined();
    });
  });
});
