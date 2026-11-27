import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { dashboardMarkup } from '../lib/dashboard-view.mjs';

const script = await readFile('public/dashboard.mjs', 'utf8');
const demo = JSON.parse(await readFile('data/dashboard.json', 'utf8'));
const tick = () => new Promise(resolve => setTimeout(resolve, 25));
const A = { id: '11111111-1111-4111-8111-111111111111', email: 'a@example.test' };
const B = { id: '22222222-2222-4222-8222-222222222222', email: 'b@example.test' };
const legacy = JSON.stringify({ version: 1, wardrobe: [], records: [], profile: { style: '옛 브라우저의 개인 취향', colors: '', avoid: '', comfort: '', goal: '' }, analysis: null });

function personal(user, prefix = '내') {
  const wardrobe = [
    { id: '33333333-3333-4333-8333-333333333331', name: prefix + ' 셔츠', category: '상의', color: '화이트', swatch: '#ffffff' },
    { id: '33333333-3333-4333-8333-333333333332', name: prefix + ' 바지', category: '하의', color: '블랙', swatch: '#111111' },
    { id: '33333333-3333-4333-8333-333333333333', name: prefix + ' 신발', category: '신발', color: '화이트', swatch: '#eeeeee' },
  ];
  return { mode: 'personal', user, profile: { style: prefix + ' 취향', colors: '', avoid: '', comfort: '', goal: '' }, wardrobe, recent: [], summary: { remaining: 0, limit: 0, wardrobeCount: 3, profileCompletion: 20 }, asOf: '2026-11-28', periodLabel: '내 계정' };
}
function analysis(snapshot) {
  return { source: 'personal', fallback: false, model: 'test', generatedAt: '2026-11-28T00:00:00Z', occasion: '출근', summary: '내 옷장으로 만든 조합', items: snapshot.wardrobe, outfits: [0, 1, 2].map(i => ({ title: `개인 코디 ${i + 1}`, reason: '가지고 있는 옷의 조합', tip: '편하게 입으세요', itemIds: snapshot.wardrobe.map(w => w.id) })) };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function setup(handler, saved = legacy) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) throw error; });
  const dom = new JSDOM(`<!doctype html><body>${dashboardMarkup}</body>`, { url: 'https://example.test/', runScripts: 'outside-only', virtualConsole });
  const w = dom.window;
  w.structuredClone = structuredClone; w.AbortSignal = AbortSignal; w.AbortController = AbortController;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  if (saved !== undefined) w.localStorage.setItem('ieobom-week5-v1', saved);
  const calls = [];
  w.fetch = async (url, init = {}) => { calls.push({ url, init }); return handler(url, init); };
  w.eval(script); await tick();
  return { dom, w, d: w.document, calls };
}
function submit(w, element) { element.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); }

