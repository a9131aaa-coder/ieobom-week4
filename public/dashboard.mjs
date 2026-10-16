import { validateDashboard, remainingPercent, shortDate } from './dashboard-model.mjs';

function initDashboard() {
  const root = document.getElementById('main-content');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  const el = (id) => document.getElementById(id);
  const number = new Intl.NumberFormat('ko-KR');
  const text = (id, value) => { el(id).textContent = String(value); };
  let controller;

  function makeCell(value, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = value;
    return cell;
  }
  function render(data) {
    const { summary, recent } = data;
    text('remaining', number.format(summary.remaining));
    text('limit', number.format(summary.limit));
    text('wardrobe-count', number.format(summary.wardrobeCount));
    text('profile-completion', summary.profileCompletion);
    text('period-label', data.periodLabel);
    text('recent-count', `${recent.length}건`);
    el('remaining-fill').style.width = `${remainingPercent(summary)}%`;
    el('profile-fill').style.width = `${summary.profileCompletion}%`;
    el('remaining-fill').parentElement.setAttribute('aria-label', `상담 ${summary.limit}회 중 ${summary.remaining}회 남음`);
    el('profile-fill').parentElement.setAttribute('aria-label', `취향 프로필 ${summary.profileCompletion}퍼센트`);
    const fragment = document.createDocumentFragment();
    for (const record of recent) {
      const row = document.createElement('tr');
      row.dataset.recordId = record.id;
      const first = document.createElement('td');
      const look = document.createElement('div');
      look.className = 'look-record';
      const img = document.createElement('img');
      img.className = 'look-thumb';
      img.src = record.thumbnail;
      img.alt = '';
      img.width = 46; img.height = 54;
      img.addEventListener('error', () => { img.hidden = true; }, { once: true });
      const copy = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'look-title';
      title.textContent = record.title;
      const desc = document.createElement('p');
      desc.className = 'look-description';
      desc.textContent = record.description;
      copy.append(title, desc);
      look.append(img, copy); first.append(look); row.append(first);
      row.append(makeCell(record.occasion, 'occasion-column'));
      const dateCell = document.createElement('td');
      const time = document.createElement('time');
      time.dateTime = record.date;
      time.textContent = shortDate(record.date);
      dateCell.append(time); row.append(dateCell);
      const statusCell = document.createElement('td');
      const status = document.createElement('span');
      status.className = `status ${record.status === '착용 완료' ? 'status-worn' : record.status === '피드백 대기' ? 'status-waiting' : ''}`;
      status.textContent = record.status;
      statusCell.append(status); row.append(statusCell);
      fragment.append(row);
    }
    el('history-body').replaceChildren(fragment);
    el('table-wrap').hidden = false;
    text('data-state', '예시 데이터 연결됨');
    root.dataset.state = 'success';
  }
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const activeController = controller;
    const timer = setTimeout(() => activeController.abort(), 12000);
    root.dataset.state = 'loading';
    el('refresh-button').disabled = true;
    el('metrics').setAttribute('aria-busy', 'true');
    el('recent-section').setAttribute('aria-busy', 'true');
    el('list-skeleton').hidden = false;
    el('error-panel').hidden = true;
    el('table-wrap').hidden = true;
    text('data-state', '데이터를 불러오고 있습니다');
    // 수치와 목록을 프론트 코드에 하드코딩하지 않습니다. 가짜 성공 응답도 만들지 않습니다.
    try {
      const response = await fetch('/api/dashboard', { method: 'GET', cache: 'no-store', signal: activeController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = validateDashboard(await response.json());
      render(data);
    } catch (error) {
      ['remaining', 'limit', 'wardrobe-count', 'profile-completion', 'recent-count'].forEach(id => text(id, '—'));
      el('remaining-fill').style.width = '0%';
      el('profile-fill').style.width = '0%';
      el('error-panel').hidden = false;
      text('error-detail', error?.name === 'AbortError' ? '응답 시간이 길어지고 있어요. 잠시 후 다시 불러와 주세요.' : '연결을 확인한 뒤 다시 불러오기를 눌러주세요.');
      text('data-state', '연결을 확인해 주세요');
      text('period-label', '예시 데이터 연결 대기');
      root.dataset.state = 'error';
    } finally {
      clearTimeout(timer);
      el('list-skeleton').hidden = true;
      el('refresh-button').disabled = false;
      el('metrics').setAttribute('aria-busy', 'false');
      el('recent-section').setAttribute('aria-busy', 'false');
    }
  }
  el('refresh-button').addEventListener('click', load);
  load();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard, { once: true });
} else {
  initDashboard();
}
