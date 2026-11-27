import { getAccountContext } from '@/lib/supabase/server';
import { handleAccountRequest } from '@/lib/account-data.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleAccountRequest(request, 'outfits', undefined, getAccountContext); }
