import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliveryExecutionService } from '../DeliveryExecutionService';

describe('DeliveryExecutionService', () => {
    let service: DeliveryExecutionService;
    let mockScheduledReportService: any;
    let mockBullQueueService: any;
    let mockReportGenerationService: any;
    let mockReportDataAggregationService: any;

    beforeEach(() => {
        mockScheduledReportService = {
            getSchedule: vi.fn().mockReturnValue({
                id: 'mock-schedule',
                userId: 'user1',
                channels: ['telegram']
            }),
            recordDelivery: vi.fn().mockResolvedValue(undefined)
        };

        mockBullQueueService = {
            registerProcessor: vi.fn(),
            addJob: vi.fn().mockResolvedValue('job-123'),
            initialize: vi.fn().mockResolvedValue(undefined)
        };

        mockReportGenerationService = {
            generateReport: vi.fn().mockResolvedValue({ title: 'Mock Report' })
        };

        mockReportDataAggregationService = {
            aggregateReportData: vi.fn().mockResolvedValue({ metrics: {} })
        };

        service = new DeliveryExecutionService({
            scheduledReportService: mockScheduledReportService,
            bullQueueService: mockBullQueueService,
            reportGenerationService: mockReportGenerationService,
            reportDataAggregationService: mockReportDataAggregationService
        });
    });

    it('should initialize services', async () => {
        await service.initialize();
        expect(mockBullQueueService.initialize).toHaveBeenCalled();
    });

    it('should schedule execution and add job to queue', async () => {
        const jobId = await service.scheduleExecution('mock-schedule');
        expect(jobId).toBe('job-123');
        expect(mockBullQueueService.addJob).toHaveBeenCalledWith('mock-schedule', expect.any(Object));
    });

    it('should process delivery job successfully', async () => {
        // We can test the private processDeliveryJob by creating an instance and extracting the bound method 
        // passed to registerProcessor in the constructor
        const boundProcessor = mockBullQueueService.registerProcessor.mock.calls[0][1];

        await boundProcessor({
            id: 'job-123',
            data: {
                scheduleId: 'mock-schedule',
                userId: 'user1',
                channels: ['telegram'],
                reportDate: '2026-02-23'
            },
            attemptsMade: 0
        } as any);

        expect(mockReportDataAggregationService.aggregateReportData).toHaveBeenCalled();
        expect(mockReportGenerationService.generateReport).toHaveBeenCalled();
        expect(mockScheduledReportService.recordDelivery).toHaveBeenCalledWith('mock-schedule', expect.objectContaining({
            success: true,
            channels: ['telegram']
        }));
    });

    it('should record failure if aggregation fails', async () => {
        const boundProcessor = mockBullQueueService.registerProcessor.mock.calls[0][1];
        mockReportDataAggregationService.aggregateReportData.mockResolvedValue(null);

        await expect(boundProcessor({
            id: 'job-123',
            data: {
                scheduleId: 'mock-schedule',
                userId: 'user1',
                channels: ['telegram'],
                reportDate: '2026-02-23'
            },
            attemptsMade: 0
        } as any)).rejects.toThrow('No data available');

        expect(mockScheduledReportService.recordDelivery).toHaveBeenCalledWith('mock-schedule', expect.objectContaining({
            success: false
        }));
    });
});
