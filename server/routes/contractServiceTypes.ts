import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/contract-service-types - List all contract service types
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const types = await prisma.contractServiceType.findMany({
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(types);
  } catch (error) {
    console.error('[CONTRACT_SERVICE_TYPES] Erro ao buscar tipos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/contract-service-types/:id - Get single type
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const type = await prisma.contractServiceType.findUnique({
      where: { id: req.params.id },
    });
    if (!type) {
      return res.status(404).json({ error: 'Tipo não encontrado' });
    }
    return res.status(200).json(type);
  } catch (error) {
    console.error('[CONTRACT_SERVICE_TYPES] Erro ao buscar tipo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/contract-service-types - Create type
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, isDefault } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const type = await prisma.contractServiceType.create({
      data: {
        name,
        description,
        isDefault: isDefault || false,
      },
    });

    return res.status(201).json(type);
  } catch (error) {
    console.error('[CONTRACT_SERVICE_TYPES] Erro ao criar tipo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/contract-service-types/:id - Update type
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, isDefault } = req.body;

    const type = await prisma.contractServiceType.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        isDefault,
      },
    });

    return res.status(200).json(type);
  } catch (error) {
    console.error('[CONTRACT_SERVICE_TYPES] Erro ao atualizar tipo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/contract-service-types/:id - Delete type
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.contractServiceType.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[CONTRACT_SERVICE_TYPES] Erro ao excluir tipo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;