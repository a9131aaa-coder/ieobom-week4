# 입어봄 6주차 · Supabase 연결 순서

지금은 프로젝트가 만들어진 단계입니다. 아래 1번부터 진행하세요. 코드 작성·자동 테스트는 완료했지만, 실제 Supabase 실행·Vercel 연결·휴대폰 확인은 사용자 화면에서 진행해야 합니다.

## 1. 표와 예시 데이터 넣기

1. Supabase 프로젝트의 왼쪽 **SQL Editor**를 엽니다.
2. **New query** 또는 **+**로 빈 쿼리를 만듭니다.
3. 이 폴더의 `supabase/001_init.sql`을 메모장으로 엽니다. 별도 제공한 `입어봄_표만들기_SQL.txt`와 같은 내용입니다.
4. 파일 내용을 **Ctrl+A → Ctrl+C**로 모두 복사합니다. SQL Editor의 입력칸을 클릭하고 **Ctrl+V**로 붙여 넣습니다.
5. **Run**을 누릅니다. 쿼리에 정책을 다시 만드는 `drop policy` 문장이 있어 경고가 나오면, 대상이 `ieobom_public_read` 정책인지 확인하세요. 데이터나 표를 삭제하는 SQL은 없습니다.
6. 결과 표에 `ieobom_profiles = 1`, `ieobom_wardrobe = 12`, `ieobom_outfits = 20`이 표시되는지 봅니다.
7. **Table Editor**에서 표 3개를 확인합니다.

모든 데이터는 수업용 가상 데이터입니다. 같은 SQL을 재실행해도 중복 행이 늘지 않으며 이미 수정한 행의 값은 덮어쓰지 않습니다. 지운 예시 행은 다시 채워집니다. 기존 표의 열 구조를 임의로 바꾼 경우에는 재실행 전에 오류 내용을 확인해야 합니다.

## 2. Vercel에 연결 정보 3개 등록

Supabase의 **Connect**에서 프로젝트 URL을 확인합니다. **Settings → API Keys**에서 publishable 키와 secret 키를 확인합니다. 아직 없으면 해당 화면에서 생성합니다.

