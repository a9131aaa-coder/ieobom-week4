import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRagCost } from '../lib/rag-cost.mjs';
const base = {model:'gemini-3.5-flash-lite',embeddingModel:'gemini-embedding-2',status:'answered',metrics:{embeddingTokens:20,inputTokens:1000,outputTokens:100,thinkingTokens:50}};
test('RAG cost includes question embedding and thinking output', () => {
  assert.equal(estimateRagCost(base).estimatedUsd, 0.000679);
  assert.equal(estimateRagCost(base).estimatedKrw, 0.9167);
});
test('missing usage and unknown model are not priced as free', () => {
  assert.equal(estimateRagCost({...base,model:'gemini-future'}), null);
  assert.equal(estimateRagCost({...base,metrics:{...base.metrics,embeddingTokens:null}}), null);
  assert.equal(estimateRagCost({...base,status:'fallback',metrics:{embeddingTokens:20,inputTokens:null,outputTokens:null}}), null);
  assert.equal(estimateRagCost({...base,status:'no_evidence',reason:'no_matches',metrics:{embeddingTokens:20,inputTokens:null,outputTokens:null}}).estimatedUsd, 0.000004);
});
