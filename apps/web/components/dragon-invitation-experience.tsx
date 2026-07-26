'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const MEDIA_ROOT = '/private-media/raymundo-6';
const INTRO_VIDEO = `${MEDIA_ROOT}/dragons-intro.mp4`;
const THEME_AUDIO = `${MEDIA_ROOT}/dragons-theme.mp3`;

export function DragonInvitationExperience({
  enterLabel,
  fallbackLabel,
  children,
}: {
  enterLabel: string;
  fallbackLabel: string;
  children: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [entered, setEntered] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!entered || !videoUnavailable) return;
    void audioRef.current?.play().catch(() => undefined);
  }, [entered, videoUnavailable]);

  async function enterExperience() {
    setEntered(true);
    const video = videoRef.current;

    if (!video) {
      setVideoUnavailable(true);
      return;
    }

    try {
      video.currentTime = 0;
      video.muted = false;
      await video.play();
    } catch {
      setVideoUnavailable(true);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02070d] text-white">
      <video
        ref={videoRef}
        className={`fixed inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          entered && !videoUnavailable ? 'opacity-100' : 'opacity-0'
        }`}
        playsInline
        preload="metadata"
        onError={() => setVideoUnavailable(true)}
        onEnded={() => setVideoUnavailable(true)}
      >
        <source src={INTRO_VIDEO} type="video/mp4" />
      </video>

      <audio ref={audioRef} src={THEME_AUDIO} loop preload="metadata" muted={muted} />

      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(29,214,181,0.13),transparent_22%),linear-gradient(180deg,rgba(1,7,13,0.18),rgba(1,6,13,0.9))]" />

      {(!entered || videoUnavailable) && (
        <div className="dragon-pulse fixed inset-0" aria-label={fallbackLabel}>
          <div className="dragon-eye dragon-eye-left" />
          <div className="dragon-eye dragon-eye-right" />
          <div className="absolute inset-x-0 bottom-[15%] text-center text-xs uppercase tracking-[0.45em] text-emerald-200/70">
            {fallbackLabel}
          </div>
        </div>
      )}

      {!entered ? (
        <section className="relative z-10 flex min-h-screen items-center justify-center p-6 text-center">
          <div className="max-w-xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.5em] text-emerald-300">
              A Night Fury awaits
            </p>
            <button
              type="button"
              onClick={enterExperience}
              className="rounded-full border border-emerald-300/60 bg-black/45 px-8 py-4 text-lg font-bold uppercase tracking-[0.18em] shadow-[0_0_45px_rgba(52,211,153,0.25)] backdrop-blur transition hover:scale-[1.03] hover:bg-emerald-300/10 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              {enterLabel}
            </button>
          </div>
        </section>
      ) : (
        <div className="relative z-10 min-h-screen bg-black/25 pt-12 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              if (videoRef.current) videoRef.current.muted = nextMuted;
            }}
            className="fixed right-4 top-4 z-20 rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-wider backdrop-blur"
          >
            {muted ? 'Sound on' : 'Mute'}
          </button>
          {children}
        </div>
      )}
    </main>
  );
}
