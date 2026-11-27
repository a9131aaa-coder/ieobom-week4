import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createChatHandler } from '../lib/rag.mjs';

const origin = 'https://app.example.test';
const userA = { id: '11111111-1111-4111-8111-111111111111' };
const userB = { id: '22222222-2222-4222-8222-222222222222' };
const recordA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: '푸른도서관 가을룩', worn_on: '2026-11-28',
  occasion: '독서 모임', status: '저장됨', description: '크림 니트 · 진청 데님 · 로퍼', reason: '', tip: '',
};
const recordB = {
  ...recordA, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: '크림 니트 운동복', description: '니트 · 조거 팬츠 · 운동화',
};

function request(question, expectedUser, extra = {}) {
  const headers = { origin, 'content-type': 'application/json' };
  if (expectedUser) headers['x-ieobom-user'] = expectedUser;
  return new Request(`${origin}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ question, ...extra }) });
}

test('signed-in search queries only the verified owner, matches saved terms, and never calls public RAG', async () => {
  let user = userA;
  const calls = [];
  const handle = createChatHandler({
    fetcher: () => assert.fail('Private records and questions must not enter public RAG'),
    logger: { info: () => assert.fail('Private requests must not use the RAG logger') },
    getAccountContext: async () => {
      const sessionUser = user;
      const client = createClient('https://db.example.test', 'test-public-key', {
        accessToken: async () => `token-for-${sessionUser.id}`,
        global: { fetch: async (input, init) => {
          const url = new URL(input);
          const headers = new Headers(init.headers);
          assert.equal(url.pathname, '/rest/v1/ieobom_user_outfits');
          assert.equal(headers.get('apikey'), 'test-public-key');
          assert.equal(headers.get('authorization'), `Bearer token-for-${sessionUser.id}`);
          assert.equal(url.searchParams.get('user_id'), `eq.${sessionUser.id}`);
          calls.push(sessionUser.id);
          return Response.json(sessionUser === userA ? [recordA] : [recordB]);
        } },
      });
      return { status: 'authenticated', user: sessionUser, client, apply: response => response };
    },
  });

  const question = '푸른도서관의 가을룩 기록이 있나요?';
  const responseA = await handle(request(question, userA.id, { user_id: userB.id, source: 'guest' }));
  assert.equal(responseA.status, 200);
  assert.match(responseA.headers.get('cache-control'), /private, no-store/);
  assert.equal(responseA.headers.get('vary'), 'Cookie');
  const own = await responseA.json();
  assert.equal(own.scope, 'personal');
  assert.equal(own.status, 'answered');
  assert.deepEqual(own.sources.map(source => source.id), [recordA.id]);
  assert.match(own.answer, /푸른도서관 가을룩/);
  const composedQuestion = '크림 니트와 로퍼를 함께 쓴 코디를 찾아줘.';
  assert.equal((await (await handle(request(composedQuestion))).json()).status, 'answered');

  user = userB;
  for (const otherQuestion of [question, composedQuestion]) {
    const other = await (await handle(request(otherQuestion, userB.id, { user_id: userA.id }))).json();
    assert.equal(other.scope, 'personal');
    assert.equal(other.status, 'no_evidence');
    assert.deepEqual(other.sources, []);
    assert.doesNotMatch(other.answer, /푸른도서관/);
  }
  assert.deepEqual(calls, [userA.id, userA.id, userB.id, userB.id]);
  const general = await (await handle(request('내 코디 기록 보여줘', userB.id))).json();
  assert.equal(general.status, 'no_evidence');
  assert.deepEqual(general.sources, []);
  assert.equal(calls.length, 4);
});

test('session changes, auth failure and private database failure fail closed', async () => {
  const forbiddenClient = { from: () => assert.fail('No personal query for invalid sessions') };
  const contexts = [
    [{ status: 'authenticated', user: userB, client: forbiddenClient }, userA.id, 409, 'account_changed'],
    [{ status: 'authenticated', user: userB, client: forbiddenClient }, 'guest', 409, 'account_changed'],
    [{ status: 'anonymous', user: null, client: forbiddenClient }, userA.id, 401, 'login_required'],
    [{ status: 'unconfigured', user: null, client: null }, userA.id, 503, 'auth_unavailable'],
    [{ status: 'unavailable', user: null, client: null }, 'guest', 503, 'auth_unavailable'],
  ];
  for (const [account, expectedUser, status, code] of contexts) {
    const handle = createChatHandler({
      fetcher: () => assert.fail('No guest fallback for failed account checks'),
      getAccountContext: async () => ({ ...account, apply: response => response }),
    });
    const result = await handle(request(recordA.title, expectedUser));
    assert.equal(result.status, status);
    assert.equal((await result.json()).code, code);
  }

  const client = createClient('https://db.example.test', 'test-public-key', {
    accessToken: async () => 'test-token',
    global: { fetch: async () => Response.json({ code: '42501', message: 'database private detail' }, { status: 403 }) },
  });
  const handle = createChatHandler({
    fetcher: () => assert.fail('No fallback to public RAG for a storage error'),
    getAccountContext: async () => ({ status: 'authenticated', user: userA, client, apply: response => response }),
  });
  const failure = await handle(request(recordA.title, userA.id));
  assert.equal(failure.status, 503);
  const error = await failure.json();
  assert.equal(error.code, 'storage_unavailable');
  assert.doesNotMatch(error.error, /database private detail/);
});
