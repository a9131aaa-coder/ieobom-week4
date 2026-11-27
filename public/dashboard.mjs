const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='ieobom-week5-v1';
const LEGACY_BASE={"wardrobe":[{"id":"w01","name":"화이트 코튼 셔츠","category":"상의","color":"화이트","swatch":"#eeeae3"},{"id":"w02","name":"크림 라운드 니트","category":"상의","color":"크림","swatch":"#e6dcc8"},{"id":"w03","name":"블랙 기본 티셔츠","category":"상의","color":"블랙","swatch":"#323232"},{"id":"w04","name":"네이비 스트라이프 티","category":"상의","color":"네이비","swatch":"#364356"},{"id":"w05","name":"차콜 와이드 슬랙스","category":"하의","color":"차콜","swatch":"#595954"},{"id":"w06","name":"진청 스트레이트 데님","category":"하의","color":"진청","swatch":"#3b5268"},{"id":"w07","name":"베이지 코튼 팬츠","category":"하의","color":"베이지","swatch":"#c7b89f"},{"id":"w08","name":"블랙 싱글 재킷","category":"아우터","color":"블랙","swatch":"#333333"},{"id":"w09","name":"베이지 가디건","category":"아우터","color":"베이지","swatch":"#c9baa2"},{"id":"w10","name":"블랙 로퍼","category":"신발","color":"블랙","swatch":"#333333"},{"id":"w11","name":"화이트 스니커즈","category":"신발","color":"화이트","swatch":"#eeeeea"},{"id":"w12","name":"브라운 숄더백","category":"가방","color":"브라운","swatch":"#87664e"}],"profile":{"style":"미니멀 · 단정한 캐주얼","colors":"화이트, 블랙, 네이비, 베이지","avoid":"큰 로고, 과한 장식","comfort":"오래 걸어도 편한 신발","goal":"가진 옷을 다양하게 활용하고 싶어요"},"records":[{"id":"look-005","title":"편안하지만 단정한 출근룩","description":"화이트 셔츠 · 와이드 슬랙스 · 로퍼","occasion":"출근","date":"2026-10-15","status":"착용 완료","thumbnail":"/images/look-01.webp","kind":"sample","rating":0},{"id":"look-004","title":"많이 걷는 날의 데이트룩","description":"셔츠 · 데님 · 편한 운동화는 그대로","occasion":"데이트","date":"2026-10-14","status":"피드백 대기","thumbnail":"/images/look-02.webp","kind":"sample","rating":0},{"id":"look-003","title":"좋아하는 니트로 완성한 주말","description":"라이트 니트 · 진청 데님 · 숄더백","occasion":"주말 외출","date":"2026-10-12","status":"저장됨","thumbnail":"/images/look-03.webp","kind":"sample","rating":0},{"id":"look-002","title":"재킷 하나로 정리하는 미팅룩","description":"기본 티셔츠 · 블랙 재킷 · 슬랙스","occasion":"미팅","date":"2026-09-30","status":"착용 완료","thumbnail":"/images/look-04.webp","kind":"sample","rating":0},{"id":"look-001","title":"새로 사지 않고, 한 번 더","description":"차분한 색 조합 · 평소 입던 옷의 다른 연출","occasion":"일상","date":"2026-09-28","status":"저장됨","thumbnail":"/images/look-05.webp","kind":"sample","rating":0}]};
let data, state, current='home', filter='전체', busy=false, activeRecord=null, toastTimer, dataSource='mock', historyPage=0;
let currentUser=null, scope='unknown', epoch=0, mutationBusy=false, editingItem=null, authConfigured=true, checkingIdentity=false;
const requests=new Set();
const AUTH_MARKER='ieobom-auth-change';
const profileKeys=['style','colors','avoid','comfort','goal'];
function toast(message){
 const notice=$('toast');
 const host=document.querySelector('dialog[open]')||document.body;
 if(notice.parentElement!==host)host.append(notice);
 notice.textContent=message;notice.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.hidden=true,4200);
}
document.addEventListener('close',event=>{
 const notice=$('toast');
 if(event.target===notice.parentElement){notice.hidden=true;document.body.append(notice);}
},true);
function persist(){if(scope!=='demo'||!state)return;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('저장 공간에 접근할 수 없어 이번 화면에서만 변경됩니다.');}}
function route(){
  const requested=location.hash.slice(1)||'home';
  current=['home','wardrobe','consult','history','profile'].includes(requested)?requested:'home';
  document.querySelectorAll('[data-page]').forEach(el=>el.hidden=!data||el.dataset.page!==current);
  document.querySelectorAll('[data-nav]').forEach(el=>{const active=el.dataset.nav===current;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('breadcrumb-title').textContent=({home:'Dashboard',wardrobe:'Wardrobe',consult:'Styling',history:'Archive',profile:'My profile'})[current];
  if(data){document.title=`입어봄 · ${{home:'홈 대시보드',wardrobe:'내 옷장',consult:'코디 상담',history:'착용 기록',profile:'스타일 프로필'}[current]}`;}
}
function isStoredState(s){return s?.version===1 && Array.isArray(s.wardrobe)&&s.wardrobe.length<=10000&&s.wardrobe.every(w=>w&&['id','name','category','color','swatch'].every(k=>typeof w[k]==='string'))&&s.profile&&profileKeys.every(k=>typeof s.profile[k]==='string'&&s.profile[k].length<=160)&&Array.isArray(s.records)&&s.records.length<=10000&&s.records.every(r=>r&&typeof r.id==='string'&&typeof r.title==='string'&&typeof r.description==='string')&&(!s.analysis || (Array.isArray(s.analysis.outfits)&&s.analysis.outfits.length===3&&s.analysis.outfits.every(o=>o&&typeof o.title==='string'&&typeof o.reason==='string'&&typeof o.tip==='string'&&Array.isArray(o.itemIds))&&Array.isArray(s.analysis.items)&&s.analysis.items.every(w=>w&&typeof w.id==='string'&&typeof w.name==='string')));}
// Reapply only browser edits. Unedited fields always reflect the latest DB values.
function mergeFields(fresh, saved, base){
 const result={...fresh};
 for(const key of Object.keys(saved))if(JSON.stringify(saved[key])!==JSON.stringify(base[key]))result[key]=saved[key];
 return result;
}
function mergeRows(fresh, saved, base){
 const old=new Map(base.map(r=>[r.id,r])), edits=new Map(saved.map(r=>[r.id,r]));
 const rows=fresh.filter(r=>!old.has(r.id)||edits.has(r.id)).map(r=>old.has(r.id)&&edits.has(r.id)?mergeFields(r,edits.get(r.id),old.get(r.id)):r);
 const ids=new Set(rows.map(r=>r.id));
 return [...saved.filter(r=>!old.has(r.id)&&!ids.has(r.id)),...rows];
}
function staleRequest(){const e=new Error('다른 계정의 요청입니다.');e.name='StaleRequest';return e;}
function isCurrent(requestEpoch,userId){return requestEpoch===epoch&&(!userId||currentUser?.id===userId);}
async function requestJSON(url,init={},timeoutMs=12000,requestEpoch=epoch){
 const controller=new AbortController();requests.add(controller);
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...init,credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(requestEpoch!==epoch)throw staleRequest();
  const body=await response.json();
  if(requestEpoch!==epoch)throw staleRequest();
  if(!response.ok){const e=new Error(typeof body?.error==='string'?body.error:'요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');e.status=response.status;e.code=body?.code;throw e;}
  return {body,response};
 }finally{clearTimeout(timer);requests.delete(controller);}
}
function clearScope(){
 epoch++;for(const request of requests)request.abort();requests.clear();
 data=null;state=null;scope='unknown';currentUser=null;busy=false;mutationBusy=false;activeRecord=null;editingItem=null;historyPage=0;filter='전체';
 clearTimeout(toastTimer);$('toast').hidden=true;$('toast').textContent='';
 for(const id of ['item-dialog','record-dialog'])if($(id).open)$(id).close();
 for(const key of profileKeys)$('profile-'+key).value='';
 $('item-form').reset();$('consult-form').reset();
 for(const id of ['wardrobe-grid','recent-list','history-list','record-detail','access-result'])$(id).textContent='';
 document.querySelectorAll('.analysis-host').forEach(el=>el.textContent='');
 for(const id of ['wardrobe-count','saved-count','profile-completion'])$(id).textContent='—';
 $('data-status').hidden=true;$('load-error').hidden=true;$('load-state').hidden=false;
 $('account-label').textContent='계정 확인 중…';$('account-login').hidden=true;$('account-signout').hidden=true;
 route();return epoch;
}
function showAccount(){
 const personal=scope==='personal';
 $('account-label').textContent=personal?currentUser.email||'내 계정':'예시 둘러보기';
 $('account-login').hidden=personal;$('account-signout').hidden=!personal;
 $('scope-detail').textContent=personal?'로그인한 계정의 옷장·취향·코디 기록만 불러옵니다.':'공통 예시 데이터입니다. 둘러보기에서 수정한 내용은 이 브라우저에만 저장되며 로그인한 계정에 자동으로 옮겨지지 않습니다.';
 $('overview-copy').textContent=personal?'내 계정에 저장한 옷장과 코디':'예시 옷장으로 둘러보는 스타일 공간';
 $('wardrobe-scope-copy').textContent=personal?'등록·수정한 옷은 내 계정에 저장됩니다. 같은 계정으로 로그인하면 다른 기기에서도 볼 수 있어요.':'공통 예시 옷장입니다. 수정한 내용은 이 브라우저에만 저장되며 계정에 자동으로 옮겨지지 않아요.';
 $('history-scope-copy').textContent=personal?'내가 저장한 코디만 표시합니다. AI 분석과 예시 결과를 구분하고, 착용 후 만족도를 남길 수 있어요.':'공통 예시 기록입니다. 둘러보기에서 저장한 결과는 이 브라우저에만 남습니다.';
 $('profile-scope-copy').textContent=personal?'내 계정에 저장합니다. 내 옷장으로 코디를 분석할 때 이 취향을 참고해요.':'이 브라우저에 저장됩니다. 코디 상담에서 내가 수정한 옷장을 선택하면 반영돼요.';
 $('footer-scope-copy').textContent=personal?'내 옷장과 코디 기록은 계정별로 보관합니다. 기록 챗봇에서는 내 계정에 저장한 코디를 검색할 수 있어요.':'예시 둘러보기의 수정 내용은 이 브라우저에만 저장됩니다. 회원가입 후 개인 옷장은 빈 상태로 시작해요.';
 $('analysis-banner-copy').textContent=personal?'내 계정에 저장한 옷장과 취향으로 코디 3가지와 이유를 제안합니다.':'공통 예시 옷장과 취향으로 코디 3가지와 이유를 제안합니다.';
 document.querySelector('[data-action="check-access"]').hidden=personal;
 $('data-source').innerHTML=personal?'<option value="personal">내 계정의 옷장과 스타일 프로필</option>':'<option value="mock">공통 예시 옷장</option><option value="local">이 브라우저에서 수정한 옷장과 프로필</option>';
}
async function load(){
 const requestEpoch=clearScope();
 try{
  const {body:session}=await requestJSON('/api/session',{},12000,requestEpoch);
  if(!session||!('user' in session)||typeof session.authConfigured!=='boolean'||(session.user&&typeof session.user.id!=='string'))throw new Error('계정 정보를 확인하지 못했어요. 다시 불러와 주세요.');
  authConfigured=session.authConfigured;currentUser=session.user;scope=currentUser?'personal':'demo';showAccount();
  const userId=currentUser?.id;
  const {body:snapshot,response}=await requestJSON(userId?'/api/me/dashboard':'/api/dashboard',{headers:userId?{'X-Ieobom-User':userId}:{}},12000,requestEpoch);
  if(!isCurrent(requestEpoch,userId))throw staleRequest();
  if(!Array.isArray(snapshot?.wardrobe)||!snapshot.profile||!Array.isArray(snapshot.recent))throw new Error('옷장 정보를 확인하지 못했어요. 다시 불러와 주세요.');
  if(userId&&(snapshot.mode!=='personal'||snapshot.user?.id!==userId))throw new Error('계정에 맞는 옷장 정보를 확인하지 못했어요.');
  data=snapshot;dataSource=userId?'personal':response.headers.get('x-data-source')==='db'?'db':'mock';
  $('db-source').textContent=userId?'내 계정에 저장됨':dataSource==='db'?'Supabase 연결됨 · 예시 둘러보기':'샘플 데이터 · 예시 둘러보기';
  $('db-meta').textContent=`옷 ${data.wardrobe.length}벌 · 기록 ${data.recent.length}개 · ${userId?'나만의 옷장':'수업용 가상 데이터'}`;
  $('db-header').textContent=`x-data-source: ${response.headers.get('x-data-source')||dataSource}`;
  $('db-fallback').textContent=userId?'':({missing_config:'연결 정보를 등록하면 공통 예시 데이터를 불러옵니다.',db_timeout:'DB 응답이 늦어 파일의 예시 데이터를 표시합니다.',db_unavailable:'공통 DB를 불러오지 못해 파일의 예시 데이터를 표시합니다.'})[response.headers.get('x-data-fallback')]||(!authConfigured?'로그인 설정이 준비되면 개인 옷장을 사용할 수 있어요.':'');
  const fresh={wardrobe:structuredClone(data.wardrobe),profile:structuredClone(data.profile),records:data.recent.map(r=>({...r,kind:r.kind||(userId?'ai':'sample'),rating:r.rating??0}))};
  state={version:1,...structuredClone(fresh),analysis:null,...(!userId?{baseline:fresh}:{})};
  if(!userId){
   try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(isStoredState(saved)){
     const base=saved.baseline&&isStoredState({version:1,...saved.baseline})?saved.baseline:LEGACY_BASE;
     state.wardrobe=mergeRows(fresh.wardrobe,saved.wardrobe,base.wardrobe);state.records=mergeRows(fresh.records,saved.records,base.records);state.profile=mergeFields(fresh.profile,saved.profile,base.profile);state.analysis=saved.analysis;
    }else if(saved)toast('저장된 정보 형식이 달라 공통 예시 데이터로 시작합니다.');
   }catch{toast('저장된 정보를 읽지 못해 공통 예시 데이터로 시작합니다.');}
   persist();
  }
  $('data-status').hidden=false;for(const k of profileKeys)$('profile-'+k).value=state.profile[k];render();route();
 }catch(error){
  if(requestEpoch!==epoch||error.name==='StaleRequest')return;
  data=null;state=null;$('load-error').hidden=false;
  $('load-error').querySelector('p').textContent=error.status===401||error.status===409?'로그인 상태가 바뀌었어요. 다시 불러오거나 로그인해 주세요.':'옷장을 불러오지 못했어요. 연결을 확인하고 다시 불러와 주세요.';
  if(error.status===401||error.status===409){scope='unknown';currentUser=null;$('account-label').textContent='로그인 확인 필요';$('account-login').hidden=false;$('account-signout').hidden=true;}
  else if(scope==='unknown'){$('account-label').textContent='계정 확인 필요';$('account-login').hidden=false;}
  route();
 }finally{if(requestEpoch===epoch){$('load-state').hidden=true;updateControls();}}
}
async function checkIdentity(){
 if(checkingIdentity||scope==='unknown')return;
 checkingIdentity=true;const requestEpoch=epoch;const expected=currentUser?.id||null;
 try{const {body:session}=await requestJSON('/api/session',{},10000,requestEpoch);if((session.user?.id||null)!==expected)await load();}
 catch(error){if(requestEpoch===epoch&&scope==='personal')await load();}
 finally{checkingIdentity=false;}
}
function updateControls(){
 document.querySelectorAll('[data-analyze-button],[data-action="quick-analyze"],[data-action="failure-test"]').forEach(el=>el.disabled=busy||mutationBusy||!state);
 document.querySelectorAll('[data-remove-item],[data-edit-item],[data-save-outfit],[data-rating],[data-action="mark-worn"],[data-action="delete-record"],[data-action="add-item"],#item-form button[type="submit"],#profile-form button[type="submit"]').forEach(el=>el.disabled=mutationBusy||!state);
 $('account-signout').disabled=false;
}
async function privateMutation(path,method,body,apply,message){
 if(scope!=='personal'||!currentUser||mutationBusy||!state)return;
 const requestEpoch=epoch,userId=currentUser.id;mutationBusy=true;updateControls();
 try{
  const {body:result}=await requestJSON(path,{method,headers:{'Content-Type':'application/json','X-Ieobom-User':userId},...(body!==undefined?{body:JSON.stringify(body)}:{})},12000,requestEpoch);
  if(!isCurrent(requestEpoch,userId))return;
  apply(result);render();if(activeRecord&&$('record-dialog').open)showRecord(activeRecord);toast(message);
 }catch(error){
  if(!isCurrent(requestEpoch,userId)||error.name==='StaleRequest')return;
  if(error.status===401||(error.status===409&&error.code==='account_changed')){await load();toast('로그인 상태가 바뀌어 옷장을 다시 확인했어요.');}
  else toast(error.name==='AbortError'?'저장 요청이 오래 걸리고 있어요. 다시 불러와 저장 여부를 확인해 주세요.':error.message||'저장하지 못했어요. 다시 시도해 주세요.');
 }finally{if(requestEpoch===epoch){mutationBusy=false;updateControls();}}
}
async function signOut(){
 const userId=currentUser?.id;const requestEpoch=clearScope();$('account-label').textContent='로그아웃 중…';
 try{
  await requestJSON('/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/json',...(userId?{'X-Ieobom-User':userId}:{})},body:'{}'},12000,requestEpoch);
  try{localStorage.setItem(AUTH_MARKER,String(Date.now())+'-'+Math.random());}catch{}
  location.assign('/login');
 }catch(error){if(requestEpoch!==epoch)return;await load();toast('로그아웃을 완료하지 못했어요. 다시 시도해 주세요.');}
}
function garmentSvg(w){
  const swatch=/^#[0-9a-f]{6}$/i.test(w.swatch)?w.swatch:'#b7b0a3';
  const paths={상의:'M30 17 43 11Q50 26 57 11L70 17 88 38 73 50 65 40 65 104 35 104 35 40 27 50 12 38Z',하의:'M27 12H73L80 108H55L50 51 45 108H20Z',아우터:'M31 15 42 10 50 34 58 10 69 15 88 104 72 108 63 54 66 108H34L37 54 28 108 12 104Z',신발:'M12 74 22 56 44 64 52 77 79 82Q92 83 92 98H9Q7 86 12 74Z',가방:'M20 46H80L86 108H14ZM34 46V30Q50 3 66 30V46H60V31Q50 15 40 31V46Z'};
  return `<svg viewBox="0 0 100 120" aria-hidden="true"><path d="${paths[w.category]||paths.상의}" fill="${swatch}" stroke="#00000020" stroke-width="1.5"/>${w.category==='상의'?'<path d="M50 31V103" stroke="#00000012"/>':''}</svg>`;
}
function renderWardrobe(){
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  const items=state.wardrobe.filter(w=>filter==='전체'||w.category===filter);
  $('wardrobe-grid').innerHTML=items.length?items.map(w=>`<article class="garment"><div class="garment-art">${garmentSvg(w)}</div><small>${escape(w.category)}</small><h3>${escape(w.name)}</h3><div class="garment-bottom"><span>${escape(w.color)}</span><span class="garment-actions"><button class="delete-button" data-edit-item="${escape(w.id)}" aria-label="${escape(w.name)} 수정">수정</button><button class="delete-button" data-remove-item="${escape(w.id)}" aria-label="${escape(w.name)} 삭제">삭제</button></span></div></article>`).join(''):'<p class="empty">이 분류에 등록한 옷이 없어요.</p>';
}
const recordType=r=>r.kind==='ai'?'AI 분석':r.kind==='fallback'?'예시 결과':'예시 기록';
function rows(records){return records.length?records.map((r,i)=>`<button class="record-row" data-record="${escape(r.id)}"><span class="record-image">${r.kind==='sample'&&/^\/images\/look-0[1-5]\.webp$/.test(r.thumbnail)?`<img src="${r.thumbnail}" alt="" width="48" height="58" class="record-image">`:String(i+1).padStart(2,'0')}</span><span class="record-copy"><strong>${escape(r.title)}</strong><p>${escape(r.description)}</p></span><span class="record-meta"><span class="occasion">${escape(r.occasion)}</span><span>${escape(r.date?.slice(5).replace('-','.'))}</span><span class="badge ${r.kind==='ai'?'ai':''}">${escape(r.status)}</span></span></button>`).join(''):'<p class="empty">코디 분석 결과에서 마음에 드는 조합을 저장해 보세요.</p>';}
function render(){
  $('wardrobe-count').textContent=state.wardrobe.length;$('saved-count').textContent=state.records.length;
  $('profile-completion').textContent=profileKeys.filter(k=>state.profile[k].trim()).length*20;
  renderWardrobe();$('recent-list').innerHTML=rows(state.records.slice(0,5));renderHistory();renderAnalysis();updateControls();
}
function renderHistory(){
 const pages=Math.max(1,Math.ceil(state.records.length/10));historyPage=Math.max(0,Math.min(historyPage,pages-1));
 $('history-list').innerHTML=rows(state.records.slice(historyPage*10,historyPage*10+10));
 $('history-page').textContent=`${historyPage+1} / ${pages} 페이지 · ${state.records.length}개`;
 $('history-prev').disabled=historyPage===0;$('history-next').disabled=historyPage===pages-1;
}
const reasonText={forced_test:'실패 테스트로 예시 결과를 표시했습니다.',missing_key:'AI 키가 아직 설정되지 않았습니다. Vercel에서 키를 등록한 뒤 다시 배포해 주세요.',invalid_model:'AI 모델 설정을 확인해 주세요.',provider_limit:'AI 제공사의 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',provider_auth:'AI 키 또는 접근 권한을 확인해 주세요.',model_not_found:'설정한 AI 모델을 찾지 못했습니다.',provider_error:'AI 제공사에서 응답 오류가 발생했습니다.',incomplete_response:'AI 답변이 완료되지 않아 예시를 표시합니다.',empty_response:'AI가 빈 응답을 보내 예시를 표시합니다.',invalid_response:'AI 결과가 필요한 형식과 일치하지 않아 예시를 표시합니다.',timeout:'AI 응답이 지연되어 예시를 표시합니다.',connection_error:'AI 서버에 연결하지 못했습니다.',server_limit:'짧은 시간에 요청이 많습니다. 잠시 후 다시 시도해 주세요.'};
function renderAnalysis(){
 const hosts=document.querySelectorAll('.analysis-host');
 if(busy){hosts.forEach(h=>{h.setAttribute('aria-busy','true');h.innerHTML='<div class="loading-note" role="status">옷장과 취향을 분석하고 있어요. 잠시만 기다려 주세요.</div>';});return;}
 hosts.forEach(h=>h.removeAttribute('aria-busy'));
 const r=state?.analysis;if(!r){hosts.forEach(h=>h.innerHTML='');return;}
 const byId=new Map(r.items.map(w=>[w.id,w]));
 const usage=r.usage;
 const html=`<div class="section-heading"><div><span class="eyebrow">YOUR PERSONAL EDIT</span><h2>${r.fallback?'코디 예시 결과':'AI 코디 분석 결과'}</h2></div><a class="text-link" href="#consult">다시 상담하기 ↗</a></div><div class="result-meta"><span class="badge ${r.fallback?'example':'ai'}">${r.fallback?'예시 결과 · 대체 응답':'실제 AI 응답'}</span><span>${r.source==='personal'?'내 계정의 옷장':r.source==='mock'?(r.dataSource==='db'?'Supabase 예시 옷장':'MOCK 옷장'):'이 브라우저에서 수정한 옷장'} · ${escape(r.occasion)}</span><span>${escape(new Date(r.generatedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</span></div>${r.fallback?`<div class="notice" role="status"><b>지금은 예시를 보여 드려요.</b><br>${escape(reasonText[r.reason]||'AI 응답 대신 기본 예시를 표시합니다.')}</div>`:''}<p class="analysis-summary">${escape(r.summary)}</p><div class="outfit-grid">${r.outfits.map((o,i)=>`<article class="outfit"><span class="outfit-index">LOOK / 0${i+1}</span><h3>${escape(o.title)}</h3><ul>${o.itemIds.map(id=>`<li>${escape(byId.get(id)?.name||'삭제된 의류')}</li>`).join('')}</ul><p class="reason">${escape(o.reason)}</p><p class="tip">${escape(o.tip)}</p><button class="button secondary" data-save-outfit="${i}">${state.records.some(x=>x.analysisKey===r.generatedAt+'-'+i)?'저장됨 · 기록 보기':'이 코디 저장 ↗'}</button></article>`).join('')}</div><details class="lab"><summary>실습 확인 · 응답 JSON / 토큰 / 원가</summary><p>POST /api/suggest · 응답 상태 ${escape(r.httpStatus||200)} · fallback: ${r.fallback?'true':'false'} · ${escape(r.model)}</p>${usage?`<div class="usage-grid"><div>입력 토큰<strong>${usage.inputTokens}</strong></div><div>출력 토큰<strong>${usage.outputTokens}</strong></div><div>추론 토큰<strong>${usage.thinkingTokens}</strong></div><div>유료 단가 환산<strong>${usage.estimatedKrw===null?'계산 미지원':usage.estimatedKrw.toFixed(2)+'원'}</strong></div></div><p>${escape(usage.basis)} 환율 1달러=1,350원, 단가 확인일 ${escape(usage.pricingDate)}. 모델을 변경하면 공식 단가도 다시 확인하세요.</p>`:'<p>이 요청에서 확인 가능한 토큰 사용량이 없습니다. 실제 AI 호출 성공 후 기록하세요.</p>'}<button class="button small secondary" data-action="download-response">실제 응답 JSON 저장</button><button class="button small secondary" data-action="download-cost">원가 기록 CSV 저장</button><pre>${escape(JSON.stringify(r.raw,null,2))}</pre></details>`;
 hosts.forEach(h=>h.innerHTML=html);
}
function setBusy(value){busy=value;renderAnalysis();updateControls();}
async function analyze({quick=false,failure=false}={}){
 if(busy||mutationBusy||!data||!state)return;
 const requestEpoch=epoch,userId=currentUser?.id;
 const source=scope==='personal'?'personal':quick?'mock':$('data-source').value;
 const items=structuredClone(source==='mock'?data.wardrobe:state.wardrobe);
 if(!['상의','하의','신발'].every(c=>items.some(w=>w.category===c))){toast('상담하려면 내 옷장에 상의·하의·신발을 최소 1개씩 등록해 주세요.');return;}
 const body={source,occasion:quick?'출근':$('occasion').value,note:quick?'':$('note').value,forceFallback:failure};
 if(source==='local'){body.wardrobe=items;body.profile={...state.profile};}
 setBusy(true);
 try{
  const {body:raw,response}=await requestJSON('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json',...(userId?{'X-Ieobom-User':userId}:{})},body:JSON.stringify(body)},26000,requestEpoch);
  if(!isCurrent(requestEpoch,userId))return;
  if(!Array.isArray(raw.outfits)||raw.outfits.length!==3||typeof raw.fallback!=='boolean')throw new Error('응답 형식을 확인해 주세요.');
  state.analysis={...raw,raw,items:source==='personal'&&Array.isArray(raw.items)?raw.items:items,httpStatus:response.status,dataSource:response.headers.get('x-data-source')||dataSource};persist();
  toast(raw.fallback?'예시 결과를 표시했습니다. 안내 내용을 확인해 주세요.':'AI 코디 분석이 완료됐습니다.');
 }catch(error){
  if(!isCurrent(requestEpoch,userId)||error.name==='StaleRequest')return;
  if(error.status===401||error.status===409){await load();toast('로그인 상태가 바뀌어 옷장을 다시 확인했어요.');}
  else toast(error.name==='AbortError'?'서버 응답이 늦어지고 있어요. 다시 시도해 주세요.':error.message||'연결을 확인한 뒤 다시 시도해 주세요.');
 }finally{if(requestEpoch===epoch){setBusy(false);const host=document.querySelector(`[data-result-place="${current==='home'?'home':'consult'}"]`);host?.scrollIntoView({behavior:'smooth',block:'start'});}}
}
function saveOutfit(index){
 const r=state?.analysis;if(!r||mutationBusy||!r.outfits[index])return;const key=r.generatedAt+'-'+index;
 if(state.records.some(x=>x.analysisKey===key)){location.hash='history';return;}
 if(state.records.length>=200){toast('최대 200건까지 저장할 수 있습니다. 이전 기록을 삭제해 주세요.');return;}
 const o=r.outfits[index];const byId=new Map(r.items.map(w=>[w.id,w]));
 const record={analysisKey:key,title:o.title,description:o.itemIds.map(id=>byId.get(id)?.name||id).join(' · '),reason:o.reason,tip:o.tip,occasion:r.occasion,date:new Date().toLocaleDateString('sv-SE'),status:'저장됨',kind:r.fallback?'fallback':'ai',rating:0};
 if(scope==='personal')return privateMutation('/api/me/outfits','POST',record,result=>{if(!result.record?.id)throw new Error('저장 결과를 확인하지 못했어요. 다시 불러와 주세요.');if(!state.records.some(x=>x.id===result.record.id))state.records.unshift(result.record);},'코디를 내 계정에 저장했습니다.');
 state.records.unshift({id:crypto.randomUUID(),...record});persist();render();toast('이 브라우저의 착용 기록에 저장했습니다.');
}
function openItem(id=null){
 if(!state||mutationBusy)return;
 if(!id&&state.wardrobe.length>=40){toast('이번 시제품은 옷을 최대 40개까지 등록할 수 있습니다.');return;}
 const item=id?state.wardrobe.find(w=>w.id===id):null;if(id&&!item)return;
 editingItem=id;$('item-form').reset();$('item-dialog-title').textContent=item?'옷 정보 수정':'옷 등록';$('item-submit').textContent=item?'수정 내용 저장':'내 옷장에 추가';
 if(item)for(const key of ['name','category','color','swatch'])$('item-'+key).value=item[key];
 $('item-dialog').showModal();
}
function updateRecord(patch,message){
 if(!state||mutationBusy)return;const id=activeRecord;const record=state.records.find(r=>r.id===id);if(!record)return;
 if(scope==='personal')return privateMutation('/api/me/outfits/'+encodeURIComponent(id),'PATCH',patch,result=>{if(!result.record?.id)throw new Error('저장 결과를 확인하지 못했어요. 다시 불러와 주세요.');state.records=state.records.map(r=>r.id===id?result.record:r);},message);
 Object.assign(record,patch);persist();render();showRecord(id);toast(message);
}
function showRecord(id){
 activeRecord=id;const r=state.records.find(x=>x.id===id);if(!r)return;
 $('record-detail').innerHTML=`<span class="badge">${recordType(r)}</span><h3 class="detail-title">${escape(r.title)}</h3><p class="detail-description">${escape(r.description)}</p>${r.reason?`<p class="detail-description">${escape(r.reason)}</p><p class="tip">${escape(r.tip)}</p>`:''}<p class="hint">${escape(r.date)} · ${escape(r.occasion)} · ${escape(r.status)}</p><label>입어본 만족도</label><div class="rating" aria-label="만족도 선택">${[1,2,3,4,5].map(v=>`<button data-rating="${v}" class="${r.rating>=v?'selected':''}" aria-label="${v}점" aria-pressed="${r.rating===v}">★</button>`).join('')}</div><div class="detail-actions"><button class="button" data-action="mark-worn">착용 완료로 표시</button><button class="button secondary" data-action="delete-record">기록 삭제</button></div>`;
 if(!$('record-dialog').open)$('record-dialog').showModal();
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvValue(v){let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
document.addEventListener('click',event=>{
 const el=event.target.closest('button,a');if(!el)return;
 if(el.dataset.filter){filter=el.dataset.filter;renderWardrobe();}
 if(el.dataset.editItem)openItem(el.dataset.editItem);
 if(el.dataset.removeItem&&state&&!mutationBusy){const id=el.dataset.removeItem;if(scope==='personal')void privateMutation('/api/me/wardrobe/'+encodeURIComponent(id),'DELETE',undefined,()=>{state.wardrobe=state.wardrobe.filter(w=>w.id!==id);},'옷장에서 삭제했습니다.');else{state.wardrobe=state.wardrobe.filter(w=>w.id!==id);persist();render();toast('옷장에서 삭제했습니다.');}}
 if(el.dataset.saveOutfit!==undefined)saveOutfit(Number(el.dataset.saveOutfit));
 if(el.dataset.record)showRecord(el.dataset.record);
 if(el.dataset.rating)void updateRecord({rating:Number(el.dataset.rating),status:'착용 완료'},'만족도를 저장했습니다.');
 switch(el.dataset.action){
 case 'reload':void load();break;
 case 'sign-out':void signOut();break;
 case 'check-access':{
   if(scope!=='demo')break;const requestEpoch=epoch;
   el.disabled=true;$('access-result').textContent='공개키 권한을 확인하고 있어요…';
   fetch('/api/database-check',{method:'POST',signal:AbortSignal.timeout(12000)}).then(r=>r.json()).then(result=>{
    if(requestEpoch!==epoch)return;
    if(!result.rows){$('access-result').textContent=result.error||'다시 시도해 주세요.';return;}
    $('access-result').innerHTML=`<p><b>${result.ok?'읽기 허용 · 쓰기 거부 확인 완료':'권한 또는 연결 설정을 확인해 주세요'}</b></p><div class="access-table"><table><thead><tr><th>표</th><th>동작</th><th>HTTP</th><th>결과</th></tr></thead><tbody>${result.rows.map(r=>`<tr><td>${escape(r.table)}</td><td>${escape(r.operation)}</td><td>${escape(r.status)}</td><td>${r.pass?'통과':'확인 필요'} · ${r.operation==='select'?escape(r.count??'?')+'행':escape(r.code||'응답 없음')}</td></tr>`).join('')}</tbody></table></div>`;
   }).catch(()=>{if(requestEpoch===epoch)$('access-result').textContent='확인 요청에 실패했어요. 다시 시도해 주세요.';}).finally(()=>{if(requestEpoch===epoch)el.disabled=false;});
   break;
 }

 case 'history-prev':historyPage--;renderHistory();break;
 case 'history-next':historyPage++;renderHistory();break;
 case 'quick-analyze':analyze({quick:true});break;
 case 'failure-test':analyze({failure:true});break;
 case 'add-item':openItem();break;
 case 'close-dialog':el.closest('dialog').close();break;
 case 'mark-worn':void updateRecord({status:'착용 완료'},'착용 완료로 표시했습니다.');break;
 case 'delete-record':{if(!state||mutationBusy)break;const id=activeRecord;if(scope==='personal')void privateMutation('/api/me/outfits/'+encodeURIComponent(id),'DELETE',undefined,()=>{state.records=state.records.filter(x=>x.id!==id);activeRecord=null;$('record-dialog').close();},'기록을 삭제했습니다.');else{state.records=state.records.filter(x=>x.id!==id);persist();render();$('record-dialog').close();toast('기록을 삭제했습니다.');}break;}
 case 'download-response':if(state.analysis)download('ieobom-ai-response.json',JSON.stringify(state.analysis.raw,null,2),'application/json');break;
 case 'download-cost':{const r=state.analysis;if(!r?.usage){toast('토큰 사용량이 있는 실제 AI 응답을 먼저 받으세요.');break;}const u=r.usage;const csv=[['시각','모델','fallback','입력 토큰','출력 토큰','추론 토큰','입력 단가 USD/100만','출력 단가 USD/100만','환율','유료 단가 환산 KRW','정의서 게이트③ 비교'],[r.generatedAt,r.model,r.fallback,u.inputTokens,u.outputTokens,u.thinkingTokens,u.inputUsdPerMillion,u.outputUsdPerMillion,u.exchangeRate,u.estimatedKrw,'정의서 목표와 직접 비교해 작성']].map(row=>row.map(csvValue).join(',')).join('\r\n');download('ieobom-ai-cost.csv','\uFEFF'+csv,'text/csv;charset=utf-8');break;}
 }
});
$('consult-form').addEventListener('submit',event=>{event.preventDefault();analyze();});
$('item-form').addEventListener('submit',event=>{
 event.preventDefault();if(!state||mutationBusy)return;
 const values=new FormData(event.target);const name=String(values.get('name')||'').trim(),color=String(values.get('color')||'').trim();
 if(!name||!color){toast('옷 이름과 색상을 입력해 주세요.');return;}
 const item={name,color,category:String(values.get('category')),swatch:String(values.get('swatch'))};const editId=editingItem;
 if(scope==='personal')return void privateMutation('/api/me/wardrobe'+(editId?'/'+encodeURIComponent(editId):''),editId?'PATCH':'POST',item,result=>{
  if(!result.item?.id)throw new Error('저장 결과를 확인하지 못했어요. 다시 불러와 주세요.');
  if(editId)state.wardrobe=state.wardrobe.map(w=>w.id===editId?result.item:w);else state.wardrobe.push(result.item);
  filter='전체';editingItem=null;$('item-dialog').close();
 },editId?'옷 정보를 수정했습니다.':'내 계정의 옷장에 등록했습니다.');
 if(editId)state.wardrobe=state.wardrobe.map(w=>w.id===editId?{...w,...item}:w);else state.wardrobe.push({id:crypto.randomUUID(),...item});persist();filter='전체';render();editingItem=null;$('item-dialog').close();toast(editId?'옷 정보를 수정했습니다.':'옷을 등록했습니다.');
});
$('profile-form').addEventListener('submit',event=>{
 event.preventDefault();if(!state||mutationBusy)return;const profile=Object.fromEntries(profileKeys.map(k=>[k,$('profile-'+k).value.trim()]));
 if(scope==='personal')return void privateMutation('/api/me/profile','PUT',profile,result=>{
  if(!result.profile||!profileKeys.every(k=>typeof result.profile[k]==='string'))throw new Error('저장 결과를 확인하지 못했어요. 다시 불러와 주세요.');
  state.profile=result.profile;
  for(const k of profileKeys){
   const field=$('profile-'+k);
   if(field.value.trim()===profile[k])field.value=result.profile[k];
  }
 },'내 계정의 스타일 프로필을 저장했습니다.');
 state.profile=profile;persist();render();toast('스타일 프로필을 저장했습니다.');
});
window.addEventListener('hashchange',()=>{route();window.scrollTo({top:0,behavior:'instant'});$('main-content').focus({preventScroll:true});});
window.addEventListener('ieobom:auth-changed',()=>void load());
window.addEventListener('storage',event=>{if(event.key===AUTH_MARKER)void load();});
window.addEventListener('pageshow',event=>{if(event.persisted)void load();});
window.addEventListener('focus',()=>void checkIdentity());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void checkIdentity();});
route();void load();
