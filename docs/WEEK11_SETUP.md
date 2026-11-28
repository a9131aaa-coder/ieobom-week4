# 10~11주차 n8n 실습과 Instagram 게시

## 10주차 실습

`workflows/week10-a-edit-fields.json`과 `workflows/week10-b-zenquotes.json`을 n8n에 가져옵니다. A는 수동 실행 후 네 필드를 만들고, B는 [ZenQuotes](https://zenquotes.io/)에서 명언을 받아 저자와 한국 시간으로 정리합니다.

## 11주차 실서비스 연결

1. Instagram 프로페셔널 계정에 Meta 앱을 연결해 계정 ID와 게시 권한이 있는 토큰을 받습니다. 토큰은 n8n의 HTTP Request용 `Header Auth` 자격 증명에만 넣습니다. 이름은 `Authorization`, 값은 `Bearer ` 뒤에 토큰을 붙입니다.
2. 기존 공개 예시 사진을 640 × 760 홍보용 JPEG로 변환했습니다. 입어봄의 Supabase `promo` 버킷에서 공개 HTTPS 주소로 읽히는 것을 확인했습니다. [홍보용 JPEG](https://whrxlldbsblrmhzzjrhk.supabase.co/storage/v1/object/public/promo/ieobom-course-promo-shirt.jpg)
3. `workflows/week11-instagram-manual.json`에서 계정 ID를 채우고 각 Graph API 노드에 자격 증명을 지정합니다. `Check Instagram Account`를 먼저 실행해 연결할 계정인지 확인합니다. `Publish Instagram Media`는 실제 피드에 올라갈 사진과 글을 확인한 다음 실행합니다.
4. `workflows/week11-instagram-webhook.json`에서는 `Edit Fields`의 계정 ID를 지정하고 Graph API 노드에 같은 자격 증명을 연결합니다. `Instagram Webhook`에는 별도의 `Header Auth`를 사용합니다. 이름은 `x-ieoga-secret`, 값은 입어봄 서버와 공유할 비밀 값입니다. 노드 설정 후 `Publish`에서 웹훅을 켜고 `Production URL`을 확인합니다.
5. Supabase에 `supabase/009_instagram.sql`을 적용한 후 Vercel 서버 환경변수에 게시 운영자의 입어봄 사용자 ID, n8n `Production URL`, 웹훅 비밀 값, 공개 JPEG 주소를 설정하고 재배포합니다. 변수 이름은 `.env.example`과 같습니다. `Production URL`은 Vercel에서 접근할 수 있는 HTTPS 주소를 사용합니다.
6. 게시 운영자가 입어봄에 로그인해 **착용 기록**에서 게시할 코디를 엽니다. 게시 이미지와 글을 확인하고 **인스타그램에 올리기**로 게시합니다. Instagram 피드와 입어봄의 게시 완료 표시를 확인합니다. 서버가 결과를 확인하지 못하면 중복 게시를 막기 위해 같은 요청을 다시 보내지 않습니다.

## 검증 기록

로컬 n8n과 모의 Meta API에 대한 확인은 실제 Instagram 게시와 구분합니다. 실서비스 게시 확인에는 연결할 Instagram 계정과 그 계정에 대한 게시 권한이 필요합니다.
