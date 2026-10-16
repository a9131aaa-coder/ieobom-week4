# 입어봄 — 4주차 제출용 대시보드

**이번 제출 범위: 홈 대시보드 1개 + GET /api/dashboard.**

카드 3개와 목록 5건은 `data/dashboard.json`에서 읽습니다. 실제 AI, 로그인, DB, 사진 업로드, 결제는 없습니다. 미구현 메뉴는 ‘준비 중’으로 비활성화했습니다. 서비스 자체의 회원가입이나 AI API 키 없이 공개할 수 있는 구조입니다. GitHub와 Vercel 계정 로그인은 배포를 위해 필요합니다.

## 가장 간단한 배포: GitHub 업로드 → Vercel Import

1. 이 ZIP을 압축 해제합니다. `package.json`, `app`, `public`, `data`가 보이는 폴더를 엽니다.
2. 본인 GitHub에서 새 저장소를 만듭니다. 예: `ieobom-week4`. 기존 저장소를 덮어쓰지 마세요.
3. 저장소의 **uploading an existing file** 또는 **Add file → Upload files**에서 위 폴더의 **내용물**을 올립니다. ZIP 파일 자체를 올리면 안 됩니다.
4. `node_modules`, `.next`, `.env`는 올리지 않습니다. 저장소 최상단에 `package.json`이 보이는지 확인하고 Commit changes를 누릅니다. 한 겹 더 들어간 폴더 아래에 올렸다면 Vercel Root Directory를 그 폴더로 설정해야 합니다.
5. Vercel 로그인 → **Add New → Project → Import Git Repository** → 해당 저장소 Import.
6. Framework Preset은 **Next.js**, Root Directory는 **package.json이 있는 폴더**, Node.js는 **22.x**를 사용합니다. Output Directory는 비워 두고 환경변수도 추가하지 않습니다. Deploy를 누릅니다.
7. `Ready` 이후 표시되는 **Production 도메인**을 휴대폰 또는 시크릿 창으로 엽니다. 보이는 URL이 곧 제출 주소입니다. 프로젝트 이름만으로 주소를 미리 추측하지 않습니다.
8. 공개 도메인에서 `/api/dashboard`가 JSON으로 열리는지 확인합니다.

Vercel 계정 로그인 화면으로 넘어간다면 프로젝트의 Settings → Deployment Protection에서 공개 과제 도메인을 보호하지 않도록 확인하세요. 프리뷰 전체를 불필요하게 공개하지 말고, 제출할 Production 도메인만 비로그인 상태에서 확인합니다.

**PRD 링크:** 배포된 실제 도메인 뒤에 `/PRD.html`을 붙입니다. PDF는 `/PRD.pdf`입니다.

## 제출할 네 가지

1. 배포 URL — Vercel의 실제 Production 주소.
2. PRD v1 문서 링크 — 같은 주소 뒤 `/PRD.html`.
3. Network 캡처 — F12 → Network → Fetch/XHR → 새로고침 → `dashboard` 상태 200이 보이도록 캡처.
4. 한 줄 회고 — 본인이 겪은 점을 직접 적습니다. 아래 형식을 사용해도 됩니다.

```text
교수님, 입어봄 4주차 과제 제출드립니다.
1. 배포 URL: [실제 배포된 주소]
2. PRD v1: [실제 배포된 주소]/PRD.html
3. Network 탭: 첨부한 캡처에서 /api/dashboard 200 확인
4. 회고: [가장 막힌 부분]을 [어떻게 확인·해결했는지] 정리했습니다.
5주차 AI 적용 후보: 사진과 상황을 바탕으로 코디 수정안과 이유를 작성하는 부분입니다.
```

`Network` 캡처는 임의 제작하지 않았습니다. 공개 배포 후 본인 브라우저의 실제 응답을 찍어야 합니다.

## 로컬에서 실행하는 경우

Node.js 22를 설치한 다음 이 폴더에서 터미널을 열어 실행합니다.

