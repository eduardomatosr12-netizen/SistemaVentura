import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/whatsapp-templates - List all templates
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const templates = await prisma.whatsAppTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(templates);
  } catch (error) {
    console.error('[WHATSAPP_TEMPLATES] Erro ao buscar templates:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/whatsapp-templates/:id - Get single template
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: req.params.id },
    });
    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }
    return res.status(200).json(template);
  } catch (error) {
    console.error('[WHATSAPP_TEMPLATES] Erro ao buscar template:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/whatsapp-templates - Create template
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, content, category } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });
    }

    const template = await prisma.whatsAppTemplate.create({
      data: {
        name,
        content,
        category,
      },
    });

    return res.status(201).json(template);
  } catch (error) {
    console.error('[WHATSAPP_TEMPLATES] Erro ao criar template:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/whatsapp-templates/:id - Update template
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, content, category } = req.body;

    const template = await prisma.whatsAppTemplate.update({
      where: { id: req.params.id },
      data: {
        name,
        content,
        category,
      },
    });

    return res.status(200).json(template);
  } catch (error) {
    console.error('[WHATSAPP_TEMPLATES] Erro ao atualizar template:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/whatsapp-templates/:id - Delete template
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.whatsAppTemplate.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[WHATSAPP_TEMPLATES] Erro ao excluir template:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;