test('wardrobe photo candidates are editable and only the confirmed garment is saved', async () => {
  const snapshot = personal(A);
  const photoPath = '/api/me/wardrobe/analyze-photo';
  const candidates = [
    { name: '린넨 셔츠', category: '상의', color: '화이트', swatch: '#ffffff' },
    { name: '넓은 바지', category: '하의', color: '네이비', swatch: '#25314a' },
  ];
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    if (url === photoPath && init.method !== 'POST') return Response.json({ available: true });
    assert.equal(init.headers['X-Ieobom-User'], A.id);
    if (url === photoPath) {
      assert.equal(init.body.get('source'), 'shopping');
      assert.equal(init.body.get('photo').type, 'image/jpeg');
      assert.equal(init.headers['Content-Type'], undefined);
      return Response.json({ candidates });
    }
    if (url === '/api/me/wardrobe') {
      const item = JSON.parse(init.body);
      assert.deepEqual(item, { ...candidates[0], name: '확인한 린넨 셔츠' });
      return Response.json({ item: { ...item, id: '44444444-4444-4444-8444-444444444444' } });
    }
    throw new Error('Unexpected endpoint ' + url);
  });
  try {
    const { d, w } = app;
    w.createImageBitmap = async () => ({ width: 400, height: 500, close() {} });
    w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, drawImage() {} });
    w.HTMLCanvasElement.prototype.toBlob = callback => callback(new w.Blob(['jpeg'], { type: 'image/jpeg' }));
    d.getElementById('photo-open').click(); await tick();
    d.getElementById('photo-source').value = 'shopping';
    const file = new w.File(['png'], 'privacy-sensitive-name.png', { type: 'image/png' });
    Object.defineProperty(d.getElementById('wardrobe-photo'), 'files', { value: [file] });
    submit(w, d.getElementById('photo-form')); await tick();
    assert.equal(d.querySelectorAll('[data-photo-candidate]').length, 2);
    assert.equal(app.calls.some(call => call.url === '/api/me/wardrobe'), false);
    d.querySelector('[data-photo-candidate="0"]').click();
    assert.equal(d.getElementById('photo-item-name').value, '린넨 셔츠');
    d.getElementById('photo-item-name').value = '확인한 린넨 셔츠';
    submit(w, d.getElementById('photo-review')); await tick();
    assert.equal(d.getElementById('wardrobe-count').textContent, '4');
    assert.equal(d.querySelectorAll('[data-photo-candidate]').length, 1);
    assert.equal(w.localStorage.getItem('ieobom-week5-v1'), legacy);
  } finally { app.dom.window.close(); }
});

test('wardrobe photo import stays closed and clears fields when the account changes', async () => {
  let user = A;
  const pending = deferred();
  const app = await setup(async url => {
    if (url === '/api/session') return Response.json({ user, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(personal(user));
    if (url === '/api/me/wardrobe/analyze-photo') return pending.promise;
    throw new Error('Unexpected endpoint ' + url);
  });
  try {
    const { d, w } = app;
    d.getElementById('photo-open').click();
    assert.equal(d.getElementById('photo-dialog').open, true);
    user = B;
    w.dispatchEvent(new w.Event('ieobom:auth-changed'));
    await tick();
    pending.resolve(Response.json({ available: true }));
    await tick();
    assert.equal(d.getElementById('photo-dialog').open, false);
    assert.equal(d.getElementById('photo-analyze').disabled, true);
    assert.equal(d.getElementById('photo-status').textContent, '');
    assert.equal(d.getElementById('account-label').textContent, B.email);
  } finally { app.dom.window.close(); }
});

test('manual entry from a photo works with AI disabled and never uploads the file', async () => {
  const snapshot = personal(A);
  const photoPath = '/api/me/wardrobe/analyze-photo';
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    if (url === photoPath && init.method !== 'POST') return Response.json({ available: false });
    if (url === '/api/me/wardrobe') {
      const item = JSON.parse(init.body);
      assert.deepEqual(Object.keys(item).sort(), ['category', 'color', 'name', 'swatch']);
      return Response.json({ item: { ...item, id: '44444444-4444-4444-8444-444444444444' } });
    }
    throw new Error('Unexpected photo transfer');
  });
  try {
    const { d, w } = app;
    const selected = d.getElementById('wardrobe-photo');
    d.getElementById('photo-open').click(); await tick();
    assert.equal(d.getElementById('photo-analyze').disabled, true);
    const file = new w.File(['png'], 'my-photo.png', { type: 'image/png' });
    Object.defineProperty(selected, 'files', { value: [file] });
    selected.dispatchEvent(new w.Event('change'));
    d.getElementById('photo-manual').click();
    d.getElementById('photo-item-name').value = '직접 확인한 셔츠';
    d.getElementById('photo-item-color').value = '화이트';
    submit(w, d.getElementById('photo-review')); await tick();
    assert.equal(d.getElementById('wardrobe-count').textContent, '4');
    assert.equal(d.getElementById('photo-dialog').open, false);
    assert.equal(app.calls.some(call => call.url === photoPath && call.init.method === 'POST'), false);
  } finally { app.dom.window.close(); }
});

