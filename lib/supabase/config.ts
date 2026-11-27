export function getPublicAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null;
    if (!key.startsWith('sb_publishable_')) {
      const payload = key.split('.')[1];
      if (!payload || JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') return null;
    }
    return { url: parsed.origin, key };
  } catch { return null; }
}
