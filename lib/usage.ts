import { NextRequest } from 'next/server';
import { isProTier } from '@/lib/auth';

const FREE_INGEST_LIMIT = Number(process.env.FREE_INGEST_LIMIT || 5);
const MONTH_KEY_PREFIX = 'be:usage:ingest:';

type UsageStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number }) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
};

let store: UsageStore | null | undefined;
const memoryUsage = new Map<string, number>();

function monthBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function secondsUntilMonthEnd(): number {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(60, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export function getClientKey(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map(part => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }

  return 'unknown';
}

async function getStore(): Promise<UsageStore | null> {
  if (store !== undefined) {
    return store;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    store = null;
    return null;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    store = new Redis({ url, token }) as UsageStore;
    return store;
  } catch {
    store = null;
    return null;
  }
}

export type UsageSnapshot = {
  tier: 'free' | 'pro';
  ingestsUsed: number;
  ingestsLimit: number;
  ingestsRemaining: number;
};

export async function getUsage(request: NextRequest): Promise<UsageSnapshot> {
  const tier = isProTier(request) ? 'pro' : 'free';

  if (tier === 'pro') {
    return {
      tier,
      ingestsUsed: 0,
      ingestsLimit: Number.MAX_SAFE_INTEGER,
      ingestsRemaining: Number.MAX_SAFE_INTEGER,
    };
  }

  const clientKey = getClientKey(request);
  const redisKey = `${MONTH_KEY_PREFIX}${monthBucket()}:${clientKey}`;
  const redis = await getStore();

  let used = 0;
  if (redis) {
    const raw = await redis.get(redisKey);
    used = raw ? Number(raw) : 0;
  } else {
    used = memoryUsage.get(redisKey) ?? 0;
  }

  return {
    tier: 'free',
    ingestsUsed: used,
    ingestsLimit: FREE_INGEST_LIMIT,
    ingestsRemaining: Math.max(0, FREE_INGEST_LIMIT - used),
  };
}

function buildFreeUsage(used: number): UsageSnapshot {
  return {
    tier: 'free',
    ingestsUsed: used,
    ingestsLimit: FREE_INGEST_LIMIT,
    ingestsRemaining: Math.max(0, FREE_INGEST_LIMIT - used),
  };
}

export async function consumeIngest(request: NextRequest): Promise<
  | { allowed: true; usage: UsageSnapshot }
  | { allowed: false; usage: UsageSnapshot; status: 402 }
> {
  if (isProTier(request)) {
    return {
      allowed: true,
      usage: {
        tier: 'pro',
        ingestsUsed: 0,
        ingestsLimit: Number.MAX_SAFE_INTEGER,
        ingestsRemaining: Number.MAX_SAFE_INTEGER,
      },
    };
  }

  const clientKey = getClientKey(request);
  const redisKey = `${MONTH_KEY_PREFIX}${monthBucket()}:${clientKey}`;
  const redis = await getStore();

  let used = 0;
  if (redis) {
    used = await redis.incr(redisKey);
    if (used === 1) {
      await redis.set(redisKey, String(used), { ex: secondsUntilMonthEnd() });
    }
  } else {
    used = (memoryUsage.get(redisKey) ?? 0) + 1;
    memoryUsage.set(redisKey, used);
  }

  const usage = buildFreeUsage(used);
  if (used > FREE_INGEST_LIMIT) {
    return { allowed: false, usage, status: 402 };
  }

  return { allowed: true, usage };
}

export function paywallResponse(usage: UsageSnapshot) {
  return {
    success: false,
    error: 'Free tier limit reached. Upgrade to Pro for unlimited ingests.',
    code: 'PAYWALL',
    usage,
    upgradeUrl: '/pricing',
  };
}