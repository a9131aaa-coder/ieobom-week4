// 5주차: AI 호출은 서버에서만. 비밀 키는 .env.local에 두고 화면 코드에는 쓰지 않습니다.
// 이번 주차에는 AI 호출, 인증, 외부 API 연결을 구현하지 않습니다.
import { getDashboard } from '@/lib/dashboard-data.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDashboard();
    return Response.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Data-Source': 'mock-json' },
    });
  } catch (error) {
    console.error('[dashboard] mock JSON load failed', error);
    return Response.json(
      { error: '대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
