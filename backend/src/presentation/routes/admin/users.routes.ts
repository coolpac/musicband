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

  // CSV export covers Telegram users only (header is telegram_id). Max users are
  // exported via their own platform-specific flow once that exists.
  let whereClause: { platform: 'telegram'; platformId?: { in: bigint[] } } = {
    platform: 'telegram',
  };
  if (segment === 'just_person' || segment === 'organizer') {
    const role = segment === 'just_person' ? 'just_person' : 'organizer';
    // Get telegram IDs from onboarding_answers with this role
    const onboardingAnswers = await prisma.onboardingAnswer.findMany({
      where: { role, platform: 'telegram' },
      select: { platformId: true },
    });
    const platformIds = onboardingAnswers.map((a) => a.platformId);
    whereClause = { platform: 'telegram', platformId: { in: platformIds } };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: {
      platformId: true,
      username: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });

  // Get all onboarding answers to map roles
  const allOnboarding = await prisma.onboardingAnswer.findMany({
    where: { platform: 'telegram' },
    select: { platformId: true, role: true },
  });
  const roleMap = new Map(allOnboarding.map((a) => [a.platformId.toString(), a.role]));

  // Build CSV with BOM for Excel compatibility
  const BOM = '\uFEFF';
  const header = 'telegram_id,username,first_name,last_name,role,created_at';
  const rows = users.map((u) => {
    const role = roleMap.get(u.platformId.toString()) || '';
    const roleLabel = role === 'just_person' ? 'Физлицо' : role === 'organizer' ? 'Организатор' : role === 'agent' ? 'Агент' : '';
    return [
      u.platformId.toString(),
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
  const adminTelegramId = req.user?.platformId ? Number(req.user.platformId) : null;

  if (!adminTelegramId) {
    res.status(400).json({ error: 'Admin telegram ID not found' });
    return;
  }

  let whereClause: { platform: 'telegram'; platformId?: { in: bigint[] } } = {
    platform: 'telegram',
  };
  if (segment === 'just_person' || segment === 'organizer') {
    const role = segment === 'just_person' ? 'just_person' : 'organizer';
    const onboardingAnswers = await prisma.onboardingAnswer.findMany({
      where: { role, platform: 'telegram' },
      select: { platformId: true },
    });
    whereClause = {
      platform: 'telegram',
      platformId: { in: onboardingAnswers.map((a) => a.platformId) },
    };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: { platformId: true, username: true, firstName: true, lastName: true, createdAt: true },
  });

  const allOnboarding = await prisma.onboardingAnswer.findMany({
    where: { platform: 'telegram' },
    select: { platformId: true, role: true },
  });
  const roleMap = new Map(allOnboarding.map((a) => [a.platformId.toString(), a.role]));

  const BOM = '\uFEFF';
  const header = 'telegram_id,username,first_name,last_name,role,created_at';
  const rows = users.map((u) => {
    const role = roleMap.get(u.platformId.toString()) || '';
    const roleLabel = role === 'just_person' ? 'Физлицо' : role === 'organizer' ? 'Организатор' : role === 'agent' ? 'Агент' : '';
    return [
      u.platformId.toString(),
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

  // Phase 3: платформа захардкожена 'telegram' (CSV-экспорт идёт админу в Telegram).
  await botManager.sendCsvToAdmin(
    { platform: 'telegram', platformId: String(adminTelegramId) },
    Buffer.from(csv, 'utf-8'),
    filename
  );
  res.json({ ok: true, count: users.length, filename });
}));

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
