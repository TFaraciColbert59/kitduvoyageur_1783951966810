'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface VoiceRecorderBarProps {
  onSendVoiceNote: (audioBlob: Blob, durationSec: number) => void;
  onCancel: () => void;
}

/** Pilule de verre de la zone de conversation (marges du composer). */
const BAR = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 'none',
  // La barre vit dans la zone du composer, qui porte déjà la safe area.
  margin: '7px 10px',

  padding: '5px 6px 5px 12px',
  borderRadius: 999,
} as const;

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({
  onSendVoiceNote,
  onCancel,
}) => {
  const { haptic } = useHapticFeedback();
  const [, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startRecording() {
      try {
        setPermissionError(null);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg')
            ? 'audio/ogg'
            : 'audio/mp4';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.start(100);
        setRecording(true);
        haptic('medium');

        timerRef.current = setInterval(() => {
          setSeconds((prev) => prev + 1);
        }, 1000);
      } catch {
        setPermissionError(
          'Accès au microphone refusé ou non disponible. Veuillez vérifier les autorisations de votre navigateur.'
        );
      }
    }

    startRecording();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [haptic]);

  const handleStopAndSend = () => {
    haptic('light');
    if (!mediaRecorderRef.current) return;

    const finalSecs = seconds;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(chunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm',
      });
      onSendVoiceNote(audioBlob, finalSecs);
    };

    mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (permissionError) {
    return (
      <div className="lg" style={BAR} role="alert">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flex: 'none', color: 'var(--bad)' }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
        <span className="sub" style={{ flex: 1, minWidth: 0, color: 'var(--bad)' }}>
          {permissionError}
        </span>
        <button type="button" className="mbtn" onClick={onCancel}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="lg" style={BAR}>
      <span className="pd" style={{ background: 'var(--bad)' }} aria-hidden="true" />
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: 'none', color: 'var(--bad)' }}
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
      <span className="hl num">
        {formatTimer(seconds)}
      </span>
      <span className="sub" style={{ flex: 1, minWidth: 0 }}>
        Note vocale
      </span>
      <button
        type="button"
        className="lg gbtn"
        style={{ width: 38, height: 38, color: 'var(--bad)' }}
        onClick={() => {
          haptic('light');
          onCancel();
        }}
        aria-label="Annuler l'enregistrement"
        title="Annuler"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M6 7l1 13h10l1-13" />
        </svg>
      </button>
      <button
        type="button"
        className="mbtn p"
        onClick={handleStopAndSend}
        disabled={seconds < 1}
      >
        Envoyer
      </button>
    </div>
  );
};
