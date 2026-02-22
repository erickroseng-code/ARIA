import { describe, it, expect, beforeEach } from 'vitest';
import { ClientStatusService } from '../ClientStatusService';

describe('ClientStatusService', () => {
  let service: ClientStatusService;

  const mockTasks = [
    { id: '1', title: 'Task 1', status: 'overdue' as const, source: 'clickup' as const, url: 'http://clickup/1', dueDate: new Date(Date.now() - 86400000) },
    { id: '2', title: 'Task 2', status: 'open' as const, source: 'notion' as const, url: 'http://notion/2' },
  ];

  const mockMeetings = [
    { id: '1', date: new Date(Date.now() + 86400000), description: 'Meeting 1', url: 'http://notion/meet1' },
  ];

  const mockPlans = [
    { id: '1', date: new Date(), title: 'Plan 1', url: 'http://notion/plan1' },
  ];

  beforeEach(() => {
    service = new ClientStatusService(
      async () => mockTasks.filter((t) => t.source === 'clickup'),
      async () => mockTasks.filter((t) => t.source === 'notion'),
      async () => mockMeetings,
      async () => mockPlans
    );
  });

  describe('getStatus', () => {
    it('should fetch and consolidate data', async () => {
      const status = await service.getStatus('client1', 'Empresa ABC');
      expect(status.clientId).toBe('client1');
      expect(status.clientName).toBe('Empresa ABC');
      expect(status.clickupTasks.length).toBeGreaterThan(0);
    });

    it('should limit upcoming meetings to 3', async () => {
      service = new ClientStatusService(
        async () => [],
        async () => [],
        async () => [
          { id: '1', date: new Date(), description: 'M1', url: 'url' },
          { id: '2', date: new Date(), description: 'M2', url: 'url' },
          { id: '3', date: new Date(), description: 'M3', url: 'url' },
          { id: '4', date: new Date(), description: 'M4', url: 'url' },
        ],
        async () => []
      );

      const status = await service.getStatus('client1', 'Empresa');
      expect(status.upcomingMeetings.length).toBeLessThanOrEqual(3);
    });

    it('should cache results', async () => {
      let callCount = 0;
      service = new ClientStatusService(
        async () => {
          callCount++;
          return [];
        },
        async () => [],
        async () => [],
        async () => []
      );

      await service.getStatus('client1', 'Empresa');
      const first = callCount;

      await service.getStatus('client1', 'Empresa');
      expect(callCount).toBe(first); // Should not have made another call
    });
  });

  describe('formatStatus', () => {
    it('should format status message', async () => {
      const status = await service.getStatus('client1', 'Empresa ABC');
      const formatted = service.formatStatus(status);
      expect(formatted).toContain('Empresa ABC');
      expect(formatted).toContain('Status de');
    });

    it('should show overdue tasks', async () => {
      const status = await service.getStatus('client1', 'Empresa ABC');
      const formatted = service.formatStatus(status);
      if (status.clickupTasks.some((t) => t.status === 'overdue')) {
        expect(formatted).toContain('Atrasadas');
      }
    });

    it('should show meetings', async () => {
      const status = await service.getStatus('client1', 'Empresa ABC');
      const formatted = service.formatStatus(status);
      if (status.upcomingMeetings.length > 0) {
        expect(formatted).toContain('Reuniões');
      }
    });

    it('should include client profile link', async () => {
      const status = await service.getStatus('client1', 'Empresa ABC');
      const formatted = service.formatStatus(status);
      expect(formatted).toContain('notion://client/client1');
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific client', async () => {
      await service.getStatus('client1', 'Empresa');
      service.clearCache('client1');
      // Cache should be empty
      expect(service['cache'].size).toBe(0);
    });

    it('should clear all cache', async () => {
      await service.getStatus('client1', 'Empresa');
      service.clearAllCache();
      expect(service['cache'].size).toBe(0);
    });
  });

  describe('timeout handling', () => {
    it('should handle API timeouts gracefully', async () => {
      service = new ClientStatusService(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Longer than timeout
          return [];
        },
        async () => [],
        async () => [],
        async () => []
      );

      const status = await service.getStatus('client1', 'Empresa');
      expect(status.clickupTasks).toEqual([]);
    });
  });
});
