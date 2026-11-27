// Standard paid-tier estimate, not a billing statement. Verified 2026-11-21:
// https://ai.google.dev/gemini-api/docs/pricing
export function estimateRagCost(result, exchangeRate = 1350) {
  const m = result?.metrics;
  if (!m || result.embeddingModel !== 'gemini-embedding-2' || result.model !== 'gemini-3.5-flash-lite' ||
      !Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;
  const valid = value => Number.isSafeInteger(value) && value >= 0;
  if (!valid(m.embeddingTokens)) return null;
  // No generation was made for a zero-match refusal. Unknown/error usage is never assumed free.
  const skipped = result.status === 'no_evidence' && result.reason === 'no_matches';
  if (!skipped && (!valid(m.inputTokens) || !valid(m.outputTokens))) return null;
  const input = skipped ? 0 : m.inputTokens;
  const output = skipped ? 0 : m.outputTokens;
  const thinking = m.thinkingTokens ?? 0;
  if (!valid(thinking)) return null;
  const usd = (m.embeddingTokens * 0.20 + input * 0.30 + (output + thinking) * 2.50) / 1e6;
  return { estimatedUsd: Number(usd.toFixed(8)), estimatedKrw: Number((usd * exchangeRate).toFixed(4)),
    exchangeRate, pricingDate: '2026-11-21', embeddingUsdPerMillion: 0.20,
    inputUsdPerMillion: 0.30, outputUsdPerMillion: 2.50,
    basis: '유료 Standard 단가 환산 추정치. 환율은 가정이며 무료 티어 실제 청구액과 다릅니다. 누락된 thinking 토큰 필드는 0으로 계산합니다.' };
}
