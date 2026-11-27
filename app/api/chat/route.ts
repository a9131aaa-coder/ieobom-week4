import { createChatHandler } from '@/lib/rag.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = createChatHandler();
