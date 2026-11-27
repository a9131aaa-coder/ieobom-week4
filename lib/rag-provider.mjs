// Server/Node only. Shared by the chatbot and the offline indexing script.
export const EMBEDDING_MODEL = 'gemini-embedding-2';
export const EMBEDDING_DIMENSIONS = 768;

export class RagProviderError extends Error {
  constructor(code) { super(code); this.name = 'RagProviderError'; this.code = code; }
}

export function embeddingModel(env = process.env) {
  const model = env.EMBEDDING_MODEL || EMBEDDING_MODEL;
  // Changing models requires a deliberate migration and reindex, not a silent fallback.
  if (model !== EMBEDDING_MODEL) throw new RagProviderError('invalid_embedding_model');
  return model;
}

export function normalizeVector(values) {
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS ||
      !values.every(v => typeof v === 'number' && Number.isFinite(v))) {
    throw new RagProviderError('invalid_embedding');
  }
  const norm = Math.hypot(...values);
  if (!Number.isFinite(norm) || norm <= 0) throw new RagProviderError('invalid_embedding');
  return values.map(v => v / norm);
}

export function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function providerFailure(status) {
  return status === 429 ? 'provider_limit' : status === 401 || status === 403 ? 'provider_auth' :
    status === 404 ? 'model_not_found' : 'provider_error';
}

export async function embedText(text, {
  kind = 'query', title = 'none', env = process.env, fetcher = fetch, signal,
} = {}) {
  const model = embeddingModel(env);
  if (!env.LLM_API_KEY) throw new RagProviderError('missing_key');
  if (!['query', 'document'].includes(kind) || typeof text !== 'string' || !text.trim() || text.length > 16000 ||
      typeof title !== 'string' || title.length > 1000) throw new RagProviderError('invalid_embedding_input');
  // Embedding 2 uses prompt prefixes, not the taskType parameter of Embedding 001.
  // https://ai.google.dev/gemini-api/docs/embeddings#task-types-embeddings-2
  const input = kind === 'query' ? `task: search result | query: ${text}` : `title: ${title || 'none'} | text: ${text}`;
  const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.LLM_API_KEY }, signal,
    body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: input }] }, outputDimensionality: EMBEDDING_DIMENSIONS }),
  });
  if (!response.ok) throw new RagProviderError(providerFailure(response.status));
  let data;
  try { data = await response.json(); } catch { throw new RagProviderError('invalid_embedding'); }
  return { vector: normalizeVector(data?.embedding?.values), tokens: tokenCount(data?.usageMetadata?.promptTokenCount) };
}
