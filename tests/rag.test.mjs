import test from 'node:test';
import assert from 'node:assert/strict';
import { embedText, normalizeVector, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '../lib/rag-provider.mjs';
import { answerQuestion, createChatHandler, normalizeQuestion, validateGroundedAnswer, NO_EVIDENCE_ANSWER } from '../lib/rag.mjs';

const env = { LLM_API_KEY: 'TEST_AI_SECRET_NOT_REAL', EMBEDDING_MODEL,
  CHAT_MODEL: 'gemini-3.5-flash-lite', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_TEST_DATABASE_NOT_REAL' };
const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i === 0 ? 2 : 0);
const rows = [
  { content_id: 'look-006', title: '도서관에서 보내는 오후', worn_on: '2026-10-23', chunk_text: '크림 니트 · 진청 데님 · 화이트 스니커즈. 오래 걸을 때 편안한 코디입니다.', thumbnail: '/images/look-01.webp', similarity: 0.81 },
  { content_id: 'look-009', title: '발표가 있는 날', worn_on: '2026-10-20', chunk_text: '화이트 셔츠 · 차콜 슬랙스 · 블랙 재킷.', similarity: 0.71 },
];
const answer = { found: true, answer: '2026-10-23의 「도서관에서 보내는 오후」 기록에는 크림 니트와 진청 데님, 화이트 스니커즈 조합이 있어요. 편안한 코디로 기록되어 있어요.',
  citations: [{ id: 'look-006', quote: '크림 니트 · 진청 데님 · 화이트 스니커즈' }] };
const logger = { info() {} };
function mocked({ matches = rows, generated = answer, embeddingResponse, searchResponse, generationResponse, requests = [] } = {}) {
  return async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    if (url.endsWith(':embedContent')) return embeddingResponse || Response.json({ embedding: { values: vector }, usageMetadata: { promptTokenCount: 12 } });
    if (url.endsWith('/rpc/match_contents')) return searchResponse || Response.json(matches);
    if (url.endsWith(':generateContent')) return generationResponse || Response.json({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(generated) }] } }],
      usageMetadata: { promptTokenCount: 850, candidatesTokenCount: 110, thoughtsTokenCount: 35 },
    });
    assert.fail('Unexpected URL');
  };
}

test('embedding uses the supported model-2 prefixes, exactly 768 dimensions and normalized vectors', async () => {
  const requests = [];
  const fetcher = mocked({ requests });
  const query = await embedText('편한 코디?', { env, fetcher });
  const document = await embedText('크림 니트와 청바지', { kind: 'document', title: '오후', env, fetcher });
  assert.equal(requests[0].body.content.parts[0].text, 'task: search result | query: 편한 코디?');
  assert.equal(requests[1].body.content.parts[0].text, 'title: 오후 | text: 크림 니트와 청바지');
  for (const request of requests) {
    assert.equal(request.body.outputDimensionality, 768);
    assert.equal(request.body.taskType, undefined);
    assert.equal(request.init.headers['x-goog-api-key'], env.LLM_API_KEY);
    assert.equal(request.url.includes(env.LLM_API_KEY), false);
  }
  assert.equal(query.vector.length, 768);
  assert.equal(Math.hypot(...query.vector), 1);
  assert.equal(document.tokens, 12);
});

test('reject malformed/zero embeddings and model mixing before retrieval', async () => {
  for (const bad of [[], Array(768).fill(0), Array(768).fill(null), [...Array(767).fill(1), NaN], Array(769).fill(1)]) {
    assert.throws(() => normalizeVector(bad), /invalid_embedding/);
  }
  await assert.rejects(embedText('question', { env: { ...env, EMBEDDING_MODEL: 'gemini-embedding-001' }, fetcher: () => assert.fail('No mixed-model calls') }), /invalid_embedding_model/);
});

