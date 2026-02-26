// @ts-nocheck
import { Router, Request, Response } from 'express';
import { ScheduledReportService } from '@aria/core';

const router = Router();
const scheduledReportService = new ScheduledReportService();

/**
 * @route POST /api/scheduled-reports
 * @desc Create a new scheduled report
 */
router.post('/scheduled-reports', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id || 'admin'; // Mock user context
        const { frequency, hour, minute, timezone, channels, options } = req.body;

        const schedule = await scheduledReportService.createSchedule(
            userId,
            frequency,
            hour,
            minute,
            timezone,
            channels,
            options
        );

        return res.status(201).json(schedule);
    } catch (error) {
        console.error('Error creating scheduled report:', error);
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
    }
});

/**
 * @route GET /api/scheduled-reports
 * @desc Get all scheduled reports for the current user
 */
router.get('/scheduled-reports', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id || 'admin';
        const schedules = scheduledReportService.getUserSchedules(userId);
        return res.json({ data: schedules });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route GET /api/scheduled-reports/:id
 * @desc Get a specific scheduled report
 */
router.get('/scheduled-reports/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const schedule = scheduledReportService.getSchedule(id);

        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        return res.json(schedule);
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @route PUT /api/scheduled-reports/:id
 * @desc Update a scheduled report
 */
router.put('/scheduled-reports/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const schedule = await scheduledReportService.updateSchedule(id, updates);
        return res.json(schedule);
    } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
    }
});

/**
 * @route DELETE /api/scheduled-reports/:id
 * @desc Delete a scheduled report
 */
router.delete('/scheduled-reports/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await scheduledReportService.deleteSchedule(id);
        return res.status(204).send();
    } catch (error) {
        return res.status(404).json({ error: 'Schedule not found' });
    }
});

/**
 * @route POST /api/scheduled-reports/:id/pause
 * @desc Pause a scheduled report
 */
router.post('/scheduled-reports/:id/pause', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const schedule = await scheduledReportService.pauseSchedule(id);
        return res.json(schedule);
    } catch (error) {
        return res.status(404).json({ error: 'Schedule not found' });
    }
});

/**
 * @route POST /api/scheduled-reports/:id/resume
 * @desc Resume a scheduled report
 */
router.post('/scheduled-reports/:id/resume', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const schedule = await scheduledReportService.resumeSchedule(id);
        return res.json(schedule);
    } catch (error) {
        return res.status(404).json({ error: 'Schedule not found' });
    }
});

/**
 * @route GET /api/scheduled-reports/:id/history
 * @desc Get delivery history for a scheduled report
 */
router.get('/scheduled-reports/:id/history', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

        const history = scheduledReportService.getDeliveryHistory(id, limit);
        return res.json({ data: history });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
