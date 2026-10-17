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
