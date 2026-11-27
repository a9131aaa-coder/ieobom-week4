import { redirect } from 'next/navigation';
import { getAccountContext } from '@/lib/supabase/server';
import AuthForm from './AuthForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '로그인 — 입어봄' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  const params = await searchParams;
  const account = await getAccountContext();
  if (account.user && params.mode !== 'forgot' && !params.error) redirect('/#home');
  const mode = params.mode === 'signup' || params.mode === 'forgot' ? params.mode : 'login';
  const error = account.status === 'unavailable' ? '로그인 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'
    : params.error === 'link' ? '인증 링크가 만료되었거나 이미 사용됐어요. 다시 로그인하거나 새 재설정 링크를 받아 주세요.' : '';
  return <main className="auth-page"><a href="/#home" className="auth-wordmark">입어봄<span>.</span><small>YOUR EVERYDAY EDIT</small></a><AuthForm configured={account.status !== 'unconfigured'} initialMode={mode} initialError={error} /><p className="auth-page-foot">새로 사기 전에, 내 옷으로 한 번 더.</p></main>;
}
