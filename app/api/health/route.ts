import { NextResponse } from 'next/server';
import { getPersistenceMode } from '@/lib/persistence';

export async function GET() {
  const persistence = await getPersistenceMode();
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return NextResponse.json({
    ok: true,
    service: 'business-engine',
    version: '2.0.0',
    persistence,
    features: {
      ingest: true,
      extract: hasAnthropicKey,
      artifacts: true,
      marketing: hasAnthropicKey,
      execute: true,
    },
    timestamp: new Date().toISOString(),
  });
}