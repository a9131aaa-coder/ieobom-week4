// Personal data always uses the verified user's publishable-key client.
// Never import a service/secret-key client here: Supabase RLS is the final boundary.
export const PROFILE_FIELDS = ['style', 'colors', 'avoid', 'comfort', 'goal'];
export const EMPTY_PROFILE = Object.freeze(Object.fromEntries(PROFILE_FIELDS.map(k => [k, ''])));
const CATEGORIES = ['상의', '하의', '아우터', '신발', '가방'];
const STATUSES = ['저장됨', '착용 완료', '피드백 대기'];
const TABLES = { profile: 'ieobom_user_profiles', wardrobe: 'ieobom_user_wardrobe', outfits: 'ieobom_user_outfits' };
const WARDROBE_FIELDS = 'id,name,category,color,swatch';
const OUTFIT_FIELDS = 'id,title,description,occasion,worn_on,status,reason,tip,rating,kind,analysis_key';
const OUTFIT_SEARCH_FIELDS = 'id,title,description,occasion,worn_on,status,reason,tip';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AccountError extends Error {
  constructor(message, status = 400, code = 'invalid_input') { super(message); this.status = status; this.code = code; }
}
const invalid = () => new AccountError('입력한 내용과 글자 수를 확인해 주세요.');
function objectOnly(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw invalid();
}
function text(value, max, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max) throw invalid();
  const clean = value.trim();
  if ((!allowEmpty && !clean) || clean.includes('\u0000')) throw invalid();
  return clean;
}
export function profileInput(body) {
  objectOnly(body, PROFILE_FIELDS);
  return Object.fromEntries(PROFILE_FIELDS.map(k => [k, text(body[k], 160, true)]));
}
export function wardrobeInput(body, partial = false) {
  const fields = ['name', 'category', 'color', 'swatch'];
  objectOnly(body, fields);
  if (!Object.keys(body).length) throw invalid();
  const result = {};
  for (const key of fields) {
    if (partial && !(key in body)) continue;
    result[key] = text(body[key], key === 'name' ? 50 : key === 'color' ? 30 : 20);
  }
  if (result.category !== undefined && !CATEGORIES.includes(result.category)) throw invalid();
  if (result.swatch !== undefined && !/^#[0-9a-f]{6}$/i.test(result.swatch)) throw invalid();
  return result;
}
export function outfitInput(body, partial = false) {
  if (partial) {
    objectOnly(body, ['status', 'rating']);
    if (!Object.keys(body).length) throw invalid();
    if ('status' in body && !STATUSES.includes(body.status)) throw invalid();
    if ('rating' in body && (!Number.isInteger(body.rating) || body.rating < 0 || body.rating > 5)) throw invalid();
    return { ...body };
  }
  objectOnly(body, ['title', 'description', 'occasion', 'date', 'status', 'reason', 'tip', 'rating', 'kind', 'analysisKey']);
  const date = text(body.date, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw invalid();
  const result = {
    title: text(body.title, 80), description: text(body.description, 1000), occasion: text(body.occasion, 40),
    worn_on: date, status: body.status ?? '저장됨', reason: text(body.reason ?? '', 500, true),
    tip: text(body.tip ?? '', 500, true), rating: body.rating ?? 0, kind: body.kind ?? 'manual',
    analysis_key: body.analysisKey == null ? null : text(body.analysisKey, 160),
  };
  if (!STATUSES.includes(result.status) || !['ai', 'fallback', 'manual'].includes(result.kind)
    || !Number.isInteger(result.rating) || result.rating < 0 || result.rating > 5) throw invalid();
  return result;
}
function checkedId(id) { if (typeof id !== 'string' || !UUID.test(id)) throw new AccountError('기록을 찾지 못했어요.', 404, 'not_found'); return id; }
const timed = query => query.abortSignal(AbortSignal.timeout(8000));
function dbError(error) {
  if (!error) return;
  if (['23514', '22001', '22007', '22P02'].includes(error.code)) throw invalid();
  throw new AccountError('저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', 503, 'storage_unavailable');
}
function recordView(row) {
  const { worn_on, analysis_key, ...rest } = row;
  return { ...rest, date: worn_on, thumbnail: '', analysisKey: analysis_key ?? undefined };
}
async function rows(client, table, userId, fields) {
  const all = [];
  for (let offset = 0; offset < 10000; offset += 250) {
    const result = await timed(client.from(table).select(fields).eq('user_id', userId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 249));
    dbError(result.error);
    if (!Array.isArray(result.data)) throw new AccountError('저장된 자료를 확인하지 못했어요.', 503, 'storage_unavailable');
    all.push(...result.data);
    if (result.data.length < 250) return all;
  }
  throw new AccountError('불러올 자료가 너무 많아요. 관리자에게 문의해 주세요.', 503, 'too_many_records');
}
export function loadPersonalOutfitSearchRecords(client, userId) {
  return rows(client, TABLES.outfits, userId, OUTFIT_SEARCH_FIELDS);
}
export async function loadPersonalDashboard(client, user, now = new Date()) {
  const [profileResult, wardrobe, outfits] = await Promise.all([
    timed(client.from(TABLES.profile).select(PROFILE_FIELDS.join(',')).eq('user_id', user.id).maybeSingle()),
    rows(client, TABLES.wardrobe, user.id, WARDROBE_FIELDS),
    rows(client, TABLES.outfits, user.id, OUTFIT_FIELDS),
  ]);
  dbError(profileResult.error);
  const profile = profileResult.data ?? { ...EMPTY_PROFILE };
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const at = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const asOf = `${at.year}-${at.month}-${at.day}`;
  const recent = outfits.map(recordView).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return { mode: 'personal', user: { id: user.id, email: user.email ?? '' }, profile, wardrobe, recent, asOf,
    periodLabel: '내 계정에 저장된 기록', summary: { remaining: 0, limit: 0, wardrobeCount: wardrobe.length,
      profileCompletion: PROFILE_FIELDS.filter(k => typeof profile[k] === 'string' && profile[k].trim()).length * 20 } };
}
async function capacity(client, table, userId, max, label) {
  const result = await timed(client.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId));
  dbError(result.error);
  if (!Number.isInteger(result.count)) throw new AccountError('저장 가능 수를 확인하지 못했어요.', 503, 'storage_unavailable');
  if (result.count >= max) throw new AccountError(`${label}은 최대 ${max}개까지 저장할 수 있어요.`, 409, 'capacity_reached');
}
export async function saveProfile(client, userId, body) {
  const value = profileInput(body);
  const existing = await timed(client.from(TABLES.profile).select('user_id').eq('user_id', userId).maybeSingle());
  dbError(existing.error);
  const update = () => timed(client.from(TABLES.profile).update(value).eq('user_id', userId).select(PROFILE_FIELDS.join(',')).single());
  let result = existing.data ? await update() : await timed(client.from(TABLES.profile).insert({ user_id: userId, ...value }).select(PROFILE_FIELDS.join(',')).single());
  if (result.error?.code === '23505') result = await update(); // Concurrent first saves; never update ownership.
  dbError(result.error);
  return { profile: result.data };
}
export async function saveGarment(client, userId, body, id) {
  const value = wardrobeInput(body, id !== undefined);
  let result;
  if (id !== undefined) result = await timed(client.from(TABLES.wardrobe).update(value).eq('user_id', userId).eq('id', checkedId(id)).select(WARDROBE_FIELDS).maybeSingle());
  else {
    await capacity(client, TABLES.wardrobe, userId, 40, '옷');
    result = await timed(client.from(TABLES.wardrobe).insert({ user_id: userId, ...value }).select(WARDROBE_FIELDS).single());
  }
  dbError(result.error);
  if (!result.data) throw new AccountError('옷을 찾지 못했어요.', 404, 'not_found');
  return { item: result.data };
}
export async function saveRecord(client, userId, body, id) {
  const value = outfitInput(body, id !== undefined);
  const byKey = () => timed(client.from(TABLES.outfits).select(OUTFIT_FIELDS).eq('user_id', userId).eq('analysis_key', value.analysis_key).maybeSingle());
  if (id === undefined && value.analysis_key) {
    const previous = await byKey(); dbError(previous.error);
    if (previous.data) return { record: recordView(previous.data) };
  }
  let result;
  if (id !== undefined) result = await timed(client.from(TABLES.outfits).update(value).eq('user_id', userId).eq('id', checkedId(id)).select(OUTFIT_FIELDS).maybeSingle());
  else {
    await capacity(client, TABLES.outfits, userId, 200, '코디 기록');
    result = await timed(client.from(TABLES.outfits).insert({ user_id: userId, ...value }).select(OUTFIT_FIELDS).single());
    if (result.error?.code === '23505' && value.analysis_key) result = await byKey();
  }
  dbError(result.error);
  if (!result.data) throw new AccountError('코디 기록을 찾지 못했어요.', 404, 'not_found');
  return { record: recordView(result.data) };
}
export async function deletePersonalItem(client, userId, resource, id) {
  const table = resource === 'wardrobe' ? TABLES.wardrobe : resource === 'outfits' ? TABLES.outfits : null;
  if (!table) throw new AccountError('기록을 찾지 못했어요.', 404, 'not_found');
  const result = await timed(client.from(table).delete().eq('user_id', userId).eq('id', checkedId(id)).select('id').maybeSingle());
  dbError(result.error);
  if (!result.data) throw new AccountError('기록을 찾지 못했어요.', 404, 'not_found');
  return { deleted: true };
}

export function accountJson(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Cookie' } });
}
export function verifyAccountContext(context, request, { mutation = false } = {}) {
  if (context.status === 'unconfigured' || context.status === 'unavailable') throw new AccountError('로그인 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.', 503, 'auth_unavailable');
  if (context.status !== 'authenticated' || !context.user || !context.client) throw new AccountError('로그인이 필요해요. 다시 로그인해 주세요.', 401, 'login_required');
  const expected = request.headers.get('x-ieobom-user');
  if ((mutation && !expected) || (expected && expected !== context.user.id)) throw new AccountError('로그인 계정이 바뀌었어요. 화면을 새로 불러와 주세요.', 409, 'account_changed');
  if (mutation && request.headers.get('origin') !== new URL(request.url).origin) throw new AccountError('허용되지 않은 요청입니다.', 403, 'invalid_origin');
  return context;
}
export async function readAccountBody(request) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new AccountError('JSON 입력이 필요합니다.', 415, 'invalid_content_type');
  if (Number(request.headers.get('content-length')) > 12000) throw new AccountError('입력이 너무 깁니다.', 413, 'body_too_large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 12000) throw new AccountError('입력이 너무 깁니다.', 413, 'body_too_large');
  try { return JSON.parse(raw); } catch { throw invalid(); }
}
export function accountErrorResponse(error) {
  return error instanceof AccountError
    ? accountJson({ error: error.message, code: error.code }, error.status)
    : accountJson({ error: '요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.', code: 'storage_unavailable' }, 503);
}
export async function handleAccountRequest(request, resource, id, getContext) {
  let context;
  try {
    context = await getContext();
    const mutation = request.method !== 'GET';
    verifyAccountContext(context, request, { mutation });
    const { client, user } = context;
    let result;
    if (resource === 'dashboard' && request.method === 'GET') result = await loadPersonalDashboard(client, user);
    else if (resource === 'profile' && request.method === 'PUT') result = await saveProfile(client, user.id, await readAccountBody(request));
    else if (request.method === 'DELETE' && id) result = await deletePersonalItem(client, user.id, resource, id);
    else if (['POST', 'PATCH'].includes(request.method) && resource === 'wardrobe') result = await saveGarment(client, user.id, await readAccountBody(request), id);
    else if (['POST', 'PATCH'].includes(request.method) && resource === 'outfits') result = await saveRecord(client, user.id, await readAccountBody(request), id);
    else throw new AccountError('지원하지 않는 요청입니다.', 405, 'method_not_allowed');
    return context.apply(accountJson(result));
  } catch (error) {
    const response = accountErrorResponse(error);
    return context?.apply ? context.apply(response) : response;
  }
}
