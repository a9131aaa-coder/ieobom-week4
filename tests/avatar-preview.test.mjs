import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { dashboardMarkup } from '../lib/dashboard-view.mjs';

const script = await readFile(new URL('../public/avatar-preview.mjs', import.meta.url), 'utf8');

test('manual avatar updates proportions and clears the preview on form reset', async () => {
  const dom = new JSDOM(dashboardMarkup, { runScripts: 'outside-only' });
  try {
    dom.window.eval(script);
    const form = dom.window.document.getElementById('avatar-preview-form');
    const figure = dom.window.document.getElementById('avatar-preview-figure');
    const originalStyle = figure.getAttribute('style');
    const originalLabel = figure.getAttribute('aria-label');

    function set(name, value) {
      const input = form.elements.namedItem(name);
      input.value = value;
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }

    set('height', '185');
    set('shoulders', '1');
    set('waist', '1');
    set('legs', '2');
    assert.match(figure.getAttribute('aria-label'), /185센티미터/);
    assert.equal(figure.style.getPropertyValue('--avatar-shoulders'), '61%');
    assert.equal(figure.style.getPropertyValue('--avatar-lower-start'), '45%');
    assert.equal(figure.style.getPropertyValue('--avatar-waist-center'), '35.5%');

    const resizedStyle = figure.getAttribute('style');
    set('weight', '65.5');
    assert.match(figure.getAttribute('aria-label'), /참고 몸무게 65.5 kg/);
    assert.equal(figure.getAttribute('style'), resizedStyle);

    set('emphasize', 'waist');
    set('deemphasize', 'lower');
    assert.equal(figure.dataset.emphasize, 'waist');
    assert.equal(figure.dataset.deemphasize, 'lower');
    set('deemphasize', 'waist');
    assert.equal(figure.dataset.emphasize, '');
    assert.equal(figure.dataset.deemphasize, 'waist');

    form.reset();
    await Promise.resolve();
    assert.equal(figure.getAttribute('style'), originalStyle);
    assert.equal(figure.getAttribute('aria-label'), originalLabel);
    assert.equal(figure.dataset.emphasize, '');
    assert.equal(figure.dataset.deemphasize, '');
  } finally {
    dom.window.close();
  }
});

test('body reference photos stay local and are released when replaced or closed', async () => {
  const dom = new JSDOM(dashboardMarkup, { runScripts: 'outside-only', url: 'https://example.test/#profile' });
  try {
    const { document, URL, Event } = dom.window;
    const panel = document.getElementById('avatar-preview');
    const form = document.getElementById('avatar-preview-form');
    const input = document.getElementById('avatar-reference-file');
    const reference = document.getElementById('avatar-reference');
    const image = document.getElementById('avatar-reference-image');
    const remove = document.getElementById('avatar-reference-remove');
    const status = document.getElementById('avatar-reference-status');
    const revoked = [];
    let number = 0;
    URL.createObjectURL = () => `blob:reference-${++number}`;
    URL.revokeObjectURL = url => revoked.push(url);
    image.decode = async () => {};
    panel.open = true;
    dom.window.eval(script);

    async function select(bytes, { type = 'image/jpeg', size = bytes.length } = {}) {
      const file = {
        type,
        size,
        slice: () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }),
      };
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setImmediate(resolve));
    }

    assert.equal(input.hasAttribute('name'), false);
    assert.equal(reference.hidden, true);
    await select([1, 2, 3]);
    assert.equal(number, 0);
    assert.match(status.textContent, /사진을 열지 못했어요/);
    await select([255, 216, 255], { size: 9 * 1024 * 1024 });
    assert.equal(number, 0);

    const jpeg = [255, 216, 255, 224];
    await select(jpeg);
    assert.equal(reference.hidden, false);
    assert.equal(image.getAttribute('src'), 'blob:reference-1');
    await select(jpeg);
    assert.equal(image.getAttribute('src'), 'blob:reference-2');
    assert.deepEqual(revoked, ['blob:reference-1']);
    remove.click();
    assert.equal(reference.hidden, true);
    assert.equal(image.hasAttribute('src'), false);

    await select(jpeg);
    form.reset();
    assert.equal(image.hasAttribute('src'), false);
    await select(jpeg);
    panel.open = false;
    panel.dispatchEvent(new Event('toggle'));
    assert.equal(reference.hidden, true);
    assert.equal(image.hasAttribute('src'), false);
    assert.deepEqual(revoked, ['blob:reference-1', 'blob:reference-2', 'blob:reference-3', 'blob:reference-4']);
  } finally {
    dom.window.close();
  }
});