test('private wardrobe writes wait for acknowledgement, edit canonically and never read or replace legacy browser data', async () => {
  const snapshot = personal(A);
  const pending = deferred(); let writes = 0;
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    assert.equal(init.headers['X-Ieobom-User'], A.id);
    if (url === '/api/me/wardrobe') { writes++; return pending.promise; }
    if (url.startsWith('/api/me/wardrobe/')) return Response.json({ item: { id: snapshot.wardrobe[0].id, ...JSON.parse(init.body), name: '서버에서 확인한 수정 셔츠' } });
    if (url === '/api/me/profile') return Response.json({ profile: JSON.parse(init.body) });
    throw new Error('Unexpected endpoint ' + url);
  });
  try {
    const { d, w } = app;
    assert.equal(d.getElementById('wardrobe-count').textContent, '3');
    assert.equal(d.getElementById('profile-style').value, '내 취향');
    assert.equal(d.querySelector('[data-action="check-access"]').hidden, true);
    d.querySelector('[data-action="add-item"]').click();
    d.getElementById('item-name').value = '새 옷'; d.getElementById('item-color').value = '화이트';
    submit(w, d.getElementById('item-form')); submit(w, d.getElementById('item-form'));
    assert.equal(writes, 1); assert.equal(d.getElementById('wardrobe-count').textContent, '3');
    assert.equal(d.getElementById('item-dialog').open, true);
    pending.resolve(Response.json({ item: { id: '44444444-4444-4444-8444-444444444444', name: '서버에서 저장한 옷', category: '상의', color: '화이트', swatch: '#ffffff' } }));
    await tick();
    assert.equal(d.getElementById('wardrobe-count').textContent, '4');
    assert.match(d.getElementById('wardrobe-grid').textContent, /서버에서 저장한 옷/);
    assert.equal(d.getElementById('item-dialog').open, false);
    d.querySelector('[data-edit-item]').click();
    assert.equal(d.getElementById('item-name').value, '내 셔츠');
    d.getElementById('item-name').value = '수정 셔츠'; submit(w, d.getElementById('item-form')); await tick();
    assert.match(d.getElementById('wardrobe-grid').textContent, /서버에서 확인한 수정 셔츠/);
    assert.equal(d.getElementById('wardrobe-count').textContent, '4');
    d.getElementById('profile-style').value = '계정의 새 취향'; submit(w, d.getElementById('profile-form')); await tick();
    assert.equal(w.localStorage.getItem('ieobom-week5-v1'), legacy);
    assert.equal(w.localStorage.length, 1, 'No private cache or AI output goes to localStorage');
  } finally { app.dom.window.close(); }
});

test('failed private write keeps the form and previous data without a saved message or demo fallback', async () => {
  const snapshot = personal(A);
  const app = await setup(async url => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    return Response.json({ error: '저장 연결을 확인해 주세요.' }, { status: 503 });
  });
  try {
    const { d, w } = app;
    d.querySelector('[data-action="add-item"]').click(); d.getElementById('item-name').value = '잃으면 안 되는 입력'; d.getElementById('item-color').value = '블루';
    submit(w, d.getElementById('item-form')); await tick();
    assert.equal(d.getElementById('item-dialog').open, true);
    assert.equal(d.getElementById('item-name').value, '잃으면 안 되는 입력');
    assert.equal(d.getElementById('item-submit').disabled, false);
    assert.equal(d.getElementById('wardrobe-count').textContent, '3');
    assert.match(d.getElementById('toast').textContent, /저장 연결/);
    assert.equal(app.calls.some(call => call.url === '/api/dashboard'), false);
    assert.equal(w.localStorage.getItem('ieobom-week5-v1'), legacy);
  } finally { app.dom.window.close(); }
});

