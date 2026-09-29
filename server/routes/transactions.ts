import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/transactions - List all transactions (with optional query params)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { origemEventoId } = req.query;
    const where = origemEventoId ? { origemEventoId: origemEventoId as string } : {};
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    return res.status(200).json(transactions);
  } catch (error) {
    console.error('[TRANSACTIONS] Erro ao buscar transações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
    });
    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }
    return res.status(200).json(transaction);
  } catch (error) {
    console.error('[TRANSACTIONS] Erro ao buscar transação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/transactions - Create transaction
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      type, client, description, amount, date, paidDate, status,
      source, paymentMethod, installments, category, eventType,
      origemEventoId, lastModifiedBy, expenseType, recurrence, dueDay, parentId
    } = req.body;

    if (!type || !description || !amount || !date || !status) {
      return res.status(400).json({ error: 'Campos obrigatórios: type, description, amount, date, status' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        type,
        client,
        description,
        amount,
        date: new Date(date),
        paidDate: paidDate ? new Date(paidDate) : null,
        status,
        source,
        paymentMethod,
        installments,
        category,
        eventType,
        origemEventoId,
        lastModifiedBy,
        expenseType,
        recurrence,
        dueDay,
        parentId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'transacao_criada',
        descricao: `Transação "${description}" criada`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(201).json(transaction);
  } catch (error) {
    console.error('[TRANSACTIONS] Erro ao criar transação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/transactions/:id - Update transaction
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      type, client, description, amount, date, paidDate, status,
      source, paymentMethod, installments, category, eventType,
      origemEventoId, lastModifiedBy, expenseType, recurrence, dueDay, parentId
    } = req.body;

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        type,
        client,
        description,
        amount,
        date: date ? new Date(date) : undefined,
        paidDate: paidDate ? new Date(paidDate) : null,
        status,
        source,
        paymentMethod,
        installments,
        category,
        eventType,
        origemEventoId,
        lastModifiedBy,
        expenseType,
        recurrence,
        dueDay,
        parentId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'transacao_atualizada',
        descricao: `Transação "${description}" atualizada`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(200).json(transaction);
  } catch (error) {
    console.error('[TRANSACTIONS] Erro ao atualizar transação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.transaction.delete({
      where: { id: req.params.id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'transacao_excluida',
        descricao: `Transação excluída`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[TRANSACTIONS] Erro ao excluir transação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;