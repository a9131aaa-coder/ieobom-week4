'use client';

import { useRef, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { authMessage, notifyAuthChange, validateAuthInput } from '@/lib/auth-input.mjs';

type Mode = 'login' | 'signup' | 'forgot';
const labels = { login: '로그인', signup: '회원가입', forgot: '재설정 메일 받기' };

export default function AuthForm({ configured, initialMode = 'login', initialError = '' }: { configured: boolean; initialMode?: Mode; initialError?: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const pending = useRef(false);

  function changeMode(next: Mode) {
    if (pending.current) return;
    setMode(next); setError(''); setNotice(''); setPassword(''); setConfirmPassword('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !configured) return;
    setError(''); setNotice('');
    const invalid = validateAuthInput({ email, password, confirmPassword }, mode);
    if (invalid) { setError(invalid); return; }
    pending.current = true; setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'login') {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) { setError(authMessage(failure)); return; }
        notifyAuthChange();
        window.location.assign('/#home');
      } else if (mode === 'signup') {
        const { data, error: failure } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (failure) { setError(authMessage(failure)); return; }
        setPassword(''); setConfirmPassword('');
        if (data.session) { notifyAuthChange(); window.location.assign('/#home'); return; }
        setNotice('인증 메일을 확인해 주세요. 가입 가능한 이메일이면 메일이 발송됩니다. 받은편지함과 스팸함에서 링크를 누른 뒤 이용할 수 있어요.');
      } else {
        const { error: failure } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/account/update-password`,
        });
        if (failure) { setError(authMessage(failure)); return; }
        setNotice('가입된 이메일이면 비밀번호 재설정 메일이 발송됩니다. 받은편지함과 스팸함을 확인해 주세요.');
      }
    } catch { setError('연결이 원활하지 않아 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { pending.current = false; setBusy(false); }
  }

  return <div className="auth-card">
    <div className="auth-tabs" aria-label="계정 이용 방식">
      <button type="button" className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => changeMode('login')} disabled={busy}>로그인</button>
      <button type="button" className={mode === 'signup' ? 'active' : ''} aria-pressed={mode === 'signup'} onClick={() => changeMode('signup')} disabled={busy}>회원가입</button>
    </div>
    <h1>{mode === 'signup' ? '나만의 옷장을 시작해요.' : mode === 'forgot' ? '비밀번호를 잊으셨나요?' : '내 옷장으로 돌아오세요.'}</h1>
    <p className="auth-description">{mode === 'signup' ? '이메일을 인증하면 옷과 코디 기록을 내 계정에 저장할 수 있어요.' : mode === 'forgot' ? '가입한 이메일로 새 비밀번호를 정할 수 있는 링크를 보내드려요.' : '내가 등록한 옷과 코디 기록을 이어서 관리해요.'}</p>
    {!configured && <p className="auth-message auth-error" role="alert">로그인 연결 설정이 아직 준비되지 않았어요. 잠시 후 다시 이용해 주세요.</p>}
    <form onSubmit={submit} aria-busy={busy}>
      <label htmlFor="auth-email">이메일</label>
      <input id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={busy || !configured} placeholder="name@example.com" />
      {mode !== 'forgot' && <><label htmlFor="auth-password">비밀번호{mode === 'signup' && <span>8자 이상</span>}</label>
        <input id="auth-password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'signup' ? 8 : 1} maxLength={128} required disabled={busy || !configured} />
      </>}
      {mode === 'signup' && <><label htmlFor="auth-confirm">비밀번호 확인</label><input id="auth-confirm" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} maxLength={128} required disabled={busy || !configured} /></>}
      {error && <p className="auth-message auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-message auth-success" role="status">{notice}</p>}
      <button className="button auth-submit" type="submit" disabled={busy || !configured}>{busy ? '처리하고 있어요…' : labels[mode]}</button>
    </form>
    {mode === 'login' && <button className="auth-text-button" type="button" onClick={() => changeMode('forgot')} disabled={busy}>비밀번호를 잊으셨나요?</button>}
    {mode === 'forgot' && <button className="auth-text-button" type="button" onClick={() => changeMode('login')} disabled={busy}>로그인으로 돌아가기</button>}
    <p className="auth-demo-link"><a href="/#home">먼저 예시 옷장 둘러보기</a></p>
  </div>;
}
