import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPublicAuthConfig } from './config';
import { isAnonymousAuthError } from '../auth-input.mjs';

type AccountStatus = 'authenticated' | 'anonymous' | 'unavailable' | 'unconfigured';
export type AccountContext = {
  client: SupabaseClient | null;
  user: User | null;
  status: AccountStatus;
  apply: (response: Response) => Response;
};

export async function getAccountContext(): Promise<AccountContext> {
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const cacheHeaders = new Headers();
  const apply = (response: Response): Response => {
    const result = new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
    pending.forEach(({ name, value, options }) => result.cookies.set(name, value, options));
    cacheHeaders.forEach((value, name) => result.headers.set(name, value));
    result.headers.set('Cache-Control', 'private, no-store');
    result.headers.set('Pragma', 'no-cache');
    result.headers.set('Expires', '0');
    result.headers.set('Vary', [...new Set([...(result.headers.get('Vary') || '').split(',').map(x => x.trim()).filter(Boolean), 'Cookie'])].join(', '));
    return result;
  };
  const config = getPublicAuthConfig();
  if (!config) return { client: null, user: null, status: 'unconfigured', apply };
  const store = await cookies();
  let client: SupabaseClient;
  try {
    client = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => store.getAll(),
        setAll(cookiesToSet, headers) {
          Object.entries(headers ?? {}).forEach(([name, value]) => cacheHeaders.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => {
            pending.set(name, { name, value, options });
            try { store.set(name, value, options); } catch { /* Server Components cannot set cookies; proxy refreshes them. */ }
          });
        },
      },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
    const { data, error } = await client.auth.getUser();
    if (error) return { client, user: null, status: isAnonymousAuthError(error) ? 'anonymous' : 'unavailable', apply };
    return { client, user: data.user, status: data.user ? 'authenticated' : 'anonymous', apply };
  } catch {
    return { client: null, user: null, status: 'unavailable', apply };
  }
}
