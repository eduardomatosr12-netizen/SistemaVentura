import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/activity-logs - List activity logs
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });
    return res.status(200).json(logs);
  } catch (error) {
    console.error('[ACTIVITY_LOGS] Erro ao buscar logs:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;