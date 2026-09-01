"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X, Reply, Mic } from 'lucide-react';
import type { Message } from '../types/messaging.types';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface MessageComposerProps {
  onSendMessage: (content: string) => void;
  onSendAttachment?: (file: File) => void;
  onSendVoiceNote?: (blob: Blob, durationSec: number) => void;
  onTyping?: () => void;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onSendAttachment,
  onSendVoiceNote,
  onTyping,
  replyToMessage,
  onCancelReply,
  disabled,
}) => {
  const { haptic } = useHapticFeedback();
  const [content, setContent] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(newHeight, 40)}px`;
    }
  }, [content]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || disabled) return;
    haptic('light');
    onSendMessage(content.trim());
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift) on desktop / non-touch
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendAttachment) {
      haptic('light');
      onSendAttachment(file);
    }
  };

  if (isRecordingVoice && onSendVoiceNote) {
    return (
      <VoiceRecorderBar
        onSendVoiceNote={(blob, durationSec) => {
          setIsRecordingVoice(false);
          onSendVoiceNote(blob, durationSec);
        }}
        onCancel={() => setIsRecordingVoice(false)}
      />
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-2xl border-t border-stone-200/60 flex flex-col shrink-0 pb-[max(env(safe-area-inset-bottom,0px),8px)] shadow-lg">
      {replyToMessage && (
        <div className="px-4 py-2 bg-stone-50/95 border-b border-stone-200/60 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-1 h-8 bg-[#17402C] rounded-full shrink-0" />
            <Reply className="w-4 h-4 text-[#17402C] shrink-0" />
            <div className="text-xs overflow-hidden">
              <span className="font-bold text-[#17402C] block truncate">
                Réponse à {replyToMessage.sender_profile?.full_name || 'un voyageur'}
              </span>
              <span className="text-[#5A574E] truncate block text-[11px]">
                {replyToMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              onCancelReply?.();
            }}
            className="glass-circle-btn w-7 h-7 text-[#5A574E] hover:text-[#17402C] shrink-0"
            title="Annuler la réponse"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-2 sm:p-3 flex items-end gap-1.5 sm:gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.gpx,application/gpx+xml"
        />

        <button
          type="button"
          onClick={() => {
            haptic('light');
            fileInputRef.current?.click();
          }}
          disabled={disabled}
          className="glass-circle-btn w-10 h-10 text-[#17402C] shrink-0 active:scale-95 shadow-2xs"
          title="Joindre un fichier, une photo ou un GPX"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {onSendVoiceNote && (
          <button
            type="button"
            onClick={() => {
              haptic('medium');
              setIsRecordingVoice(true);
            }}
            disabled={disabled}
            className="glass-circle-btn w-10 h-10 text-[#17402C] hover:text-[#A8443A] shrink-0 active:scale-95 shadow-2xs"
            title="Enregistrer une note vocale terrain"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative flex items-center min-w-0">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              replyToMessage
                ? `Répondre à ${replyToMessage.sender_profile?.full_name || 'voyageur'}...`
                : 'Votre message...'
            }
            className="w-full pl-4 pr-3 py-2 text-[16px] md:text-sm rounded-2xl bg-white/85 border border-stone-200/80 focus:outline-none focus:border-[#17402C]/40 focus:ring-2 focus:ring-[#17402C]/15 text-[#14140F] placeholder-stone-400 font-medium resize-none min-h-[40px] max-h-[120px] leading-relaxed custom-scrollbar shadow-inner-xs transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!content.trim() || disabled}
          className={`w-10 h-10 shrink-0 ${
            content.trim() && !disabled
              ? 'glass-circle-btn primary shadow-md active:scale-95 cursor-pointer'
              : 'glass-circle-btn opacity-40 cursor-not-allowed text-[#5A574E]'
          }`}
          title="Envoyer le message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