```sh
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 배포 전에는 다음을 실행합니다.

```sh
npm test
npm run typecheck
npm run build
```

Windows에서는 `START_LOCAL.cmd`를 사용할 수 있습니다. 최초 실행에는 인터넷을 통해 npm 패키지를 설치합니다. 관리자 권한은 요구하지 않습니다.

처음 설치 후 생긴 `package-lock.json`도 저장소에 커밋하면 실제 설치된 버전이 고정됩니다. 현재 패키지 버전은 설치 시점의 안정 버전을 가져오도록 되어 있습니다. 취약점 점검과 업데이트 여부는 배포 전에 확인하세요.

## 설치 없는 로컬 미리보기 — 대체 점검용, 제출 서버 아님

Node.js는 있지만 npm 설치가 막힌 환경에서는:

```sh
node scripts/preview.mjs
```

동일한 화면·JS·CSS·데이터 읽기 함수를 Node 기본 서버에서 점검합니다. **이 서버는 Next.js가 아니며, 이 미리보기의 성공만으로 `next build`나 Vercel 배포가 검증된 것은 아닙니다.** Vercel에는 기본 Next.js 프로젝트를 배포하세요.

## 폴더 구조

```text
app/
  layout.tsx                 공통 문서/글꼴·스타일 연결
  page.tsx                   홈 대시보드
  api/dashboard/route.ts     GET API; 200 또는 500
lib/
  dashboard-view.mjs         고정 화면 문구·레이아웃
  dashboard-data.mjs         mock 파일 읽기와 검증
public/
  dashboard.mjs              API 요청과 화면 갱신
  dashboard-model.mjs        공통 검증/계산 함수
  dashboard.css              반응형 디자인
  images/                    기존 기획 포스터 기반 예시 썸네일
  PRD.html / PRD.pdf          제출용 정적 설계서
  favicon.svg                브라우저 탭 아이콘
data/dashboard.json          카드 수치/목록의 유일한 원본
tests/                       데이터/구조 단위 테스트
scripts/preview.mjs          설치 없는 보조 미리보기
PRD.md                       수정 가능한 설계서 원본
```

## 검증 상태와 제한

제작 환경에서는 인터넷 패키지 다운로드가 제한되어 `npm install`·Next.js 빌드·Vercel 배포를 실행 완료하지 못했습니다. 대신 동일한 템플릿/브라우저 코드의 데스크톱·모바일 화면, 데이터 변경, 실패 안내와 재시도를 테스트하고, 보조 Node 서버에서 실제 JSON 응답 200을 확인했습니다. 세부 항목은 `docs/TEST_REPORT.md`를 참조하세요.

브라우저 화면 테스트는 네트워크가 차단된 테스트 환경에서 API 응답을 주입한 방식입니다. **실제 배포 성공, 실제 Chrome Network 캡처와는 다릅니다.** 최종 제출 전 Vercel Build Logs와 공개 URL을 확인해야 합니다.

글꼴은 Pretendard 외부 CSS를 참조합니다. 로컬 화면 검증 시에는 외부 폰트 접속이 제한되어 시스템 대체 글꼴이 사용됐습니다. 폰트 파일은 포함하지 않았습니다.

## 공식 참고 문서

- Next.js 설치: https://nextjs.org/docs/app/getting-started/installation
- Vercel GitHub 배포: https://vercel.com/docs/git/vercel-for-github
- 공개 도메인/보호: https://vercel.com/docs/deployments/generated-urls
- Vercel 인증 보호: https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication

## 이후 수정할 때

브랜드 문구/메뉴: `lib/dashboard-view.mjs` · 숫자/기록: `data/dashboard.json` · 디자인: `public/dashboard.css`.

현재 범위를 넘어 사진 업로드·AI·로그인을 한꺼번에 추가하지 마세요. 5주차는 AI 서버 호출, 6주차는 DB, 7주차는 인증을 강의 순서대로 연결합니다.
