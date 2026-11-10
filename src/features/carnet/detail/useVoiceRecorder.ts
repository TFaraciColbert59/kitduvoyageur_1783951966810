'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Une note vocale dure 3 minutes au plus (au-delà, l'enregistrement s'arrête seul). */
export const MAX_VOICE_SECONDS = 180;

/** « 0:42 », « 12:05 » : le format de durée des moments (`durationLabel`). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

/** Premier format que le navigateur sait écrire (Safari : mp4, Chrome/Firefox : webm/ogg). */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string | null {
  return MIME_CANDIDATES.find((mime) => isSupported(mime)) ?? null;
}

export type VoiceState = 'idle' | 'recording' | 'ready' | 'error';

export interface VoiceRecording {
  file: File;
  durationLabel: string;
  seconds: number;
}

/**
 * Enregistrement réel d'une note vocale (MediaRecorder). Le micro n'est ouvert
 * qu'à l'appui sur « Enregistrer » et refermé à l'arrêt, à l'abandon ou au
 * démontage : aucune piste ne reste vivante en arrière-plan.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const release = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      release();
    },
    [release]
  );

  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const start = useCallback(async () => {
    setMessage(null);
    if (!supported) {
      setState('error');
      setMessage('Ton navigateur ne peut pas enregistrer de son.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.max(1, (performance.now() - startedAtRef.current) / 1000);
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        release();
        if (blob.size === 0) {
          setState('error');
          setMessage('Aucun son enregistré, réessaie.');
          return;
        }
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        setRecording({
          file: new File([blob], `note-vocale.${ext}`, { type }),
          durationLabel: formatClock(elapsed),
          seconds: Math.round(elapsed),
        });
        setState('ready');
      };
      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      setSeconds(0);
      setRecording(null);
      recorder.start();
      setState('recording');
      timerRef.current = window.setInterval(() => {
        const elapsed = (performance.now() - startedAtRef.current) / 1000;
        setSeconds(Math.floor(elapsed));
        if (elapsed >= MAX_VOICE_SECONDS && recorder.state !== 'inactive') recorder.stop();
      }, 250);
    } catch {
      release();
      setState('error');
      setMessage('Le micro est refusé ou indisponible.');
    }
  }, [release, supported]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const reset = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    release();
    setRecording(null);
    setSeconds(0);
    setMessage(null);
    setState('idle');
  }, [release]);

  return { state, seconds, recording, message, supported, start, stop, reset };
}
