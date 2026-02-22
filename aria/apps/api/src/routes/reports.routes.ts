/**
 * Report API Routes
 * Task 5: Caching & Re-generation - API endpoints
 *
 * GET  /api/reports              - List user reports (cached)
 * POST /api/reports/:id/refresh  - Force regenerate report
 * GET  /api/reports/:id          - Get single report details
 */

import { Router, Request, Response } from 'express';
import { ReportGenerationService } from '@aria/core/dist/reports/ReportGenerationService';
import { ReportDataAggregationService } from '@aria/core/dist/reports/ReportDataAggregationService';
import { CacheService } from '@aria/core/dist/cache/CacheService';

const router = Router();

// Initialize services
const reportGenService = new ReportGenerationService();
const reportAggService = new ReportDataAggregationService();
const cacheService = new CacheService({ useRedis: false, ttlSeconds: 3600 });

// Extend Express Request type for authenticated user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Task 5.3: Manual refresh endpoint
 * POST /api/reports/:id/refresh
 *
 * Force regenerate a report, bypassing cache
 */
router.post('/reports/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId || 'user123'; // In production: from JWT token
    const { regenerate = true, notify = true } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Report ID required' });
    }

    // Aggregate data for the user
    // In production: fetch actual data from ClickUp, Notion, Calendar
    const reportData = await reportAggService.aggregateReportData(userId, {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    });

    if (!reportData) {
      return res.status(404).json({ error: 'No aggregated data found' });
    }

    // Generate fresh report
    const report = await reportGenService.generateReport({
      userId,
      reportData,
      regenerate, // Force bypass cache
      notify,
    });

    return res.json({
      success: true,
      report,
      message: `Report ${id} regenerated successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing report:', error);
    return res.status(500).json({
      error: 'Failed to regenerate report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/reports/:id
 * Get single report details
 */
router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId || 'user123';

    if (!id) {
      return res.status(400).json({ error: 'Report ID required' });
    }

    // In production: fetch from database/cache
    // For now: return mock data
    const report = {
      id,
      userId,
      status: 'ready',
      generatedAt: new Date(),
      sections: {
        executiveSummary: 'Report summary...',
        keyMetrics: ['Metric 1', 'Metric 2'],
        insights: ['Insight 1'],
        recommendations: ['Recommendation 1'],
      },
    };

    return res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

/**
 * GET /api/reports
 * List user reports with pagination
 */
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || 'user123';
    const { skip = 0, limit = 10, status = 'all' } = req.query;

    const skipNum = parseInt(skip as string, 10) || 0;
    const limitNum = parseInt(limit as string, 10) || 10;

    // In production: fetch from database with pagination
    // For now: return mock data
    const reports = [
      {
        id: 'report_123',
        userId,
        period: {
          start: new Date('2026-02-01'),
          end: new Date('2026-02-28'),
        },
        status: 'ready',
        generatedAt: new Date(),
        notionPageId: 'notion_123',
      },
      {
        id: 'report_456',
        userId,
        period: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
        status: 'ready',
        generatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        notionPageId: 'notion_456',
      },
    ];

    return res.json({
      success: true,
      data: reports.slice(skipNum, skipNum + limitNum),
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total: reports.length,
        hasMore: skipNum + limitNum < reports.length,
      },
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});

/**
 * DELETE /api/reports/:id/cache
 * Clear cache for specific report (admin only)
 */
router.delete('/reports/:id/cache', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || 'user123';

    // Clear user's cache
    await cacheService.clearForUser(userId);

    return res.json({
      success: true,
      message: `Cache cleared for user ${userId}`,
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * GET /api/cache/stats
 * Get cache statistics (monitoring/debugging)
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = await cacheService.getStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

export default router;
