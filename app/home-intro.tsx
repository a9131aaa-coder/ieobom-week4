'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './home-intro.module.css';

const seenKey = 'ieobom-home-intro-seen';
const startupLimit = 1500;
const playbackLimit = 5500;
const fadeDuration = 220;

function canShowIntro() {
  const { hash, origin } = window.location;
  if (hash && hash !== '#home') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  if (document.referrer) {
    const referrer = new URL(document.referrer);
    if (referrer.origin === origin && referrer.pathname !== '/') return false;
  }

  try {
    if (window.sessionStorage.getItem(seenKey)) return false;
    window.sessionStorage.setItem(seenKey, '1');
    return true;
  } catch {
    return false;
  }
}

export default function HomeIntro() {
  const [phase, setPhase] = useState<'hidden' | 'playing' | 'fading'>('hidden');
  const checkedVisit = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const visible = phase !== 'hidden';
  const dismiss = useCallback(() => {
    setPhase(current => current === 'playing' ? 'fading' : current);
  }, []);

  useEffect(() => {
    if (checkedVisit.current) return;
    checkedVisit.current = true;
    if (canShowIntro()) setPhase('playing');
  }, []);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video || typeof dialog.showModal !== 'function') {
      setPhase('hidden');
      return;
    }

    try {
      dialog.showModal();
    } catch {
      setPhase('hidden');
      return;
    }

    const startupTimer = window.setTimeout(dismiss, startupLimit);
    const playbackTimer = window.setTimeout(dismiss, playbackLimit);
    const playbackStarted = () => window.clearTimeout(startupTimer);
    video.addEventListener('playing', playbackStarted, { once: true });
    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) playbackStarted();
    window.addEventListener('hashchange', dismiss);

    return () => {
      video.removeEventListener('playing', playbackStarted);
      window.removeEventListener('hashchange', dismiss);
      window.clearTimeout(startupTimer);
      window.clearTimeout(playbackTimer);
      if (dialog.open) dialog.close();
    };
  }, [dismiss, visible]);

  useEffect(() => {
    if (phase !== 'fading') return;
    const timer = window.setTimeout(() => setPhase('hidden'), fadeDuration);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (!visible) return null;

  return (
    <dialog
      aria-label="입어봄 인트로"
      data-home-intro
      className={phase === 'fading' ? `${styles.intro} ${styles.fading}` : styles.intro}
      ref={dialogRef}
      onCancel={event => { event.preventDefault(); dismiss(); }}
    >
      <video
        ref={videoRef}
        className={styles.video}
        src="/intro/wardrobe-intro.mp4"
        poster="/intro/wardrobe-intro-poster.jpg"
        muted
        autoPlay
        playsInline
        aria-hidden="true"
        onEnded={dismiss}
        onError={dismiss}
      />
      <button type="button" className={styles.skip} onClick={dismiss} aria-keyshortcuts="Escape">
        건너뛰기
      </button>
    </dialog>
  );
}