test('answer cites only used records; sources are server-owned and usage is preserved', async () => {
  const requests = [], logs = [];
  const result = await answerQuestion('편하게 오래 걸을 때 입는 조합은?', { env, fetcher: mocked({ requests }), logger: { info: (...items) => logs.push(items) } });
  assert.equal(result.status, 'answered');
  assert.equal(result.fallback, false);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].id, 'look-006');
  assert.equal(result.sources[0].similarity, 0.81);
  assert.equal(result.sources[0].thumbnail, '/images/look-01.webp');
  assert.equal(result.sources[0].content, rows[0].chunk_text);
  assert.equal(result.metrics.embeddingTokens, 12);
  assert.equal(result.metrics.inputTokens, 850);
  assert.equal(result.metrics.outputTokens, 110);
  assert.equal(result.metrics.thinkingTokens, 35);
  assert.equal(result.metrics.retrievedCount, 2);
  assert.equal(result.metrics.topSimilarity, 0.81);
  assert.equal(logs.length, 1);
  const serialized = JSON.stringify({ result, logs });
  assert.equal(JSON.stringify(logs).includes('도서관'), false);
  assert.equal(JSON.stringify(logs).includes('편하게 오래'), false);
  assert.equal(serialized.includes(env.LLM_API_KEY), false);
  assert.equal(serialized.includes(env.SUPABASE_SECRET_KEY), false);
  const search = requests[1];
  assert.deepEqual(Object.keys(search.body).sort(), ['filter_model', 'filter_profile_id', 'match_count', 'match_threshold', 'query_embedding']);
  assert.equal(search.body.filter_profile_id, 'demo-profile');
  assert.equal(search.body.filter_model, EMBEDDING_MODEL);
  assert.equal(search.body.match_count, 5);
  assert.equal(search.body.match_threshold, 0.45);
  assert.equal(search.init.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(search.init.headers.Authorization, undefined);
  assert.equal(search.init.cache, 'no-store');
});

test('valid index with no matches or below-threshold records makes no generation call', async () => {
  for (const matches of [[], rows.map(row => ({ ...row, similarity: 0.3 }))]) {
    const requests = [];
    const result = await answerQuestion('근거가 없는 내용', { env, fetcher: mocked({ matches, requests }), logger });
    assert.equal(result.status, 'no_evidence');
    assert.equal(result.fallback, false);
    assert.deepEqual(result.sources, []);
    assert.equal(result.metrics.generationMs, 0);
    assert.equal(result.metrics.inputTokens, null);
    assert.equal(requests.length, 2);
  }
});

test('high similarity alone does not force an answer; generated refusal never exposes irrelevant sources or claims', async () => {
  const result = await answerQuestion('기록 속 옷의 정확한 가격은?', { env, logger,
    fetcher: mocked({ matches: rows.map(row => ({ ...row, similarity: 0.99 })),
      generated: { found: false, answer: '보여 주면 안 되는 근거 없는 가격 123원', citations: [{ id: 'look-006', quote: '크림 니트' }] } }) });
  assert.equal(result.status, 'no_evidence');
  assert.equal(result.reason, 'insufficient_evidence');
  assert.equal(result.answer, NO_EVIDENCE_ANSWER);
  assert.deepEqual(result.sources, []);
  assert.equal(result.metrics.inputTokens, 850);
  assert.equal(result.metrics.topSimilarity, 0.99);
});

test('source thumbnails are restricted to the app image directory', async () => {
  for (const thumbnail of ['https://evil.test/photo.jpg', '/images/../../secret.jpg', 'data:image/png;base64,bad', '/images/photo.svg']) {
    const result = await answerQuestion('편한 조합?', { env, logger, fetcher: mocked({ matches: [{ ...rows[0], thumbnail }] }) });
    assert.equal(result.status, 'answered');
    assert.equal(result.sources[0].thumbnail, undefined);
  }
});

test('fabricated IDs, quotations, duplicate citations, unnamed sources and bracket indexes are rejected', () => {
  const sources = rows.map(row => ({ id: row.content_id, title: row.title, date: row.worn_on, content: row.chunk_text, similarity: row.similarity }));
  assert.equal(validateGroundedAnswer(answer, sources).status, 'answered');
  const cases = [
    value => value.citations[0].id = 'invented',
    value => value.citations[0].quote = '캐시미어 100% 9만원',
    value => value.citations.push(value.citations[0]),
    value => value.citations = [],
    value => value.answer = '기록 제목을 밝히지 않은 답변이에요.',
    value => value.answer += ' [1]',
    value => value.answer = '',
  ];
  for (const mutate of cases) { const bad = structuredClone(answer); mutate(bad); assert.throws(() => validateGroundedAnswer(bad, sources)); }
});

test('missing config and unsupported model never invoke external APIs', async () => {
  for (const options of [{}, { ...env, LLM_API_KEY: '' }, { ...env, NEXT_PUBLIC_SUPABASE_URL: 'http://invalid.test' },
    { ...env, CHAT_MODEL: 'TEST_AI_SECRET_NOT_REAL' }, { ...env, EMBEDDING_MODEL: 'gemini-embedding-001' }, { ...env, RAG_MATCH_THRESHOLD: 'NaN' }]) {
    const result = await answerQuestion('질문', { env: options, logger, fetcher: () => assert.fail('Config should stop all requests') });
    assert.equal(result.status, 'fallback');
    assert.equal(result.fallback, true);
    assert.deepEqual(result.sources, []);
    assert.equal(JSON.stringify(result).includes('TEST_AI_SECRET_NOT_REAL'), false);
  }
});

