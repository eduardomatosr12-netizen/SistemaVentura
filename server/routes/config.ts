import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/config - Get system config
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    let config = await prisma.systemConfig.findUnique({
      where: { id: 'singleton' },
    });

    if (!config) {
      config = await prisma.systemConfig.create({
        data: { id: 'singleton' },
      });
    }

    return res.status(200).json(config);
  } catch (error) {
    console.error('[CONFIG] Erro ao buscar config:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/config - Update system config
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { whatsappApiKey, asaasApiKey, firebaseConfig } = req.body;

    const config = await prisma.systemConfig.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        whatsappApiKey,
        asaasApiKey,
        firebaseConfig,
      },
      update: {
        whatsappApiKey,
        asaasApiKey,
        firebaseConfig,
      },
    });

    return res.status(200).json(config);
  } catch (error) {
    console.error('[CONFIG] Erro ao atualizar config:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;