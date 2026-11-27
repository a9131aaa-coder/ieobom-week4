import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { handleAccountRequest } from '../lib/account-data.mjs';

const origin = 'https://app.example.test';
const user = { id: '11111111-1111-4111-8111-111111111111' };
const id = '22222222-2222-4222-8222-222222222222';
const garment = { name: '셔츠', color: '화이트', category: '상의', swatch: '#ffffff' };
const outfit = { title: '출근 코디', occasion: '출근', description: '셔츠 · 바지 · 신발', date: '2026-11-28', analysisKey: 'analysis-1' };

function api() {
  const replies = [];
  const calls = [];
  const client = createClient('https://db.example.test', 'test-public-key', {
    accessToken: async () => 'test-user-token',
    global: { fetch: async (url, init) => {
      calls.push({ url: new URL(url), method: init.method, body: init.body && JSON.parse(init.body) });
      return replies.shift() ?? Response.json({ message: 'unexpected request' }, { status: 400 });
    } },
  });
  return { calls, replies, async request(method, resource, body, itemId) {
    const req = new Request(origin + '/api/me/' + resource + (itemId ? '/' + itemId : ''), {
      method, headers: { origin, 'content-type': 'application/json', 'x-ieobom-user': user.id },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return handleAccountRequest(req, resource, itemId, async () => ({
      status: 'authenticated', user, client, apply: response => response,
    }));
  } };
}

const count = n => new Response(null, { headers: { 'content-range': '*/' + n } });

test('personal wardrobe API validates input, inserts for the verified user, edits and deletes a single item', async () => {
  const { request, calls, replies } = api();
  assert.equal((await request('POST', 'wardrobe', { ...garment, user_id: id })).status, 400);
  assert.equal(calls.length, 0);
  replies.push(count(0), Response.json({ id, ...garment }, { status: 201 }));
  const created = await request('POST', 'wardrobe', garment);
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), { item: { id, ...garment } });
  assert.equal(calls[0].url.searchParams.get('user_id'), 'eq.' + user.id);
  assert.deepEqual(calls[1].body, { user_id: user.id, ...garment });

  replies.push(Response.json([{ id, ...garment, color: '크림' }]), Response.json([{ id }]), Response.json([]));
  assert.equal((await (await request('PATCH', 'wardrobe', { color: '크림' }, id)).json()).item.color, '크림');
  assert.deepEqual(await (await request('DELETE', 'wardrobe', undefined, id)).json(), { deleted: true });
  assert.equal((await request('PATCH', 'wardrobe', { color: '크림' }, id)).status, 404);
  for (const call of calls.slice(2)) {
    assert.equal(call.url.searchParams.get('user_id'), 'eq.' + user.id);
    assert.equal(call.url.searchParams.get('id'), 'eq.' + id);
  }
});

test('personal outfit API returns the same saved record on a concurrent insert or subsequent retry', async () => {
  const { request, calls, replies } = api();
  const stored = { id, title: outfit.title, description: outfit.description, occasion: outfit.occasion,
    worn_on: outfit.date, analysis_key: outfit.analysisKey, status: '저장됨' };
  replies.push(Response.json([]), count(0), Response.json({ code: '23505' }, { status: 409 }), Response.json([stored]));
  const first = await request('POST', 'outfits', outfit);
  assert.equal(first.status, 200);
  const result = await first.json();
  assert.equal(result.record.id, id);
  assert.equal(result.record.date, outfit.date);
  assert.equal(result.record.analysisKey, outfit.analysisKey);
  replies.push(Response.json([stored]));
  assert.deepEqual(await (await request('POST', 'outfits', outfit)).json(), result);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  for (const call of calls.filter(call => call.method === 'GET')) {
    assert.equal(call.url.searchParams.get('user_id'), 'eq.' + user.id);
    assert.equal(call.url.searchParams.get('analysis_key'), 'eq.' + outfit.analysisKey);
  }
});

test('personal API distinguishes full storage and database failure on save', async () => {
  const { request, replies, calls } = api();
  replies.push(count(40));
  const full = await request('POST', 'wardrobe', garment);
  assert.equal(full.status, 409);
  assert.equal((await full.json()).code, 'capacity_reached');
  replies.push(Response.json({ code: '42501', message: 'internal storage detail' }, { status: 403 }));
  const failed = await request('POST', 'wardrobe', garment);
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).code, 'storage_unavailable');
  assert.deepEqual(calls.map(call => call.method), ['HEAD', 'HEAD']);
});
