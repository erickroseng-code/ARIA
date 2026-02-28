import { Job } from 'bullmq';
import { ScheduledReportService, DeliveryChannel } from './ScheduledReportService';
import { BullQueueService, ReportDeliveryJob } from './BullQueueService';
import { ReportGenerationService } from './ReportGenerationService';
import { ReportDataAggregationService } from './ReportDataAggregationService';

export interface DeliveryExecutionConfig {
    scheduledReportService: ScheduledReportService;
    bullQueueService: BullQueueService;
    reportGenerationService: ReportGenerationService;
    reportDataAggregationService: ReportDataAggregationService;
}

export class DeliveryExecutionService {
    private scheduledReportService: ScheduledReportService;
    private bullQueueService: BullQueueService;
    private reportGenerationService: ReportGenerationService;
    private reportDataAggregationService: ReportDataAggregationService;

    constructor(config: DeliveryExecutionConfig) {
        this.scheduledReportService = config.scheduledReportService;
        this.bullQueueService = config.bullQueueService;
        this.reportGenerationService = config.reportGenerationService;
        this.reportDataAggregationService = config.reportDataAggregationService;

        // Register this service as the processor for the scheduled-reports queue
        this.bullQueueService.registerProcessor('scheduled-report', this.processDeliveryJob.bind(this));
    }

    /**
     * Initialize the service and start processing
     */
    async initialize(): Promise<void> {
        await this.bullQueueService.initialize();

        // Periodically check for schedules that need to be delivered (if in-memory cron triggers or manual polling)
        // Normally, ScheduledReportService's cron will trigger addJob via an event emitter or callback, 
        // but we can poll just in case.
    }

    /**
     * Schedule a report for execution (called by ScheduledReportService cron trigger)
     */
    async scheduleExecution(scheduleId: string): Promise<string> {
        const schedule = this.scheduledReportService.getSchedule(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        const jobPayload: Omit<ReportDeliveryJob, 'jobId'> = {
            scheduleId: schedule.id,
            userId: schedule.userId,
            reportDate: new Date().toISOString().split('T')[0],
            channels: schedule.channels as Array<'telegram' | 'email' | 'notion'>,
            generatedAt: new Date(),
        };

        return this.bullQueueService.addJob(scheduleId, jobPayload);
    }

    /**
     * Process a report delivery job
     */
    private async processDeliveryJob(job: Job<ReportDeliveryJob>): Promise<void> {
        const { scheduleId, userId, channels } = job.data;

        try {
            const reportData = await this.reportDataAggregationService.aggregateData({
                start: new Date(), // Normally based on frequency
                end: new Date(),
            });

            if (!reportData) {
                throw new Error('No data available for report generation');
            }

            // 2. Generate report
            const report = await this.reportGenerationService.generateReport({
                reportData,
                userId,
            });

            // 3. Deliver to channels
            const deliveryTasks = channels.map(channel => this.deliverToChannel(channel, report, userId));
            const results = await Promise.allSettled(deliveryTasks);

            // Check for partial failures
            const failedChannels = channels.filter((_, index) => results[index].status === 'rejected');

            const success = failedChannels.length === 0;
            const errorMessage = failedChannels.length > 0
                ? `Failed to deliver to: ${failedChannels.join(', ')}`
                : undefined;

            // 4. Record delivery history
            await this.scheduledReportService.recordDelivery(scheduleId, {
                deliveryTime: new Date(),
                channels: channels as DeliveryChannel[],
                success,
                errorMessage,
                reportId: job.data.jobId, // Using job ID as report ID for simplicity
                retryCount: job.attemptsMade || 0
            });

            if (!success) {
                throw new Error(errorMessage); // Trigger retry for failed channels
            }
        } catch (error) {
            console.error(`Failed to execute delivery for job ${job.id}:`, error);

            // Record failure immediately
            await this.scheduledReportService.recordDelivery(scheduleId, {
                deliveryTime: new Date(),
                channels: channels as DeliveryChannel[],
                success: false,
                errorMessage: error instanceof Error ? error.message : String(error),
                retryCount: job.attemptsMade || 0
            });

            throw error; // Re-throw to trigger BullMQ retry
        }
    }

    /**
     * Deliver report to a specific channel
     */
    private async deliverToChannel(channel: string, report: any, userId: string): Promise<void> {
        // In a real implementation, this would interface with NotificationService, EmailService, etc.
        switch (channel) {
            case 'telegram':
                console.log(`[Delivery] Sending report to Telegram for user ${userId}`);
                // await telegramService.sendMessage(...)
                break;
            case 'email':
                console.log(`[Delivery] Sending report to Email for user ${userId}`);
                // await emailService.send(...)
                break;
            case 'notion':
                console.log(`[Delivery] Appending report to Notion for user ${userId}`);
                // await notionService.append(...)
                break;
            default:
                throw new Error(`Unsupported delivery channel: ${channel}`);
        }
    }
}
