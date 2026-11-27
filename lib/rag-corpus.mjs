// Node/server only. Keep this exact text format in sync with ieobom_rag_document SQL.
import { createHash } from 'node:crypto';

export const RAG_PROFILE_ID = 'demo-profile';
export const RAG_DIMENSIONS = 768;
export const RAG_SOURCE_COLUMNS = 'id,profile_id,title,worn_on,occasion,description,status,reason,tip,thumbnail';

export function outfitDocument(row) {
  const fields = ['id', 'profile_id', 'title', 'worn_on', 'occasion', 'description', 'status', 'reason', 'tip'];
  if (!row || fields.some(key => typeof row[key] !== 'string') || row.profile_id !== RAG_PROFILE_ID ||
      !row.id.trim() || !row.title.trim() || row.title.length > 1000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.worn_on)) throw new Error('invalid_source');
  // Preserve whitespace and Unicode exactly: edits must invalidate the old vector.
  const chunkText = [
    `프로필: ${row.profile_id}`,
    `기록 ID: ${row.id}`,
    `제목: ${row.title}`,
    `날짜: ${row.worn_on}`,
    `상황: ${row.occasion}`,
    `옷 조합: ${row.description}`,
    `상태: ${row.status}`,
    `이유: ${row.reason}`,
    `팁: ${row.tip}`,
  ].join('\n');
  if (chunkText.length > 16000) throw new Error('source_too_long');
  return {
    content_id: row.id,
    profile_id: row.profile_id,
    title: row.title,
    chunk_text: chunkText,
    content_hash: createHash('sha256').update(chunkText, 'utf8').digest('hex'),
  };
}

export function storedVector(value) {
  let vector = value;
  if (typeof value === 'string') {
    try { vector = JSON.parse(value); } catch { throw new Error('invalid_stored_vector'); }
  }
  if (!Array.isArray(vector) || vector.length !== RAG_DIMENSIONS ||
      !vector.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error('invalid_stored_vector');
  const norm = Math.hypot(...vector);
  if (Math.abs(norm - 1) > 0.001) throw new Error('invalid_stored_vector');
  return { vector, norm };
}

export function embeddingCurrent(row, document, model) {
  if (!row || row.content_id !== document.content_id || row.profile_id !== document.profile_id ||
      row.content_hash !== document.content_hash || row.chunk_text !== document.chunk_text ||
      row.model !== model || row.dim !== RAG_DIMENSIONS) return false;
  try { storedVector(row.embedding); return true; } catch { return false; }
}

export function planEmbeddings(sourceRows, embeddingRows, model) {
  if (!Array.isArray(sourceRows) || !Array.isArray(embeddingRows) || sourceRows.length === 0) throw new Error('source_empty');
  const documents = sourceRows.map(outfitDocument);
  const existing = new Map(embeddingRows.map(row => [row.content_id, row]));
  if (new Set(documents.map(row => row.content_id)).size !== documents.length || existing.size !== embeddingRows.length) {
    throw new Error('duplicate_source');
  }
  const pending = documents.filter(doc => !embeddingCurrent(existing.get(doc.content_id), doc, model));
  // No countTokens request: this is a deliberately broad text-byte heuristic, not measured usage.
  const inputBytes = pending.reduce((n, doc) => n + Buffer.byteLength(`title: ${doc.title} | text: ${doc.chunk_text}`, 'utf8'), 0);
  const estimatedTokens = { low: Math.ceil(inputBytes / 4), high: inputBytes };
  return {
    documents, pending, sourceCount: documents.length, skippedCount: documents.length - pending.length,
    estimatedTokens,
    estimatedUsd: { low: estimatedTokens.low * 0.20 / 1e6, high: estimatedTokens.high * 0.20 / 1e6 },
  };
}
