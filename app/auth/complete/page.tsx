import { redirect } from 'next/navigation';
import { getAccountContext } from '@/lib/supabase/server';
import { safeAuthNext } from '@/lib/auth-input.mjs';
import CompleteClient from './CompleteClient';

export const dynamic = 'force-dynamic';

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const account = await getAccountContext();
  if (!account.user) redirect('/login?error=link');
  const params = await searchParams;
  return <CompleteClient next={safeAuthNext(params.next)} />;
}
