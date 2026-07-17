import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'joseleonardomcc@gmail.com';

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log('[SEED] Usuário administrador já existe:', adminEmail);
    return;
  }

  const senhaHash = await bcrypt.hash('Brasil2016v', 10);

  await prisma.user.create({
    data: {
      nome: 'Administrador',
      email: adminEmail,
      senhaHash,
      perfil: 'admin',
      ativo: true,
    },
  });

  console.log('[SEED] Usuário administrador criado com sucesso:', adminEmail);
}

main()
  .catch((e) => {
    console.error('[SEED] Erro ao criar usuário administrador:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
