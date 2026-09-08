import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token nao fornecido' })
    }

    const token = authHeader.split(' ')[1]

    let decoded: { userId: string; email: string }
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string }
    } catch {
      return res.status(401).json({ error: 'Token invalido ou expirado' })
    }

    const { nome } = req.body || {}

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ error: 'Nome e obrigatorio' })
    }

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { nome: nome.trim() },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        createdAt: true,
      },
    })

    return res.status(200).json(user)
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('[PROFILE ERROR]', err.message, err.code)
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario nao encontrado' })
    }
    return res.status(500).json({ error: 'Erro interno', details: err.message })
  } finally {
    await prisma.$disconnect()
  }
}