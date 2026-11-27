# 입어봄 · 9주차 개발 인계본

**운영 사이트는 8주차 버전입니다. 이 폴더는 아직 배포하지 않은 9주차 개발 코드입니다.**

운영 DB에는 개인 저장 표 3개를 추가했고 권한 검사 9개가 통과했습니다. 배포 전 확인할 로그인 설정과 서비스 검증 항목은 [9주차 설정 안내](docs/WEEK9_SETUP.md)에 있습니다.

## 현재 범위

- 8주차: 공통 예시 옷장과 코디 기록, Gemini 코디 추천, 코디 기록 RAG와 출처 카드. 운영 중.
- 9주차 개발본: 이메일 회원가입·로그인·비밀번호 재설정, 개인 옷장/프로필/코디 기록 저장, 계정별 RLS, 계정 전환 시 화면 정리.
- 아직 미구현: 사진 등록과 AI 의류 추출, 체형 사진 분석, 수동 아바타, 개인 기록 RAG, 기존 브라우저 자료 가져오기.

기존 공통 자료는 `ieobom_profiles`, `ieobom_wardrobe`, `ieobom_outfits`에 있습니다. 개인 자료는 별도의 `ieobom_user_*` 표에 저장하도록 구현했습니다. `/chat`은 공통 예시 기록만 검색합니다.

## 실행과 검증

프로젝트 지정 런타임은 Node.js 22입니다.

```sh
npm ci
npm run dev
```

실제 값은 `.env.example`을 참고해 `.env.local`에 넣습니다. 키가 없는 상태에서도 자동 테스트와 빌드를 실행할 수 있지만, 실제 회원가입과 DB 저장은 확인할 수 없습니다.

```sh
npm test
npm run typecheck
npm run build
```

9주차 설정·실서비스 검증: [docs/WEEK9_SETUP.md](docs/WEEK9_SETUP.md).
8주차 설정 참고: [docs/WEEK8_SETUP.md](docs/WEEK8_SETUP.md). **기존 운영 DB 설정과 임베딩을 처음부터 다시 만들 필요는 없습니다.**

## 주요 API

| API | 역할 |
| --- | --- |
| GET `/api/session` | 검증된 로그인 사용자 정보 |
| GET `/api/me/dashboard` | 현재 계정의 개인 자료 |
| PUT `/api/me/profile` | 내 취향 프로필 저장 |
| POST `/api/me/wardrobe` | 내 옷 등록 |
| PATCH / DELETE `/api/me/wardrobe/[id]` | 내 옷 수정 / 삭제 |
| POST `/api/me/outfits` | 내 코디 저장 |
| PATCH / DELETE `/api/me/outfits/[id]` | 상태·평점 수정 / 삭제 |
| POST `/api/suggest` | 공통·브라우저·개인 옷장 코디 추천 |
| POST `/api/chat` | 공통 예시 코디 기록 RAG |
| POST `/api/auth/signout` | 현재 세션 로그아웃 |
| POST `/api/auth/password` | 비밀번호 변경 |

개인 요청은 Supabase 공개 키와 검증된 사용자의 세션으로 처리하며, DB가 행 소유권을 검사합니다. 서버 비밀 키는 기존 공통 자료/RAG용이며 개인 자료 API에 사용하지 않습니다.

기존 `docs/TEST_REPORT.md`, `PRD.md`, `docs/GUIDE.md` 등은 과거 단계 문서입니다. 현재 검증 내역은 [9주차 검증 기록](docs/HANDOFF_VALIDATION.md)에 있습니다.
