const icon=(s)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s}</svg>`;
const icons=[icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M9 11v2M15 11v2"/>'),icon('<path d="M21 12a9 9 0 0 1-9 9c-2 0-3-1-4-1l-5 1 1-5a9 9 0 1 1 17-4Z"/><path d="M8 10h8M8 14h5"/>'),icon('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h6"/>'),icon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>')];
const navs=[['home','홈 대시보드'],['wardrobe','내 옷장'],['consult','코디 상담'],['history','착용 기록'],['profile','스타일 프로필']];
const head=(en,title,copy)=>`<div class="page-heading"><span class="eyebrow">${en}</span><h1>${title}</h1><p>${copy}</p></div>`;
export const dashboardMarkup=`
<a class="skip-link" href="#main-content">본문 바로가기</a>
<div class="app-shell">
<aside class="sidebar"><a href="#home" class="wordmark">입어봄<span>.</span><small>YOUR EVERYDAY EDIT</small></a><div class="sidebar-label">MY STYLE SPACE</div><nav aria-label="주 메뉴">${navs.map(([id,label],i)=>`<a class="nav-item" href="#${id}" data-nav="${id}">${icons[i]}<span>${label}</span></a>`).join('')}<a class="nav-item" href="/chat">${icon('<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3M8 7h3M7 11h4M7 15h5"/><circle cx="17" cy="7" r="4"/><path d="m20 10 2 2"/>')}<span>기록 챗봇</span></a></nav><div class="sidebar-foot"><span></span><p>새로 사기 전에,<br>내 옷으로 한 번 더.</p><small>WEEK 09 · MY WARDROBE</small></div></aside>
<div class="workspace"><header class="topbar"><span class="breadcrumb">MY STYLE <i>/</i> <b id="breadcrumb-title">Dashboard</b></span><div class="account-controls"><span id="account-label" class="account-label">계정 확인 중…</span><a id="account-login" class="button small secondary" href="/login" hidden>로그인 · 회원가입</a><button id="account-signout" class="button small secondary" data-action="sign-out" hidden>로그아웃</button></div></header>
<main id="main-content" tabindex="-1"><div id="load-state" role="status">옷장을 불러오고 있어요…</div><div id="load-error" class="notice" hidden><p>데이터를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.</p><button data-action="reload" class="button">다시 불러오기</button></div>
<div id="data-status" class="data-status" hidden><div><b id="db-source"></b><p id="db-meta"></p><small id="db-fallback"></small></div><button class="button small secondary" data-action="reload">새로 불러오기</button><details class="source-detail"><summary>데이터 연결 확인</summary><p>GET /api/dashboard · <code id="db-header"></code></p><p id="scope-detail">로그인하면 내 계정의 옷장과 코디 기록을 불러옵니다.</p><button class="button small secondary" data-action="check-access">공개키 읽기·쓰기 권한 확인</button><div id="access-result" aria-live="polite"></div></details></div>
<section data-page="home" hidden>
<div class="home-intro"><div><span class="eyebrow">A LITTLE EDIT, A BETTER YOU.</span><h1>좋아하는 옷으로,<br><span>더 나다운 하루.</span></h1><p>내 옷과 취향을 바탕으로, 오늘의 조합을 찾아보세요.</p></div><div class="index-mark">MY<br>STYLE<span>.</span></div></div>
<div class="section-line"><span>MY OVERVIEW</span><span id="overview-copy">나의 스타일 공간</span></div>
<div class="metrics"><a href="#wardrobe" class="metric"><span>등록한 옷 <b>↗</b></span><div><strong id="wardrobe-count">—</strong><small>벌</small></div><p>옷장 열어보기</p></a><a href="#history" class="metric"><span>저장한 코디 <b>↗</b></span><div><strong id="saved-count">—</strong><small>개</small></div><p>나의 스타일 기록</p></a><a href="#profile" class="metric"><span>취향 프로필 <b>↗</b></span><div><strong id="profile-completion">—</strong><small>%</small></div><p>좋아하는 스타일 수정하기</p></a></div>
<div class="analysis-banner"><div><span class="eyebrow">TODAY'S STYLE EDIT</span><h2>오늘은 어떻게 입을까요?</h2><p id="analysis-banner-copy">옷장과 취향을 바탕으로<br class="desktop-break"> 코디 3가지와 구체적인 이유를 제안합니다.</p></div><div class="banner-actions"><button class="button light" data-action="quick-analyze">AI 코디 분석 <span>↗</span></button><a href="#consult">상황을 직접 입력하기 →</a></div></div>
<div class="analysis-host" data-result-place="home"></div>
<div class="section-heading"><div><span class="eyebrow">YOUR STYLE ARCHIVE</span><h2>최근 코디 기록</h2></div><a href="#history" class="text-link">전체 보기 ↗</a></div><div id="recent-list"></div>
</section>
<section data-page="wardrobe" hidden>${head('MY WARDROBE','내 옷장','어떤 옷이 있는지 알면, 조합은 더 쉬워집니다.')}<div class="toolbar"><div class="filters" id="wardrobe-filters" aria-label="의류 분류">${['전체','상의','하의','아우터','신발','가방'].map((c,i)=>`<button data-filter="${c}" aria-pressed="${i===0}">${c}</button>`).join('')}</div><div class="wardrobe-actions"><button class="button secondary" id="photo-open" data-action="open-photo" hidden>사진으로 등록</button><button class="button" data-action="add-item">+ 옷 등록</button></div></div><p class="hint" id="wardrobe-scope-copy"></p><div class="wardrobe-grid" id="wardrobe-grid"></div></section>
<section data-page="consult" hidden>${head('PERSONAL STYLING','코디 상담','가진 옷으로, 오늘의 상황에 어울리는 조합을 찾으세요.')}<div class="consult-layout"><form id="consult-form" class="form-panel"><label for="data-source">분석할 옷장</label><select id="data-source" name="source"><option value="mock">공통 예시 옷장</option><option value="local">내가 수정한 옷장과 스타일 프로필</option></select><label for="occasion">어디에 입고 가나요?</label><select id="occasion" name="occasion">${['출근','데이트','주말 외출','미팅','친구와 약속','여행'].map(v=>`<option>${v}</option>`).join('')}</select><label for="note">추가로 원하는 점 <small>선택</small></label><textarea id="note" name="note" maxlength="300" rows="4" placeholder="예: 많이 걸을 예정이라 편한 신발이 좋아요."></textarea><p class="hint">옷 이름·색상·취향·요청 문장이 AI로 전달됩니다. 사진 판독과 실시간 날씨 조회는 포함되지 않습니다.</p><button class="button full" type="submit" data-analyze-button>AI 코디 분석 ↗</button></form><aside class="consult-note"><span class="eyebrow">MADE FROM YOUR CLOSET</span><h2>새로운 옷보다,<br>새로운 조합.</h2><p>옷장에 있는 의류만 활용합니다.<br>왜 어울리는지, 어떻게 입으면 좋은지도<br>함께 확인해 보세요.</p><div class="mini-steps"><p><b>01</b> 옷장과 취향 확인</p><p><b>02</b> 상황에 맞는 조합 3개</p><p><b>03</b> 착용 후 만족도 기록</p></div></aside></div><div class="analysis-host" data-result-place="consult"></div><details class="lab"><summary>수업용 실패 테스트</summary><p>AI 연결 실패를 의도적으로 재현합니다. 외부 AI 호출 없이 같은 형식의 예시 응답을 받고, <code>fallback: true</code>를 확인할 수 있습니다.</p><button class="button secondary" data-action="failure-test">실패 상황 테스트</button></details></section>
<section data-page="history" hidden>${head('YOUR STYLE ARCHIVE','착용 기록','마음에 든 조합을 저장하고, 입어본 느낌을 남겨보세요.')}<p class="hint" id="history-scope-copy"></p><div id="history-list"></div><div class="history-pages"><button class="button small secondary" id="history-prev" data-action="history-prev">이전</button><span id="history-page"></span><button class="button small secondary" id="history-next" data-action="history-next">다음</button></div></section>
<section data-page="profile" hidden>${head('MY STYLE PROFILE','스타일 프로필','편안함부터 좋아하는 분위기까지. 나의 기준을 남겨주세요.')}<form id="profile-form" class="profile-form">${[['style','좋아하는 스타일','미니멀, 단정한 캐주얼'],['colors','좋아하는 색','화이트, 블랙, 네이비'],['avoid','피하고 싶은 스타일','큰 로고, 과한 장식'],['comfort','편안함의 기준','오래 걸어도 편한 신발'],['goal','스타일링 목표','가진 옷을 다양하게 활용하고 싶어요']].map(([key,label,ph],i)=>`<label class="profile-row" for="profile-${key}"><span class="row-number">0${i+1}</span><span><b>${label}</b><input id="profile-${key}" name="${key}" maxlength="160" placeholder="${ph}"></span></label>`).join('')}<div class="profile-actions"><p class="hint" id="profile-scope-copy"></p><button class="button" type="submit">프로필 저장 ↗</button></div></form>
<details id="avatar-preview" class="avatar-preview" hidden>
  <summary>수동 아바타 미리보기</summary>
  <p class="hint">키와 비율을 직접 조절해 보세요. 설정은 현재 화면에서만 유지돼요.</p>
  <div class="avatar-layout">
    <form id="avatar-preview-form" class="avatar-controls" autocomplete="off">
      <fieldset><legend>키와 비율</legend>
        <label>키 (cm)<input type="number" name="height" min="120" max="220" step="1" value="170" inputmode="numeric"></label>
        <label>참고 몸무게 (kg) · 선택<input type="number" name="weight" min="20" max="500" step="0.1" inputmode="decimal"></label>
        <label>어깨 너비<select name="shoulders"><option value="-2">좁게</option><option value="-1">조금 좁게</option><option value="0" selected>기본</option><option value="1">조금 넓게</option><option value="2">넓게</option></select></label>
        <label>허리 위치<select name="waist"><option value="-1">낮게</option><option value="0" selected>기본</option><option value="1">높게</option></select></label>
        <label>다리 길이<select name="legs"><option value="-2">짧게</option><option value="-1">조금 짧게</option><option value="0" selected>기본</option><option value="1">조금 길게</option><option value="2">길게</option></select></label>
      </fieldset>
      <fieldset><legend>스타일링에서 원하는 부분</legend>
        <label>강조하고 싶은 부분<select name="emphasize"><option value="">선택 안 함</option><option value="upper">상체</option><option value="waist">허리</option><option value="lower">하체</option></select></label>
        <label>덜 드러내고 싶은 부분<select name="deemphasize"><option value="">선택 안 함</option><option value="upper">상체</option><option value="waist">허리</option><option value="lower">하체</option></select></label>
      </fieldset>
      <div class="avatar-reference-picker">
        <label for="avatar-reference-file">체형 참고 사진 <small>선택</small></label>
        <p id="avatar-reference-hint" class="hint">얼굴을 가린 사진을 골라 주세요. JPG, PNG, WebP, 최대 8MB. 사진은 이 브라우저에서만 열리고, 미리보기를 닫거나 로그아웃하면 화면에서 사라져요.</p>
        <input id="avatar-reference-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="avatar-reference-hint">
        <button id="avatar-reference-remove" class="button small secondary" type="button" hidden>참고 사진 제거</button>
        <p id="avatar-reference-status" class="hint" role="status"></p>
      </div>
      <button class="button small secondary" type="reset">아바타 초기화</button>
    </form>
    <div class="avatar-comparison">
      <div class="avatar-stage">
        <div id="avatar-preview-figure" class="avatar-figure" role="img" aria-label="기본 아바타 실루엣">
          <span class="avatar-head" aria-hidden="true"></span><span class="avatar-neck" aria-hidden="true"></span>
          <span class="avatar-arm avatar-arm-left" data-avatar-region="upper" aria-hidden="true"></span><span class="avatar-arm avatar-arm-right" data-avatar-region="upper" aria-hidden="true"></span>
          <span class="avatar-upper" data-avatar-region="upper" aria-hidden="true"></span><span class="avatar-waist" data-avatar-region="waist" aria-hidden="true"></span>
          <span class="avatar-lower" data-avatar-region="lower" aria-hidden="true"></span>
        </div>
        <p class="avatar-visual-key" aria-hidden="true"><span class="avatar-key-emphasis">강조</span><span class="avatar-key-muted">덜 드러냄</span></p>
        <p id="avatar-weight-reference" class="avatar-reference-weight" aria-hidden="true" hidden></p>
      </div>
      <figure id="avatar-reference" class="avatar-reference" hidden>
        <img id="avatar-reference-image" alt="이 브라우저에서 선택한 참고 사진">
        <figcaption>참고 사진</figcaption>
      </figure>
    </div>
  </div>
