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
      <div className="p-3 bg-rose-50 border-t border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-800 font-medium">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{permissionError}</span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 bg-rose-200/80 hover:bg-rose-300 rounded-full text-rose-900 font-semibold shrink-0"
        >
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 bg-stone-900 text-white border-t border-stone-800 flex items-center justify-between gap-3 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping absolute" />
          <span className="w-3 h-3 bg-rose-500 rounded-full relative" />
        </div>
        <Mic className="w-4 h-4 text-rose-400" />
        <span className="font-mono font-bold text-sm text-emerald-400 tracking-wider">
          {formatTimer(seconds)}
        </span>
        <span className="text-xs text-stone-400 font-medium hidden sm:inline">
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
          className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
          title="Annuler"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleStopAndSend}
          disabled={seconds < 1}
          className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
            seconds >= 1
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
              : 'bg-stone-800 text-stone-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Envoyer
        </button>
      </div>
    </div>
  );
};
