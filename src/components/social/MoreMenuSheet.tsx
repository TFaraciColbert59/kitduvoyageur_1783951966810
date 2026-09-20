'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, ListItem, Sheet } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onShare?: () => void;
  onCopyLink?: () => void;
  onReport?: () => void;
  onMuteOrLeave?: () => void;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  leaveLabel?: string;
}

export default function MoreMenuSheet({
  isOpen,
  onClose,
  title,
  onShare,
  onCopyLink,
  onReport,
  onMuteOrLeave,
  isOwner = false,
  onEdit,
  onDelete,
  leaveLabel = 'Masquer cette publication',
}: MoreMenuSheetProps) {
  const { triggerHaptic } = useHapticFeedback();

  const handleAction = (action?: () => void) => {
    triggerHaptic('selection');
    onClose();
    if (action) action();
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      dragToDismiss
    >
      <div className="flex flex-col gap-[var(--space-2)]">
        <Card className="divide-y divide-[color:var(--lkv-border-subtle)] overflow-hidden p-0">
          {/* Share action */}
          {onShare && (
            <ListItem
              as="div"
              onClick={() => handleAction(onShare)}
              leading={<Icon name="PaperAirplaneIcon" size={18} className="text-[color:var(--lkv-primary)]" />}
              title="Partager le contenu"
            />
          )}

          {/* Copy Link */}
          {onCopyLink && (
            <ListItem
              as="div"
              onClick={() => handleAction(onCopyLink)}
              leading={<Icon name="LinkIcon" size={18} className="text-[color:var(--lkv-primary)]" />}
              title="Copier le lien"
            />
          )}

          {/* Edit (if owner) */}
          {isOwner && onEdit && (
            <ListItem
              as="div"
              onClick={() => handleAction(onEdit)}
              leading={<Icon name="PencilIcon" size={18} className="text-[color:var(--lkv-primary)]" />}
              title="Modifier"
            />
          )}

          {/* Mute / Leave */}
          {onMuteOrLeave && (
            <ListItem
              as="div"
              onClick={() => handleAction(onMuteOrLeave)}
              leading={<Icon name="EyeSlashIcon" size={18} className="text-[color:var(--lkv-text-secondary)]" />}
              title={<span className="font-medium text-[color:var(--lkv-text-secondary)]">{leaveLabel}</span>}
            />
          )}

          {/* Delete (if owner) */}
          {isOwner && onDelete && (
            <ListItem
              as="div"
              onClick={() => handleAction(onDelete)}
              leading={<Icon name="TrashIcon" size={18} className="text-[color:var(--lkv-danger)]" />}
              title={<span className="text-[color:var(--lkv-danger)]">Supprimer définitivement</span>}
            />
          )}

          {/* Report action */}
          {!isOwner && onReport && (
            <ListItem
              as="div"
              onClick={() => handleAction(onReport)}
              leading={<Icon name="ExclamationTriangleIcon" size={18} className="text-[color:var(--lkv-danger)]" />}
              title={<span className="text-[color:var(--lkv-danger)]">Signaler ce contenu</span>}
            />
          )}
        </Card>

        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          Annuler
        </Button>
      </div>
    </Sheet>
  );
}
