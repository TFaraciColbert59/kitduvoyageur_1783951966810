'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useRef, useEffect } from 'react';
import { Button, IconButton } from '@/components/ui';
import type {
  Message,
  ProductMessageMeta,
  TrailMessageMeta,
  KitMessageMeta,
} from '../types/messaging.types';
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
  onSendKit?: (meta: KitMessageMeta) => void;
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
  onSendKit,
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

  // Auto-resize — aligné sur le min-height 44px du champ, max 132px.
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
    <div className="flex shrink-0 flex-col border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] pb-[max(calc(var(--safe-bottom)-var(--kb-inset,0px)),8px)] shadow-elevation-3 backdrop-blur-[var(--glass-blur-sm)]">
      {replyToMessage && (
        <div className="animate-fade-in flex items-center justify-between border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-4)] py-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)] overflow-hidden">
            <div className="h-8 w-1 shrink-0 rounded-full bg-[color:var(--lkv-primary)]" />
            <Icon name="reply" className="size-4 shrink-0 text-[color:var(--lkv-text-primary)]" aria-hidden="true" />
            <div className="overflow-hidden text-[length:var(--lkv-text-caption)]">
              <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">
                Réponse à {replyToMessage.sender_profile?.full_name || 'un voyageur'}
              </span>
              <span className="block truncate text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                {replyToMessage.content}
              </span>
            </div>
          </div>
          <IconButton
            type="button"
            size="sm"
            onClick={() => {
              haptic('light');
              onCancelReply?.();
            }}
            className="shrink-0 text-[color:var(--lkv-text-secondary)] hover:text-[color:var(--lkv-text-primary)]"
            title="Annuler la réponse"
            aria-label="Annuler la réponse"
          >
            <Icon name="x" className="size-3.5" aria-hidden="true" />
          </IconButton>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-[var(--space-1)] p-[var(--space-2)] sm:gap-[var(--space-2)] sm:p-[var(--space-3)]">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />

        {/* Photo — envoie une image via le flux d'upload existant */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          iconOnly
          disabled={disabled}
          onClick={() => {
            haptic('light');
            fileInputRef.current?.click();
          }}
          aria-label="Envoyer une photo"
          title="Envoyer une photo"
          className="shrink-0"
          icon={<Icon name="image-plus" className="size-5" aria-hidden="true" />}
        />

        <div className="relative flex min-w-0 flex-1 items-center">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            enterKeyHint="send"
            inputMode="text"
            aria-label="Votre message"
            placeholder={
              replyToMessage
                ? `Répondre à ${replyToMessage.sender_profile?.full_name || 'voyageur'}...`
                : 'Votre message...'
            }
            className="custom-scrollbar max-h-[132px] min-h-[44px] w-full resize-none rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] py-[var(--space-2)] pl-[var(--space-4)] pr-[var(--space-3)] text-[16px] font-medium leading-relaxed text-[color:var(--lkv-text-primary)] transition-all placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)] md:text-[length:var(--lkv-text-footnote)]"
          />
        </div>

        {onSendVoiceNote && (
          <IconButton
            type="button"
            variant="glass"
            disabled={disabled}
            onClick={() => {
              haptic('medium');
              setIsRecordingVoice(true);
            }}
            aria-label="Enregistrer une note vocale terrain"
            title="Enregistrer une note vocale terrain"
            className="shrink-0 text-[color:var(--lkv-text-primary)] hover:text-[color:var(--lkv-danger)]"
          >
            <Icon name="mic" className="size-5" aria-hidden="true" />
          </IconButton>
        )}

        {/* Menu ••• — GPX, équipement, randonnée */}
        <IconButton
          type="button"
          variant="glass"
          disabled={disabled}
          onClick={() => {
            haptic('medium');
            setIsMenuOpen(true);
          }}
          aria-label="Partager un GPX, un équipement ou une randonnée"
          title="Partager un GPX, un équipement ou une randonnée"
          className="shrink-0"
        >
          <Icon name="ellipsis" className="size-5" aria-hidden="true" />
        </IconButton>

        <IconButton
          type="submit"
          variant={content.trim() && !disabled ? 'solid' : 'ghost'}
          disabled={!content.trim() || disabled}
          aria-label="Envoyer le message"
          title="Envoyer le message"
          className="shrink-0 shadow-elevation-2"
        >
          <Icon name="send" className="size-4" aria-hidden="true" />
        </IconButton>
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
        onSendKit={(meta) => {
          haptic('medium');
          onSendKit?.(meta);
        }}
      />
    </div>
  );
};