</details></section>
<footer class="page-footer"><p id="footer-scope-copy"></p><div><a href="/PRD.html" target="_blank" rel="noopener">서비스 정의서 ↗</a><a href="/GUIDE.html" target="_blank" rel="noopener">6주차 제출 안내 ↗</a></div></footer>
<noscript>이 서비스는 JavaScript가 필요합니다.</noscript></main></div></div>
<div id="toast" role="status" aria-live="polite" hidden></div>
<dialog id="item-dialog"><form id="item-form"><div class="dialog-heading"><h2 id="item-dialog-title">옷 등록</h2><button type="button" data-action="close-dialog" class="icon-button" aria-label="닫기">×</button></div><label for="item-name">옷 이름</label><input id="item-name" name="name" required maxlength="50" placeholder="예: 연청 스트레이트 데님"><label for="item-category">분류</label><select id="item-category" name="category">${['상의','하의','아우터','신발','가방'].map(c=>`<option>${c}</option>`).join('')}</select><label for="item-color">색상</label><input id="item-color" name="color" required maxlength="30" placeholder="예: 연청"><label for="item-swatch">표시 색상</label><input id="item-swatch" name="swatch" type="color" value="#b7b0a3"><button class="button full" id="item-submit" type="submit">내 옷장에 추가</button></form></dialog>
<dialog id="photo-dialog" aria-labelledby="photo-title">
  <div class="dialog-heading"><h2 id="photo-title">사진으로 옷 찾기</h2><button type="button" data-action="close-dialog" class="icon-button" aria-label="닫기">×</button></div>
  <p id="photo-status" class="hint" role="status" aria-live="polite"></p>
  <img id="photo-preview" alt="선택한 사진 미리보기" hidden>
  <div id="photo-picker">
    <form id="photo-form" aria-describedby="photo-privacy">
      <label for="photo-source">사진 종류</label>
      <select id="photo-source" name="source"><option value="outfit">내 착장 사진</option><option value="shopping">쇼핑몰·구매 내역 캡처</option><option value="garment">옷 단독 사진</option></select>
      <p class="hint" id="photo-privacy">얼굴, 이름, 주소, 주문번호는 가려 주세요. 분석을 누르면 사진을 Gemini에 보내며, 옷장에는 확인한 옷 정보만 저장합니다.</p>
      <label for="wardrobe-photo">사진 한 장 <small>JPG, PNG, WebP · 최대 4MB</small></label>
      <input id="wardrobe-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required>
      <div class="detail-actions"><button type="button" class="button secondary" id="photo-manual" data-action="photo-manual" disabled>사진 보며 직접 등록</button><button type="submit" class="button" id="photo-analyze" disabled>AI로 옷 찾기</button></div>
    </form>
    <div id="photo-candidates"></div>
  </div>
  <form id="photo-review" hidden>
    <p class="hint">이 옷을 실제로 가지고 있다면 정보를 확인하고 저장해 주세요.</p>
    <p class="hint" id="photo-duplicate" hidden>내 옷장에 같은 이름과 분류, 색상의 옷이 있어요.</p>
    <label for="photo-item-name">옷 이름</label><input id="photo-item-name" name="name" required maxlength="50">
    <label for="photo-item-category">분류</label><select id="photo-item-category" name="category">${['상의','하의','아우터','신발','가방'].map(c=>`<option>${c}</option>`).join('')}</select>
    <label for="photo-item-color">색상</label><input id="photo-item-color" name="color" required maxlength="30">
    <label for="photo-item-swatch">표시 색상</label><input id="photo-item-swatch" name="swatch" type="color">
    <div class="detail-actions"><button class="button secondary" type="button" data-action="photo-back">후보 목록</button><button class="button" type="submit">확인하고 저장</button></div>
  </form>
</dialog>
<dialog id="record-dialog"><div class="dialog-heading"><h2>코디 기록</h2><button data-action="close-dialog" class="icon-button" aria-label="닫기">×</button></div><div id="record-detail"></div></dialog>`;
