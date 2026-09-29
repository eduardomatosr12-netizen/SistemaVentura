import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/event-stock - List all event stock items
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const items = await prisma.eventStockItem.findMany({
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(items);
  } catch (error) {
    console.error('[EVENT_STOCK] Erro ao buscar estoque:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/event-stock/:id - Get single event stock item
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await prisma.eventStockItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    return res.status(200).json(item);
  } catch (error) {
    console.error('[EVENT_STOCK] Erro ao buscar item:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/event-stock - Create event stock item
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, category, quantity, unit, valorReferencia, observacao } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Nome e categoria são obrigatórios' });
    }

    const item = await prisma.eventStockItem.create({
      data: {
        name,
        category,
        quantity: quantity || 0,
        unit: unit || 'unidade',
        valorReferencia: valorReferencia || 0,
        observacao,
      },
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error('[EVENT_STOCK] Erro ao criar item:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/event-stock/:id - Update event stock item
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, category, quantity, unit, valorReferencia, observacao } = req.body;

    const item = await prisma.eventStockItem.update({
      where: { id: req.params.id },
      data: {
        name,
        category,
        quantity,
        unit,
        valorReferencia,
        observacao,
      },
    });

    return res.status(200).json(item);
  } catch (error) {
    console.error('[EVENT_STOCK] Erro ao atualizar item:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/event-stock/:id - Delete event stock item
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.eventStockItem.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[EVENT_STOCK] Erro ao excluir item:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;