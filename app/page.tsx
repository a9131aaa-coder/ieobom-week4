import Script from 'next/script';
import { dashboardMarkup } from '@/lib/dashboard-view.mjs';

/**
 * 4주차에는 화면 1개만 제공합니다.
 * dashboardMarkup은 개발자가 작성한 고정 레이아웃이며 사용자 입력이 아닙니다.
 * 카드 숫자와 기록은 이 페이지에 포함하지 않고, 브라우저가 /api/dashboard로 요청합니다.
 * 데이터 표시에는 textContent를 사용합니다. 5주차에는 상담 영역을 별도 컴포넌트로 확장합니다.
 */
export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: dashboardMarkup }} />
      <Script src="/dashboard.mjs" type="module" strategy="afterInteractive" />
    </>
  );
}
