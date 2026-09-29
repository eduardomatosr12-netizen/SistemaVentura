import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/rentals - List all rentals
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rentals = await prisma.rental.findMany({
      orderBy: { startDate: 'desc' },
    });
    return res.status(200).json(rentals);
  } catch (error) {
    console.error('[RENTALS] Erro ao buscar aluguéis:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/rentals/:id - Get single rental
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rental = await prisma.rental.findUnique({
      where: { id: req.params.id },
    });
    if (!rental) {
      return res.status(404).json({ error: 'Aluguel não encontrado' });
    }
    return res.status(200).json(rental);
  } catch (error) {
    console.error('[RENTALS] Erro ao buscar aluguel:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/rentals - Create rental
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { clientName, clientPhone, clientEmail, items, totalValue, discount, status, startDate, endDate, notes } = req.body;

    if (!clientName || !items || !totalValue || !startDate) {
      return res.status(400).json({ error: 'Campos obrigatórios: clientName, items, totalValue, startDate' });
    }

    const rental = await prisma.rental.create({
      data: {
        clientName,
        clientPhone,
        clientEmail,
        items,
        totalValue,
        discount: discount || 0,
        status: status || 'ativo',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        notes,
      },
    });

    return res.status(201).json(rental);
  } catch (error) {
    console.error('[RENTALS] Erro ao criar aluguel:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/rentals/:id - Update rental
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { clientName, clientPhone, clientEmail, items, totalValue, discount, status, startDate, endDate, notes } = req.body;

    const rental = await prisma.rental.update({
      where: { id: req.params.id },
      data: {
        clientName,
        clientPhone,
        clientEmail,
        items,
        totalValue,
        discount,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        notes,
      },
    });

    return res.status(200).json(rental);
  } catch (error) {
    console.error('[RENTALS] Erro ao atualizar aluguel:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/rentals/:id - Delete rental
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.rental.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[RENTALS] Erro ao excluir aluguel:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;