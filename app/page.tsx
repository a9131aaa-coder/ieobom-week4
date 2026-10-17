import Script from 'next/script';
import { dashboardMarkup } from '@/lib/dashboard-view.mjs';

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: dashboardMarkup }} />
      <Script src="/dashboard.mjs" type="module" strategy="afterInteractive" />
    </>
  );
}
