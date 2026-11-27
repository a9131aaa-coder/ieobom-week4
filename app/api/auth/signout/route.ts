import { getAccountContext } from '@/lib/supabase/server';
import { isSameOrigin } from '@/lib/auth-input.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: '요청한 페이지를 확인할 수 없어요.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return Response.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 415, headers: { 'Cache-Control': 'private, no-store' } });
  const account = await getAccountContext();
  if (account.status === 'unavailable') return account.apply(Response.json({ error: '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 503 }));
  if (account.user && request.headers.get('x-ieobom-user') !== account.user.id) return account.apply(Response.json({ error: '다른 탭에서 로그인한 계정이 바뀌었어요. 화면을 새로고침해 주세요.' }, { status: 409 }));
  if (!account.client) return account.apply(Response.json({ ok: true }));
  try {
    const { error } = await account.client.auth.signOut({ scope: 'local' });
    if (error) return account.apply(Response.json({ error: '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 503 }));
    return account.apply(Response.json({ ok: true }));
  } catch { return account.apply(Response.json({ error: '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 503 })); }
}
