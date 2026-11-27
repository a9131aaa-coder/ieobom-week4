// Run from the project folder (Node 22):
// node --env-file=.env.local scripts/embed.mjs --dry-run
// node --env-file=.env.local scripts/embed.mjs
// node --env-file=.env.local scripts/embed.mjs --verify
// Only the middle command makes paid embedding requests and database writes.
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { embedText, embeddingModel } from '../lib/rag-provider.mjs';
import { RAG_PROFILE_ID, RAG_DIMENSIONS, RAG_SOURCE_COLUMNS, planEmbeddings, storedVector } from '../lib/rag-corpus.mjs';

const EMBEDDING_COLUMNS = 'content_id,profile_id,chunk_text,content_hash,model,dim,embedding';
const MIN_INTERVAL_MS = 710; // 84.51 request starts/minute, below the lecture's 85/minute ceiling.
const MAX_ROWS = 10000;
const SAFE_CODES = new Set([
  'missing_config', 'invalid_config', 'invalid_arguments', 'invalid_embedding_model', 'missing_key',
  'source_empty', 'invalid_source', 'source_too_long', 'duplicate_source', 'db_unavailable', 'db_timeout',
  'invalid_db_response', 'too_many_rows', 'index_not_ready', 'verification_failed', 'invalid_stored_vector',
  'provider_auth', 'provider_limit', 'model_not_found', 'provider_error', 'invalid_embedding',
  'invalid_embedding_input', 'embedding_failed', 'embedding_timeout', 'save_failed',
]);

export class IndexingError extends Error {
  constructor(code, progress = null) { super(SAFE_CODES.has(code) ? code : 'embedding_failed'); this.code = this.message; this.progress = progress; }
}
const safeCode = error => SAFE_CODES.has(error?.code) ? error.code : SAFE_CODES.has(error?.message) ? error.message : 'embedding_failed';

