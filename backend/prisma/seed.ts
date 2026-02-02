import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Проверка наличия admin пользователя (создаётся через Telegram бота)
  const adminExists = await prisma.user.findFirst({
    where: { role: UserRole.admin },
  });

  if (!adminExists) {
    console.log('No admin user found. Create one via Telegram bot.');
  }

  console.log('Seed completed.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
