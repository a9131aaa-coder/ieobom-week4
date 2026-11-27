import { getAccountContext } from '@/lib/supabase/server';
import { handleAccountRequest } from '@/lib/account-data.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return handleAccountRequest(request, 'outfits', (await context.params).id, getAccountContext); }
export async function DELETE(request: Request, context: Context) { return handleAccountRequest(request, 'outfits', (await context.params).id, getAccountContext); }
