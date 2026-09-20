'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect, useRef } from 'react';
import { Button, IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface VoiceRecorderBarProps {
  onSendVoiceNote: (audioBlob: Blob, durationSec: number) => void;
  onCancel: () => void;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({
  onSendVoiceNote,
  onCancel,
}) => {
  const { haptic } = useHapticFeedback();
  const [recording, setRecording] = useState(false);
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
      } catch (err: any) {
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
  }, []);

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
      <div className="flex items-center justify-between gap-[var(--space-3)] border-t border-[color:var(--lkv-danger)]/20 bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-danger-dark)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <Icon name="alert-circle" className="size-4 shrink-0 text-[color:var(--lkv-danger)]" aria-hidden="true" />
          <span>{permissionError}</span>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} className="shrink-0">
          Fermer
        </Button>
      </div>
    );
  }

  return (
    <div className="msg-sheet-in flex items-center justify-between gap-[var(--space-3)] border-t border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] pb-[max(calc(var(--safe-bottom)-var(--kb-inset,0px)),12px)] backdrop-blur-[var(--blur-md)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <div className="relative flex items-center justify-center" aria-hidden="true">
          <span className="absolute size-3 animate-ping rounded-full bg-[color:var(--lkv-danger)]" />
          <span className="relative size-3 rounded-full bg-[color:var(--lkv-danger)]" />
        </div>
        <Icon name="mic" className="size-4 text-[color:var(--lkv-danger)]" aria-hidden="true" />
        <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold tracking-wider text-[color:var(--lkv-text-primary)]">
          {formatTimer(seconds)}
        </span>
        <span className="hidden text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-muted)] sm:inline">
          Enregistrement de la note vocale terrain...
        </span>
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        <IconButton
          type="button"
          variant="glass"
          onClick={() => {
            haptic('light');
            onCancel();
          }}
          aria-label="Annuler l'enregistrement"
          title="Annuler"
          className="text-[color:var(--lkv-danger)]"
        >
          <Icon name="trash2" className="size-4" aria-hidden="true" />
        </IconButton>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleStopAndSend}
          disabled={seconds < 1}
          icon={<Icon name="send" className="size-3.5" aria-hidden="true" />}
          className={seconds >= 1 ? 'shadow-elevation-2' : 'opacity-40'}
        >
          Envoyer
        </Button>
      </div>
    </div>
  );
};
