'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import LkvIcon from '@/components/ui/LkvIcon';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDragDismiss } from '@/hooks/gestures';

export interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  contentId: string;
  contentType: 'post' | 'carnet' | 'group' | 'club';
  currentUserId?: string;
}

export default function ShareSheet({
  isOpen,
  onClose,
  title,
  url,
  contentId,
  contentType,
  currentUserId,
}: ShareSheetProps) {
  const { triggerHaptic } = useHapticFeedback();
  // Fermeture au drag (mission gestes, Phase 2) — poignée + en-tête.
  const { dragProps, handleProps, y } = useDragDismiss({ onDismiss: onClose, mode: 'handle' });
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; destination?: string }>>([]);
  const [sendingToGroup, setSendingToGroup] = useState<string | null>(null);
  const [sentGroup, setSentGroup] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUserId) {
      const supabase = createClient();
      supabase
        .from('group_members')
        .select('group_id, travel_groups(id, name, destination)')
        .eq('user_id', currentUserId)
        .eq('status', 'active')
        .then(({ data }) => {
          if (data) {
            const list = data
              .map((d: any) => d.travel_groups)
              .filter(Boolean);
            setGroups(list);
          }
        });
    }
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    triggerHaptic('selection');
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    triggerHaptic('light');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Découvre ce contenu sur Le Kit du Voyageur : ${title}`,
          url,
        });
        onClose();
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleSendToGroup = async (groupId: string, groupName: string) => {
    if (!currentUserId) return;
    triggerHaptic('selection');
    setSendingToGroup(groupId);
    try {
      const supabase = createClient();
      await supabase.from('group_messages').insert({
        group_id: groupId,
        user_id: currentUserId,
        content: `🎒 Partage : ${title}\n${url}`,
      });
      setSentGroup(groupId);
      setTimeout(() => {
        setSentGroup(null);
        setSendingToGroup(null);
      }, 1800);
    } catch (err) {
      console.error('Error sending message to group:', err);
      setSendingToGroup(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Liquid Glass Sheet Content */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          style={{ y }}
          {...dragProps}
          className="relative z-10 w-full max-w-lg glass text-[#17402C] rounded-t-3xl p-5 pb-8 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
        >
          {/* Drag handle */}
          <div
            {...handleProps}
            className="w-10 h-1 bg-[#17402C]/20 rounded-full mx-auto shrink-0 cursor-grab active:cursor-grabbing touch-none"
          />

          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10 shrink-0">
            <h3 className="font-display font-bold text-base text-[#17402C] flex items-center gap-2">
              <span>↗️</span>
              <span>Transférer / Partager</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0 shrink-0"
              aria-label="Fermer"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-[#FAF8F5] active:scale-[0.98] border border-[#17402C]/15 rounded-2xl text-xs font-bold text-[#17402C] transition-all "
            >
              <LkvIcon name="bookmark" size={16} color="#17402C" />
              <span>{copied ? '✓ Lien copié !' : 'Copier le lien'}</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-[#17402C] hover:bg-[#365233] active:scale-[0.98] text-white rounded-2xl text-xs font-bold transition-all "
            >
              <Icon name="PaperAirplaneIcon" size={16} />
              <span>Partage externe</span>
            </button>
          </div>

          {/* Send to Travel Groups */}
          <div className="pt-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#A6C1A0] mb-2">
              Envoyer dans vos groupes de voyage ({groups.length})
            </p>

            {groups.length === 0 ? (
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center text-xs text-white/60">
                Vous n'avez pas encore de groupe actif pour envoyer ce message.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {groups.map(group => {
                  const isSending = sendingToGroup === group.id;
                  const isSent = sentGroup === group.id;

                  return (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold text-white truncate">{group.name}</p>
                        {group.destination && (
                          <p className="text-[10px] text-white/60 truncate font-mono">📍 {group.destination}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendToGroup(group.id, group.name)}
                        disabled={isSending || isSent}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSent
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/10 hover:bg-[#A6C1A0] hover:text-[#17402C] text-white'
                        }`}
                      >
                        {isSent ? '✓ Envoyé' : isSending ? 'Envoi...' : 'Envoyer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
