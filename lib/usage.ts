import { NextRequest } from 'next/server';

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
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
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
  const proKey = process.env.BUSINESS_ENGINE_PRO_KEY;
  const license = request.headers.get('x-be-license');
  const tier = proKey && license === proKey ? 'pro' : 'free';

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

export async function consumeIngest(request: NextRequest): Promise<
  | { allowed: true; usage: UsageSnapshot }
  | { allowed: false; usage: UsageSnapshot; status: 402 }
> {
  const usage = await getUsage(request);

  if (usage.tier === 'pro' || usage.ingestsRemaining > 0) {
    if (usage.tier === 'free') {
      const clientKey = getClientKey(request);
      const redisKey = `${MONTH_KEY_PREFIX}${monthBucket()}:${clientKey}`;
      const redis = await getStore();

      if (redis) {
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.set(redisKey, String(count), { ex: secondsUntilMonthEnd() });
        }
        usage.ingestsUsed = count;
        usage.ingestsRemaining = Math.max(0, FREE_INGEST_LIMIT - count);
      } else {
        const next = (memoryUsage.get(redisKey) ?? 0) + 1;
        memoryUsage.set(redisKey, next);
        usage.ingestsUsed = next;
        usage.ingestsRemaining = Math.max(0, FREE_INGEST_LIMIT - next);
      }
    }

    return { allowed: true, usage };
  }

  return { allowed: false, usage, status: 402 };
}

export function isProTier(request: NextRequest): boolean {
  const proKey = process.env.BUSINESS_ENGINE_PRO_KEY;
  const license = request.headers.get('x-be-license');
  return Boolean(proKey && license === proKey);
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