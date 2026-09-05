import { NextRequest, NextResponse } from 'next/server';
import { getUsage } from '@/lib/usage';

export async function GET(request: NextRequest) {
  const usage = await getUsage(request);
  return NextResponse.json({ ok: true, usage });
}