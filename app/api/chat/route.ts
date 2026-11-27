import { createChatHandler } from '@/lib/rag.mjs';
import { getAccountContext } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = createChatHandler({ getAccountContext });
