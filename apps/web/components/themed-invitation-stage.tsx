'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { InvitationPresentation } from '@matemyparty/contracts';
import type { Dictionary } from '@matemyparty/i18n';

export function ThemedInvitationStage({
  presentation,
  dictionary,
  privateExperience = false,
  mediaDisabled = false,
  forceReducedMotion = false,
  containedControls = false,
  mediaUnlocked = true,
  children,
}: {
  presentation: InvitationPresentation;
  dictionary: Dictionary;
  privateExperience?: boolean;
  mediaDisabled?: boolean;
  forceReducedMotion?: boolean;
  containedControls?: boolean;
  mediaUnlocked?: boolean;
  children: ReactNode;
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(forceReducedMotion);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (forceReducedMotion) {
      setPrefersReducedMotion(true);
      return;
    }
    if (typeof window.matchMedia !== 'function') {
      setPrefersReducedMotion(false);
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [forceReducedMotion]);

  const showVideo = Boolean(
    presentation.videoRef && !videoFailed && !mediaDisabled && !prefersReducedMotion,
  );
  const fallback = presentation.staticFallbackRef ?? presentation.thumbnailRef;
  const overlayOpacity = Math.max(0, Math.min(0.9, presentation.overlayIntensity / 100));

  async function toggleVideo() {
    if (!video.current) return;
    if (video.current.paused) {
      await video.current.play().catch(() => undefined);
      setVideoPaused(false);
    } else {
      video.current.pause();
      setVideoPaused(true);
    }
  }

  async function replayVideo() {
    if (!video.current) return;
    video.current.currentTime = 0;
    await video.current.play().catch(() => undefined);
    setVideoPaused(false);
  }

  async function toggleAudio() {
    if (!audio.current) return;
    if (audio.current.paused) {
      await audio.current.play().catch(() => undefined);
      setAudioPlaying(!audio.current.paused);
    } else {
      audio.current.pause();
      setAudioPlaying(false);
    }
  }

  return (
    <main
      className={`@container relative min-h-screen overflow-hidden bg-slate-950 text-white template-${presentation.mode.toLowerCase()}`}
      data-presentation-mode={presentation.mode}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      <div
        data-testid="media-fallback"
        aria-label={dictionary.invitation.mediaFallback}
        className="absolute inset-0 scale-105 bg-[radial-gradient(circle_at_top,#4338ca_0%,#172554_35%,#020617_78%)] bg-cover bg-center"
      >
        {fallback ? (
          <img src={fallback} alt="" aria-hidden className="size-full object-cover" />
        ) : null}
      </div>
      {showVideo ? (
        <video
          ref={video}
          data-testid="invitation-video"
          src={presentation.videoRef!}
          autoPlay
          muted={videoMuted}
          loop={!privateExperience}
          playsInline
          preload="metadata"
          onCanPlay={() => setVideoReady(true)}
          onPlay={() => setVideoPaused(false)}
          onPause={() => setVideoPaused(true)}
          onError={() => setVideoFailed(true)}
          onEnded={() => setVideoPaused(true)}
          className="invitation-motion-video absolute inset-0 size-full object-cover"
        />
      ) : null}
      {!prefersReducedMotion && presentation.animationEnabled ? (
        <DecorativeAnimation mode={presentation.mode} />
      ) : null}
      <div className="absolute inset-0 bg-slate-950" style={{ opacity: overlayOpacity }} />
      {showVideo && !videoReady ? (
        <div
          className="absolute inset-x-0 top-6 z-20 text-center text-sm text-white/80"
          role="status"
        >
          {dictionary.invitation.mediaLoading}
        </div>
      ) : null}
      <div className="relative z-10 min-h-screen">{children}</div>
      <div
        className={`${containedControls ? 'absolute' : 'fixed'} inset-x-0 bottom-3 z-30 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950/75 p-2 shadow-xl backdrop-blur`}
      >
        {showVideo ? (
          <>
            <Control
              onClick={() => void toggleVideo()}
              label={videoPaused ? dictionary.invitation.play : dictionary.invitation.pause}
            />
            <Control onClick={() => void replayVideo()} label={dictionary.invitation.replay} />
            <Control
              onClick={() => {
                if (video.current) video.current.muted = !videoMuted;
                setVideoMuted((current) => !current);
              }}
              label={videoMuted ? dictionary.invitation.unmute : dictionary.invitation.mute}
            />
          </>
        ) : null}
        {presentation.audioRef && !mediaDisabled && mediaUnlocked ? (
          <>
            <audio
              ref={audio}
              src={presentation.audioRef}
              preload="none"
              onEnded={() => setAudioPlaying(false)}
            />
            <Control
              onClick={() => void toggleAudio()}
              label={
                audioPlaying ? dictionary.invitation.pauseMusic : dictionary.invitation.playMusic
              }
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

function DecorativeAnimation({ mode }: { mode: InvitationPresentation['mode'] }) {
  if (mode === 'WINTER_SNOW')
    return <div aria-hidden className="celebration-snow absolute inset-0" />;
  if (mode === 'ADVENTURE_GATES')
    return <div aria-hidden className="celebration-gates absolute inset-0" />;
  if (mode === 'ENVELOPE_REVEAL')
    return <div aria-hidden className="celebration-envelope absolute inset-0" />;
  return <div aria-hidden className="celebration-flight absolute inset-0" />;
}

function Control({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      {label}
    </button>
  );
}
