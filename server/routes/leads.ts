import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/leads - List all leads
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(leads);
  } catch (error) {
    console.error('[LEADS] Erro ao buscar leads:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/leads/:id - Get single lead
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
    });
    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }
    return res.status(200).json(lead);
  } catch (error) {
    console.error('[LEADS] Erro ao buscar lead:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/leads - Create lead
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      name, niche, whatsapp, email, instagram, stage, origin,
      firstContact, closingDate, followUpReminder, address, notes,
      value, items, lastModifiedBy
    } = req.body;

    if (!name || !niche || !whatsapp || !email || !stage) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, niche, whatsapp, email, stage' });
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        niche,
        whatsapp,
        email,
        instagram,
        stage,
        origin,
        firstContact: firstContact ? new Date(firstContact) : new Date(),
        closingDate: closingDate ? new Date(closingDate) : null,
        followUpReminder: followUpReminder ? new Date(followUpReminder) : null,
        address,
        notes,
        value: value || '0',
        items,
        lastModifiedBy,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'lead_criado',
        descricao: `Lead "${name}" criado`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(201).json(lead);
  } catch (error) {
    console.error('[LEADS] Erro ao criar lead:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/leads/:id - Update lead
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      name, niche, whatsapp, email, instagram, stage, origin,
      firstContact, closingDate, followUpReminder, address, notes,
      value, items, lastModifiedBy
    } = req.body;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        name,
        niche,
        whatsapp,
        email,
        instagram,
        stage,
        origin,
        firstContact: firstContact ? new Date(firstContact) : undefined,
        closingDate: closingDate ? new Date(closingDate) : null,
        followUpReminder: followUpReminder ? new Date(followUpReminder) : null,
        address,
        notes,
        value,
        items,
        lastModifiedBy,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'lead_atualizado',
        descricao: `Lead "${name}" atualizado`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(200).json(lead);
  } catch (error) {
    console.error('[LEADS] Erro ao atualizar lead:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.lead.delete({
      where: { id: req.params.id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'lead_excluido',
        descricao: `Lead excluído`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[LEADS] Erro ao excluir lead:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;