import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { dashboardMarkup } from '../lib/dashboard-view.mjs';

const source = await readFile('app/chat/ChatClient.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
const module = { exports: {} };
runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: 'ChatClient.test.cjs' })(createRequire(import.meta.url), module, module.exports);
const ChatClient = module.exports.default;
const metrics = { embeddingMs: 12, searchMs: 3, generationMs: 20, totalMs: 35, embeddingTokens: 8, inputTokens: 50, outputTokens: 20, thinkingTokens: null, retrievedCount: 5, topSimilarity: .81 };
const cited = { id: 'look-012', title: '가볍게 둘러보는 전시', date: '2026-10-17', content: '프로필: demo-profile\n기록 ID: look-012\n제목: 가볍게 둘러보는 전시\n날짜: 2026-10-17\n옷 조합: 크림 니트 · 차콜 슬랙스 · 블랙 로퍼\n팁: 오래 걸으면 신발을 확인하세요.', similarity: .81, thumbnail: '/images/look-02.webp' };
const answer = (overrides = {}) => ({ status: 'answered', answer: '기록에서 니트와 로퍼 조합을 찾았어요.', sources: [cited], fallback: false, reason: null, metrics, model: 'test-chat', embeddingModel: 'test-embedding', ...overrides });

async function setup(fetcher) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/chat', pretendToBeVisual: true });
  const original = new Map();
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true, fetch: fetcher })) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  await act(async () => root.render(React.createElement(ChatClient)));
  const d = dom.window.document;
  async function click(element) { await act(async () => element.click()); }
  async function submit() { await act(async () => { d.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); }
  async function choose() { await click(d.querySelector('.chat-examples button')); }
  async function close() {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
  return { dom, d, click, submit, choose, close };
}

test('both navigation surfaces link to the real chat route and retain all five existing views', async () => {
  const dashboard = new JSDOM(dashboardMarkup).window.document;
  assert.equal(dashboard.querySelector('nav a[href="/chat"]').textContent, '기록 챗봇');
  assert.equal(dashboard.querySelectorAll('[data-page]').length, 5);
  assert.equal(dashboard.querySelectorAll('nav a').length, 6);
  const app = await setup(async () => Response.json(answer()));
  try {
    assert.equal(app.d.querySelectorAll('nav a').length, 6);
    assert.equal(app.d.querySelector('[aria-current="page"]').getAttribute('href'), '/chat');
    assert.equal(app.d.querySelector('.chat-submit').disabled, true);
    assert.equal(app.d.querySelector('textarea').maxLength, 300);
    assert.match(app.d.querySelector('.chat-scope').textContent, /개인적으로 추가·수정한 기록은 포함되지/);
  } finally { await app.close(); }
});

test('submitting a question renders only cited evidence, safely and without internal source metadata', async () => {
  let request;
  const app = await setup(async (url, init) => {
    request = { url, init };
    return Response.json(answer({ answer: '<img src=x onerror=alert(1)> 기록을 찾았어요.', sources: [cited, { ...cited, id: 'look-002', title: '<script>unsafe</script>', thumbnail: 'https://untrusted.test/pixel.png' }] }));
  });
  try {
    await app.choose();
    await app.submit();
    assert.equal(request.url, '/api/chat');
    assert.deepEqual(Object.keys(JSON.parse(request.init.body)), ['question']);
    assert.equal(app.d.querySelectorAll('.chat-source-card').length, 2);
    assert.equal(app.d.querySelectorAll('.chat-source-card img').length, 1);
    assert.equal(app.d.querySelectorAll('.chat-answer img, .chat-source-card script').length, 0);
    assert.match(app.d.querySelector('.chat-answer').textContent, /<img/);
    assert.doesNotMatch(app.d.querySelector('.chat-source-grid').textContent, /demo-profile|기록 ID/);
    assert.match(app.d.querySelector('.chat-source-grid').textContent, /크림 니트/);
    assert.equal(app.d.querySelector('.chat-response-info').open, false);
    assert.equal(app.d.querySelector('.chat-submit').disabled, false);
    assert.equal(app.d.querySelectorAll('.chat-result').length, 1);
  } finally { await app.close(); }
});

test('no-evidence results display no cards even if a malformed server supplies unused candidates', async () => {
  const app = await setup(async () => Response.json(answer({ status: 'no_evidence', answer: '기록에서 찾지 못했어요.', sources: [cited] })));
  try {
    await app.choose(); await app.submit();
    assert.equal(app.d.querySelectorAll('.chat-source-card').length, 0);
    assert.match(app.d.querySelector('h2').textContent, /찾지 못했어요/);
    assert.equal(app.d.querySelector('.chat-submit').disabled, false);
  } finally { await app.close(); }
});

test('fallback, HTTP validation, malformed JSON, and network errors remain recoverable', async () => {
  let attempt = 0;
  const app = await setup(async () => {
    attempt++;
    if (attempt === 1) return Response.json(answer({ status: 'fallback', answer: '근거를 가져오지 못했어요.', sources: [], fallback: true }));
    if (attempt === 2) return Response.json({ error: '질문을 1~300자로 입력해 주세요.' }, { status: 400 });
    if (attempt === 3) return new Response('<html>Bad gateway</html>', { status: 502 });
    if (attempt === 4) throw new TypeError('Failed to fetch');
    return Response.json(answer());
  });
  try {
    await app.choose(); await app.submit();
    assert.match(app.d.querySelector('.chat-answer').textContent, /근거를 가져오지 못했어요/);
    for (const expected of [/1~300/, /연결이 원활하지/, /인터넷 연결/]) {
      await app.click(app.d.querySelector('.chat-result button'));
      assert.match(app.d.querySelector('.chat-answer').textContent, expected);
      assert.equal(app.d.querySelector('.chat-submit').disabled, false);
      assert.equal(app.d.querySelectorAll('.chat-source-card').length, 0);
      assert.doesNotMatch(app.d.querySelector('.chat-result').textContent, /SyntaxError|Unexpected token|Bad gateway|Failed to fetch/);
    }
    await app.click(app.d.querySelector('.chat-result button'));
    assert.equal(app.d.querySelectorAll('.chat-source-card').length, 1);
  } finally { await app.close(); }
});

test('loading prevents duplicate requests and the 30-second timeout restores the input', async () => {
  let calls = 0;
  const app = await setup(async (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  const originalTimer = app.dom.window.setTimeout;
  let expire;
  app.dom.window.setTimeout = (callback, delay, ...args) => {
    if (delay === 30_000) { expire = callback; return 123; }
    return originalTimer.call(app.dom.window, callback, delay, ...args);
  };
  try {
    await app.choose(); await app.submit();
    assert.equal(app.d.querySelector('textarea').disabled, true);
    assert.equal(app.d.querySelector('[role="status"]').textContent.includes('답변을 준비'), true);
    await app.submit(); assert.equal(calls, 1);
    await act(async () => expire());
    assert.match(app.d.querySelector('.chat-answer').textContent, /기다리는 시간이 길어졌어요/);
    assert.equal(app.d.querySelector('textarea').disabled, false);
    assert.equal(app.d.querySelector('.chat-submit').disabled, false);
  } finally { await app.close(); }
});
