import assert from 'node:assert/strict';
import test from 'node:test';
import { createWardrobePhotoHandler, MAX_PHOTO_BYTES, wardrobePhotoAvailable } from '../lib/wardrobe-photo.mjs';

const origin = 'https://app.example.test';
const path = '/api/me/wardrobe/analyze-photo';
const user = { id: '11111111-1111-4111-8111-111111111111' };
const env = { PHOTO_ANALYSIS_ENABLED: 'true', LLM_API_KEY: 'test-key' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+pwr8AAAAASUVORK5CYII=', 'base64');
const garment = { name: '흰색 티셔츠', category: '상의', color: '흰색', swatch: '#ffffff' };
const validContext = { status: 'authenticated', user, client: {}, apply: response => response };
const handler = fetcher => createWardrobePhotoHandler({ getContext: async () => validContext, env, fetcher });

function photoRequest({ photo = png, mimeType = 'image/png', source = 'garment', headers = {} } = {}) {
  const body = new FormData();
  body.append('photo', new Blob([photo], { type: mimeType }), 'sample.png');
  body.append('source', source);
  return new Request(origin + path, { method: 'POST', body, headers: { origin, 'x-ieobom-user': user.id, ...headers } });
}
function providerResponse(candidates) {
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ candidates }) }] } }] });
}

test('a photo candidate is validated against wardrobe fields and no database write occurs', async () => {
  const response = await handler(async (url, init) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(init.method, 'POST');
    const { contents, generationConfig } = JSON.parse(init.body);
    assert.equal(generationConfig.responseMimeType, 'application/json');
    const [prompt, image] = contents[0].parts;
    assert.match(prompt.text, /구매 내역/);
    assert.deepEqual(image.inlineData, { mimeType: 'image/png', data: png.toString('base64') });
    assert.doesNotMatch(init.body, /sample\.png|11111111/);
    return providerResponse([garment]);
  })(photoRequest({ source: 'shopping' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { candidates: [garment] });
});

test('photo analysis requires opt-in, the verified requester and an allowed image', async () => {
  let requests = 0;
  const onFetch = async () => { requests++; return providerResponse([]); };
  const analyze = handler(onFetch);
  const disabled = createWardrobePhotoHandler({
    getContext: async () => validContext, env: { LLM_API_KEY: 'test-key' }, fetcher: onFetch,
  });
  const anonymous = createWardrobePhotoHandler({ getContext: async () => ({ status: 'anonymous' }), env, fetcher: onFetch });
  assert.equal(wardrobePhotoAvailable(env), true);
  assert.equal(wardrobePhotoAvailable({ LLM_API_KEY: 'test-key' }), false);
  assert.equal((await disabled(photoRequest())).status, 503);
  assert.equal((await anonymous(photoRequest())).status, 401);
  assert.equal((await analyze(photoRequest({ headers: { origin: 'https://other.example.test' } }))).status, 403);
  assert.equal((await analyze(photoRequest({ headers: { 'x-ieobom-user': 'another-account' } }))).status, 409);
  assert.equal((await analyze(photoRequest({ photo: Buffer.from('not an image') }))).status, 400);
  assert.equal((await analyze(photoRequest({ mimeType: 'image/gif' }))).status, 400);
  assert.equal((await analyze(photoRequest({ photo: Buffer.alloc(MAX_PHOTO_BYTES + 1) }))).status, 413);
  assert.equal((await analyze(photoRequest({ source: 'unknown' }))).status, 400);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_PHOTO_BYTES + 65_537));
      controller.close();
    },
  });
  const noLengthRequest = new Request(origin + path, {
    method: 'POST',
    headers: { origin, 'x-ieobom-user': user.id, 'content-type': 'multipart/form-data; boundary=test' },
    body: stream,
    duplex: 'half',
  });
  assert.equal((await analyze(noLengthRequest)).status, 413);
  assert.equal(requests, 0);
});

test('an empty candidate list stays empty and a bad provider result does not leak raw output', async () => {
  const empty = await handler(async () => providerResponse([]))(photoRequest());
  assert.deepEqual(await empty.json(), { candidates: [] });
  const invalid = await handler(async () => providerResponse([{ ...garment, swatch: 'PRIVATE_OUTPUT' }]))(photoRequest());
  assert.equal(invalid.status, 502);
  const body = await invalid.json();
  assert.equal(body.code, 'photo_analysis_failed');
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_OUTPUT/);
});
