import { getAccountContext } from '@/lib/supabase/server';
import { createInstagramPublishHandler } from '@/lib/instagram-publish.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = createInstagramPublishHandler({ getContext: getAccountContext });
