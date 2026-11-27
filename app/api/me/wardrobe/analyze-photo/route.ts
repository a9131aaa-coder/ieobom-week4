import { accountJson } from '@/lib/account-data.mjs';
import { getAccountContext } from '@/lib/supabase/server';
import { createWardrobePhotoHandler, wardrobePhotoAvailable } from '@/lib/wardrobe-photo.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export function GET() {
  return accountJson({ available: wardrobePhotoAvailable() });
}

export const POST = createWardrobePhotoHandler({ getContext: getAccountContext });
