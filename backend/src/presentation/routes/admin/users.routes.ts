import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../../middleware/rateLimit';
import { prisma } from '../../../config/database';
import { Request, Response } from 'express';
import { getBotManager } from '../../../infrastructure/telegram/botManager';

const router = Router();

const userRepository = new PrismaUserRepository();
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);

router.use(asyncHandler(authenticate(authService)));
router.use(requireAdmin);
router.use(asyncHandler(adminRateLimiter));

router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const segment = (req.query.segment as string) || 'all';

  let whereClause = {};
  if (segment === 'just_person' || segment === 'organizer') {
    const role = segment === 'just_person' ? 'just_person' : 'organizer';
    // Get telegram IDs from onboarding_answers with this role
    const onboardingAnswers = await prisma.onboardingAnswer.findMany({
      where: { role },
      select: { telegramId: true },
    });
    const telegramIds = onboardingAnswers.map((a) => a.telegramId);
    whereClause = { telegramId: { in: telegramIds } };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: {
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });

  // Get all onboarding answers to map roles
  const allOnboarding = await prisma.onboardingAnswer.findMany({
    select: { telegramId: true, role: true },
  });
  const roleMap = new Map(allOnboarding.map((a) => [a.telegramId.toString(), a.role]));

  // Build CSV with BOM for Excel compatibility
  const BOM = '\uFEFF';
  const header = 'telegram_id,username,first_name,last_name,role,created_at';
  const rows = users.map((u) => {
    const role = roleMap.get(u.telegramId.toString()) || '';
    const roleLabel = role === 'just_person' ? 'Физлицо' : role === 'organizer' ? 'Организатор' : role === 'agent' ? 'Агент' : '';
    return [
      u.telegramId.toString(),
      escapeCsv(u.username || ''),
      escapeCsv(u.firstName || ''),
      escapeCsv(u.lastName || ''),
      roleLabel,
      u.createdAt.toISOString().split('T')[0],
    ].join(',');
  });

  const csv = BOM + header + '\n' + rows.join('\n');

  const segmentLabel = segment === 'just_person' ? 'fizlica' : segment === 'organizer' ? 'organizatory' : 'all';
  const filename = `users_${segmentLabel}_${new Date().toISOString().split('T')[0]}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

// Отправить CSV через admin-бота текущему администратору (для Telegram WebApp)
router.post('/export-bot', asyncHandler(async (req: Request, res: Response) => {
  const segment = (req.query.segment as string) || 'all';
  const adminTelegramId = req.user?.telegramId ? Number(req.user.telegramId) : null;

  if (!adminTelegramId) {
    res.status(400).json({ error: 'Admin telegram ID not found' });
    return;
  }

  let whereClause = {};
  if (segment === 'just_person' || segment === 'organizer') {
    const role = segment === 'just_person' ? 'just_person' : 'organizer';
    const onboardingAnswers = await prisma.onboardingAnswer.findMany({
      where: { role },
      select: { telegramId: true },
    });
    whereClause = { telegramId: { in: onboardingAnswers.map((a) => a.telegramId) } };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: { telegramId: true, username: true, firstName: true, lastName: true, createdAt: true },
  });

  const allOnboarding = await prisma.onboardingAnswer.findMany({
    select: { telegramId: true, role: true },
  });
  const roleMap = new Map(allOnboarding.map((a) => [a.telegramId.toString(), a.role]));

  const BOM = '\uFEFF';
  const header = 'telegram_id,username,first_name,last_name,role,created_at';
  const rows = users.map((u) => {
    const role = roleMap.get(u.telegramId.toString()) || '';
    const roleLabel = role === 'just_person' ? 'Физлицо' : role === 'organizer' ? 'Организатор' : role === 'agent' ? 'Агент' : '';
    return [
      u.telegramId.toString(),
      escapeCsv(u.username || ''),
      escapeCsv(u.firstName || ''),
      escapeCsv(u.lastName || ''),
      roleLabel,
      u.createdAt.toISOString().split('T')[0],
    ].join(',');
  });

  const csv = BOM + header + '\n' + rows.join('\n');
  const segmentLabel = segment === 'just_person' ? 'fizlica' : segment === 'organizer' ? 'organizatory' : 'all';
  const filename = `users_${segmentLabel}_${new Date().toISOString().split('T')[0]}.csv`;

  const botManager = getBotManager();
  if (!botManager) {
    res.status(503).json({ error: 'Bot not available' });
    return;
  }

  await botManager.sendCsvToAdmin(adminTelegramId, Buffer.from(csv, 'utf-8'), filename);
  res.json({ ok: true, count: users.length, filename });
}));

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
