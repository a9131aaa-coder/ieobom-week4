# 5주차 적용·제출 안내

입어봄 0.2.0 · 2026-10-17

## 먼저, 실제 AI 연결까지 마무리하기

이 업데이트는 코드와 기능을 준비한 배포 패키지입니다. 본인 API 키를 등록하고 다시 배포하기 전까지는 ‘예시 결과’가 나올 수 있습니다. ‘실제 AI 응답’과 fallback:false를 확인해야 연결 완료입니다.

1. ZIP을 새 폴더에 압축 해제합니다.
2. GitHub의 기존 ieobom-week4 저장소 → Add file → Upload files.
3. package.json이 보이는 위치의 파일과 폴더 전부를 업로드 상자에 끌어놓고 Commit changes.
4. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키를 발급합니다. 키는 채팅이나 GitHub에 올리지 않습니다.
5. Vercel 기존 프로젝트 → Settings → Environment Variables에 LLM_API_KEY(본인 키), LLM_MODEL(gemini-3.5-flash-lite)를 Production 환경으로 저장합니다.
6. Deployments → 최신 배포 메뉴 → Redeploy → Ready 확인.
7. [입어봄 열기](https://ieobom-week4.vercel.app) → AI 코디 분석. 실제 AI 응답인지 확인합니다.

코드 파일은 GitHub에, 비밀 키는 Vercel 설정에 입력합니다. 키를 입력하는 과정에서 카드 등록이나 유료 가입을 반드시 해야 하는 것은 아닙니다. 무료 계정의 실제 사용 가능 여부·한도는 AI Studio에서 확인하세요.

## 오늘 확인할 화면

| 확인 | 누를 곳 | 정상 결과 |
|---|---|---|
| MOCK 입력 | 코디 상담 → 수업용 예시 옷장 | 의류 12벌과 예시 취향 분석 |
| 실제 AI 분석 | AI 코디 분석 | 코디 3개와 추천 이유, 실제 AI 응답 |
| 대시보드 표시 | 홈 대시보드 | 방금 만든 결과가 홈에도 표시 |
| 옷 등록 | 내 옷장 → 옷 등록 | 새 옷이 목록과 숫자에 반영 |
| 코디 저장 | 이 코디 저장 → 착용 기록 | 저장한 코디 상세·만족도 입력 |
| 취향 반영 | 프로필 저장 → 상담에서 수정한 옷장 선택 | 수정한 취향으로 다음 요청 |
| 휴대폰 | 동일한 배포 URL 접속 | 메뉴 이동과 분석 결과 확인 |

휴대폰에서 앱을 별도로 설치할 필요는 없습니다. PC에서 저장한 개인 기록이 폰에 자동으로 복사되지는 않습니다.

## 실제 AI 성공 확인

PC에서 F12 → Network → Fetch/XHR. 사이트의 AI 코디 분석 버튼을 누르고 suggest 요청을 선택합니다.

- Headers: Status Code 200
- Response: fallback:false, outfits 3개
- usage: 공급자가 반환한 입력·출력·추론 토큰 수
- 응답과 요청 어디에도 API 키가 없는지 확인

페이지를 여는 것만으로는 AI를 호출하지 않습니다. 실제로 분석 버튼을 눌러야 suggest 요청이 생깁니다.

## 실패 테스트 캡처

코디 상담 아래 ‘수업용 실패 테스트’를 펼치고 ‘실패 상황 테스트’를 누릅니다.

- 화면: ‘지금은 예시를 보여 드려요’
- Network → suggest → Response: fallback:true, reason:forced_test
- 상태 코드: 200

이 버튼은 외부 AI를 호출하지 않는 의도적 실패 재현입니다. 교수님이 실제 공급자의 오류를 원하면 LLM_MODEL을 잠시 gemini-does-not-exist로 바꾸고 Redeploy 후 분석합니다. fallback:true와 model_not_found를 확인한 다음, 모델명을 gemini-3.5-flash-lite로 복구하고 다시 Redeploy합니다. 실패 테스트와 복구 결과를 혼동하지 마세요.

캡처는 실제 배포 화면에서 직접 찍습니다. 예시 JSON이나 개발 테스트 화면을 실제 호출 증거로 제출하지 않습니다.

## 원가 기록

실제 분석 결과 아래 ‘실습 확인 · 응답 JSON / 토큰 / 원가’를 펼칩니다. ‘원가 기록 CSV 저장’을 누르면 방금 응답의 수치가 저장됩니다.

기본 모델의 유료 Standard 단가 기준(2026-10-17 확인): 입력 $0.30/100만 토큰, 출력·추론 $2.50/100만 토큰. 수업 환율은 1달러=1,350원입니다.

계산식: (입력 토큰 × 0.30 + (출력 + 추론 토큰) × 2.50) ÷ 1,000,000 × 1,350.

무료 티어에서는 실제 청구액이 0원일 수 있습니다. 앱의 원가 표시는 유료 단가 환산치입니다. 다른 모델을 설정하면 공식 단가를 다시 확인해야 합니다. CSV 마지막 열에는 3주차 정의서 게이트③ 목표와 실측 환산치를 비교해 본인이 작성합니다. 기존 목표 수치는 제공받지 않아 임의로 채우지 않았습니다.

[Google 공식 가격표](https://ai.google.dev/gemini-api/docs/pricing)

## 제출할 다섯 가지

1. 배포 URL: https://ieobom-week4.vercel.app
2. PRD v1.1: https://ieobom-week4.vercel.app/PRD.html
3. 실패 테스트 화면 + fallback:true가 보이는 Network 캡처
4. 실제 토큰 원가 CSV + 게이트③ 비교 한 줄
5. 본인의 한 줄 회고

강의자료 59번 슬라이드에 나온 제출물입니다. 현재 소프트웨어는 실제 호출과 캡처를 도와주도록 만들어져 있습니다. API 키 설정·실제 성공 호출·휴대폰 확인은 본인 배포 환경에서 마무리해야 합니다.

## 막히면 확인할 것

| 표시 | 확인 |
|---|---|
| AI 키가 아직 설정되지 않았습니다 | 환경변수 이름, Production 체크, 저장 후 Redeploy |
| 키 또는 접근 권한 오류 | AI Studio에서 키와 사용 권한 확인 |
| 모델을 찾지 못했습니다 | LLM_MODEL 이름 확인 후 Redeploy |
| 사용 한도에 도달했습니다 | 계정의 무료 한도 확인, 나중에 재시도 |
| 예전 화면이 계속 보입니다 | 최신 GitHub 커밋과 Vercel Ready 확인, Ctrl+Shift+R |
| 수정한 취향이 반영되지 않습니다 | 상담의 ‘내가 수정한 옷장과 스타일 프로필’ 선택 |
| 휴대폰에서 Vercel 로그인 요청 | Production 주소인지, Deployment Protection 설정 확인 |
