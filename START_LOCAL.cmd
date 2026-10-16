@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22가 필요합니다. 또는 README의 GitHub - Vercel 경로로 배포하세요.
  pause
  exit /b 1
)
node --version
if not exist "node_modules\next\package.json" (
  echo 첫 실행에 필요한 패키지를 설치합니다. 인터넷 연결이 필요합니다.
  call npm install
  if errorlevel 1 (
    echo 패키지 설치에 실패했습니다. 위 오류를 확인해 주세요.
    pause
    exit /b 1
  )
)
echo 실행 후 브라우저에서 http://localhost:3000 을 열어주세요.
call npm run dev
pause
