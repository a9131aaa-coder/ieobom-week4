import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicAuthConfig } from '@/lib/supabase/config';

export async function proxy(request: NextRequest) {
  const authConfig = getPublicAuthConfig();
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const headers = new Headers();
  if (authConfig) {
    try {
      const supabase = createServerClient(authConfig.url, authConfig.key, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet, cacheHeaders) {
            for (const cookie of cookiesToSet) {
              request.cookies.set(cookie.name, cookie.value);
              pending.set(cookie.name, cookie);
            }
            Object.entries(cacheHeaders ?? {}).forEach(([name, value]) => headers.set(name, value));
          },
        },
      });
      await supabase.auth.getClaims();
    } catch { /* The route handler verifies the user before accessing personal data. */ }
  }
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  // Next snapshots request headers here. The current handler needs the refreshed cookies too.
  const response = NextResponse.next({ request, headers });
  pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = {
  matcher: ['/', '/chat', '/login', '/auth/:path*', '/account/:path*', '/api/:path*'],
};
