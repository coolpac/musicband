import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

const CHECK_TIMEOUT_MS = 3000;
const DISK_LOW_GB = 1;
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

async function checkDatabase(): Promise<{ status: 'up' | 'down'; latency: number }> {
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

async function checkRedis(): Promise<{ status: 'up' | 'down'; latency: number }> {
  const start = Date.now();
  try {
    await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

function checkDiskSpace(): { status: 'ok' | 'low'; freeGB: number } {
  try {
    const dir = path.isAbsolute(uploadDir) ? uploadDir : path.join(process.cwd(), uploadDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const statfsSync = (fs as any).statfsSync;
    if (typeof statfsSync !== 'function') {
      return { status: 'ok', freeGB: 0 };
    }
    const stats = statfsSync(dir);
    const bsize = Number(stats.bsize ?? stats.frsize ?? 4096);
    const bavail = Number(stats.bavail ?? stats.bfree ?? 0);
    const freeGB = (bavail * bsize) / (1024 ** 3);
    return {
      status: freeGB < DISK_LOW_GB ? 'low' : 'ok',
      freeGB: Math.round(freeGB * 100) / 100,
    };
  } catch {
    return { status: 'low', freeGB: 0 };
  }
}

function getOverallStatus(checks: {
  database: { status: string };
  redis: { status: string };
  diskSpace: { status: string };
}): 'healthy' | 'degraded' | 'unhealthy' {
  const dbOk = checks.database.status === 'up';
  const redisOk = checks.redis.status === 'up';
  const diskOk = checks.diskSpace.status === 'ok';
  if (!dbOk || !redisOk) return 'unhealthy';
  if (!diskOk) return 'degraded';
  return 'healthy';
}

/**
 * GET /health — полная проверка (без rate limit)
 * 200 если healthy, 503 если degraded/unhealthy
 */
async function getHealth(_req: Request, res: Response): Promise<void> {
  const [database, redisCheck, diskSpace] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkDiskSpace()),
  ]);

  const checks = { database, redis: redisCheck, diskSpace };
  const status = getOverallStatus(checks);

  res
    .status(status === 'healthy' ? 200 : 503)
    .json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks,
    });
}

/**
 * GET /health/ready — readiness probe (K8s)
 * 200 только когда DB и Redis подключены, без деталей
 */
async function getReady(_req: Request, res: Response): Promise<void> {
  const [database, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);
  const ready = database.status === 'up' && redisCheck.status === 'up';
  res.status(ready ? 200 : 503).json({ ready });
}

/**
 * GET /health/live — liveness probe (K8s)
 * Всегда 200 если процесс жив, минимальная нагрузка
 */
function getLive(_req: Request, res: Response): void {
  res.status(200).json({ alive: true });
}

const router = Router();
router.get('/', getHealth);
router.get('/ready', getReady);
router.get('/live', getLive);

export default router;
