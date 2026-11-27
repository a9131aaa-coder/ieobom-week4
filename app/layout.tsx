import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '입어봄 — 나를 알아가는 스타일 대시보드',
  description: '가진 옷으로 코디를 추천받고, 저장된 공통 코디 기록을 찾아 근거와 함께 답하는 AI 스타일 도우미. 기본 데이터는 예시입니다.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/dashboard.css" />
        <link rel="stylesheet" href="/auth.css" />
        {/* 폰트는 외부 CSS로만 참조합니다. 글꼴 파일은 프로젝트에 포함하지 않습니다. */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
