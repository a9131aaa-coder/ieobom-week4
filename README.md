# 입어봄 5주차 통합 업데이트 · 0.2.0

기존 ieobom-week4 Vercel 프로젝트에 올리는 업데이트입니다. 새 프로젝트를 만들 필요 없습니다.

## 가장 빠른 적용

1. 이 ZIP을 새 폴더에 완전히 압축 해제합니다.
2. 기존 GitHub `ieobom-week4` 저장소에서 **Add file → Upload files**를 엽니다.
3. `package.json`이 보이는 위치의 파일과 폴더를 모두 업로드 상자에 끌어놓습니다. ZIP 자체나 바깥 폴더는 올리지 않습니다. `app`, `lib`, `data`, `public` 등은 폴더째 끌어놓습니다.
4. **Commit changes**를 누릅니다. 기존 파일은 새 내용으로 교체되고 새 파일은 추가됩니다. `.env.local`, `node_modules`, `.next`는 올리지 않습니다.
5. Google AI Studio https://aistudio.google.com/apikey 에서 본인 API 키를 발급받습니다. 키는 채팅·카톡·GitHub에 붙이지 않습니다.
6. Vercel의 기존 프로젝트 → **Settings → Environment Variables**에 아래 두 항목을 입력합니다. 최소 Production 환경을 선택하고 저장합니다.

| 이름 | 값 |
|---|---|
| LLM_API_KEY | 본인이 발급받은 실제 키 |
| LLM_MODEL | gemini-3.5-flash-lite |

7. **Deployments → 최신 배포의 메뉴 → Redeploy**를 누르고 Ready를 기다립니다. 파일 업로드로 자동 배포가 먼저 시작되어도 키 등록 이후 다시 배포해야 합니다.
8. https://ieobom-week4.vercel.app 에서 **AI 코디 분석**을 누릅니다. ‘실제 AI 응답’ 표시와 `fallback:false`가 나와야 실제 연결 성공입니다.

‘AI 키가 아직 설정되지 않았습니다’가 나오면 화면과 버튼은 동작하지만 실제 AI 연결은 완료되지 않은 상태입니다. 환경변수 이름·적용 환경·재배포를 확인하세요. 무료 티어가 가능한 모델이라도 계정별 할당량 제한이 있을 수 있습니다. 유료 결제는 자동으로 요구하거나 진행하지 않습니다.

## 오늘 확인할 세 가지

- MOCK 옷장 → /api/suggest → 실제 AI → 대시보드 3개 코디
- 내 옷장·코디 상담·착용 기록·스타일 프로필의 버튼 동작
- 같은 배포 주소를 휴대폰에서 열고 결과 표시

개인 데이터는 브라우저별 저장입니다. 폰과 PC의 기록이 자동 동기화되는 버전은 아닙니다.

## 제출 자료

사이트의 `/GUIDE.html`에 캡처와 제출 순서가 있습니다. `/PRD.html`은 변경점이 표시된 v1.1입니다. 기존 `PRD.pdf`는 4주차 원본 참고용이며, 이번 제출에는 HTML 링크를 쓰세요.

코디 분석 결과 아래 ‘실습 확인’을 펼치면 실제 응답 JSON과 토큰 사용량을 볼 수 있습니다. ‘원가 기록 CSV 저장’으로 현재 응답의 수치를 내려받고, 기존 정의서 게이트③ 목표와의 비교 문장을 직접 작성합니다. 아직 호출하지 않은 토큰 수를 실측값으로 제출하지 마세요.

## 로컬 실행(선택)

Node.js 22.x 권장. 프로젝트 폴더에서 `npm ci`, `npm run dev`. Windows는 `START_LOCAL.cmd`로 실행할 수 있습니다. `.env.example`을 `.env.local`로 복사한 뒤 개인 편집기로 키를 직접 입력하고 서버를 재시작합니다. 로컬 실행은 Vercel 제출에 필수는 아닙니다.

검증: `npm test`, `npm run build`. 테스트의 AI 성공 경로는 모의 공급자 응답으로 검증하며 실제 API 키를 사용하지 않습니다. 유료 API 실제 성공 여부는 배포 후 확인해야 합니다.

## 파일 안내

- app/api/dashboard/route.ts: 기본 MOCK 데이터
- app/api/suggest/route.ts: POST 입력 검증·간이 호출 제한
- lib/ai.mjs: 실제 Gemini 호출 한 곳, JSON 검증, 대체 응답, 토큰 원가
- lib/dashboard-view.mjs / public/dashboard.mjs / public/dashboard.css: 화면·버튼·모바일 스타일
- data/dashboard.json: 예시 옷장 12벌·프로필·기록 5건
- PRD.md / public/PRD.html: PRD v1.1

## 한계

사진 등록·이미지 분석·자동 취향 학습·로그인·DB는 없습니다. 서버 메모리 호출 제한은 인스턴스별 교육용 장치이므로 영구적인 비용 상한이 아닙니다. Google API의 실제 할당량과 결제 설정을 확인하세요.
