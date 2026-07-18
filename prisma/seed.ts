import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('Brasil2016v', 10);

  const user = await prisma.user.upsert({
    where: { email: 'joseleonardomcc@gmail.com' },
    update: {},
    create: {
      email: 'joseleonardomcc@gmail.com',
      senhaHash,
      nome: 'Admin Ventura',
    },
  });

  console.log('Admin upserted:', user.email, user.nome);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
