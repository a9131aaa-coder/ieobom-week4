import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateDashboard } from '../public/dashboard-model.mjs';

const PROFILE_ID = 'demo-profile';
const profileKeys = ['style', 'colors', 'avoid', 'comfort', 'goal'];
export async function getMockDashboard() {
  return validateDashboard(JSON.parse(await readFile(join(process.cwd(), 'data', 'dashboard.json'), 'utf8')));
}
// Server routes only. Never serialize keys or upstream errors.
export async function loadDashboard({ env = process.env, fetcher = fetch, timeoutMs = 5000, logger = console } = {}) {
  const mock = await getMockDashboard();
  const fallback = reason => { logger.warn('[dashboard]', reason); return { data: mock, source: 'mock', reason }; };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return fallback('missing_config');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('config');
    const headers = { apikey: env.SUPABASE_SECRET_KEY, Accept: 'application/json' };
    // Modern sb_secret keys are not JWTs. Only legacy JWT keys use Bearer.
    if (env.SUPABASE_SECRET_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${env.SUPABASE_SECRET_KEY}`;
    async function readPage(table, query, offset, limit) {
      const target = new URL(`/rest/v1/${table}`, url.origin);
      target.search = new URLSearchParams({ ...query, offset: String(offset), limit: String(limit) }).toString();
      const response = await fetcher(target.toString(), { headers, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('request');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('rows');
      return rows;
    }
    async function readAll(table, query) {
      const all = [];
      for (let offset = 0; offset < 10000; offset += 100) {
        const rows = await readPage(table, query, offset, 100);
        all.push(...rows);
        if (rows.length < 100) return all;
      }
      throw new Error('too_many_rows');
    }
    const [profiles, garments, records] = await Promise.all([
      readPage('ieobom_profiles', { id: `eq.${PROFILE_ID}`, select: 'style,colors,avoid,comfort,goal,remaining,monthly_limit,as_of,period_label' }, 0, 1),
      readAll('ieobom_wardrobe', { profile_id: `eq.${PROFILE_ID}`, select: 'id,name,category,color,swatch', order: 'id.asc' }),
      readAll('ieobom_outfits', { profile_id: `eq.${PROFILE_ID}`, select: 'id,title,description,occasion,worn_on,status,thumbnail,reason,tip,rating', order: 'worn_on.desc,id.desc' }),
    ]);
    if (profiles.length !== 1) throw new Error('profile');
    const p = profiles[0];
    const profile = Object.fromEntries(profileKeys.map(key => [key, p[key]]));
    const data = {
      // mode describes the fictional lesson dataset; source is the response header.
      mode: 'mock', asOf: p.as_of, periodLabel: p.period_label,
      summary: { remaining: p.remaining, limit: p.monthly_limit, wardrobeCount: garments.length,
        profileCompletion: profileKeys.filter(k => typeof profile[k] === 'string' && profile[k].trim()).length * 20 },
      recent: records.map(({ worn_on, ...record }) => ({ ...record, date: worn_on })),
      profile, wardrobe: garments,
    };
    validateDashboard(data);
    return { data, source: 'db', reason: null };
  } catch {
    const reason = controller.signal.aborted ? 'db_timeout' : 'db_unavailable';
    return fallback(reason);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
export async function getDashboard(options) { return (await loadDashboard(options)).data; }
export async function dashboardResponse(options) {
  try {
    const { data, source, reason } = await loadDashboard(options);
    return Response.json(data, { headers: {
      'Cache-Control': 'no-store', 'X-Data-Source': source,
      ...(reason ? { 'X-Data-Fallback': reason } : {}),
    } });
  } catch {
    return Response.json({ error: '대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
