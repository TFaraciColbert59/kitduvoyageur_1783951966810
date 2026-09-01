"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ImagePlus, Send, X, Reply, Mic, Ellipsis } from 'lucide-react';
import type { Message, ProductMessageMeta, TrailMessageMeta } from '../types/messaging.types';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { ComposerMenuSheet } from './ComposerMenuSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface MessageComposerProps {
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onSendAttachment?: (file: File) => void;
  onSendVoiceNote?: (blob: Blob, durationSec: number) => void;
  onSendGpx?: (file: File) => void;
  onSendProduct?: (meta: ProductMessageMeta) => void;
  onSendTrail?: (meta: TrailMessageMeta) => void;
  onTyping?: () => void;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  currentUserId,
  onSendMessage,
  onSendAttachment,
  onSendVoiceNote,
  onSendGpx,
  onSendProduct,
  onSendTrail,
  onTyping,
  replyToMessage,
  onCancelReply,
  disabled,
}) => {
  const { haptic } = useHapticFeedback();
  const [content, setContent] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize — aligné sur le min-height 44px de .glass-input, max 132px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 132)}px`;
  }, [content]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || disabled) return;
    haptic('light');
    onSendMessage(content.trim());
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isFinePointer =
      typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
    if (isFinePointer && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (onTyping) onTyping();
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
    <div
      className="bg-white/90 backdrop-blur-2xl border-t border-stone-200/60 flex flex-col shrink-0 shadow-lg"
      style={{
        paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) - var(--kb-inset, 0px)), 8px)',
      }}
    >
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
          accept="image/*"
        />

        {/* Photo — envoie une image via le flux d'upload existant */}
        <button
          type="button"
          onClick={() => {
            haptic('light');
            fileInputRef.current?.click();
          }}
          disabled={disabled}
          aria-label="Envoyer une photo"
          className="glass-circle-btn w-11 h-11 text-[#17402C] shrink-0 active:scale-95 shadow-2xs"
          title="Envoyer une photo"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <div className="flex-1 relative flex items-center min-w-0">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            enterKeyHint="send"
            inputMode="text"
            placeholder={
              replyToMessage
                ? `Répondre à ${replyToMessage.sender_profile?.full_name || 'voyageur'}...`
                : 'Votre message...'
            }
            className="w-full pl-4 pr-3 py-2 text-[16px] md:text-sm glass-input font-medium resize-none min-h-[44px] max-h-[132px] leading-relaxed custom-scrollbar transition-all"
          />
        </div>

        {onSendVoiceNote && (
          <button
            type="button"
            onClick={() => {
              haptic('medium');
              setIsRecordingVoice(true);
            }}
            disabled={disabled}
            aria-label="Enregistrer une note vocale terrain"
            className="glass-circle-btn w-11 h-11 text-[#17402C] hover:text-[#A8443A] shrink-0 active:scale-95 shadow-2xs"
            title="Enregistrer une note vocale terrain"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {/* Menu ••• — GPX, équipement, randonnée */}
        <button
          type="button"
          onClick={() => {
            haptic('medium');
            setIsMenuOpen(true);
          }}
          disabled={disabled}
          aria-label="Partager un GPX, un équipement ou une randonnée"
          className="glass-circle-btn w-11 h-11 text-[#17402C] shrink-0 active:scale-95 shadow-2xs"
          title="Partager un GPX, un équipement ou une randonnée"
        >
          <Ellipsis className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={!content.trim() || disabled}
          aria-label="Envoyer le message"
          className={`w-11 h-11 shrink-0 ${
            content.trim() && !disabled
              ? 'glass-circle-btn primary shadow-md active:scale-95 cursor-pointer'
              : 'glass-circle-btn opacity-55 cursor-not-allowed text-[#5A574E]'
          }`}
          title="Envoyer le message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <ComposerMenuSheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentUserId={currentUserId}
        onSendGpx={(file) => {
          haptic('medium');
          onSendGpx?.(file);
        }}
        onSendProduct={(meta) => {
          haptic('medium');
          onSendProduct?.(meta);
        }}
        onSendTrail={(meta) => {
          haptic('medium');
          onSendTrail?.(meta);
        }}
      />
    </div>
  );
};