test('capacity conflict keeps private wardrobe form and shows the limit without an account reload', async () => {
  const snapshot = personal(A);
  const app = await setup(async url => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    if (url === '/api/me/wardrobe') return Response.json({ error: '옷은 최대 40개까지 저장할 수 있어요.', code: 'capacity_reached' }, { status: 409 });
    throw new Error('Unexpected endpoint ' + url);
  });
  try {
    const { d, w } = app;
    d.querySelector('[data-action="add-item"]').click();
    d.getElementById('item-name').value = '다시 저장할 셔츠';
    d.getElementById('item-color').value = '블루';
    submit(w, d.getElementById('item-form')); await tick();
    assert.equal(d.getElementById('item-dialog').open, true);
    assert.equal(d.getElementById('item-name').value, '다시 저장할 셔츠');
    assert.equal(d.getElementById('item-color').value, '블루');
    assert.equal(d.getElementById('item-submit').disabled, false);
    assert.equal(d.getElementById('wardrobe-count').textContent, '3');
    assert.equal(d.getElementById('account-label').textContent, A.email);
    assert.equal(d.getElementById('toast').textContent, '옷은 최대 40개까지 저장할 수 있어요.');
    assert.equal(d.getElementById('toast').closest('dialog'), d.getElementById('item-dialog'));
    assert.equal(app.calls.filter(call => call.url === '/api/session').length, 1);
    assert.equal(app.calls.filter(call => call.url === '/api/me/dashboard').length, 1);
    assert.equal(w.localStorage.getItem('ieobom-week5-v1'), legacy);
  } finally { app.dom.window.close(); }
});

test('a profile save acknowledgement preserves edits typed while the save was in progress', async () => {
  const snapshot = personal(A);
  const pending = deferred();
  const app = await setup(async url => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    if (url === '/api/me/profile') return pending.promise;
    throw new Error('Unexpected endpoint');
  });
  try {
    const field = app.d.getElementById('profile-style');
    field.value = '단정한 셔츠';
    submit(app.w, app.d.getElementById('profile-form'));
    field.value = '단정한 셔츠와 청바지';
    pending.resolve(Response.json({ profile: { ...snapshot.profile, style: '단정한 셔츠' } }));
    await tick();
    assert.equal(field.value, '단정한 셔츠와 청바지');
  } finally { app.dom.window.close(); }
});

test('a late account-A dashboard response cannot repopulate account B after an auth change', async () => {
  let user = A; const pending = deferred();
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user, authConfigured: true });
    if (url === '/api/me/dashboard') return init.headers['X-Ieobom-User'] === A.id ? pending.promise : Response.json(personal(B, 'B만의'));
    throw new Error('Unexpected endpoint');
  });
  try {
    user = B;
    app.w.dispatchEvent(new app.w.StorageEvent('storage', { key: 'ieobom-auth-change', newValue: 'changed' }));
    assert.equal(app.d.querySelector('[data-page="home"]').hidden, true);
    await tick();
    pending.resolve(Response.json(personal(A, '노출되면 안 되는 A'))); await tick();
    assert.equal(app.d.getElementById('account-label').textContent, B.email);
    assert.match(app.d.getElementById('wardrobe-grid').textContent, /B만의/);
    assert.doesNotMatch(app.d.body.textContent, /노출되면 안 되는 A/);
    assert.equal(app.w.localStorage.getItem('ieobom-week5-v1'), legacy);
  } finally { app.dom.window.close(); }
});

test('private AI requests omit client wardrobe and late responses are discarded after account change', async () => {
  let user = A; const pending = deferred();
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(personal(user, user.id === A.id ? 'A전용' : 'B전용'));
    if (url === '/api/suggest') {
      assert.equal(init.headers['X-Ieobom-User'], A.id);
      const body = JSON.parse(init.body);
      assert.equal(body.source, 'personal'); assert.equal('wardrobe' in body, false); assert.equal('profile' in body, false);
      return pending.promise;
    }
    throw new Error('Unexpected endpoint');
  });
  try {
    app.d.querySelector('[data-action="quick-analyze"]').click();
    user = B; app.w.dispatchEvent(new app.w.Event('ieobom:auth-changed')); await tick();
    const result = analysis(personal(A, 'A전용')); result.summary = '보이면 안 되는 A의 분석';
    pending.resolve(Response.json(result)); await tick();
    assert.equal(app.d.querySelectorAll('.outfit').length, 0);
    assert.doesNotMatch(app.d.body.textContent, /보이면 안 되는 A의 분석/);
    assert.equal(app.d.getElementById('account-label').textContent, B.email);
  } finally { app.dom.window.close(); }
});

