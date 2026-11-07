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
  if (data.recent.length > 10000) throw new Error('Too many records');
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
  if (typeof data.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.asOf)) throw new Error('Invalid asOf');
  if (!data.profile || !['style','colors','avoid','comfort','goal'].every(k => typeof data.profile[k] === 'string' && data.profile[k].length <= 160)) throw new Error('Invalid profile');
  if (!Array.isArray(data.wardrobe) || data.summary.wardrobeCount !== data.wardrobe.length) throw new Error('Invalid wardrobe');
  if (new Set(data.wardrobe.map(w => w.id)).size !== data.wardrobe.length) throw new Error('Duplicate wardrobe IDs');
  for (const w of data.wardrobe) {
    if (!w || !['id','name','category','color','swatch'].every(k => typeof w[k] === 'string' && w[k].length > 0)) throw new Error('Invalid garment');
    if (!['상의','하의','아우터','신발','가방'].includes(w.category) || !/^#[0-9a-f]{6}$/i.test(w.swatch)) throw new Error('Invalid garment category or color');
  }
  for (const r of data.recent) {
    if (r.rating !== undefined && (!Number.isInteger(r.rating) || r.rating < 0 || r.rating > 5)) throw new Error('Invalid rating');
    if (['reason','tip'].some(k => r[k] !== undefined && typeof r[k] !== 'string')) throw new Error('Invalid record details');
  }
  return data;
}
export function remainingPercent(summary) {
  return summary.limit > 0 ? Math.round(summary.remaining / summary.limit * 100) : 0;
}
export function shortDate(date) {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}
