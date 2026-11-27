# 9주차 설정과 실서비스 검증

Codex가 이어서 사용할 실행 순서입니다. 8주차 운영 자료와 임베딩은 이미 있으므로 새로 초기화하지 않습니다.

## 개인 자료 표

2026-11-28에 Supabase 프로젝트 `ieobom`의 `SQL Editor`에서 `supabase/007_accounts.sql`을 실행했습니다. 설치 전 개인 표는 0개였습니다. 설치 후 개인 프로필·옷장·코디 표 3개와 본인 행 정책을 확인했습니다.

`supabase/008_check_accounts.sql`의 9개 항목이 운영 DB에서 모두 통과했습니다. 설치 상태를 다시 확인할 때는 이 읽기 전용 파일만 실행하면 됩니다.

## Supabase 인증

- Email provider 및 회원가입 허용을 확인합니다. 이메일 확인은 유지하고 최소 비밀번호 길이를 8로 설정합니다.
- Site URL: `https://ieobom-week4.vercel.app`
- Redirect URLs: `https://ieobom-week4.vercel.app/auth/callback`, `https://ieobom-week4.vercel.app/auth/callback?next=/account/update-password`
- 로컬/preview 검증에는 실제 주소에 맞는 제한적인 callback URL을 추가합니다.

2026-11-28 운영 배포 전 `Site URL`과 운영 주소 두 개를 저장했습니다. Supabase 설정을 새로고침한 뒤 기존 미리보기 주소 두 개를 포함해 모두 남은 것을 확인했습니다. 가입과 재설정에는 미리보기에서 검증한 기본 `ConfirmationURL` 이메일 템플릿을 사용합니다.

### 9주차 미리보기 인증

Vercel 고정 브랜치 주소는 `https://ieobom-week4-git-codex-week9-auth-ieobom.vercel.app`입니다. Supabase의 기본 `ConfirmationURL` 이메일 템플릿으로 미리보기를 검사할 수 있도록 다음 두 주소를 등록했고, 새로고침 뒤에도 저장된 상태를 확인했습니다.

- `https://ieobom-week4-git-codex-week9-auth-ieobom.vercel.app/auth/callback`
- `https://ieobom-week4-git-codex-week9-auth-ieobom.vercel.app/auth/callback?next=/account/update-password`

이 방식에서는 가입이나 재설정을 요청한 브라우저에서 이메일 링크를 엽니다. `SiteURL` 템플릿으로 바꿀 때는 운영 주소를 기준으로 링크가 열리므로 미리보기 이메일 동작을 다시 확인합니다.

별도 이메일 템플릿을 사용할 때 참고할 링크:

```text
Confirm signup:
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email

Reset password:
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

현재 설정은 Supabase 기본 메일 발송입니다. 팀에 등록된 주소로만 메일이 발송됩니다. 일반 사용자의 가입 확인 및 비밀번호 재설정에는 custom SMTP를 설정해야 합니다.

공식 참고:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 환경변수·배포

`.env.example`의 이름을 사용합니다. 공개 URL과 publishable 키는 인증 클라이언트에 필요합니다. secret/LLM 키는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 공개 환경변수 변경 후 Vercel 재빌드가 필요합니다.

운영 DB에 9주차 SQL을 반영했습니다. Vercel의 `Production` 환경에 등록된 변수를 확인한 뒤 기존 `main`에 `08d9082`를 반영했습니다. 운영 주소에는 9주차가 배포됐습니다.

Vercel에서 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 `codex/week9-auth` 브랜치에 지정했습니다. 이 두 항목으로 브라우저 로그인과 개인 API가 Supabase에 연결됩니다. 공통 자료와 코디 챗봇의 실서버 검사에는 각각 기존 공통 DB와 Gemini의 서버 환경변수가 필요합니다. 이 미리보기에는 운영 서버 비밀 키가 설정되지 않았습니다.

## 완료 기준

| 확인 | 성공 기준 |
| --- | --- |
| 가입·인증 | 실제 이메일 링크 확인 후 로그인 |
| 비밀번호 재설정 | 실제 reset 링크로 변경 후 새 비밀번호 로그인 |
| 빈 계정 | 예시/이전 브라우저 자료가 개인 자료로 합쳐지지 않음 |
| 내 옷 CRUD | 등록·수정·삭제 후 새로고침/재로그인에도 유지 |
| 내 프로필 | 변경 후 재접속에도 유지 |
| 코디 기록 | 저장·상태·평점·삭제 정상, 중복 클릭 중복 저장 방지 |
| 두 계정 분리 | A/B 각각 본인 자료만 접근 |
| 계정 전환 | 다른 탭 포함 이전 자료/늦은 응답이 새 계정에 남지 않음 |
| 장애 | 실패 시 입력 유지, 성공 표시나 예시 대체 없음 |
| 모바일 | 로그인/비밀번호/옷 편집/코디 저장 UI 사용 가능 |
| 기존 기능 | 공통 옷장과 공통 RAG 출처 카드 정상 |

자동 테스트와 실서비스 통과를 구분해 기록하세요. 개인 RAG·사진·아바타는 이번 구현 범위에 포함되지 않습니다.

사용자가 나중에 임시 검사 계정 두 개 사용을 승인했습니다. 운영 Vercel API와 Supabase RLS에서 본인 자료와 다른 계정의 자료가 분리되는 것을 확인하고 임시 계정 두 개를 제거했습니다.

## 사진 등록과 수동 아바타 미리보기

- 개인 옷장의 `사진으로 등록`에서 착장 사진, 구매 내역 캡처, 옷 단독 사진을 고를 수 있습니다. 직접 등록은 현재 브라우저에 사진을 띄우고 기존 저장 API에 옷 정보만 보냅니다.
- AI 분석은 `PHOTO_ANALYSIS_ENABLED=true`를 설정한 배포에서 사용합니다. 사용자 사진을 받기 전 해당 Gemini API 프로젝트에 활성 결제 계정이 연결되어 있는지 확인합니다. 브라우저는 선택한 이미지를 다시 인코딩해 메타데이터를 제거하고, 분석 결과는 사용자가 확인할 옷 후보로 표시합니다.
- 스타일 프로필에서 키, 어깨, 허리, 다리 비율을 직접 조절할 수 있습니다. 선택한 체형 참고 사진과 몸무게는 현재 브라우저 화면에서만 봅니다. 체형이나 치수는 사진으로 추정하지 않습니다.

합성 셔츠 그림으로 Gemini 호출을 한 건 확인했습니다. 사용자 사진을 사용하는 운영 AI 분석은 유료 프로젝트 확인 후 별도로 활성화합니다. [Gemini API 데이터 사용 조건](https://aistudio.google.com/docs/terms)
