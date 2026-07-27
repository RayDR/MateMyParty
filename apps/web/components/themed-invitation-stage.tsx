'use client';

import {
  useCallback,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { InvitationPresentation } from '@matemyparty/contracts';
import type { Dictionary } from '@matemyparty/i18n';
import { Pause, Play, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';

export type InvitationMediaHandle = {
  unlockAudio: () => Promise<boolean>;
};

type ThemedInvitationStageProps = {
  presentation: InvitationPresentation;
  dictionary: Dictionary;
  privateExperience?: boolean;
  mediaDisabled?: boolean;
  forceReducedMotion?: boolean;
  containedControls?: boolean;
  mediaUnlocked?: boolean;
  controlsRaised?: boolean;
  children: ReactNode;
};

export const ThemedInvitationStage = forwardRef<InvitationMediaHandle, ThemedInvitationStageProps>(
  function ThemedInvitationStage(
    {
      presentation,
      dictionary,
      privateExperience = false,
      mediaDisabled = false,
      forceReducedMotion = false,
      containedControls = false,
      mediaUnlocked = true,
      controlsRaised = false,
      children,
    },
    ref,
  ) {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(forceReducedMotion);
    const [videoFailed, setVideoFailed] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [videoPaused, setVideoPaused] = useState(false);
    const [videoMuted, setVideoMuted] = useState(true);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioMuted, setAudioMuted] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(false);
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

    const playAudio = useCallback(async () => {
      if (!audio.current || mediaDisabled) return false;
      try {
        await audio.current.play();
        const playing = !audio.current.paused;
        setAudioPlaying(playing);
        return playing;
      } catch {
        setAudioPlaying(false);
        return false;
      }
    }, [mediaDisabled]);

    useImperativeHandle(ref, () => ({ unlockAudio: playAudio }), [playAudio]);

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
        await playAudio();
      } else {
        audio.current.pause();
        setAudioPlaying(false);
      }
    }

    async function toggleAllMedia() {
      const videoIsPlaying = Boolean(video.current && !video.current.paused);
      const audioIsPlaying = Boolean(audio.current && !audio.current.paused);

      if (videoIsPlaying || audioIsPlaying) {
        video.current?.pause();
        audio.current?.pause();
        setVideoPaused(true);
        setAudioPlaying(false);
        return;
      }

      if (video.current) {
        await video.current.play().catch(() => undefined);
        setVideoPaused(false);
      }
      if (audio.current && mediaUnlocked) {
        await playAudio();
      }
    }

    const allMediaPaused =
      (!showVideo || videoPaused) && (!presentation.audioRef || !mediaUnlocked || !audioPlaying);

    return (
      <main
        className={`@container relative min-h-[100dvh] w-full max-w-full overflow-x-clip overflow-y-hidden bg-slate-950 text-white template-${presentation.mode.toLowerCase()}`}
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
        {presentation.audioRef && !mediaDisabled ? (
          <audio
            ref={audio}
            src={presentation.audioRef}
            preload="none"
            muted={audioMuted}
            onPlay={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
            onEnded={() => setAudioPlaying(false)}
          />
        ) : null}
        {(!privateExperience || mediaUnlocked) &&
        (showVideo || Boolean(presentation.audioRef && !mediaDisabled)) ? (
          <div
            className={`${containedControls ? 'absolute' : 'fixed'} ${
              controlsRaised ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-3'
            } invitation-media-controls right-3 left-auto z-30 flex w-fit max-w-[calc(100dvw-1.5rem)] items-center gap-2`}
          >
            {controlsOpen ? (
              <div className="absolute right-0 bottom-full mb-2 flex w-[min(17rem,calc(100dvw-1.5rem))] flex-wrap items-center justify-end gap-2 rounded-3xl border border-white/15 bg-slate-950/92 p-2 shadow-xl backdrop-blur">
                {showVideo ? (
                  <>
                    <Control
                      onClick={() => void toggleVideo()}
                      label={videoPaused ? dictionary.invitation.play : dictionary.invitation.pause}
                      pressed={!videoPaused}
                      icon={
                        videoPaused ? (
                          <Play aria-hidden size={17} />
                        ) : (
                          <Pause aria-hidden size={17} />
                        )
                      }
                    />
                    <Control
                      onClick={() => void replayVideo()}
                      label={dictionary.invitation.replay}
                      icon={<RotateCcw aria-hidden size={17} />}
                    />
                    <Control
                      onClick={() => {
                        if (video.current) video.current.muted = !videoMuted;
                        setVideoMuted((current) => !current);
                      }}
                      label={
                        videoMuted
                          ? dictionary.invitation.unmuteVideo
                          : dictionary.invitation.muteVideo
                      }
                      pressed={videoMuted}
                      icon={
                        videoMuted ? (
                          <VolumeX aria-hidden size={17} />
                        ) : (
                          <Volume2 aria-hidden size={17} />
                        )
                      }
                    />
                  </>
                ) : null}

                {presentation.audioRef && !mediaDisabled && mediaUnlocked ? (
                  <>
                    <Control
                      onClick={() => void toggleAudio()}
                      label={
                        audioPlaying
                          ? dictionary.invitation.pauseMusic
                          : dictionary.invitation.playMusic
                      }
                      pressed={audioPlaying}
                      icon={
                        audioPlaying ? (
                          <Pause aria-hidden size={17} />
                        ) : (
                          <Play aria-hidden size={17} />
                        )
                      }
                    />
                    <Control
                      onClick={() => {
                        if (audio.current) audio.current.muted = !audioMuted;
                        setAudioMuted((current) => !current);
                      }}
                      label={
                        audioMuted
                          ? dictionary.invitation.unmuteMusic
                          : dictionary.invitation.muteMusic
                      }
                      pressed={audioMuted}
                      icon={
                        audioMuted ? (
                          <VolumeX aria-hidden size={17} />
                        ) : (
                          <Volume2 aria-hidden size={17} />
                        )
                      }
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/88 p-2 shadow-xl backdrop-blur">
              <Control
                onClick={() => void toggleAllMedia()}
                label={
                  allMediaPaused
                    ? `${dictionary.invitation.play} video + ${dictionary.invitation.playMusic}`
                    : `${dictionary.invitation.pause} video + ${dictionary.invitation.pauseMusic}`
                }
                pressed={!allMediaPaused}
                icon={
                  allMediaPaused ? <Play aria-hidden size={18} /> : <Pause aria-hidden size={18} />
                }
              />

              <button
                type="button"
                title={dictionary.invitation.mediaLoading}
                aria-label={dictionary.invitation.mediaLoading}
                aria-expanded={controlsOpen}
                onClick={() => setControlsOpen((current) => !current)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                <SlidersHorizontal aria-hidden size={18} />
              </button>
            </div>
          </div>
        ) : null}
      </main>
    );
  },
);

function DecorativeAnimation({ mode }: { mode: InvitationPresentation['mode'] }) {
  if (mode === 'WINTER_SNOW')
    return <div aria-hidden className="celebration-snow absolute inset-0" />;
  if (mode === 'ADVENTURE_GATES')
    return <div aria-hidden className="celebration-gates absolute inset-0" />;
  if (mode === 'ENVELOPE_REVEAL')
    return <div aria-hidden className="celebration-envelope absolute inset-0" />;
  return <div aria-hidden className="celebration-flight absolute inset-0" />;
}

function Control({
  onClick,
  label,
  icon,
  pressed,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      {icon}
    </button>
  );
}
