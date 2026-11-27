'use client';

import { useRef, useState, type FormEvent } from 'react';
import { notifyAuthChange, validateAuthInput } from '@/lib/auth-input.mjs';

export default function PasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    const invalid = validateAuthInput({ password, confirmPassword }, 'reset');
    if (invalid) { setError(invalid); return; }
    pending.current = true; setBusy(true);
    try {
      const response = await fetch('/api/auth/password', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Ieobom-User': userId }, body: JSON.stringify({ password, confirmPassword }) });
      const result = await response.json();
      if (!response.ok) { setError(typeof result.error === 'string' ? result.error : '비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
      setPassword(''); setConfirmPassword('');
      notifyAuthChange();
      window.location.assign('/#home');
    } catch { setError('비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="auth-card"><span className="auth-eyebrow">MY ACCOUNT</span><h1>새 비밀번호를 정해 주세요.</h1><p className="auth-description">8자 이상의 비밀번호를 입력해 주세요.</p><form onSubmit={submit} aria-busy={busy}>
    <label htmlFor="new-password">새 비밀번호</label><input id="new-password" name="password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} maxLength={128} required disabled={busy} />
    <label htmlFor="confirm-password">비밀번호 확인</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} maxLength={128} required disabled={busy} />
    {error && <p className="auth-message auth-error" role="alert">{error}</p>}
    <button className="button auth-submit" type="submit" disabled={busy}>{busy ? '변경하고 있어요…' : '비밀번호 변경'}</button>
  </form><p className="auth-demo-link"><a href="/login?mode=forgot">재설정 메일 다시 받기</a></p></div>;
}
