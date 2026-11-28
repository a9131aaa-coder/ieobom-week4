import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { dashboardMarkup } from '../lib/dashboard-view.mjs';

const dashboardScript = await readFile('public/dashboard.mjs', 'utf8');
const owner = { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test' };
const otherUser = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.test' };
const record = {
  id: '33333333-3333-4333-8333-333333333333', title: '흰 셔츠로 만든 출근 코디',
  description: '흰 셔츠와 데님', occasion: '출근', date: '2026-11-28', status: '저장됨', kind: 'manual', rating: 0,
};
const result = {
  instagramPublishStatus: 'published', instagramPostId: '18300000000001', instagramPostedAt: '2026-11-28T01:00:00Z',
};
const tick = () => new Promise(resolve => setTimeout(resolve, 30));

async function dashboard(publish) {
  const dom = new JSDOM('<!doctype html><body>' + dashboardMarkup + '</body>', {
    url: 'https://app.example.test/#history', runScripts: 'outside-only',
  });
  const w = dom.window;
  const d = w.document;
  const calls = [];
  const messages = [];
  let user = owner;
  let savedRecord = { ...record };
  let confirmed = false;
  w.structuredClone = structuredClone;
  w.AbortController = AbortController;
  w.AbortSignal = AbortSignal;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.confirm = message => { messages.push(message); return confirmed; };
  w.fetch = async (url, request = {}) => {
    if (url === '/api/session') return Response.json({ user, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json({
      mode: 'personal', user, wardrobe: [], recent: user === owner ? [savedRecord] : [{
        ...record, id: '44444444-4444-4444-8444-444444444444', title: '다른 계정의 코디', description: '검은 니트와 바지',
      }],
      profile: { style: '', colors: '', avoid: '', comfort: '', goal: '' },
      summary: { remaining: 0, limit: 0 }, asOf: '2026-11-28', periodLabel: '내 계정',
      instagramPublishingAvailable: user === owner, instagramImageUrl: user === owner ? 'https://public.example.test/promo.jpg' : undefined,
    });
    if (url === '/api/instagram/publish') { calls.push(request); return publish(); }
    throw new Error('Unexpected request to ' + url);
  };
  w.eval(dashboardScript);
  await tick();
  function open() { d.querySelector('#history-list [data-record]').click(); }
  function button() { return d.querySelector('[data-action="publish-instagram"]'); }
  async function reload() { w.dispatchEvent(new w.Event('ieobom:auth-changed')); await tick(); }
  return { w, d, calls, messages, open, button, reload, confirm: () => { confirmed = true; },
    useOtherAccount: () => { user = otherUser; }, updateRecord: next => { savedRecord = next; } };
}

test('Instagram publish confirms the public material and shows the persisted result only after server success', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const app = await dashboard(() => pending);
  try {
    app.open();
    assert.equal(app.d.querySelector('#record-detail a[target="_blank"]').href, 'https://public.example.test/promo.jpg');
    app.button().click();
    assert.equal(app.calls.length, 0);
    assert.match(app.messages[0], /공개 피드/);
    assert.match(app.messages[0], /흰 셔츠와 데님/);
    app.confirm();
    app.button().click();
    assert.equal(app.button().disabled, true);
    app.button().click();
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].headers['X-Ieobom-User'], owner.id);
    assert.deepEqual(JSON.parse(app.calls[0].body), { id: record.id });
    assert.doesNotMatch(app.d.querySelector('#record-detail').textContent, /게시 완료/);
    resolve(Response.json(result));
    await tick();
    assert.equal(app.button(), null);
    assert.match(app.d.querySelector('#history-list').textContent, /게시 완료/);
    app.updateRecord({ ...record, ...result });
    await app.reload();
    app.open();
    assert.match(app.d.querySelector('#record-detail').textContent, /게시 완료/);
  } finally { app.w.close(); }
});

test('ambiguous Instagram requests stay pending and do not leak after changing accounts', async () => {
  const app = await dashboard(() => Response.json({
    code: 'publication_pending', error: '게시 여부를 확인하는 중이에요.',
  }, { status: 502 }));
  try {
    app.open();
    app.confirm();
    app.button().click();
    await tick();
    assert.equal(app.button(), null);
    assert.match(app.d.querySelector('#record-detail').textContent, /게시 확인 중/);
    assert.doesNotMatch(app.d.querySelector('#record-detail').textContent, /게시 완료/);
    app.useOtherAccount();
    await app.reload();
    app.open();
    assert.equal(app.button(), null);
    assert.doesNotMatch(app.d.querySelector('#record-detail').textContent, /흰 셔츠|Instagram/);
  } finally { app.w.close(); }
});