test('embedding/search/generation failures return stable technical fallback without provider details', async () => {
  const cases = [
    [mocked({ embeddingResponse: new Response('raw API secret detail', { status: 429 }) }), 'provider_limit'],
    [mocked({ searchResponse: new Response('index_not_ready with private details', { status: 400 }) }), 'search_unavailable'],
    [mocked({ matches: { error: 'raw API secret detail' } }), 'invalid_search_response'],
    [mocked({ generationResponse: new Response('raw API secret detail', { status: 404 }) }), 'model_not_found'],
    [mocked({ generationResponse: Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) }), 'incomplete_answer'],
    [mocked({ generationResponse: Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] }) }), 'invalid_answer'],
    [async () => { throw new Error('raw API secret detail'); }, 'connection_error'],
  ];
  for (const [fetcher, reason] of cases) {
    const logs = [];
    const result = await answerQuestion('기록을 찾아줘', { env, fetcher, logger: { info: (...items) => logs.push(items) } });
    assert.equal(result.status, 'fallback');
    assert.equal(result.reason, reason);
    assert.equal(result.fallback, true);
    assert.deepEqual(result.sources, []);
    assert.equal(logs.length, 1);
    assert.equal(JSON.stringify({ result, logs }).includes('raw API secret detail'), false);
  }
});

test('timeout aborts the active stage and keeps the UI response usable', async () => {
  const result = await answerQuestion('기록을 찾아줘', { env, logger, timeoutMs: 5,
    fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  assert.equal(result.reason, 'timeout');
  assert.equal(result.status, 'fallback');
  assert.ok(result.metrics.embeddingMs >= 0);
  assert.equal(result.metrics.searchMs, 0);
});

test('invalid or overlong questions are rejected before AI calls, including direct use', async () => {
  for (const body of [null, [], { question: '' }, { question: '  ' }, { question: 5 }, { question: '가'.repeat(301) }]) {
    assert.throws(() => normalizeQuestion(body));
  }
  assert.equal(normalizeQuestion({ question: '  편한 코디  ' }), '편한 코디');
  assert.equal(normalizeQuestion({ question: '가'.repeat(300) }).length, 300);
  await assert.rejects(answerQuestion('', { env, logger, fetcher: () => assert.fail('Invalid input must not call AI') }));
});

const request = (body, headers = {}, url = 'https://app.test/api/chat') => new Request(url, { method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://app.test', ...headers }, body: JSON.stringify(body) });

test('route rejects cross-origin, wrong content type, oversized and malformed requests without AI', async () => {
  const handle = createChatHandler({ env, logger, fetcher: () => assert.fail('No calls for rejected requests') });
  for (const [req, status] of [
    [request({ question: '옷' }, { origin: 'https://other.test' }), 403],
    [request({ question: '옷' }, { 'content-type': 'application/json-wrong' }), 415],
    [request({ question: '옷' }, { 'content-length': '5000' }), 413],
    [request({ question: '옷'.repeat(301) }), 400],
    [request({ question: '옷', padding: 'a'.repeat(5000) }), 413],
    [new Request('https://app.test/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), 400],
  ]) {
    const response = await handle(req);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('route returns HTTP200 for technical failure and bounds repeated paid requests per instance', async () => {
  const requests = [];
  const handle = createChatHandler({ env, logger, fetcher: mocked({ requests, matches: [] }) });
  for (let i = 0; i < 5; i++) {
    const response = await handle(request({ question: '옷', history: [{ role: 'user', content: 'old private context' }], filter_profile_id: 'other-user' }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'no_evidence');
  }
  assert.equal(requests.length, 10);
  assert.equal(JSON.stringify(requests).includes('old private context'), false);
  assert.equal(JSON.stringify(requests).includes('other-user'), false);
  const limited = await handle(request({ question: '옷' }));
  assert.equal(limited.status, 200);
  assert.equal((await limited.json()).reason, 'server_limit');
  assert.equal(requests.length, 10);
  const broken = createChatHandler({ env: {}, logger, fetcher: () => assert.fail('Missing config') });
  const failed = await broken(request({ question: '옷' }));
  assert.equal(failed.status, 200);
  assert.equal((await failed.json()).fallback, true);
});

test('legacy service-role JWT uses Bearer while malformed DB rows never enter prompts', async () => {
  const requests = [];
  const result = await answerQuestion('옷?', { env: { ...env, SUPABASE_SECRET_KEY: 'eyJ_TEST_NOT_REAL' }, logger,
    fetcher: mocked({ requests, matches: [{ ...rows[0], similarity: '0.81' }] }) });
  assert.equal(requests[1].init.headers.Authorization, 'Bearer eyJ_TEST_NOT_REAL');
  assert.equal(result.reason, 'invalid_search_response');
  assert.equal(requests.length, 2);
});
