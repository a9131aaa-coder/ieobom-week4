import Script from 'next/script';
import { dashboardMarkup } from '@/lib/dashboard-view.mjs';
import HomeIntro from './home-intro';

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: dashboardMarkup }} />
      <HomeIntro />
      <Script src="/dashboard.mjs" type="module" strategy="afterInteractive" />
    </>
  );
}