test('personal outfit double-save issues one write, uses canonical source items and retains no private cache', async () => {
  const snapshot = personal(A); const pending = deferred(); let writes = 0;
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(snapshot);
    if (url === '/api/suggest') { const r = analysis(snapshot); r.items = r.items.map(w => ({ ...w, name: '서버 최신 ' + w.name })); return Response.json(r); }
    if (url === '/api/me/outfits') { writes++; const body = JSON.parse(init.body); assert.equal('id' in body, false); assert.equal('user' in body, false); assert.equal('thumbnail' in body, false); assert.match(body.description, /서버 최신/); return pending.promise; }
    throw new Error('Unexpected endpoint');
  });
  try {
    const { d, w } = app;
    d.querySelector('[data-action="quick-analyze"]').click(); await tick();
    assert.match(d.querySelector('.outfit').textContent, /서버 최신/);
    d.querySelector('[data-save-outfit="0"]').click(); d.querySelector('[data-save-outfit="0"]').click();
    assert.equal(writes, 1); assert.equal(d.getElementById('saved-count').textContent, '0');
    const body = JSON.parse(app.calls.find(call => call.url === '/api/me/outfits').init.body);
    pending.resolve(Response.json({ record: { ...body, id: '55555555-5555-4555-8555-555555555555', thumbnail: '' } })); await tick();
    assert.equal(d.getElementById('saved-count').textContent, '1');
    d.querySelector('[data-save-outfit="0"]').click(); await tick(); assert.equal(writes, 1);
    assert.equal(w.localStorage.getItem('ieobom-week5-v1'), legacy);
  } finally { app.dom.window.close(); }
});

test('a private dashboard outage stays an error without requesting public demo data', async () => {
  const app = await setup(async url => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json({ error: 'Unavailable' }, { status: 503 });
    if (url === '/api/dashboard') return Response.json(demo);
    throw new Error('Unexpected endpoint');
  });
  try {
    assert.equal(app.d.getElementById('load-error').hidden, false);
    assert.equal(app.d.querySelector('[data-page="home"]').hidden, true);
    assert.equal(app.calls.some(call => call.url === '/api/dashboard'), false);
    assert.equal(app.w.localStorage.getItem('ieobom-week5-v1'), legacy);
  } finally { app.dom.window.close(); }
});

test('logout clears private fields and records immediately while its network request is still pending', async () => {
  const pending = deferred();
  const app = await setup(async (url, init) => {
    if (url === '/api/session') return Response.json({ user: A, authConfigured: true });
    if (url === '/api/me/dashboard') return Response.json(personal(A, '로그아웃 전 비공개'));
    if (url === '/api/auth/signout') { assert.equal(init.headers['X-Ieobom-User'], A.id); return pending.promise; }
    throw new Error('Unexpected endpoint');
  });
  try {
    app.d.getElementById('account-signout').click();
    assert.equal(app.d.getElementById('wardrobe-grid').textContent, '');
    assert.equal(app.d.getElementById('profile-style').value, '');
    assert.equal(app.d.querySelector('[data-page="home"]').hidden, true);
    assert.doesNotMatch(app.d.body.textContent, /로그아웃 전 비공개/);
    assert.equal(app.w.localStorage.getItem('ieobom-week5-v1'), legacy);
    pending.resolve(Response.json({ ok: true })); await tick();
    assert.ok(app.w.localStorage.getItem('ieobom-auth-change'));
  } finally { app.dom.window.close(); }
});
