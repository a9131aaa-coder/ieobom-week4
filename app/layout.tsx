import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '입어봄 — 나를 알아가는 스타일 대시보드',
  description: '내 취향을 기억하는 AI 코디 컨설턴트. 5주차 AI 코디 분석과 옷장 관리 시제품. 기본 데이터는 예시입니다.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/dashboard.css" />
        {/* 폰트는 외부 CSS로만 참조합니다. 글꼴 파일은 프로젝트에 포함하지 않습니다. */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
