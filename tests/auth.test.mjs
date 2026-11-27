import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import * as input from '../lib/auth-input.mjs';

const require = createRequire(import.meta.url);
async function load(file, mocks = {}) {
  const source = await readFile(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const module = { exports: {} };
  runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: file })(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
function context(overrides = {}) {
  return { user: { id: 'user-a', email: 'a@example.test' }, status: 'authenticated', client: { auth: {} },
    apply(response) { const result = new Response(response.body, { status: response.status, headers: response.headers }); result.headers.set('Cache-Control', 'private, no-store'); return result; }, ...overrides };
}
function request(path, body = {}, extra = {}) {
  return new Request(`https://app.example.test${path}`, { method: 'POST', headers: { origin: 'https://app.example.test', 'content-type': 'application/json', 'x-ieobom-user': 'user-a', ...extra }, body: JSON.stringify(body) });
}

test('proxy forwards refreshed session cookies to this request and to the browser', async () => {
  const { NextRequest, NextResponse } = require('next/server');
  const { proxy } = await load('proxy.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/config': { getPublicAuthConfig: () => ({ url: 'https://example.test', key: 'test' }) },
    '@supabase/ssr': { createServerClient(_url, _key, { cookies }) {
      return { auth: { async getClaims() {
        cookies.setAll([{ name: 'session', value: 'renewed', options: { path: '/' } }], { Expires: '0' });
        cookies.setAll([{ name: 'session-part', value: 'second', options: { path: '/' } }], {});
      } } };
    } },
  });
  const response = await proxy(new NextRequest('https://example.test/api/me/dashboard', {
    headers: { cookie: 'session=old; theme=light' },
  }));
  const forwarded = response.headers.get('x-middleware-request-cookie').split('; ');
  assert.deepEqual(new Set(forwarded), new Set(['session=renewed', 'session-part=second', 'theme=light']));
  assert.equal(response.cookies.get('session').value, 'renewed');
  assert.equal(response.cookies.get('session-part').value, 'second');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
async function route(file, getContext) {
  return load(file, { '@/lib/supabase/server': { getAccountContext: getContext }, '@/lib/auth-input.mjs': input });
}

test('password validation enforces minimum and confirmation without blocking legacy login passwords', () => {
  assert.equal(input.validateAuthInput({ email: 'a@example.test', password: 'short' }, 'login'), '');
  assert.match(input.validateAuthInput({ email: 'a@example.test', password: 'short', confirmPassword: 'short' }, 'signup'), /8자/);
  assert.match(input.validateAuthInput({ password: 'longpassword', confirmPassword: 'different' }, 'reset'), /서로 달라/);
  assert.equal(input.validateAuthInput({ password: 'longpassword', confirmPassword: 'longpassword' }, 'reset'), '');
  assert.match(input.validateAuthInput({ email: '<script>' }, 'forgot'), /이메일/);
});

test('auth redirects only accept exact local destinations and errors never expose provider details', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/account/update-password?next=https://evil.test', '%2f%2fevil.test', undefined]) assert.equal(input.safeAuthNext(value), '/#home');
  assert.equal(input.safeAuthNext('/account/update-password'), '/account/update-password');
  assert.equal(input.authDestination('recovery'), '/account/update-password');
  assert.equal(input.authDestination('email'), '/#home');
  assert.doesNotMatch(input.authMessage({ message: 'secret_token=abc provider failure' }), /secret|provider|abc/);
  assert.equal(input.isAnonymousAuthError({ status: 503 }), false);
  assert.equal(input.isAnonymousAuthError({ name: 'AuthSessionMissingError' }), true);
});

test('signout rejects cross-origin and stale-account requests without signing out the current account', async () => {
  let contextCalls = 0, signouts = 0;
  const account = context({ client: { auth: { signOut: async () => { signouts++; return { error: null }; } } } });
  const { POST } = await route('app/api/auth/signout/route.ts', async () => { contextCalls++; return account; });
  assert.equal((await POST(request('/api/auth/signout', {}, { origin: 'https://evil.test' }))).status, 403);
  assert.equal(contextCalls, 0);
  assert.equal((await POST(request('/api/auth/signout', {}, { 'x-ieobom-user': 'user-b' }))).status, 409);
  assert.equal(signouts, 0);
  assert.equal((await POST(request('/api/auth/signout'))).status, 200);
  assert.equal(signouts, 1);
});

test('signout uses local scope, permits already anonymous callers, and hides provider failures', async () => {
  let scope;
  const account = context({ user: null, status: 'anonymous', client: { auth: { signOut: async value => { scope = value.scope; return { error: null }; } } } });
  const { POST } = await route('app/api/auth/signout/route.ts', async () => account);
  const response = await POST(request('/api/auth/signout', {}, { 'x-ieobom-user': 'stale-id' }));
  assert.equal(response.status, 200); assert.equal(scope, 'local');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  account.client.auth.signOut = async () => { throw Error('secret provider details'); };
  const failed = await POST(request('/api/auth/signout'));
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /secret|provider/);
});

