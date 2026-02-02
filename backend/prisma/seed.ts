import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Проверка наличия admin пользователя (создаётся через Telegram бота)
  const adminExists = await prisma.user.findFirst({
    where: { role: UserRole.admin },
  });

  if (!adminExists) {
    console.log('⚠️  No admin user found. Create one via Telegram bot.');
  }

  // Создаём форматы, если их ещё нет
  const formatCount = await prisma.format.count();
  
  if (formatCount === 0) {
    console.log('📋 Creating formats...');
    
    await prisma.format.createMany({
      data: [
        {
          name: 'Свадьба',
          shortDescription: 'Живая музыка для вашего торжества',
          description: 'Полноценный концерт с живым звуком, светом и видеопроекцией. Идеально для больших свадеб и юбилеев.',
          suitableFor: ['Свадьба', 'Юбилей', 'Корпоратив'],
          performers: ['Вокал (2 чел)', 'Гитара', 'Бас', 'Барабаны', 'Клавиши'],
          status: 'available',
          order: 1,
        },
        {
          name: 'Корпоратив',
          shortDescription: 'Живой звук для вашего мероприятия',
          description: 'Профессиональная живая музыка с полным техническим оснащением для корпоративных мероприятий.',
          suitableFor: ['Корпоратив', 'Презентация', 'Открытие'],
          performers: ['Вокал (2 чел)', 'Гитара', 'Бас', 'Барабаны', 'Клавиши'],
          status: 'available',
          order: 2,
        },
        {
          name: 'День рождения',
          shortDescription: 'Зажигательный праздник с живой музыкой',
          description: 'Камерный формат для небольших и средних торжеств. Создадим атмосферу настоящего рок-концерта.',
          suitableFor: ['День рождения', 'Юбилей', 'Частная вечеринка'],
          performers: ['Вокал', 'Гитара', 'Бас', 'Барабаны'],
          status: 'available',
          order: 3,
        },
        {
          name: 'Акустика',
          shortDescription: 'Уютный формат для камерных мероприятий',
          description: 'Акустический формат с вокалом и гитарами. Подходит для небольших помещений и романтических вечеров.',
          suitableFor: ['Камерный вечер', 'Ресторан', 'Кафе'],
          performers: ['Вокал', 'Акустическая гитара'],
          status: 'available',
          order: 4,
        },
      ],
    });
    
    console.log('✅ 4 formats created');
  } else {
    console.log(`ℹ️  ${formatCount} formats already exist, skipping...`);
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
