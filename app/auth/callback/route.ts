import { getAccountContext } from '@/lib/supabase/server';
import { safeAuthNext } from '@/lib/auth-input.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const account = await getAccountContext();
  const finish = (path: string) => {
    const result = account.apply(Response.redirect(new URL(path, url.origin), 303));
    result.headers.set('Referrer-Policy', 'no-referrer');
    return result;
  };
  if (!code || code.length > 4096 || !account.client) return finish('/login?error=link');
  try {
    const { error } = await account.client.auth.exchangeCodeForSession(code);
    if (error) return finish('/login?error=link');
    return finish(`/auth/complete?next=${encodeURIComponent(safeAuthNext(url.searchParams.get('next')))}`);
  } catch { return finish('/login?error=link'); }
}
