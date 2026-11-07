import { dashboardResponse } from '@/lib/dashboard-data.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return dashboardResponse(); }
