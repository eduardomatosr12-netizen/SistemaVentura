import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/inventory - List all inventory boards
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const boards = await prisma.inventoryBoard.findMany({
      orderBy: { title: 'asc' },
    });
    return res.status(200).json(boards);
  } catch (error) {
    console.error('[INVENTORY] Erro ao buscar inventário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/inventory/:id - Get single inventory board
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const board = await prisma.inventoryBoard.findUnique({
      where: { id: req.params.id },
    });
    if (!board) {
      return res.status(404).json({ error: 'Board de inventário não encontrado' });
    }
    return res.status(200).json(board);
  } catch (error) {
    console.error('[INVENTORY] Erro ao buscar board:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/inventory - Create inventory board
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, color, columns, rows } = req.body;

    if (!title || !columns || !rows) {
      return res.status(400).json({ error: 'Título, colunas e linhas são obrigatórios' });
    }

    const board = await prisma.inventoryBoard.create({
      data: {
        title,
        color: color || '#3b82f6',
        columns,
        rows,
      },
    });

    return res.status(201).json(board);
  } catch (error) {
    console.error('[INVENTORY] Erro ao criar board:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/inventory/:id - Update inventory board
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, color, columns, rows } = req.body;

    const board = await prisma.inventoryBoard.update({
      where: { id: req.params.id },
      data: {
        title,
        color,
        columns,
        rows,
      },
    });

    return res.status(200).json(board);
  } catch (error) {
    console.error('[INVENTORY] Erro ao atualizar board:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/inventory/:id - Delete inventory board
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.inventoryBoard.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[INVENTORY] Erro ao excluir board:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;