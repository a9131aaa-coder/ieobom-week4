# 입어봄 · 8주차 코디 기록 RAG

기존 6주차 기능에 `/chat` 코디 기록 챗봇을 추가했습니다. Supabase의 공통 예시 코디 기록을 벡터 검색하고, 답변에 사용한 기록만 출처 카드로 표시합니다. 로그인·개인 기록 동기화는 다음 단계입니다.

**8주차 설치·검증 순서:** [docs/WEEK8_SETUP.md](docs/WEEK8_SETUP.md). 코드를 배포하는 것 외에 SQL 실행과 실제 임베딩 생성이 필요합니다. 키가 없거나 검색 준비가 끝나지 않았으면 챗봇은 오류 안내를 표시하며 예시 답변을 실제 답변처럼 보여 주지 않습니다.

## 기존 기능

프로필 1개, 의류 12벌, 코디 기록 20개를 Supabase에서 읽는 Next.js 앱입니다. 모든 초기 데이터는 가상입니다. 5주차의 AI 분석과 브라우저 저장 버튼 기능을 유지합니다.

사용자 안내: `public/GUIDE.html` 또는 `docs/GUIDE.md`. 표 설계: `docs/TABLE_DESIGN.md`.

## 실행

Node.js 22에서 `npm ci`, `npm run dev`. 검사: `npm test`, `npm run build`.
`.env.example`을 참고하여 실제 값은 `.env.local` 또는 Vercel 환경변수에만 넣습니다.

## API

- POST `/api/chat`: 질문 임베딩 → 공통 코디 벡터 검색 → 실제 인용 근거로 답변. 검색 결과 없음은 정상 거부, 설정·연결 실패는 `fallback: true`.

- GET `/api/dashboard`: DB 성공 시 `x-data-source: db`, 설정 누락·DB 오류 시 동일 JSON 형태의 파일 데이터와 `mock`. DB 전체 시간 제한 5초.
- POST `/api/suggest`: 기존 Gemini 분석. 공통 옷장도 DB에서 읽습니다. AI 실패 시 검증된 대체 코디와 `fallback: true`.
- POST `/api/database-check`: 같은 사이트의 확인 버튼용. 공개 키로 SELECT/INSERT/UPDATE/DELETE 권한을 실제 검사합니다. 무작위 미존재 ID와 의도적으로 무효인 INSERT만 사용합니다. 실제 행을 생성·수정·삭제하지 않습니다.

Supabase REST 요청은 서버 `lib/dashboard-data.mjs`에 모았습니다. `SUPABASE_SECRET_KEY`는 서버 전용이며 공개 키는 별도 권한 검사에만 사용합니다. 새로운 SDK 의존성을 추가하지 않았습니다.

`supabase/001_init.sql`은 세 표·제약·RLS·읽기 정책·33행 초기 데이터를 생성합니다. 재실행 시 기존 값은 유지합니다. `002`는 공개 역할 읽기, `003`은 수정 거부, `004`는 RLS/권한 조회입니다.

## 범위

공통 자료는 DB, 개인 수정은 localStorage입니다. 로그인이나 사용자의 AI 결과를 DB에 쓰는 기능은 없습니다. 기존 브라우저 데이터는 기준 데이터와 차이만 합쳐서 최신 DB 값이 가려지지 않도록 했습니다. 홈 5건, 기록 페이지 10건씩 표시합니다.

자동 테스트는 대체 응답·응답 형식·키 비노출·권한 검사 요청·기존 버튼·브라우저 데이터 보존을 확인합니다. 실제 DB·Vercel·휴대폰은 배포 후 확인해야 합니다. `docs/TEST_REPORT.md` 참고.
