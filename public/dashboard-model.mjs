/** API/브라우저/테스트가 함께 사용하는 데이터 검증. 숫자는 JSON에만 둡니다. */
export function validateDashboard(data) {
  if (!data || data.mode !== 'mock' || !data.summary || !Array.isArray(data.recent)) {
    throw new Error('Invalid dashboard structure');
  }
  const { remaining, limit, wardrobeCount, profileCompletion } = data.summary;
  if (![remaining, limit, wardrobeCount, profileCompletion].every(Number.isFinite)) {
    throw new Error('Dashboard values must be finite numbers');
  }
  if (![remaining, limit, wardrobeCount, profileCompletion].every(Number.isInteger)
    || limit < 0 || remaining < 0 || remaining > limit || wardrobeCount < 0
    || profileCompletion < 0 || profileCompletion > 100) {
    throw new Error('Dashboard values are out of range');
  }
  if (data.recent.length !== 5) throw new Error('Week 4 dashboard needs exactly five records');
  if (new Set(data.recent.map(item => item.id)).size !== data.recent.length) {
    throw new Error('Record IDs must be unique');
  }
  for (const item of data.recent) {
    for (const key of ['id', 'title', 'description', 'occasion', 'date', 'status', 'thumbnail']) {
      if (typeof item[key] !== 'string' || !item[key]) throw new Error(`Invalid record ${key}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) throw new Error('Invalid record date');
    if (!/^\/images\/look-\d{2}\.webp$/.test(item.thumbnail)) throw new Error('Invalid local thumbnail');
    if (!['착용 완료', '피드백 대기', '저장됨'].includes(item.status)) throw new Error('Invalid record status');
  }
  if (typeof data.periodLabel !== 'string') throw new Error('Invalid period');
  return data;
}
export function remainingPercent(summary) {
  return summary.limit > 0 ? Math.round(summary.remaining / summary.limit * 100) : 0;
}
export function shortDate(date) {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}
