'use client';

import { useEffect, useRef, useState } from 'react';
import { isPlayableSoundtrack } from '@/lib/community/soundtrack';

type Props = {
  url?: string | null;
  title?: string | null;
  creator?: string | null;
  sourceUrl?: string | null;
};

/** User-initiated audio only; one soundtrack per page, pauses video and off-screen media. */
export function CommunityPostSoundtrack({ url, title, creator, sourceUrl }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const stop = () => { audio.pause(); setPlaying(false); };
    const onOtherAudio = (event: Event) => {
      if ((event as CustomEvent).detail !== audio) stop();
    };
    const onPageHidden = () => { if (document.hidden) stop(); };
    document.addEventListener('lkdv-community-soundtrack-play', onOtherAudio);
    document.addEventListener('lkdv-community-video-play', stop);
    document.addEventListener('visibilitychange', onPageHidden);

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      ([entry]) => { if (!entry?.isIntersecting) stop(); },
      { threshold: 0 },
    );
    if (wrapperRef.current) observer?.observe(wrapperRef.current);
    return () => {
      observer?.disconnect();
      document.removeEventListener('lkdv-community-soundtrack-play', onOtherAudio);
      document.removeEventListener('lkdv-community-video-play', stop);
      document.removeEventListener('visibilitychange', onPageHidden);
      stop();
    };
  }, [url]);

  if (!isPlayableSoundtrack(url)) return null;
  const validSource = sourceUrl?.startsWith('https://') ? sourceUrl : null;

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }
    // Sound always requires a tap. Never auto-resume or auto-unmute videos.
    document.dispatchEvent(new CustomEvent('lkdv-community-soundtrack-play', { detail: audio }));
    document.dispatchEvent(new CustomEvent('lkdv-community-video-play', { detail: null }));
    try {
      await audio.play();
      setPlaying(true);
      setFailed(false);
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  };

  return (
    <div ref={wrapperRef} className="flex max-w-full flex-col gap-1 rounded-xl bg-black/75 p-2 text-white backdrop-blur-md" onClick={(event) => event.stopPropagation()}>
      <audio ref={audioRef} src={url} preload="none" onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? 'Mettre en pause l’ambiance sonore' : 'Écouter l’ambiance sonore'}
        aria-pressed={playing}
        className="flex min-w-0 items-center gap-2 text-left text-xs font-medium"
      >
        <span aria-hidden="true">{playing ? 'Ⅱ' : '♫'}</span>
        <span className="truncate">{title || 'Ambiance sonore'}</span>
      </button>
      {creator ? <span className="truncate text-[10px] text-white/75">Par {creator}</span> : null}
      {failed ? (
        <span className="text-[10px] text-amber-200">Lecture impossible sur cet appareil.</span>
      ) : null}
      {validSource ? (
        <a href={validSource} rel="noopener noreferrer" target="_blank" className="text-[10px] text-white/75 underline underline-offset-2">
          Source et licence
        </a>
      ) : null}
    </div>
  );
}
