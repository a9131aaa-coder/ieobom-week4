import test from 'node:test';
import assert from 'node:assert/strict';
import { outfitDocument, planEmbeddings, storedVector, embeddingCurrent } from '../lib/rag-corpus.mjs';
import { runEmbedding, parseArguments } from '../scripts/embed.mjs';

const model = 'gemini-embedding-2';
const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_TEST_NOT_REAL', LLM_API_KEY: 'TEST_NOT_REAL', EMBEDDING_MODEL: model };
const vector = [1, ...Array(767).fill(0)];
function outfit(i = 0) {
  return { id: `look-${String(i).padStart(3, '0')}`, profile_id: 'demo-profile', title: `출근 코디 ${i}`,
    worn_on: '2026-10-24', occasion: '출근', description: '화이트 셔츠 · 진청 데님', status: '저장됨',
    reason: '가진 옷을 다시 조합합니다.', tip: '편한 신발을 신으세요.', thumbnail: '/images/look-01.webp' };
}
function embedding(row) {
  const { title, ...doc } = outfitDocument(row);
  return { ...doc, model, dim: 768, embedding: JSON.stringify(vector) };
}

function fakeDatabase(source, initial = [], { pageCap = 100, badRpc = false, saveFailureAt = Infinity } = {}) {
  const saved = new Map(initial.map(row => [row.content_id, structuredClone(row)]));
  const requests = [];
  let writeCalls = 0;
  const fetcher = async (url, init) => {
    requests.push({ url, method: init.method });
    assert.equal(url.includes(env.SUPABASE_SECRET_KEY), false);
    assert.equal(init.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(init.headers.Authorization, undefined);
    const u = new URL(url);
    if (u.pathname.endsWith('/rpc/match_contents')) {
      const body = JSON.parse(init.body);
      assert.equal(body.filter_profile_id, 'demo-profile'); assert.equal(body.filter_model, model);
      assert.equal(body.query_embedding.length, 768);
      if (badRpc) return Response.json([{ content_id: 'invented', similarity: 1 }]);
      return Response.json(source.slice(0, 5).map(row => ({ content_id: row.id, title: row.title, worn_on: row.worn_on,
        thumbnail: row.thumbnail, chunk_text: outfitDocument(row).chunk_text, similarity: 1 })));
    }
    if (init.method === 'POST') {
      writeCalls++;
      if (writeCalls === saveFailureAt) return Response.json({ message: 'private upstream detail' }, { status: 500 });
      const row = JSON.parse(init.body);
      assert.equal(u.searchParams.get('on_conflict'), 'content_id');
      assert.equal(init.headers.Prefer, 'resolution=merge-duplicates,return=representation');
      saved.set(row.content_id, row);
      return Response.json([{ content_id: row.content_id, content_hash: row.content_hash, model: row.model, dim: row.dim }]);
    }
    assert.equal(init.method, 'GET');
    assert.equal(u.searchParams.get('profile_id'), 'eq.demo-profile');
    assert.ok(u.searchParams.get('select').includes('id'));
    const rows = u.pathname.endsWith('/ieobom_outfits') ? source : [...saved.values()];
    const offset = Number(u.searchParams.get('offset'));
    const page = rows.slice(offset, offset + Math.min(pageCap, Number(u.searchParams.get('limit'))));
    return Response.json(page, { headers: { 'Content-Range': page.length ? `${offset}-${offset + page.length - 1}/${rows.length}` : `*/${rows.length}` } });
  };
  return { fetcher, requests, saved };
}
const quiet = () => {};

test('corpus hashes change on every searchable field, preserve whitespace, and ignore thumbnail-only edits', () => {
  const row = outfit(), doc = outfitDocument(row);
  assert.equal(doc.chunk_text, '프로필: demo-profile\n기록 ID: look-000\n제목: 출근 코디 0\n날짜: 2026-10-24\n상황: 출근\n옷 조합: 화이트 셔츠 · 진청 데님\n상태: 저장됨\n이유: 가진 옷을 다시 조합합니다.\n팁: 편한 신발을 신으세요.');
  assert.match(doc.content_hash, /^[0-9a-f]{64}$/);
  for (const field of ['id', 'title', 'occasion', 'description', 'status', 'reason', 'tip']) {
    assert.notEqual(outfitDocument({ ...row, [field]: `${row[field]} ` }).content_hash, doc.content_hash, field);
  }
  assert.notEqual(outfitDocument({ ...row, worn_on: '2026-10-25' }).content_hash, doc.content_hash);
  assert.equal(outfitDocument({ ...row, thumbnail: '/images/look-02.webp' }).content_hash, doc.content_hash);
  assert.throws(() => outfitDocument({ ...row, profile_id: 'another-person' }), /invalid_source/);
});

test('skip requires matching text, hash, model, dimensions and a valid stored unit vector', () => {
  const row = outfit(), doc = outfitDocument(row), stored = embedding(row);
  assert.equal(embeddingCurrent(stored, doc, model), true);
  for (const patch of [{ content_hash: 'a'.repeat(64) }, { chunk_text: 'changed' }, { model: 'old-model' }, { dim: 3072 },
    { embedding: JSON.stringify(Array(768).fill(0)) }, { embedding: [NaN, ...Array(767).fill(0)] }]) {
    assert.equal(embeddingCurrent({ ...stored, ...patch }, doc, model), false);
  }
  assert.equal(storedVector(JSON.stringify(vector)).norm, 1);
  assert.throws(() => storedVector('[1,2]'), /invalid_stored_vector/);
});

test('dry run makes only DB SELECT requests, requires no AI key, and paginates a server-capped dataset', async () => {
  const source = Array.from({ length: 205 }, (_, i) => outfit(i));
  const db = fakeDatabase(source, source.slice(0, 2).map(embedding), { pageCap: 37 });
  const logs = [];
  const result = await runEmbedding({ mode: 'dry-run', env: { ...env, LLM_API_KEY: '' }, fetcher: db.fetcher,
    embedder: () => assert.fail('dry-run must not call AI'), log: s => logs.push(s) });
  assert.equal(result.sourceCount, 205); assert.equal(result.plannedCalls, 203); assert.equal(result.skippedCount, 2);
  assert.equal(db.saved.size, 2); assert.ok(db.requests.every(r => r.method === 'GET'));
  assert.equal(db.requests.filter(r => r.url.includes('/ieobom_outfits?')).length, 6);
  assert.ok(result.estimatedUsd.high > 0); assert.match(result.estimateNote, /실제 토큰·청구액이 아닙니다/);
  assert.equal(logs.join('').includes(env.SUPABASE_SECRET_KEY), false);
});

test('sequential embedding is rate limited and each completed row is saved before the next API call', async () => {
  const source = [outfit(0), outfit(1), outfit(2)], db = fakeDatabase(source);
  let clock = 0, calls = 0; const starts = [];
  const result = await runEmbedding({ env, fetcher: db.fetcher, now: () => clock,
    sleep: async ms => { clock += ms; }, log: quiet,
    embedder: async (text, options) => {
      assert.equal(options.kind, 'document'); assert.equal(options.title, source[calls].title);
      assert.equal(text, outfitDocument(source[calls]).chunk_text);
      assert.equal(db.saved.size, calls, 'previous vector must already be checkpointed');
      starts.push(clock); calls++; return { vector, tokens: 10 };
    } });
  assert.deepEqual(starts, [0, 710, 1420]); assert.equal(result.saved, 3);
  assert.equal(result.knownTokens, 30); assert.equal(result.verification.ok, true);
  assert.equal(db.requests.filter(r => r.url.includes('/rpc/')).length, 1);
});

test('mid-run failure keeps checkpoints and a rerun embeds only the missing record', async () => {
  const source = [outfit(0), outfit(1), outfit(2)], db = fakeDatabase(source);
  let calls = 0;
  await assert.rejects(runEmbedding({ env, fetcher: db.fetcher, log: quiet, sleep: async () => {},
    embedder: async () => { if (++calls === 3) throw new Error(`private ${env.LLM_API_KEY}`); return { vector, tokens: null }; } }),
  error => error.code === 'embedding_failed' && error.progress.saved === 2 && !error.message.includes(env.LLM_API_KEY));
  assert.equal(db.saved.size, 2);
  let retryCalls = 0;
  const retry = await runEmbedding({ env, fetcher: db.fetcher, log: quiet,
    embedder: async () => { retryCalls++; return { vector, tokens: 9 }; } });
  assert.equal(retryCalls, 1); assert.equal(retry.skippedCount, 2); assert.equal(retry.verification.embeddingCount, 3);
  const again = await runEmbedding({ env: { ...env, LLM_API_KEY: '' }, fetcher: db.fetcher, log: quiet,
    embedder: () => assert.fail('unchanged data must not cause a paid call') });
  assert.equal(again.saved, 0); assert.equal(again.skippedCount, 3);
});

test('verify uses real SELECT-shaped data and RPC-shaped results, makes no AI calls or writes, rejects stale data', async () => {
  const source = [outfit(0)], db = fakeDatabase(source, source.map(embedding));
  const result = await runEmbedding({ mode: 'verify', env: { ...env, LLM_API_KEY: '' }, fetcher: db.fetcher, log: quiet,
    embedder: () => assert.fail('verify must not call AI') });
  assert.equal(result.dimension, 768); assert.equal(result.minNorm, 1); assert.equal(result.rpcMatches, 1);
  assert.ok(db.requests.every(r => r.method === 'GET' || r.url.endsWith('/rpc/match_contents')));
  source[0].reason = '원본이 바뀌었습니다.';
  await assert.rejects(runEmbedding({ mode: 'verify', env, fetcher: db.fetcher, log: quiet }), /index_not_ready/);
  const corruptRpc = fakeDatabase([outfit(0)], [embedding(outfit(0))], { badRpc: true });
  await assert.rejects(runEmbedding({ mode: 'verify', env, fetcher: corruptRpc.fetcher, log: quiet }), /verification_failed/);
});

test('database errors are not replaced by local examples and do not disclose upstream details', async () => {
  const logs = [];
  await assert.rejects(runEmbedding({ mode: 'dry-run', env, log: x => logs.push(x),
    fetcher: async () => Response.json({ message: env.SUPABASE_SECRET_KEY }, { status: 401 }) }), /db_unavailable/);
  assert.deepEqual(logs, []);
  await assert.rejects(runEmbedding({ mode: 'dry-run', env, log: quiet,
    fetcher: async () => Response.json({ unexpected: 'not an array' }) }), /invalid_db_response/);
  assert.throws(() => planEmbeddings([], [], model), /source_empty/);
  assert.throws(() => parseArguments(['--verify', '--dry-run']), /invalid_arguments/);
  assert.equal(parseArguments(['--dry-run']), 'dry-run');
});

test('save failure stops immediately and leaves earlier upserts available to resume', async () => {
  const source = [outfit(0), outfit(1), outfit(2)], db = fakeDatabase(source, [], { saveFailureAt: 2 });
  let calls = 0;
  await assert.rejects(runEmbedding({ env, fetcher: db.fetcher, log: quiet, sleep: async () => {},
    embedder: async () => { calls++; return { vector, tokens: 1 }; } }),
  error => error.code === 'save_failed' && error.progress.saved === 1);
  assert.equal(calls, 2); assert.equal(db.saved.size, 1);
});
