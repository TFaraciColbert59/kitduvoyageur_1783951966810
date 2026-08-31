"use client";

import React, { useState, useRef } from 'react';
import { Paperclip, Send, X, Reply, Mic } from 'lucide-react';
import type { Message } from '../types/messaging.types';
import { VoiceRecorderBar } from './VoiceRecorderBar';

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
  const [content, setContent] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;
    onSendMessage(content.trim());
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendAttachment) {
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
    <div className="bg-white/70 backdrop-blur-xl border-t border-stone-200/50 flex flex-col">
      {replyToMessage && (
        <div className="px-4 py-2 bg-stone-100/90 border-b border-stone-200/50 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-1 h-8 bg-emerald-600 rounded-full shrink-0" />
            <Reply className="w-4 h-4 text-emerald-700 shrink-0" />
            <div className="text-xs overflow-hidden">
              <span className="font-bold text-stone-900 block truncate">
                Réponse à {replyToMessage.sender_profile?.full_name || 'un voyageur'}
              </span>
              <span className="text-stone-500 truncate block text-[11px]">
                {replyToMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors shrink-0"
            title="Annuler la réponse"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.gpx,application/gpx+xml"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2.5 rounded-full text-stone-500 hover:text-emerald-700 hover:bg-stone-100 transition-colors shrink-0"
          title="Joindre un fichier, une photo ou un GPX"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {onSendVoiceNote && (
          <button
            type="button"
            onClick={() => setIsRecordingVoice(true)}
            disabled={disabled}
            className="p-2.5 rounded-full text-stone-500 hover:text-rose-600 hover:bg-stone-100 transition-colors shrink-0"
            title="Enregistrer une note vocale terrain"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative">
          <input
            type="text"
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              replyToMessage
                ? `Répondre à ${replyToMessage.sender_profile?.full_name || 'voyageur'}...`
                : 'Votre message...'
            }
            className="w-full pl-4 pr-10 py-2.5 text-[16px] md:text-sm rounded-2xl bg-stone-100/90 border border-stone-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-stone-900 placeholder-stone-400 font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={!content.trim() || disabled}
          className={`p-2.5 rounded-full transition-all shrink-0 flex items-center justify-center ${
            content.trim() && !disabled
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
