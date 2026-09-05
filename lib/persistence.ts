import type { KnowledgeGraph } from './types';

const GRAPH_KEY = 'business-engine:graph';

type RedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<unknown>;
};

let redisClient: RedisClient | null | undefined;

async function getRedis(): Promise<RedisClient | null> {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({ url, token }) as RedisClient;
    return redisClient;
  } catch (error) {
    console.error('Upstash Redis init failed; using in-memory store.', error);
    redisClient = null;
    return null;
  }
}

export async function loadGraph(fallback: KnowledgeGraph): Promise<KnowledgeGraph> {
  const redis = await getRedis();
  if (!redis) {
    return fallback;
  }

  try {
    const raw = await redis.get(GRAPH_KEY);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as KnowledgeGraph;
  } catch (error) {
    console.error('Failed to load graph from Redis.', error);
    return fallback;
  }
}

export async function saveGraph(graph: KnowledgeGraph): Promise<'redis' | 'memory'> {
  const redis = await getRedis();
  if (!redis) {
    return 'memory';
  }

  try {
    await redis.set(GRAPH_KEY, JSON.stringify(graph));
    return 'redis';
  } catch (error) {
    console.error('Failed to save graph to Redis.', error);
    return 'memory';
  }
}

export async function getPersistenceMode(): Promise<'redis' | 'memory'> {
  const redis = await getRedis();
  return redis ? 'redis' : 'memory';
}