'use client';

import { useRef, useState, type ReactNode } from 'react';

const MEDIA_ROOT = '/private-media/raymundo-6';
const INTRO_VIDEO = `${MEDIA_ROOT}/dragons-intro.mp4`;
const THEME_AUDIO = `${MEDIA_ROOT}/dragons-theme.mp3`;

type ExperienceLabels = {
  enter: string;
  fallback: string;
  introPrompt: string;
  video: string;
  play: string;
  pause: string;
  mute: string;
  soundOn: string;
};

export function DragonInvitationExperience({
  labels,
  children,
}: {
  labels: ExperienceLabels;
  children: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const enteredRef = useRef(false);
  const [entered, setEntered] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  async function activateFallback() {
    setVideoUnavailable(true);
    videoRef.current?.pause();
    if (!enteredRef.current || !audioRef.current) {
      setPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  async function enterExperience() {
    enteredRef.current = true;
    setEntered(true);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const video = videoRef.current;
    if (reduceMotion || videoUnavailable || !video) {
      await activateFallback();
      return;
    }

    try {
      video.currentTime = 0;
      video.muted = muted;
      await video.play();
      setPlaying(true);
    } catch {
      await activateFallback();
    }
  }

  async function togglePlayback() {
    const media = videoUnavailable ? audioRef.current : videoRef.current;
    if (!media) return;

    if (playing) {
      media.pause();
      setPlaying(false);
      return;
    }

    try {
      await media.play();
      setPlaying(true);
    } catch {
      if (!videoUnavailable) await activateFallback();
    }
  }

  function toggleMuted() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) videoRef.current.muted = nextMuted;
    if (audioRef.current) audioRef.current.muted = nextMuted;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02070d] text-white">
      <video
        ref={videoRef}
        aria-label={labels.video}
        className={`dragon-media-transition fixed inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          entered && !videoUnavailable ? 'opacity-100' : 'opacity-0'
        }`}
        playsInline
        preload="metadata"
        muted={muted}
        onError={() => void activateFallback()}
        onEnded={() => void activateFallback()}
      >
        <source src={INTRO_VIDEO} type="video/mp4" />
      </video>

      <audio
        ref={audioRef}
        src={THEME_AUDIO}
        loop
        preload="metadata"
        muted={muted}
        onError={() => setPlaying(false)}
      />

      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(29,214,181,0.13),transparent_22%),linear-gradient(180deg,rgba(1,7,13,0.18),rgba(1,6,13,0.9))]" />

      {(!entered || videoUnavailable) && (
        <div className="dragon-pulse fixed inset-0" aria-label={labels.fallback}>
          <div className="dragon-eye dragon-eye-left" />
          <div className="dragon-eye dragon-eye-right" />
          <div className="absolute inset-x-0 bottom-[15%] text-center text-xs uppercase tracking-[0.45em] text-emerald-200/70">
            {labels.fallback}
          </div>
        </div>
      )}

      {!entered ? (
        <section className="relative z-10 flex min-h-screen items-center justify-center p-6 text-center">
          <div className="max-w-xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.5em] text-emerald-300">
              {labels.introPrompt}
            </p>
            <button
              type="button"
              onClick={() => void enterExperience()}
              className="rounded-full border border-emerald-300/60 bg-black/45 px-8 py-4 text-lg font-bold uppercase tracking-[0.18em] shadow-[0_0_45px_rgba(52,211,153,0.25)] backdrop-blur transition hover:scale-[1.03] hover:bg-emerald-300/10 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              {labels.enter}
            </button>
          </div>
        </section>
      ) : (
        <>
          <div
            className="fixed right-4 top-4 z-30 flex gap-2"
            role="group"
            aria-label={labels.video}
          >
            <button
              type="button"
              onClick={() => void togglePlayback()}
              className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider backdrop-blur"
            >
              {playing ? labels.pause : labels.play}
            </button>
            <button
              type="button"
              onClick={toggleMuted}
              className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider backdrop-blur"
            >
              {muted ? labels.soundOn : labels.mute}
            </button>
          </div>
          <div className="relative z-10 min-h-screen bg-black/25 pt-12 backdrop-blur-[1px]">
            {children}
          </div>
        </>
      )}
    </main>
  );
}