function connection(env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new IndexingError('missing_config');
  let url;
  try { url = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new IndexingError('invalid_config'); }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password ||
      (!env.SUPABASE_SECRET_KEY.startsWith('sb_secret_') && !env.SUPABASE_SECRET_KEY.startsWith('eyJ'))) {
    throw new IndexingError('invalid_config');
  }
  const headers = { apikey: env.SUPABASE_SECRET_KEY, Accept: 'application/json' };
  if (env.SUPABASE_SECRET_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${env.SUPABASE_SECRET_KEY}`;
  return { origin: url.origin, headers };
}

function database(env, fetcher) {
  const { origin, headers } = connection(env);
  async function request(path, { query = {}, method = 'GET', body, prefer } = {}) {
    const url = new URL(`/rest/v1/${path}`, origin);
    url.search = new URLSearchParams(query).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetcher(url.toString(), {
        method, cache: 'no-store', signal: controller.signal,
        headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        // Inspect only a known setup code; never retain/print raw upstream text.
        let error;
        try { error = await response.json(); } catch {}
        if (error?.code === 'P0001' && error.message === 'index_not_ready') throw new IndexingError('index_not_ready');
        throw new IndexingError(method === 'POST' && path === 'content_embeddings' ? 'save_failed' : 'db_unavailable');
      }
      let rows;
      try { rows = await response.json(); } catch { throw new IndexingError('invalid_db_response'); }
      if (!Array.isArray(rows)) throw new IndexingError('invalid_db_response');
      const countText = response.headers.get('content-range')?.split('/')[1];
      const total = /^\d+$/.test(countText || '') ? Number(countText) : null;
      return { rows, total };
    } catch (error) {
      if (error instanceof IndexingError) throw error;
      throw new IndexingError(controller.signal.aborted ? 'db_timeout' : 'db_unavailable');
    } finally { clearTimeout(timer); }
  }
  async function readAll(table, select, order) {
    const rows = [];
    for (;;) {
      const page = await request(table, { query: {
        select, profile_id: `eq.${RAG_PROFILE_ID}`, order: `${order}.asc`, offset: String(rows.length), limit: '100',
      }, prefer: 'count=exact' });
      if (page.total !== null && page.total > MAX_ROWS) throw new IndexingError('too_many_rows');
      rows.push(...page.rows);
      if (rows.length > MAX_ROWS) throw new IndexingError('too_many_rows');
      if (page.total !== null) {
        if (rows.length > page.total || (page.rows.length === 0 && rows.length < page.total)) throw new IndexingError('invalid_db_response');
        if (rows.length === page.total) return rows;
      } else if (page.rows.length < 100) return rows;
      if (rows.length === MAX_ROWS) throw new IndexingError('too_many_rows');
    }
  }
  return {
    readSource: () => readAll('ieobom_outfits', RAG_SOURCE_COLUMNS, 'id'),
    readEmbeddings: () => readAll('content_embeddings', EMBEDDING_COLUMNS, 'content_id'),
    async save(row) {
      const { rows } = await request('content_embeddings', {
        method: 'POST', query: { on_conflict: 'content_id', select: 'content_id,content_hash,model,dim' },
        prefer: 'resolution=merge-duplicates,return=representation', body: row,
      });
      if (rows.length !== 1 || rows[0].content_id !== row.content_id || rows[0].content_hash !== row.content_hash ||
          rows[0].model !== row.model || rows[0].dim !== row.dim) throw new IndexingError('save_failed');
    },
    async probe(vector, model) {
      return (await request('rpc/match_contents', { method: 'POST', body: {
        query_embedding: vector, match_threshold: -1, match_count: 5,
        filter_profile_id: RAG_PROFILE_ID, filter_model: model,
      } })).rows;
    },
  };
}

async function verifyDatabase(db, model) {
  const [source, rows] = await Promise.all([db.readSource(), db.readEmbeddings()]);
  const plan = planEmbeddings(source, rows, model);
  const byId = new Map(plan.documents.map(row => [row.content_id, row]));
  if (rows.length !== source.length || plan.pending.length || rows.some(row => !byId.has(row.content_id))) {
    throw new IndexingError('index_not_ready');
  }
  const norms = rows.map(row => storedVector(row.embedding).norm);
  const matches = await db.probe(storedVector(rows[0].embedding).vector, model);
  const sourceById = new Map(source.map(row => [row.id, row]));
  if (matches.length < 1 || matches.length > 5 || new Set(matches.map(row => row.content_id)).size !== matches.length ||
      !matches.some(row => row.content_id === rows[0].content_id && row.similarity >= 0.999)) throw new IndexingError('verification_failed');
  for (const match of matches) {
    const doc = byId.get(match.content_id), row = sourceById.get(match.content_id);
    if (!doc || match.title !== row.title || match.worn_on !== row.worn_on || match.chunk_text !== doc.chunk_text ||
        match.thumbnail !== row.thumbnail || !/^\/images\/look-0[1-5]\.webp$/.test(match.thumbnail) ||
        typeof match.similarity !== 'number' || !Number.isFinite(match.similarity) || Math.abs(match.similarity) > 1.000001) {
      throw new IndexingError('verification_failed');
    }
  }
  return { ok: true, sourceCount: source.length, embeddingCount: rows.length, missingOrStale: 0,
    model, modelKinds: 1, dimension: RAG_DIMENSIONS, dimensionKinds: 1,
    minNorm: Math.min(...norms), maxNorm: Math.max(...norms), rpcMatches: matches.length };
}

export async function runEmbedding({
  mode = 'run', env = process.env, fetcher = fetch, embedder = embedText,
  now = Date.now, sleep = delay, log = console.log,
} = {}) {
  if (!['run', 'dry-run', 'verify'].includes(mode)) throw new IndexingError('invalid_arguments');
  const model = embeddingModel(env);
  const db = database(env, fetcher);
  if (mode === 'verify') {
    const result = await verifyDatabase(db, model);
    log(JSON.stringify({ event: 'embedding_verified', ...result }));
    return result;
  }
  const [source, existing] = await Promise.all([db.readSource(), db.readEmbeddings()]);
  const plan = planEmbeddings(source, existing, model);
  const summary = { sourceCount: plan.sourceCount, skippedCount: plan.skippedCount,
    plannedCalls: plan.pending.length, estimatedTokens: plan.estimatedTokens, estimatedUsd: plan.estimatedUsd,
    priceUsdPerMillion: 0.20, pricingDate: '2026-11-21', pricingSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    estimateNote: 'UTF-8 바이트 1~4개/토큰을 가정한 참고 범위이며 실제 토큰·청구액이 아닙니다. 무료 티어 적용 여부도 다릅니다.' };
  log(JSON.stringify({ event: mode === 'dry-run' ? 'embedding_dry_run' : 'embedding_plan', ...summary }));
  if (mode === 'dry-run') return { mode, ...summary };
  if (plan.pending.length && !env.LLM_API_KEY) throw new IndexingError('missing_key');

  let saved = 0, lastStart = -Infinity, knownTokens = 0, unknownTokenCalls = 0;
  for (const doc of plan.pending) {
    try {
      const remaining = MIN_INTERVAL_MS - (now() - lastStart);
      if (remaining > 0) await sleep(remaining);
      lastStart = now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let embedded;
      try {
        embedded = await embedder(doc.chunk_text, { kind: 'document', title: doc.title, env, fetcher, signal: controller.signal });
      } catch (error) {
        throw new IndexingError(controller.signal.aborted ? 'embedding_timeout' : safeCode(error));
      } finally { clearTimeout(timer); }
      const { vector } = storedVector(embedded?.vector);
      await db.save({ content_id: doc.content_id, profile_id: doc.profile_id,
        chunk_text: doc.chunk_text, content_hash: doc.content_hash, model, dim: RAG_DIMENSIONS,
        embedding: vector, updated_at: new Date(now()).toISOString() });
      // Each successful vector is saved immediately. A later failure does not discard it.
      saved++;
      if (Number.isSafeInteger(embedded.tokens) && embedded.tokens >= 0) knownTokens += embedded.tokens;
      else unknownTokenCalls++;
      log(JSON.stringify({ event: 'embedding_saved', saved, plannedCalls: plan.pending.length }));
    } catch (error) {
      throw new IndexingError(safeCode(error), { saved, plannedCalls: plan.pending.length });
    }
  }
  const verification = await verifyDatabase(db, model);
  const result = { mode, saved, skippedCount: plan.skippedCount, knownTokens, unknownTokenCalls, verification };
  log(JSON.stringify({ event: 'embedding_complete', ...result }));
  return result;
}

export function parseArguments(args) {
  if (args.length === 0) return 'run';
  if (args.length === 1 && ['--dry-run', '--verify', '--help'].includes(args[0])) return args[0].slice(2);
  throw new IndexingError('invalid_arguments');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = parseArguments(process.argv.slice(2));
    if (mode === 'help') console.log('Node 22에서 실행: node --env-file=.env.local scripts/embed.mjs [--dry-run | --verify]\n옵션 없음: 실제 임베딩·저장. --dry-run: DB 조회와 비용 추정만. --verify: DB 조회·검색 함수 확인만.\n.env.local 변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, LLM_API_KEY, EMBEDDING_MODEL=gemini-embedding-2');
    else await runEmbedding({ mode });
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: safeCode(error),
      ...(error instanceof IndexingError && error.progress ? { progress: error.progress } : {}),
      next: '키 값은 공유하지 마세요. 연결·005 SQL·모델 설정을 확인한 뒤 다시 실행하면 저장된 항목은 건너뜁니다.' }));
    process.exitCode = 1;
  }
}
