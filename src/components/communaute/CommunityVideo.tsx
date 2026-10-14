'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

/** One active video at a time, always muted by default. Pauses off-screen/tab hidden. */
export default function CommunityVideo({ src, className = '' }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  const pause = useCallback(() => {
    const video = ref.current;
    if (video) video.pause();
    setPlaying(false);
  }, []);

  const play = useCallback(async () => {
    const video = ref.current;
    if (!video) return;
    try {
      await video.play();
      setPlaying(true);
    } catch {
      // iOS Low Power Mode and user preferences can forbid autoplay.
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.65 && !document.hidden) {
        void play();
      } else pause();
    }, { threshold: [0, 0.65, 1] });
    observer.observe(video);
    const onHidden = () => { if (document.hidden) pause(); };
    const onOtherVideo = (event: Event) => {
      if ((event as CustomEvent).detail !== video) pause();
    };
    const onPlay = () => {
      document.dispatchEvent(new CustomEvent('lkdv-community-video-play', { detail: video }));
      setPlaying(true);
    };
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('lkdv-community-video-play', onOtherVideo);
    video.addEventListener('play', onPlay);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('lkdv-community-video-play', onOtherVideo);
      video.removeEventListener('play', onPlay);
      video.pause();
    };
  }, [src, pause, play]);

  return (
    <div className={'relative size-full bg-black ' + className} onClick={(event) => event.stopPropagation()}>
      <video
        ref={ref}
        src={src}
        className="size-full object-contain"
        preload="metadata"
        playsInline
        loop
        muted={muted}
        onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); pause(); }}
        aria-label="Vidéo de voyage"
      />
      {failed ? (
        <p role="alert" className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-white">
          Vidéo indisponible. Réessayez plus tard.
        </p>
      ) : (
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <button type="button" className="lkdv-community-video-control" onClick={() => { if (playing) pause(); else void play(); }} aria-label={playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}>
            <Icon name={playing ? 'pause' : 'play'} size={20} aria-hidden="true" />
          </button>
          <button type="button" className="lkdv-community-video-control" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Activer le son' : 'Couper le son'}>
            <Icon name={muted ? 'volume-x' : 'volume-2'} size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