[Vercel 대시보드](https://vercel.com/dashboard) → 기존 `ieobom-week4` 프로젝트 → **Settings → Environment Variables**에 다음 이름으로 등록합니다. 환경은 **Production**을 선택합니다. Preview 주소도 사용할 경우 Preview에도 동일하게 등록합니다.

| 변수 이름 | 넣을 값 | 종류 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://…supabase.co` 형태의 Project URL | Config |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`로 시작하는 공개 키 | Config |
| `SUPABASE_SECRET_KEY` | `sb_secret_…`로 시작하는 비밀 키 | Secret |

`=` 기호, 따옴표, 앞뒤 공백을 넣지 않습니다. Supabase 관리 화면 주소나 데이터베이스 비밀번호를 넣는 칸이 아닙니다. 비밀 키는 Vercel에 직접 입력하고 채팅·GitHub·캡처에는 넣지 마세요.

기존 `LLM_API_KEY`는 유지합니다. `LLM_MODEL`을 별도로 등록하지 않아도 기존 코드의 기본 모델이 적용됩니다.

## 3. 기존 GitHub에 코드 올리기

1. `입어봄_6주차_Supabase_통합본.zip`을 압축 해제합니다.
2. 안의 `ieobom-week6` 폴더를 열어 **package.json이 보이는 위치**로 들어갑니다.
3. [기존 저장소 업로드 화면](https://github.com/a9131aaa-coder/ieobom-week4/upload/main)을 엽니다.
4. 그 위치의 파일·폴더 전체를 드래그합니다. `ieobom-week6` 바깥 폴더 자체나 ZIP 파일을 올리지 않습니다.
5. 기존 파일 교체 내용을 확인하고 **Commit changes**를 누릅니다.
6. Vercel에서 새 배포가 **Ready**가 되는지 확인합니다. 코드 업로드를 먼저 했다면, 환경변수 등록 후 **Deployments → 최신 배포의 ⋯ → Redeploy**를 누릅니다.

ZIP에는 실제 키, `.env.local`, `node_modules`, `.next`가 들어 있지 않습니다. 로컬에서 만든 비밀 파일을 추가로 섞어 올리지 마세요. `.env.example`은 변수 이름만 있는 빈 예시입니다.

## 4. 연결됐는지 확인

1. [입어봄 사이트](https://ieobom-week4.vercel.app)를 새로고침합니다.
2. 상단에 **Supabase 연결됨**이 나오면 DB에서 읽은 것입니다. **샘플 데이터 표시 중**이면 파일로 대체된 상태입니다.
3. **데이터 연결 확인**을 펼치면 실제 `/api/dashboard` 응답 헤더에서 읽은 `x-data-source: db` 또는 `mock`이 보입니다.
4. 크롬 **F12 → Network → Fetch/XHR → 새로고침 → dashboard → Headers → Response Headers**에서도 `x-data-source: db`를 확인합니다.
5. **Table Editor → ieobom_outfits**에서 예시 기록 하나의 제목을 수정한 뒤 사이트의 **새로 불러오기**를 누릅니다. 수정한 날짜의 기록은 착용 기록의 다음 페이지에 있을 수 있습니다. 수정 값이 보이면 코드 재배포 없이 DB 변경이 전달된 것입니다.
6. 휴대폰에서 같은 배포 URL을 열어 옷장·착용 기록·AI 분석 버튼을 확인합니다.

홈에는 최근 5건, 착용 기록에는 한 페이지에 10건이 보입니다. 최초 데이터는 옷 12벌·기록 20개입니다. 개인적으로 추가·삭제한 내용이 있으면 화면의 숫자는 달라집니다. 상단의 DB 숫자는 공통 데이터 수입니다.

## 5. 공개키 읽기·쓰기 권한 확인

사이트 상단의 **데이터 연결 확인 → 공개키 읽기·쓰기 권한 확인**을 누릅니다. 서버가 공개 키만 사용해 3개 표에 읽기·추가·수정·삭제를 요청하고 실제 결과를 보여줍니다.

- 읽기: HTTP 200 또는 206, 처음에는 1/12/20행.
- 추가·수정·삭제: HTTP 401 또는 403, 오류 코드 `42501`, 화면에 **통과**.
- 일부 항목이 **확인 필요**이면 SQL 실행과 공개 키를 확인합니다. 읽기 결과가 비어 있어도 확인 필요로 표시합니다. 공개 읽기 정책 누락과 미입력 데이터를 확인하세요.

이 검사는 무작위로 만든 존재하지 않는 ID만 대상으로 합니다. 추가 요청은 필수 값을 의도적으로 비워 두어, 쓰기 권한이 잘못 열려 있어도 새 행을 만들지 못하게 했습니다. 검사에는 secret 키를 사용하지 않습니다. 이 화면을 권한 거부 캡처로 사용할 수 있습니다.

SQL Editor에서도 `supabase/004_check_security.sql`로 RLS=true, 읽기=true, 쓰기 3개=false를 확인할 수 있습니다. `003_check_write_denied.sql`은 공개 역할의 수정 요청을 거부시키는 별도 SQL입니다. **42501 오류가 정상**입니다. 이후 쿼리에서 25P02가 나오면 `rollback;`을 단독 실행하세요.

공개 읽기 정책이므로 이 세 표에 실제 개인정보를 넣지 않습니다. 로그인 후 사용자별 데이터 접근은 다음 단계입니다.

## 6. DB 실패 대비 확인

먼저 정상 상태의 `x-data-source: db`를 확인합니다. 이후 Vercel에서 `SUPABASE_SECRET_KEY`의 이름을 잠시 `SUPABASE_SECRET_KEY_DISABLED`로 바꾸고 재배포합니다. 화면은 열리며 `x-data-source: mock`과 샘플 안내가 보여야 합니다.

확인이 끝나면 **반드시 원래 이름 `SUPABASE_SECRET_KEY`로 복원하고 다시 배포**합니다. 마지막 제출 화면은 `db` 상태로 남깁니다. 서버의 DB 시간 제한은 전체 5초이며, 오류 본문과 비밀 키를 화면이나 로그에 내보내지 않습니다.

AI 실패 테스트는 코디 상담 아래의 기존 **실패 상황 테스트**입니다. DB 실패와 AI 실패는 서로 다른 검사입니다.

## 7. 제출물

표 설계는 `docs/TABLE_DESIGN.md`에 있습니다. 캡처는 아래 4장을 **실제 화면에서** 찍으세요.

| 캡처 | 보여야 할 내용 |
|---|---|
| Table Editor | 입어봄 표 목록과 예시 행 |
| 배포 화면 | 입어봄 대시보드와 Supabase 연결됨 표시 |
| Network | `/api/dashboard`, 응답 200, `x-data-source: db` |
| 권한 거부 | 공개키 검사에서 쓰기 거부 HTTP/42501 결과 |

키 값이 보이는 화면은 캡처하지 않습니다. 휴대폰에서도 배포 주소를 확인합니다. 마지막으로 실제 경험에 맞게 한 줄 회고를 씁니다: “__번째 걸음에서 __ 때문에 막혔고, __로 풀었다.”

## 저장 범위

공통 프로필·옷·기록은 Supabase에서 읽습니다. 사용자가 버튼으로 추가·삭제한 옷, 프로필 수정, AI 결과 저장, 평점은 **현재 브라우저**에 저장됩니다. 개인 수정 내용의 기기 간 동기화·로그인·AI 결과의 DB 쓰기는 이번 버전에 포함하지 않았습니다. 기존 개인 수정 내용을 유지하면서 수정하지 않은 항목에는 최신 DB 값을 반영합니다.

## 기술 참고와 확인한 자료

서버가 Supabase REST API를 호출합니다. 공개 키·비밀 키는 `apikey` 헤더에 보내고, 새 `sb_…` 키를 JWT로 취급하지 않습니다. JSON 응답의 `mode: mock`은 가상 수업 데이터라는 기존 호환 필드입니다. 실제 읽은 위치는 `x-data-source` 헤더로 확인합니다.

확인일: 2026-10-31. 강의자료: AI와창업혁신_6주차_v1(1).pptx, 특히 슬라이드 18, 22, 24, 30–41, 45, 48.

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel 환경변수](https://vercel.com/docs/environment-variables)
- [Vercel 재배포](https://vercel.com/docs/deployments/managing-deployments)
