import { getAccountContext } from '@/lib/supabase/server';
import { authDestination } from '@/lib/auth-input.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const account = await getAccountContext();
  const finish = (path: string) => {
    const response = Response.redirect(new URL(path, url.origin), 303);
    const result = account.apply(response);
    result.headers.set('Referrer-Policy', 'no-referrer');
    return result;
  };
  if (!hash || hash.length > 2048 || !['email', 'recovery'].includes(type || '') || !account.client) return finish('/login?error=link');
  try {
    const { error } = await account.client.auth.verifyOtp({ token_hash: hash, type: type as 'email' | 'recovery' });
    if (error) return finish('/login?error=link');
    return finish(`/auth/complete?next=${encodeURIComponent(authDestination(type))}`);
  } catch { return finish('/login?error=link'); }
}
