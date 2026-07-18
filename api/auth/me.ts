import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' })
    }

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuario desativado' })
    }

    return res.status(200).json(user)
  } catch (error: any) {
    console.error('[ME ERROR]', error.message, error.code)
    return res.status(500).json({ error: 'Erro interno', details: error.message })
  } finally {
    await prisma.$disconnect()
  }
}
