// @ts-nocheck
import { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import router from '../scheduled-reports.routes';

vi.mock('@aria/core', () => {
    return {
        ScheduledReportService: class {
            createSchedule = vi.fn().mockResolvedValue({ id: 'test_id', frequency: 'daily' });
            getUserSchedules = vi.fn().mockReturnValue([{ id: 'test_id' }]);
            getSchedule = vi.fn().mockImplementation((id) => id === 'test_id' ? { id: 'test_id' } : undefined);
            updateSchedule = vi.fn().mockResolvedValue({ id: 'test_id', frequency: 'weekly' });
            deleteSchedule = vi.fn().mockResolvedValue(undefined);
            pauseSchedule = vi.fn().mockResolvedValue({ id: 'test_id', isActive: false });
            resumeSchedule = vi.fn().mockResolvedValue({ id: 'test_id', isActive: true });
            getDeliveryHistory = vi.fn().mockReturnValue([{ id: 'history_1' }]);
        }
    };
});

describe('Scheduled Reports API Routes', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let responseJson: Mock;
    let responseStatus: Mock;
    let responseSend: Mock;

    beforeEach(() => {
        responseJson = vi.fn();
        responseStatus = vi.fn().mockReturnValue({ json: responseJson, send: (responseSend = vi.fn()) });

        mockRequest = {
            user: { id: 'test_user' } as any,
        };
        mockResponse = {
            json: responseJson,
            status: responseStatus,
        };
    });

    const runRoute = async (method: 'get' | 'post' | 'put' | 'delete', path: string, req: any, res: any) => {
        const layer = router.stack.find(
            (layer) => layer.route && layer.route.path === path && layer.route.methods[method]
        );
        if (layer && layer.route && layer.route.stack.length > 0) {
            const handler = layer.route.stack[0].handle;
            await handler({ ...mockRequest, ...req } as Request, res as Response, () => { });
        } else {
            throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
        }
    };

    it('POST /api/scheduled-reports should create a schedule', async () => {
        await runRoute('post', '/scheduled-reports', { body: { frequency: 'daily', channels: ['telegram'] } }, mockResponse);
        expect(responseStatus).toHaveBeenCalledWith(201);
        expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ id: 'test_id' }));
    });

    it('GET /api/scheduled-reports should return user schedules', async () => {
        await runRoute('get', '/scheduled-reports', {}, mockResponse);
        expect(responseJson).toHaveBeenCalledWith({ data: [{ id: 'test_id' }] });
    });

    it('GET /api/scheduled-reports/:id should return a specific schedule', async () => {
        await runRoute('get', '/scheduled-reports/:id', { params: { id: 'test_id' } }, mockResponse);
        expect(responseJson).toHaveBeenCalledWith({ id: 'test_id' });
    });

    it('PUT /api/scheduled-reports/:id should update a schedule', async () => {
        await runRoute('put', '/scheduled-reports/:id', { params: { id: 'test_id' }, body: { frequency: 'weekly' } }, mockResponse);
        expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'weekly' }));
    });

    it('DELETE /api/scheduled-reports/:id should delete a schedule', async () => {
        await runRoute('delete', '/scheduled-reports/:id', { params: { id: 'test_id' } }, mockResponse);
        expect(responseStatus).toHaveBeenCalledWith(204);
    });
});
