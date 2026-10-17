import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboard } from '../lib/dashboard-data.mjs';
import { validateDashboard, remainingPercent, shortDate } from '../public/dashboard-model.mjs';
import { dashboardMarkup } from '../lib/dashboard-view.mjs';
const data = await getDashboard();

test('JSON validates, has three counters and five unique records', () => {
  assert.equal(validateDashboard(data), data);
  assert.equal(data.recent.length, 5);
  assert.equal(new Set(data.recent.map(r => r.id)).size, 5);
  assert.ok(data.summary.remaining <= data.summary.limit);
});
test('progress is calculated; zero allowance is handled', () => {
  assert.equal(remainingPercent({remaining:17,limit:20}), 85);
  assert.equal(remainingPercent({remaining:0,limit:0}), 0);
});
test('short dates do not depend on the client timezone', () => assert.equal(shortDate('2026-10-15'), '10.15'));
test('reject invalid counter, negative values, wrong record count and unsafe image path', () => {
  for (const change of [
    d => d.summary.remaining = '17',
    d => d.summary.wardrobeCount = -1,
    d => d.summary.profileCompletion = 110,
    d => d.recent.pop(),
    d => d.recent[0].thumbnail = 'https://example.com/pixel',
  ]) {
    const d = structuredClone(data); change(d);
    assert.throws(() => validateDashboard(d));
  }
});
