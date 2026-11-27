const form = document.getElementById('avatar-preview-form');
const figure = document.getElementById('avatar-preview-figure');

function setupReference(form) {
  const input = document.getElementById('avatar-reference-file');
  if (!input) return;

  const panel = document.getElementById('avatar-preview');
  const reference = document.getElementById('avatar-reference');
  const image = document.getElementById('avatar-reference-image');
  const remove = document.getElementById('avatar-reference-remove');
  const status = document.getElementById('avatar-reference-status');
  const signatures = new Map([
    ['image/jpeg', bytes => [255, 216, 255].every((byte, index) => bytes[index] === byte)],
    ['image/png', bytes => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)],
    ['image/webp', bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'],
  ]);
  let referenceUrl;
  let selection = 0;

  function clearReference(clearInput = true) {
    selection++;
    reference.hidden = true;
    remove.hidden = true;
    status.textContent = '';
    image.removeAttribute('src');
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    referenceUrl = undefined;
    if (clearInput) input.value = '';
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    clearReference(false);
    if (!file) return;

    const current = selection;
    const isSupported = signatures.get(file.type);
    remove.hidden = false;
    status.textContent = '참고 사진을 열고 있어요.';
    try {
      if (!isSupported || file.size < 1 || file.size > 8 * 1024 * 1024) throw new Error('Unsupported file');
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (current !== selection) return;
      if (!isSupported(bytes)) throw new Error('Invalid image signature');
      referenceUrl = URL.createObjectURL(file);
      image.src = referenceUrl;
      await image.decode();
      if (current !== selection) return;
      reference.hidden = false;
      status.textContent = '';
    } catch {
      if (current !== selection) return;
      clearReference();
      status.textContent = '사진을 열지 못했어요. 8MB 이하 JPG, PNG, WebP 사진을 골라 주세요.';
    }
  });

  remove.addEventListener('click', () => {
    clearReference();
    input.focus();
  });
  form.addEventListener('reset', () => clearReference());
  panel.addEventListener('toggle', () => {
    if (!panel.open) clearReference();
  });
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#profile') clearReference();
  });
  window.addEventListener('pagehide', () => clearReference());
}

if (form && figure) {
  const { height, weight, shoulders, waist, legs, emphasize, deemphasize } = form.elements;
  const weightReference = document.getElementById('avatar-weight-reference');

  function render(event) {
    if (emphasize.value && emphasize.value === deemphasize.value) {
      const other = event?.target === deemphasize ? emphasize : deemphasize;
      other.value = '';
    }

    const centimeters = Math.min(220, Math.max(120, height.valueAsNumber || 170));
    const shoulderWidth = 56 + Number(shoulders.value) * 5;
    const lowerStart = 51 - Number(legs.value) * 3;
    const waistCenter = lowerStart - 7 - Number(waist.value) * 2.5;
    const weightLabel = weight?.value && weight.validity.valid ? `참고 몸무게 ${weight.valueAsNumber} kg` : '';
    if (weightReference) {
      weightReference.textContent = weightLabel;
      weightReference.hidden = !weightLabel;
    }

    figure.style.setProperty('--avatar-height', `${140 + centimeters * 0.58}px`);
    figure.style.setProperty('--avatar-shoulders', `${shoulderWidth}%`);
    figure.style.setProperty('--avatar-lower-start', `${lowerStart}%`);
    figure.style.setProperty('--avatar-waist-center', `${waistCenter}%`);
    figure.dataset.emphasize = emphasize.value;
    figure.dataset.deemphasize = deemphasize.value;
    figure.setAttribute('aria-label', [
      `키 ${centimeters}센티미터 아바타`,
      `어깨 ${shoulders.selectedOptions[0].text}`,
      `허리 위치 ${waist.selectedOptions[0].text}`,
      `다리 길이 ${legs.selectedOptions[0].text}`,
      `강조 ${emphasize.selectedOptions[0].text}`,
      `덜 드러냄 ${deemphasize.selectedOptions[0].text}`,
      weightLabel,
    ].filter(Boolean).join(', '));
  }

  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', render);
  form.addEventListener('reset', () => queueMicrotask(() => render()));
  render();
  setupReference(form);
}
