'use client';

import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  title,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Valider',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onConfirm(value);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[var(--blur-sm)]"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-[var(--z-modal)] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]',
            'p-[var(--space-5)] shadow-[var(--elevation-4)] focus:outline-none'
          )}
        >
          <Dialog.Title className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            {title}
          </Dialog.Title>
          <form onSubmit={handleSubmit}>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              aria-label={title}
              autoFocus
              className={cn(
                'mt-[var(--space-3)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--btn-glass-border)]',
                'bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-[var(--space-3)] py-[var(--space-2)]',
                'text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]'
              )}
            />
            <div className="mt-[var(--space-5)] flex justify-end gap-[var(--space-2)]">
              <Button variant="ghost" onClick={onCancel}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                {confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PromptDialog;
