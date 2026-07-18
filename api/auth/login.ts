import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha obrigatorios' })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas' })
    }

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuario desativado' })
    }

    const senhaCorreta = await bcrypt.compare(String(password), user.senhaHash)

    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Credenciais invalidas' })
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, nome: user.nome },
    })
  } catch (error: any) {
    console.error('[LOGIN ERROR]', error.message, error.code)
    return res.status(500).json({ error: 'Erro interno', details: error.message })
  } finally {
    await prisma.$disconnect()
  }
}
