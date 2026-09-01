"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Send, AlertCircle } from 'lucide-react';
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
      <div className="p-3 bg-[#F5DDD9]/90 border-t border-[#A8443A]/20 flex items-center justify-between gap-3 text-xs text-[#8A241B] font-medium">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#A8443A]" />
          <span>{permissionError}</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 rounded-full bg-[#A8443A]/15 text-[#8A241B] font-semibold shrink-0 min-h-[32px]"
        >
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-3 glass border-t border-white/40 flex items-center justify-between gap-3 msg-sheet-in"
      style={{
        paddingBottom:
          'max(calc(env(safe-area-inset-bottom, 0px) - var(--kb-inset, 0px)), 12px)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center" aria-hidden="true">
          <span className="w-3 h-3 bg-[#A8443A] rounded-full animate-ping absolute" />
          <span className="w-3 h-3 bg-[#A8443A] rounded-full relative" />
        </div>
        <Mic className="w-4 h-4 text-[#A8443A]" />
        <span className="font-mono font-bold text-sm text-[#17402C] tracking-wider">
          {formatTimer(seconds)}
        </span>
        <span className="text-xs text-[#5A7064] font-medium hidden sm:inline">
          Enregistrement de la note vocale terrain...
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            haptic('light');
            onCancel();
          }}
          aria-label="Annuler l'enregistrement"
          className="glass-circle-btn w-10 h-10 text-[#A8443A] active:scale-95"
          title="Annuler"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleStopAndSend}
          disabled={seconds < 1}
          className={`glass-capsule-btn px-4 min-h-[44px] text-xs font-bold flex items-center gap-1.5 transition-all ${
            seconds >= 1 ? 'primary shadow-md active:scale-95' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Envoyer
        </button>
      </div>
    </div>
  );
};
