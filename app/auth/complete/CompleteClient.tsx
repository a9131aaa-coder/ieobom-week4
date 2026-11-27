'use client';

import { useEffect, useRef } from 'react';
import { notifyAuthChange, safeAuthNext } from '@/lib/auth-input.mjs';

export default function CompleteClient({ next }: { next: string }) {
  const completed = useRef(false);
  useEffect(() => {
    if (completed.current) return;
    completed.current = true;
    notifyAuthChange();
    window.location.replace(safeAuthNext(next));
  }, [next]);
  return <main className="auth-page"><div className="auth-card"><h1>인증을 확인했어요.</h1><p className="auth-description" role="status">내 계정으로 이동하고 있어요.</p><a className="button" href={safeAuthNext(next)}>계속하기</a></div></main>;
}
