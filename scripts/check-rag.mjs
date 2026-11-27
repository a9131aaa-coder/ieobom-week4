// Explicit manual evaluation: five requests to an already deployed/local chatbot.
// Usage: node scripts/check-rag.mjs https://ieobom-week4.vercel.app
import { estimateRagCost } from '../lib/rag-cost.mjs';
const cases = [
  ['related', '온라인 미팅 때 카메라에 보이는 옷차림을 확인하는 코디 기록을 찾아줘.', 'look-015 근거 포함'],
  ['related', '기차로 이동할 때 편한 조합과 실내 온도 대비 팁이 있는 기록을 찾아줘.', 'look-010 근거 포함'],
  ['absent', '스키장에 갈 때 저장한 방수 재킷 코디가 있어?', 'no_evidence, 카드 0개'],
  ['unrelated', '자바스크립트 배열을 정렬하는 코드를 알려줘.', 'no_evidence, 카드 0개'],
  ['boundary', '기차 여행 코디에서 입은 베이지 팬츠의 브랜드와 구매 가격은 얼마야?', 'no_evidence, 카드 0개'],
];
let base;
try {
  base = new URL(process.argv[2]);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) throw new Error();
} catch {
  console.error('사용법: node scripts/check-rag.mjs https://ieobom-week4.vercel.app');
  process.exit(1);
}
const results = [];
for (const [category, question, expected] of cases) {
  try {
    const response = await fetch(new URL('/api/chat', base), { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base.origin },
      body: JSON.stringify({ question }), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    results.push({ category, question, expected, httpStatus: response.status,
      status: result.status, answer: result.answer, fallback: result.fallback, reason: result.reason,
      sources: result.sources?.map(({id, title, similarity}) => ({ id, title, similarity })),
      metrics: result.metrics, estimatedCost: estimateRagCost(result), correctness: '직접 확인 필요' });
  } catch {
    results.push({ category, question, expected, error: 'request_failed', correctness: '미확인' });
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), target: base.origin,
  note: '질문별 결과를 실제 코디 기록과 대조해야 합니다. 응답이 왔다는 이유만으로 정답 처리하지 않습니다.', results }, null, 2));
if (results.some(row => row.error || row.httpStatus !== 200 || row.fallback)) process.exitCode = 1;
