'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';

export interface PostReplyComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  ariaLabel: string;
  inputLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Composer unique des commentaires de post et des réponses de story. */
export function PostReplyComposer({
  value,
  onChange,
  onSend,
  placeholder,
  ariaLabel,
  inputLabel,
  busy = false,
  disabled = false,
  autoFocus = false,
}: PostReplyComposerProps) {
  return (
    <div className="lkdv-comments-composer">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (value.trim() && !busy && !disabled) onSend();
          }
        }}
        placeholder={placeholder}
        aria-label={inputLabel || placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />
      <button
        type="button"
        className="lkdv-comments-send"
        aria-label={ariaLabel}
        disabled={disabled || busy || !value.trim()}
        onClick={onSend}
      >
        <Icon name="send" size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export default PostReplyComposer;