test('password endpoint rejects unauthenticated, stale, malformed and oversized changes before updates', async () => {
  let updates = 0;
  const account = context({ client: { auth: { updateUser: async () => { updates++; return { error: null }; } } } });
  const { POST } = await route('app/api/auth/password/route.ts', async () => account);
  const body = { password: 'new-password', confirmPassword: 'new-password' };
  assert.equal((await POST(request('/api/auth/password', body, { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await POST(request('/api/auth/password', body, { 'x-ieobom-user': 'user-b' }))).status, 409);
  assert.equal((await POST(request('/api/auth/password', { password: 'short', confirmPassword: 'short' }))).status, 400);
  assert.equal((await POST(request('/api/auth/password', { password: 'x'.repeat(5000) }))).status, 413);
  account.user = null; account.status = 'anonymous';
  assert.equal((await POST(request('/api/auth/password', body))).status, 401);
  assert.equal(updates, 0);
});

test('password endpoint updates only the verified request account and returns no secret', async () => {
  let value;
  const account = context({ client: { auth: { updateUser: async body => { value = body; return { error: null }; } } } });
  const { POST } = await route('app/api/auth/password/route.ts', async () => account);
  const response = await POST(request('/api/auth/password', { password: 'new-password', confirmPassword: 'new-password' }));
  assert.equal(response.status, 200); assert.deepEqual(value, { password: 'new-password' });
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('session endpoint returns only approved identity fields and distinguishes unavailable/unconfigured', async () => {
  const account = context({ user: { id: 'user-a', email: 'a@example.test', identities: ['private'], phone: 'private' } });
  const { GET } = await route('app/api/session/route.ts', async () => account);
  assert.deepEqual(await (await GET()).json(), { user: { id: 'user-a', email: 'a@example.test' }, authConfigured: true });
  account.user = null; account.status = 'unconfigured';
  assert.deepEqual(await (await GET()).json(), { user: null, authConfigured: false });
  account.status = 'unavailable'; assert.equal((await GET()).status, 503);
});

test('email confirmation allows only email/recovery types and ignores external next parameters', async () => {
  const verified = [];
  const account = context({ client: { auth: { verifyOtp: async args => { verified.push(args); return { error: null }; } } } });
  const { GET } = await route('app/auth/confirm/route.ts', async () => account);
  const denied = await GET(new Request('https://app.example.test/auth/confirm?token_hash=token&type=invite'));
  assert.equal(new URL(denied.headers.get('location')).pathname, '/login'); assert.equal(verified.length, 0);
  const response = await GET(new Request('https://app.example.test/auth/confirm?token_hash=token&type=recovery&next=https://evil.test'));
  assert.deepEqual(verified, [{ token_hash: 'token', type: 'recovery' }]);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://app.example.test'); assert.equal(location.pathname, '/auth/complete');
  assert.equal(location.searchParams.get('next'), '/account/update-password');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('PKCE exchange rejects absent codes and never redirects to arbitrary next URLs', async () => {
  let exchanged = 0;
  const account = context({ client: { auth: { exchangeCodeForSession: async () => { exchanged++; return { error: null }; } } } });
  const { GET } = await route('app/auth/callback/route.ts', async () => account);
  await GET(new Request('https://app.example.test/auth/callback'));
  assert.equal(exchanged, 0);
  const response = await GET(new Request('https://app.example.test/auth/callback?code=one-time&next=//evil.test'));
  assert.equal(exchanged, 1);
  assert.equal(new URL(response.headers.get('location')).searchParams.get('next'), '/#home');
});

test('server context validates getUser, forwards refreshed cookies/cache headers, and creates a client per request', async () => {
  const { NextResponse } = require('next/server');
  let created = 0, writes = 0;
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }), getSession: () => { throw Error('untrusted session used'); } } };
  const { getAccountContext } = await load('lib/supabase/server.ts', {
    '@supabase/ssr': { createServerClient(_url, _key, options) { created++; options.cookies.setAll([{ name: 'refreshed', value: 'safe-test', options: { httpOnly: true, path: '/' } }], { 'Cache-Control': 'no-store', Pragma: 'no-cache' }); return client; } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set() { writes++; } }) }, 'next/server': { NextResponse },
    './config': { getPublicAuthConfig: () => ({ url: 'https://project.supabase.co', key: 'test-publishable' }) }, '../auth-input.mjs': input,
  });
  const account = await getAccountContext(); await getAccountContext();
  assert.equal(account.status, 'authenticated'); assert.equal(account.user.id, 'verified-user');
  assert.equal(created, 2); assert.equal(writes, 2);
  const response = account.apply(Response.json({ ok: true }));
  assert.match(response.headers.get('set-cookie'), /refreshed=safe-test/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('pragma'), 'no-cache'); assert.match(response.headers.get('vary'), /Cookie/);
  client.auth.getUser = async () => ({ data: { user: null }, error: { status: 503 } });
  assert.equal((await getAccountContext()).status, 'unavailable');
  client.auth.getUser = async () => ({ data: { user: null }, error: { name: 'AuthSessionMissingError' } });
  assert.equal((await getAccountContext()).status, 'anonymous');
});
