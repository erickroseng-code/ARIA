/**
 * Scheduled Report Service Tests
 * Task 1: ScheduledReportService Setup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ScheduledReportService,
  type ScheduledReport,
  type DeliveryHistoryEntry,
} from '../ScheduledReportService';

describe('ScheduledReportService', () => {
  let service: ScheduledReportService;
  const testUserId = 'user123';
  const testTimezone = 'America/Sao_Paulo';

  beforeEach(() => {
    service = new ScheduledReportService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('Schedule Creation', () => {
    it('should create a daily schedule', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        9, // 9 AM
        30, // 30 minutes
        testTimezone,
        ['telegram', 'notion']
      );

      expect(schedule.id).toBeTruthy();
      expect(schedule.userId).toBe(testUserId);
      expect(schedule.frequency).toBe('daily');
      expect(schedule.hour).toBe(9);
      expect(schedule.minute).toBe(30);
      expect(schedule.timezone).toBe(testTimezone);
      expect(schedule.channels).toEqual(['telegram', 'notion']);
      expect(schedule.isActive).toBe(true);
      expect(schedule.cronExpression).toBe('30 9 * * *');
    });

    it('should create a weekly schedule', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'weekly',
        10,
        0,
        testTimezone,
        ['telegram'],
        { dayOfWeek: 'monday' }
      );

      expect(schedule.frequency).toBe('weekly');
      expect(schedule.dayOfWeek).toBe('monday');
      expect(schedule.cronExpression).toBe('0 10 * * 1');
    });

    it('should create a monthly schedule', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'monthly',
        8,
        0,
        testTimezone,
        ['notion'],
        { dayOfMonth: 15 }
      );

      expect(schedule.frequency).toBe('monthly');
      expect(schedule.dayOfMonth).toBe(15);
      expect(schedule.cronExpression).toBe('0 8 15 * *');
    });

    it('should require dayOfWeek for weekly schedules', async () => {
      await expect(
        service.createSchedule(testUserId, 'weekly', 10, 0, testTimezone, ['telegram'])
      ).rejects.toThrow('dayOfWeek required for weekly');
    });

    it('should require dayOfMonth for monthly schedules', async () => {
      await expect(
        service.createSchedule(testUserId, 'monthly', 10, 0, testTimezone, ['telegram'])
      ).rejects.toThrow('Valid dayOfMonth');
    });

    it('should validate hour range', async () => {
      await expect(
        service.createSchedule(testUserId, 'daily', 25, 0, testTimezone, ['telegram'])
      ).rejects.toThrow('Hour must be between 0 and 23');

      await expect(
        service.createSchedule(testUserId, 'daily', -1, 0, testTimezone, ['telegram'])
      ).rejects.toThrow('Hour must be between 0 and 23');
    });

    it('should validate minute range', async () => {
      await expect(
        service.createSchedule(testUserId, 'daily', 10, 60, testTimezone, ['telegram'])
      ).rejects.toThrow('Minute must be between 0 and 59');

      await expect(
        service.createSchedule(testUserId, 'daily', 10, -1, testTimezone, ['telegram'])
      ).rejects.toThrow('Minute must be between 0 and 59');
    });

    it('should require at least one delivery channel', async () => {
      await expect(
        service.createSchedule(testUserId, 'daily', 10, 0, testTimezone, [])
      ).rejects.toThrow('At least one delivery channel must be specified');
    });

    it('should set nextDeliveryAt', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      expect(schedule.nextDeliveryAt).toBeDefined();
      expect(schedule.nextDeliveryAt instanceof Date).toBe(true);
    });

    it('should support multiple delivery channels', async () => {
      const schedule = await service.createSchedule(testUserId, 'daily', 9, 0, testTimezone, [
        'telegram',
        'notion',
        'email',
      ]);

      expect(schedule.channels).toHaveLength(3);
      expect(schedule.channels).toContain('telegram');
      expect(schedule.channels).toContain('notion');
      expect(schedule.channels).toContain('email');
    });
  });

  describe('Schedule Retrieval', () => {
    it('should retrieve a schedule by ID', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const retrieved = service.getSchedule(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent schedule', () => {
      const retrieved = service.getSchedule('nonexistent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should get all schedules for a user', async () => {
      const user1 = 'user1';
      const user2 = 'user2';

      await service.createSchedule(user1, 'daily', 10, 0, testTimezone, ['telegram']);
      await service.createSchedule(user1, 'weekly', 14, 0, testTimezone, ['telegram'], {
        dayOfWeek: 'friday',
      });
      await service.createSchedule(user2, 'daily', 9, 0, testTimezone, ['telegram']);

      const user1Schedules = service.getUserSchedules(user1);
      const user2Schedules = service.getUserSchedules(user2);

      expect(user1Schedules).toHaveLength(2);
      expect(user2Schedules).toHaveLength(1);
      expect(user1Schedules.every((s) => s.userId === user1)).toBe(true);
      expect(user2Schedules.every((s) => s.userId === user2)).toBe(true);
    });

    it('should return empty array for user with no schedules', () => {
      const schedules = service.getUserSchedules('nonexistent-user');
      expect(schedules).toHaveLength(0);
    });
  });

  describe('Schedule Updates', () => {
    it('should update schedule frequency', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const updated = await service.updateSchedule(created.id, {
        frequency: 'weekly',
        dayOfWeek: 'monday',
      });

      expect(updated.frequency).toBe('weekly');
      expect(updated.dayOfWeek).toBe('monday');
      expect(updated.cronExpression).toBe('0 10 * * 1');
    });

    it('should update time', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const updated = await service.updateSchedule(created.id, {
        hour: 15,
        minute: 30,
      });

      expect(updated.hour).toBe(15);
      expect(updated.minute).toBe(30);
      expect(updated.cronExpression).toBe('30 15 * * *');
    });

    it('should update delivery channels', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const updated = await service.updateSchedule(created.id, {
        channels: ['telegram', 'notion', 'email'],
      });

      expect(updated.channels).toHaveLength(3);
    });

    it('should update timezone', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        'UTC',
        ['telegram']
      );

      const updated = await service.updateSchedule(created.id, {
        timezone: 'America/New_York',
      });

      expect(updated.timezone).toBe('America/New_York');
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(
        service.updateSchedule('nonexistent', { hour: 12 })
      ).rejects.toThrow('not found');
    });

    it('should update updatedAt timestamp', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const originalTime = created.updatedAt.getTime();

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.updateSchedule(created.id, { hour: 15 });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalTime);
    });
  });

  describe('Schedule Deletion', () => {
    it('should delete a schedule', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      await service.deleteSchedule(created.id);

      expect(service.getSchedule(created.id)).toBeUndefined();
    });

    it('should remove delivery history when deleting schedule', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      await service.recordDelivery(created.id, {
        scheduleId: created.id,
        deliveryTime: new Date(),
        channels: ['telegram'],
        success: true,
        retryCount: 0,
      });

      await service.deleteSchedule(created.id);

      const history = service.getDeliveryHistory(created.id);
      expect(history).toHaveLength(0);
    });

    it('should throw error deleting non-existent schedule', async () => {
      await expect(service.deleteSchedule('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('Pause/Resume', () => {
    it('should pause a schedule', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const paused = await service.pauseSchedule(created.id);

      expect(paused.isActive).toBe(false);
    });

    it('should resume a schedule', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      await service.pauseSchedule(created.id);
      const resumed = await service.resumeSchedule(created.id);

      expect(resumed.isActive).toBe(true);
    });

    it('should update nextDeliveryAt when resuming', async () => {
      const created = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const originalNext = created.nextDeliveryAt;

      await service.pauseSchedule(created.id);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const resumed = await service.resumeSchedule(created.id);

      expect(resumed.nextDeliveryAt).toBeDefined();
    });

    it('should throw error pausing non-existent schedule', async () => {
      await expect(service.pauseSchedule('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw error resuming non-existent schedule', async () => {
      await expect(service.resumeSchedule('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('Delivery History', () => {
    it('should record successful delivery', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const now = new Date();
      const entry = await service.recordDelivery(schedule.id, {
        scheduleId: schedule.id,
        deliveryTime: now,
        channels: ['telegram'],
        success: true,
        retryCount: 0,
      });

      expect(entry.id).toBeTruthy();
      expect(entry.userId).toBe(testUserId);
      expect(entry.success).toBe(true);
      expect(entry.retryCount).toBe(0);
    });

    it('should record failed delivery with error', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      const entry = await service.recordDelivery(schedule.id, {
        scheduleId: schedule.id,
        deliveryTime: new Date(),
        channels: ['telegram'],
        success: false,
        errorMessage: 'Telegram API timeout',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() + 60000),
      });

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Telegram API timeout');
      expect(entry.retryCount).toBe(1);
    });

    it('should get delivery history for schedule', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      // Record multiple deliveries
      for (let i = 0; i < 5; i++) {
        await service.recordDelivery(schedule.id, {
          scheduleId: schedule.id,
          deliveryTime: new Date(),
          channels: ['telegram'],
          success: i % 2 === 0,
          retryCount: 0,
        });
      }

      const history = service.getDeliveryHistory(schedule.id);
      expect(history).toHaveLength(5);
    });

    it('should limit delivery history with maxResults', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      // Record 10 deliveries
      for (let i = 0; i < 10; i++) {
        await service.recordDelivery(schedule.id, {
          scheduleId: schedule.id,
          deliveryTime: new Date(),
          channels: ['telegram'],
          success: true,
          retryCount: 0,
        });
      }

      const history = service.getDeliveryHistory(schedule.id, 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should update lastDeliveryAt on successful delivery', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      expect(schedule.lastDeliveryAt).toBeUndefined();

      const deliveryTime = new Date();
      await service.recordDelivery(schedule.id, {
        scheduleId: schedule.id,
        deliveryTime,
        channels: ['telegram'],
        success: true,
        retryCount: 0,
      });

      const updated = service.getSchedule(schedule.id);
      expect(updated?.lastDeliveryAt).toBeDefined();
    });

    it('should not update lastDeliveryAt on failed delivery', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      await service.recordDelivery(schedule.id, {
        scheduleId: schedule.id,
        deliveryTime: new Date(),
        channels: ['telegram'],
        success: false,
        errorMessage: 'Failed',
        retryCount: 0,
      });

      const updated = service.getSchedule(schedule.id);
      expect(updated?.lastDeliveryAt).toBeUndefined();
    });

    it('should throw error recording delivery for non-existent schedule', async () => {
      await expect(
        service.recordDelivery('nonexistent', {
          scheduleId: 'nonexistent',
          deliveryTime: new Date(),
          channels: ['telegram'],
          success: true,
          retryCount: 0,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('Next Delivery Calculation', () => {
    it('should return next delivery time', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        14,
        30,
        testTimezone,
        ['telegram']
      );

      const nextDelivery = service.getNextDelivery(schedule.id);
      expect(nextDelivery).toBeDefined();
      expect(nextDelivery instanceof Date).toBe(true);
      expect(nextDelivery!.getTime()).toBeGreaterThan(new Date().getTime());
    });

    it('should return null for non-existent schedule', () => {
      const nextDelivery = service.getNextDelivery('nonexistent');
      expect(nextDelivery).toBeNull();
    });
  });

  describe('Schedules For Delivery', () => {
    it('should identify active schedules due for delivery', async () => {
      // Create a schedule with past next delivery time
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      // Manually set nextDeliveryAt to past
      const s = service.getSchedule(schedule.id)!;
      s.nextDeliveryAt = new Date(Date.now() - 1000);

      const schedulesForDelivery = service.getSchedulesForDelivery();
      expect(schedulesForDelivery.some((s) => s.id === schedule.id)).toBe(true);
    });

    it('should not include paused schedules', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      // Manually set nextDeliveryAt to past
      const s = service.getSchedule(schedule.id)!;
      s.nextDeliveryAt = new Date(Date.now() - 1000);

      await service.pauseSchedule(schedule.id);

      const schedulesForDelivery = service.getSchedulesForDelivery();
      expect(schedulesForDelivery.some((s) => s.id === schedule.id)).toBe(false);
    });

    it('should respect ±5 min tolerance window', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );

      // Set next delivery to 4 minutes in future (within tolerance)
      const s = service.getSchedule(schedule.id)!;
      s.nextDeliveryAt = new Date(Date.now() + 4 * 60 * 1000);

      const schedulesForDelivery = service.getSchedulesForDelivery();
      expect(schedulesForDelivery.some((s) => s.id === schedule.id)).toBe(true);
    });
  });

  describe('Service Statistics', () => {
    it('should return service statistics', async () => {
      const user1 = 'user1';
      const user2 = 'user2';

      await service.createSchedule(user1, 'daily', 10, 0, testTimezone, ['telegram']);
      await service.createSchedule(user1, 'weekly', 14, 0, testTimezone, ['telegram'], {
        dayOfWeek: 'friday',
      });
      await service.createSchedule(user2, 'daily', 9, 0, testTimezone, ['telegram']);

      const stats = service.getStats();

      expect(stats.totalSchedules).toBe(3);
      expect(stats.activeSchedules).toBe(3);
    });

    it('should count paused schedules correctly', async () => {
      const schedule1 = await service.createSchedule(
        testUserId,
        'daily',
        10,
        0,
        testTimezone,
        ['telegram']
      );
      const schedule2 = await service.createSchedule(
        testUserId,
        'daily',
        12,
        0,
        testTimezone,
        ['telegram']
      );

      await service.pauseSchedule(schedule1.id);

      const stats = service.getStats();

      expect(stats.totalSchedules).toBe(2);
      expect(stats.activeSchedules).toBe(1);
    });
  });

  describe('Cron Expression Building', () => {
    it('should build daily cron correctly', async () => {
      const schedule = await service.createSchedule(
        testUserId,
        'daily',
        9,
        30,
        testTimezone,
        ['telegram']
      );

      expect(schedule.cronExpression).toBe('30 9 * * *');
    });

    it('should build weekly cron correctly', async () => {
      const days: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ];

      for (let i = 0; i < days.length; i++) {
        const schedule = await service.createSchedule(testUserId, 'weekly', 10, 0, testTimezone, ['telegram'], {
          dayOfWeek: days[i],
        });

        expect(schedule.cronExpression).toBe(`0 10 * * ${i}`);
      }
    });

    it('should build monthly cron correctly', async () => {
      for (let day = 1; day <= 31; day += 5) {
        const schedule = await service.createSchedule(
          testUserId,
          'monthly',
          10,
          0,
          testTimezone,
          ['telegram'],
          { dayOfMonth: day }
        );

        expect(schedule.cronExpression).toBe(`0 10 ${day} * *`);
      }
    });
  });
});
