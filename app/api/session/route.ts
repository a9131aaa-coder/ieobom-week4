import { getAccountContext } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getAccountContext();
  if (account.status === 'unavailable') return account.apply(Response.json({ user: null, authConfigured: true, error: '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 503 }));
  return account.apply(Response.json({
    user: account.user ? { id: account.user.id, email: account.user.email ?? '' } : null,
    authConfigured: account.status !== 'unconfigured',
  }));
}
