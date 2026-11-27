import { redirect } from 'next/navigation';
import { getAccountContext } from '@/lib/supabase/server';
import PasswordForm from './PasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '비밀번호 변경 — 입어봄' };

export default async function UpdatePasswordPage() {
  const account = await getAccountContext();
  if (account.status === 'unavailable') return <main className="auth-page"><div className="auth-card"><h1>로그인 상태를 확인하지 못했어요.</h1><p className="auth-description">잠시 후 페이지를 새로고침해 주세요.</p><a className="button" href="/account/update-password">다시 확인하기</a></div></main>;
  if (!account.user) redirect('/login?mode=forgot');
  return <main className="auth-page"><a href="/#home" className="auth-wordmark">입어봄<span>.</span><small>YOUR EVERYDAY EDIT</small></a><PasswordForm userId={account.user.id} /></main>;
}
