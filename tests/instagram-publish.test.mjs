import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { loadPersonalDashboard } from '../lib/account-data.mjs';
import { createInstagramPublishHandler } from '../lib/instagram-publish.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const record = '33333333-3333-4333-8333-333333333333';
const token = '44444444-4444-4444-8444-444444444444';
const differentToken = '55555555-5555-4555-8555-555555555555';
const postId = '17841400000000001';
const postedAt = '2026-11-28T02:00:00+00:00';
const origin = 'https://ieobom.example.test';
const env = {
  INSTAGRAM_OWNER_USER_ID: owner,
  N8N_INSTAGRAM_WEBHOOK_URL: 'https://n8n.example.test/webhook/ieobom-instagram',
  N8N_WEBHOOK_SECRET: 'course-fixture-header-secret',
  DEFAULT_INSTAGRAM_IMAGE_URL: 'https://storage.example.test/promo/ieobom.jpg',
};

function publishRequest({ account = owner, from = origin, body = { id: record } } = {}) {
  return new Request(origin + '/api/instagram/publish', {
    method: 'POST', headers: { origin: from, 'x-ieobom-user': account, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup({ user = owner, remote = () => Response.json({ id: postId }), finishUnavailable = false } = {}) {
  const calls = [];
  let state = 'ready';
  let claim;
  const client = createClient('https://db.example.test', 'test-public-key', {
    accessToken: async () => 'test-user-token',
    global: { fetch: async (input, options) => {
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer test-user-token');
      const url = new URL(input);
      if (url.pathname.endsWith('/ieobom_user_outfits')) {
        assert.equal(url.searchParams.get('id'), 'eq.' + record);
        assert.equal(url.searchParams.get('user_id'), 'eq.' + owner);
        assert.equal(url.searchParams.get('select'), 'title,description');
        return Response.json([{ title: '저장한 코디', description: '셔츠와 바지' }]);
      }
      const rpc = url.pathname.split('/').at(-1);
      const payload = JSON.parse(options.body);
      assert.equal(payload.outfit_id, record);
      calls.push(rpc);
      if (rpc === 'ieobom_instagram_claim') {
        if (state !== 'ready') return Response.json({ status: state });
        state = 'publishing';
        claim = payload.claim_token;
        return Response.json({ status: 'claimed' });
      }
      assert.equal(rpc, 'ieobom_instagram_finish');
      assert.equal(payload.claim_token, claim);
      assert.equal(payload.provider_post_id, postId);
      if (finishUnavailable) return Response.json({ code: '55000' }, { status: 400 });
      state = 'published';
      return Response.json({ status: 'published', post_id: postId, posted_at: postedAt });
    } },
  });
  const handle = createInstagramPublishHandler({ env, getContext: async () => ({
    status: 'authenticated', client, user: { id: user }, apply: response => response,
  }), fetcher: async (url, options) => {
    calls.push('n8n');
    assert.equal(url, env.N8N_INSTAGRAM_WEBHOOK_URL);
    assert.equal(options.headers['x-ieoga-secret'], env.N8N_WEBHOOK_SECRET);
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), {
      image_url: env.DEFAULT_INSTAGRAM_IMAGE_URL, caption: '저장한 코디\n\n셔츠와 바지\n\n#입어봄',
    });
    return remote();
  } });
  return { handle, calls };
}

test('publish requires the configured same-origin account and uses saved text to record the provider receipt', async () => {
  const denied = setup({ user: other });
  assert.equal((await denied.handle(publishRequest({ account: other }))).status, 403);
  assert.deepEqual(denied.calls, []);

  const { handle, calls } = setup();
  assert.equal((await handle(publishRequest({ account: other }))).status, 409);
  assert.equal((await handle(publishRequest({ from: 'https://other.example.test' }))).status, 403);
  assert.equal((await handle(publishRequest({ body: { id: record, caption: '임의 캡션' } }))).status, 400);
  assert.deepEqual(calls, []);
  const response = await handle(publishRequest());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(await response.json(), { instagramPublishStatus: 'published', instagramPostId: postId, instagramPostedAt: postedAt });
  const duplicate = await handle(publishRequest());
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, 'already_published');
  assert.deepEqual(calls, ['ieobom_instagram_claim', 'n8n', 'ieobom_instagram_finish', 'ieobom_instagram_claim']);
});

test('concurrent requests and uncertain external receipts cannot redispatch the webhook', async () => {
  let startRemote, finishRemote;
  const remoteStarted = new Promise(resolve => { startRemote = resolve; });
  const remoteResponse = new Promise(resolve => { finishRemote = resolve; });
  const { handle, calls } = setup({ remote: () => { startRemote(); return remoteResponse; } });
  const first = handle(publishRequest());
  await remoteStarted;
  const parallel = await handle(publishRequest());
  assert.equal(parallel.status, 409);
  assert.equal((await parallel.json()).code, 'publication_pending');
  finishRemote(Response.json({ stopped: true }, { status: 502 }));
  const failed = await first;
  assert.equal(failed.status, 502);
  assert.equal((await failed.json()).code, 'publication_pending');
  assert.equal((await handle(publishRequest())).status, 409);
  assert.equal(calls.filter(call => call === 'n8n').length, 1);
  assert.equal(calls.includes('ieobom_instagram_finish'), false);

  const lostReceipt = setup({ finishUnavailable: true });
  assert.equal((await lostReceipt.handle(publishRequest())).status, 502);
  assert.equal((await lostReceipt.handle(publishRequest())).status, 409);
  assert.deepEqual(lostReceipt.calls, ['ieobom_instagram_claim', 'n8n', 'ieobom_instagram_finish', 'ieobom_instagram_finish', 'ieobom_instagram_claim']);
});

test('only the configured dashboard owner receives status and a public image link', async () => {
  const original = new Map(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  let migrationPresent = true;
  let projectionReads = 0;
  const client = createClient('https://db.example.test', 'test-public-key', {
    accessToken: async () => 'test-user-token',
    global: { fetch: async input => {
      const url = new URL(input);
      if (url.pathname.endsWith('/ieobom_user_outfits')) {
        if (url.searchParams.get('select').includes('instagram_post_id')) {
          projectionReads++;
          assert.equal(url.searchParams.get('user_id'), 'eq.' + owner);
          return migrationPresent ? Response.json([{ id: record, instagram_post_id: postId, instagram_posted_at: postedAt }])
            : Response.json({ message: 'column missing', code: '42703' }, { status: 400 });
        }
        return Response.json([{ id: record, title: '저장한 코디', worn_on: '2026-11-28' }]);
      }
      return Response.json([]);
    } },
  });
  try {
    const privateView = await loadPersonalDashboard(client, { id: owner });
    assert.equal(privateView.instagramPublishingAvailable, true);
    assert.equal(privateView.instagramImageUrl, env.DEFAULT_INSTAGRAM_IMAGE_URL);
    assert.equal(privateView.recent[0].instagramPublishStatus, 'published');
    assert.equal(privateView.recent[0].instagramPostId, postId);
    assert.doesNotMatch(JSON.stringify(privateView), /webhook|course-fixture-header-secret/);

    const otherView = await loadPersonalDashboard(client, { id: other });
    assert.equal(otherView.instagramPublishingAvailable, false);
    assert.equal(otherView.instagramImageUrl, undefined);
    assert.equal(otherView.recent[0].instagramPublishStatus, undefined);
    assert.equal(projectionReads, 1);

    migrationPresent = false;
    const uninstalled = await loadPersonalDashboard(client, { id: owner });
    assert.equal(uninstalled.instagramPublishingAvailable, false);
    assert.equal(uninstalled.recent[0].id, record);
    assert.equal(uninstalled.instagramImageUrl, undefined);
    assert.equal(projectionReads, 2);
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('PostgreSQL preserves member RLS and blocks pending deletion or updates without the claim', { timeout: 30000 }, async () => {
  const db = await PGlite.create();
  const run = (sql, params = []) => db.query(sql, params);
  const migration = name => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
  async function asUser(id, action) {
    await run("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('SET ROLE authenticated');
    try { return await action(); } finally { await db.exec('RESET ROLE'); }
  }
  const claimSql = 'select public.ieobom_instagram_claim($1, $2) as outcome';
  const finishSql = 'select public.ieobom_instagram_finish($1, $2, $3) as outcome';
  const outcome = async (sql, params) => (await run(sql, params)).rows[0].outcome;
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = pg_catalog AS
        $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(await migration('007_accounts.sql'));
    await db.exec(await migration('009_instagram.sql'));
    await db.exec(await migration('009_instagram.sql'));
    const audit = await run(await migration('008_check_accounts.sql'));
    assert.equal(audit.rows.length, 9);
    assert.ok(audit.rows.every(row => row.결과 === '통과'));
    await run('insert into auth.users(id) values ($1), ($2)', [owner, other]);
    const insert = async () => (await run(`insert into public.ieobom_user_outfits (title,description,occasion,worn_on)
      values ('저장한 코디','셔츠와 바지','일상','2026-11-28') returning id`)).rows[0].id;
    const saved = await asUser(owner, insert);
    await asUser(other, async () => {
      assert.equal((await outcome(claimSql, [saved, token])).status, 'not_found');
      assert.equal((await outcome(finishSql, [saved, token, postId])).status, 'not_found');
    });
    await asUser(owner, async () => {
      assert.equal((await outcome(claimSql, [saved, token])).status, 'claimed');
      assert.equal((await outcome(claimSql, [saved, differentToken])).status, 'publishing');
      assert.equal((await outcome(finishSql, [saved, differentToken, postId])).status, 'invalid');
      await assert.rejects(run('delete from public.ieobom_user_outfits where id=$1', [saved]), { code: '55000' });
      await assert.rejects(run('update public.ieobom_user_outfits set instagram_post_id = $2 where id = $1', [saved, postId]), { code: '42501' });
      await assert.rejects(run('select token from ieobom_private.instagram_publish_claims'), { code: '42501' });
      const finished = await outcome(finishSql, [saved, token, postId]);
      assert.equal(finished.post_id, postId);
      assert.ok(finished.posted_at);
      assert.deepEqual(await outcome(finishSql, [saved, token, postId]), finished);
      assert.equal((await outcome(claimSql, [saved, differentToken])).status, 'published');
      assert.equal((await run('delete from public.ieobom_user_outfits where id=$1 returning id', [saved])).rows[0].id, saved);
      const second = await insert();
      assert.equal((await outcome(claimSql, [second, token])).status, 'claimed');
    });
    await run('delete from auth.users where id = $1', [owner]);
    assert.equal((await run('select count(*) as count from ieobom_private.instagram_publish_claims')).rows[0].count, 0);
  } finally { await db.close(); }
});
