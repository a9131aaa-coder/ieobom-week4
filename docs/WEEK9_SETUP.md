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

2026-11-28 관리 화면에서 확인한 현재 값은 `Site URL`이 `http://localhost:3000`이고 `Redirect URLs`는 비어 있었습니다. 아래의 `SiteURL` 이메일 템플릿은 이 설정 주소로 연결됩니다. 미리보기에서 보내는 메일도 실제로 어느 버전의 앱으로 열리는지 확인하세요.

권장 이메일 링크:

```text
Confirm signup:
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email

Reset password:
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

기본 발송 서비스는 팀에 허용된 주소와 낮은 전송량 제한이 있어 일반 사용자에는 custom SMTP가 필요할 수 있습니다. 실제 설정과 현재 제한을 확인하세요. 메일이 안 온다고 이메일 확인을 끄는 식으로 완료 처리하지 않습니다.

공식 참고:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 환경변수·배포

`.env.example`의 이름을 사용합니다. 공개 URL과 publishable 키는 인증 클라이언트에 필요합니다. secret/LLM 키는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 공개 환경변수 변경 후 Vercel 재빌드가 필요합니다.

운영 DB에 9주차 SQL을 반영했습니다. 앱은 8주차 운영 배포와 9주차 미리보기를 구분해 확인합니다.

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

사용자 요청에 따라 운영 프로젝트에 검사 계정을 만들지 않습니다. 실제 계정 두 개로 수행하는 검사는 보류 상태입니다.
