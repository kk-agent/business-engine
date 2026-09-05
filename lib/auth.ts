import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/safe-equal';

export function isProTier(request: NextRequest): boolean {
  const proKey = process.env.BUSINESS_ENGINE_PRO_KEY;
  const license = request.headers.get('x-be-license');
  return Boolean(proKey && safeEqual(license, proKey));
}

/**
 * Privileged mutations (graph import/delete) require Pro license or admin key.
 */
export function hasPrivilegedAccess(request: NextRequest): boolean {
  if (isProTier(request)) {
    return true;
  }

  const adminKey = process.env.BUSINESS_ENGINE_ADMIN_KEY;
  const provided = request.headers.get('x-be-admin-key');
  return safeEqual(provided, adminKey);
}

export function unauthorizedMutationResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'Unauthorized. Pro license or admin key required for this operation.',
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}