'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
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

  if (!isOpen) return null;

  const handleAction = (action?: () => void) => {
    triggerHaptic('selection');
    onClose();
    if (action) action();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet Content */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8 shadow-2xl border-t border-[#1C2620]/10 flex flex-col gap-2"
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />

          {title && (
            <p className="text-xs font-semibold text-center text-[#5C6B5E] mb-2 truncate px-4">
              {title}
            </p>
          )}

          <div className="flex flex-col divide-y divide-gray-100 bg-[#F5F2E8]/40 rounded-2xl overflow-hidden border border-black/5">
            {/* Share action */}
            {onShare && (
              <button
                type="button"
                onClick={() => handleAction(onShare)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-xs font-bold text-[#1C2620] hover:bg-black/5 active:bg-black/10 transition-colors text-left"
              >
                <Icon name="PaperAirplaneIcon" size={18} className="text-[#17402C]" />
                <span>Partager le contenu</span>
              </button>
            )}

            {/* Copy Link */}
            {onCopyLink && (
              <button
                type="button"
                onClick={() => handleAction(onCopyLink)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-xs font-bold text-[#1C2620] hover:bg-black/5 active:bg-black/10 transition-colors text-left"
              >
                <Icon name="LinkIcon" size={18} className="text-[#17402C]" />
                <span>Copier le lien</span>
              </button>
            )}

            {/* Edit (if owner) */}
            {isOwner && onEdit && (
              <button
                type="button"
                onClick={() => handleAction(onEdit)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-xs font-bold text-[#1C2620] hover:bg-black/5 active:bg-black/10 transition-colors text-left"
              >
                <Icon name="PencilIcon" size={18} className="text-[#17402C]" />
                <span>Modifier</span>
              </button>
            )}

            {/* Mute / Leave */}
            {onMuteOrLeave && (
              <button
                type="button"
                onClick={() => handleAction(onMuteOrLeave)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-xs font-medium text-[#5C6B5E] hover:bg-black/5 active:bg-black/10 transition-colors text-left"
              >
                <Icon name="EyeSlashIcon" size={18} />
                <span>{leaveLabel}</span>
              </button>
            )}

            {/* Delete (if owner) */}
            {isOwner && onDelete && (
              <button
                type="button"
                onClick={() => handleAction(onDelete)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-xs font-bold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-left"
              >
                <Icon name="TrashIcon" size={18} className="text-red-600" />
                <span>Supprimer définitivement</span>
              </button>
            )}

            {/* Report action */}
            {!isOwner && onReport && (
              <button
                type="button"
                onClick={() => handleAction(onReport)}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-xs font-bold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-left"
              >
                <Icon name="ExclamationTriangleIcon" size={18} className="text-red-600" />
                <span>Signaler ce contenu</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 mt-1 bg-white border border-[#1C2620]/10 rounded-2xl text-xs font-bold text-[#1C2620] hover:bg-gray-50 active:scale-[0.99] transition-all text-center"
          >
            Annuler
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
