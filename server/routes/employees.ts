import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/employees - List all employees
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { nome: 'asc' },
    });
    return res.status(200).json(employees);
  } catch (error) {
    console.error('[EMPLOYEES] Erro ao buscar funcionários:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/employees/:id - Get single employee
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
    });
    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }
    return res.status(200).json(employee);
  } catch (error) {
    console.error('[EMPLOYEES] Erro ao buscar funcionário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/employees - Create employee
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nome, funcao, telefone, email, cpf, pix, salario, ativo, avatarUrl } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const employee = await prisma.employee.create({
      data: {
        nome,
        funcao,
        telefone,
        email,
        cpf,
        pix,
        salario,
        ativo: ativo !== undefined ? ativo : true,
        avatarUrl,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'funcionario_criado',
        descricao: `Funcionário "${nome}" criado`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(201).json(employee);
  } catch (error) {
    console.error('[EMPLOYEES] Erro ao criar funcionário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nome, funcao, telefone, email, cpf, pix, salario, ativo, avatarUrl } = req.body;

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        nome,
        funcao,
        telefone,
        email,
        cpf,
        pix,
        salario,
        ativo,
        avatarUrl,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'funcionario_atualizado',
        descricao: `Funcionário "${nome}" atualizado`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(200).json(employee);
  } catch (error) {
    console.error('[EMPLOYEES] Erro ao atualizar funcionário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/employees/:id - Delete employee
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.employee.delete({
      where: { id: req.params.id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        acao: 'funcionario_excluido',
        descricao: `Funcionário excluído`,
        userId: req.user!.id,
        userName: req.user!.email,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('[EMPLOYEES] Erro ao excluir funcionário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/employees/:id/avatar - Update employee avatar
router.put('/:id/avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { avatarUrl } = req.body;

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { avatarUrl },
    });

    return res.status(200).json(employee);
  } catch (error) {
    console.error('[EMPLOYEES] Erro ao atualizar avatar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;