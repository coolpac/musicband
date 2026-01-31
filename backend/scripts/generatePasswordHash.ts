/**
 * Утилита для генерации bcrypt хеша пароля админа
 *
 * Usage:
 * npx ts-node scripts/generatePasswordHash.ts "your-secure-password"
 *
 * Затем добавить сгенерированный хеш в .env:
 * ADMIN_PASSWORD_HASH="$2b$10$..."
 */

import bcrypt from 'bcryptjs';

async function generateHash() {
  const password = process.argv[2];

  if (!password) {
    console.error('❌ Error: Password argument is required');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/generatePasswordHash.ts "your-password"\n');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long');
    process.exit(1);
  }

  console.log('🔐 Generating bcrypt hash...\n');

  // Генерируем хеш с salt rounds = 12 (более безопасно)
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);

  console.log('✅ Password hash generated successfully!\n');
  console.log('Add this to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
  console.log('⚠️  Keep this hash SECRET and never commit it to git!');
  console.log('⚠️  Delete the old ADMIN_PASSWORD variable from .env\n');
}

generateHash().catch((error) => {
  console.error('❌ Error generating hash:', error);
  process.exit(1);
});
