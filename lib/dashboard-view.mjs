// 디자인 문구/레이아웃만 있습니다. 통계 숫자와 실제 목록 내용은 API가 채웁니다.
// SVG는 인터페이스 아이콘이며, 실제 옷 사진은 이전 프로젝트의 시안에서 가져옵니다.
const icon = (body, extra = '') => `<svg ${extra} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const home = icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
const wardrobe = icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M9 11v2M15 11v2"/>');
const chat = icon('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4-.9L3 21l1.6-5A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8 10h8M8 14h5"/>');
const history = icon('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h6"/>');
const profile = icon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>');
const arrow = icon('<path d="M7 17 17 7M7 7h10v10"/>');
const refresh = icon('<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 8A7 7 0 0 1 18 5.7L20 8M4 16l2 2.3A7 7 0 0 0 18.5 16"/>');
const disabledNav = (name, ic) => `<button type="button" class="nav-item is-disabled" disabled title="다음 주차 이후 구현 예정"><span class="nav-icon">${ic}</span><span>${name}</span><span class="soon">준비 중</span></button>`;
const skeletonRows = Array.from({ length: 5 }, () => `<div class="skeleton-row"><i></i><div><b></b><em></em></div><span></span></div>`).join('');
export const dashboardMarkup = `
<a class="skip-link" href="#main-content">본문 바로가기</a>
<div class="app-shell">
  <aside class="sidebar" aria-label="서비스 메뉴">
    <a href="/" class="wordmark" aria-label="입어봄 홈">입어봄<span class="wordmark-dot">.</span><small>YOUR EVERYDAY EDIT</small></a>
    <div class="sidebar-section">MY STYLE SPACE</div>
    <nav class="navigation" aria-label="주 메뉴">
      <a class="nav-item is-active" href="/" aria-current="page"><span class="nav-icon">${home}</span><span>홈 대시보드</span><i></i></a>
      ${disabledNav('내 옷장', wardrobe)}
      ${disabledNav('코디 상담', chat)}
      ${disabledNav('착용 기록', history)}
      ${disabledNav('스타일 프로필', profile)}
    </nav>
    <div class="sidebar-foot"><span class="side-dash"></span><p>새로 사기 전에,<br>내 옷으로 한 번 더.</p><small>WEEK 04 · DASHBOARD</small></div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="breadcrumb">MY STYLE <span>/</span> <strong>Dashboard</strong></div><span class="demo-tag"><i></i>수업용 미리보기</span></header>
    <main id="main-content" tabindex="-1">
      <section class="intro" aria-labelledby="page-title">
        <div class="intro-copy"><span class="eyebrow">A LITTLE EDIT, A BETTER YOU.</span><h1 id="page-title">좋아하는 옷으로,<br><span>더 나다운 하루.</span></h1><p>내 옷과 취향을 이어가는 스타일 대시보드.</p></div>
        <div class="intro-meta"><span class="index-mark">MY<br>STYLE.</span><span id="period-label">예시 데이터 불러오는 중</span></div>
      </section>
      <div class="section-line"><span>MY OVERVIEW</span><span class="data-state" id="data-state" role="status" aria-live="polite">데이터를 불러오고 있습니다</span></div>
      <section class="metric-grid" aria-label="내 스타일 현황" aria-busy="true" id="metrics">
        <article class="metric-card metric-dark" data-metric="consultations">
          <div class="metric-top"><h2>이번 달 남은 상담</h2>${chat}</div>
          <div class="metric-value"><strong id="remaining">—</strong><span>/ <b id="limit">—</b><small>회</small></span></div>
          <div class="metric-bottom"><div class="progress-track"><div class="progress-fill" id="remaining-fill"></div></div><p>내 옷과 상황에 맞춘 다음 상담</p></div>
        </article>
        <article class="metric-card" data-metric="wardrobe">
          <div class="metric-top"><h2>등록한 옷</h2>${wardrobe}</div>
          <div class="metric-value"><strong id="wardrobe-count">—</strong><span>벌</span></div>
          <div class="metric-bottom"><div class="wardrobe-rule"><i></i><i></i><i></i><i></i><i></i></div><p>새로 사기 전, 가진 옷부터</p></div>
        </article>
        <article class="metric-card" data-metric="profile">
          <div class="metric-top"><h2>취향 프로필</h2>${profile}</div>
          <div class="metric-value"><strong id="profile-completion">—</strong><span>%</span></div>
          <div class="metric-bottom"><div class="progress-track"><div class="progress-fill" id="profile-fill"></div></div><p>좋아하는 분위기와 편안함의 기준</p></div>
        </article>
      </section>
      <section class="recent-section" aria-labelledby="recent-title" aria-busy="true" id="recent-section">
        <div class="recent-heading"><div><span class="eyebrow">YOUR STYLE ARCHIVE</span><h2 id="recent-title">최근 코디 상담<span id="recent-count">—</span></h2></div><button type="button" class="refresh-button" id="refresh-button">${refresh}<span>다시 불러오기</span></button></div>
        <div class="loading-skeleton" id="list-skeleton" aria-hidden="true">${skeletonRows}</div>
        <div id="error-panel" class="error-panel" role="alert" hidden><strong>데이터를 불러오지 못했어요.</strong><p id="error-detail">연결을 확인한 뒤 다시 불러오기를 눌러주세요.</p></div>
        <div class="table-wrap" id="table-wrap" hidden>
          <table class="history-table"><caption class="sr-only">최근 코디 상담 다섯 건. 모두 수업용 예시 기록입니다.</caption><thead><tr><th scope="col">스타일 기록</th><th scope="col" class="occasion-column">상황</th><th scope="col">날짜</th><th scope="col">상태</th></tr></thead><tbody id="history-body"></tbody></table>
        </div>
        <noscript><p class="no-script">이 대시보드는 JavaScript가 필요합니다. 브라우저 설정에서 JavaScript를 허용해 주세요.</p></noscript>
      </section>
      <footer class="page-footer"><p><b>DEMO DATA</b> 모든 수치와 기록은 예시입니다.<br class="mobile-break"> 실제 AI 상담·로그인·사진 저장은 연결하지 않았습니다.</p><a href="/PRD.html" target="_blank" rel="noopener">프로젝트 PRD ${arrow}</a></footer>
    </main>
  </div>
</div>`;
