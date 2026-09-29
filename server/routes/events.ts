import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/events - List all events
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: 'asc' },
    });
    return res.status(200).json(events);
  } catch (error) {
    console.error('[EVENTS] Erro ao buscar eventos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/events/:id - Get single event
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
    });
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    return res.status(200).json(event);
  } catch (error) {
    console.error('[EVENTS] Erro ao buscar evento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/events - Create event
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      title, client, clientId, eventType, date, dateEnd, time, local,
      decorator, city, description, equipe, clientEmail, clientPhone,
      clientCpf, clientRg, clientAddress, clientGender, contractServices, status,
      valorTotal, desconto, items, despesasInternas
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Título e data são obrigatórios' });
    }

    const event = await prisma.event.create({
      data: {
        title,
        client,
        clientId,
        eventType,
        date,
        dateEnd,
        time,
        local,
        decorator,
        city,
        description,
        equipe,
        clientEmail,
        clientPhone,
        clientCpf,
        clientRg,
        clientAddress,
        clientGender,
        contractServices: contractServices || [],
        status: status || 'orcamento',
        valorTotal: valorTotal || 0,
        desconto: desconto || 0,
        items,
        despesasInternas,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'evento_criado',
        descricao: `Evento "${title}" criado`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(201).json(event);
  } catch (error) {
    console.error('[EVENTS] Erro ao criar evento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      title, client, clientId, eventType, date, dateEnd, time, local,
      decorator, city, description, equipe, clientEmail, clientPhone,
      clientCpf, clientRg, clientAddress, clientGender, contractServices, status,
      valorTotal, desconto, items, despesasInternas
    } = req.body;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        title,
        client,
        clientId,
        eventType,
        date,
        dateEnd,
        time,
        local,
        decorator,
        city,
        description,
        equipe,
        clientEmail,
        clientPhone,
        clientCpf,
        clientRg,
        clientAddress,
        clientGender,
        contractServices,
        status,
        valorTotal,
        desconto,
        items,
        despesasInternas,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'evento_atualizado',
        descricao: `Evento "${title}" atualizado`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(200).json(event);
  } catch (error) {
    console.error('[EVENTS] Erro ao atualizar evento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.event.delete({
      where: { id: req.params.id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'evento_excluido',
        descricao: `Evento excluído`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[EVENTS] Erro ao excluir evento:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;