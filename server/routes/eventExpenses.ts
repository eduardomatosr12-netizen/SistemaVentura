import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/event-expenses - List all event expenses
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.query;
    const where = eventId ? { eventId: eventId as string } : {};
    const expenses = await prisma.eventExpense.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return res.status(200).json(expenses);
  } catch (error) {
    console.error('[EVENT_EXPENSES] Erro ao buscar despesas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/event-expenses/:id - Get single event expense
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const expense = await prisma.eventExpense.findUnique({
      where: { id: req.params.id },
    });
    if (!expense) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    return res.status(200).json(expense);
  } catch (error) {
    console.error('[EVENT_EXPENSES] Erro ao buscar despesa:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/event-expenses - Create event expense
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId, description, category, customName, valor, status, paymentMethod, tipo, interno, financeiroId, date } = req.body;

    if (!eventId || !description || !category || !valor || !date) {
      return res.status(400).json({ error: 'Campos obrigatórios: eventId, description, category, valor, date' });
    }

    const expense = await prisma.eventExpense.create({
      data: {
        eventId,
        description,
        category,
        customName,
        valor,
        status: status || 'Pendente',
        paymentMethod,
        tipo: tipo || 'variavel',
        interno: interno !== undefined ? interno : true,
        financeiroId,
        date: new Date(date),
      },
    });

    return res.status(201).json(expense);
  } catch (error) {
    console.error('[EVENT_EXPENSES] Erro ao criar despesa:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/event-expenses/:id - Update event expense
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId, description, category, customName, valor, status, paymentMethod, tipo, interno, financeiroId, date } = req.body;

    const expense = await prisma.eventExpense.update({
      where: { id: req.params.id },
      data: {
        eventId,
        description,
        category,
        customName,
        valor,
        status,
        paymentMethod,
        tipo,
        interno,
        financeiroId,
        date: date ? new Date(date) : undefined,
      },
    });

    return res.status(200).json(expense);
  } catch (error) {
    console.error('[EVENT_EXPENSES] Erro ao atualizar despesa:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/event-expenses/:id - Delete event expense
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.eventExpense.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[EVENT_EXPENSES] Erro ao excluir despesa:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;