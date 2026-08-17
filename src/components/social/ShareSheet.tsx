'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import LkvIcon from '@/components/ui/LkvIcon';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
          className="relative z-10 w-full max-w-lg bg-[#14281E]/80 backdrop-blur-2xl text-white rounded-t-3xl p-5 pb-8 shadow-2xl border-t border-white/20 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-white/30 rounded-full mx-auto shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
            <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
              <span>↗️</span>
              <span>Transférer / Partager</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-white/10 hover:bg-white/15 active:scale-[0.98] border border-white/15 rounded-2xl text-xs font-bold text-white transition-all shadow-sm"
            >
              <LkvIcon name="bookmark" size={16} color="#A8C4A2" />
              <span>{copied ? '✓ Lien copié !' : 'Copier le lien'}</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-[#A8C4A2] hover:bg-[#96b88f] active:scale-[0.98] text-[#17402C] rounded-2xl text-xs font-bold transition-all shadow-md"
            >
              <Icon name="PaperAirplaneIcon" size={16} />
              <span>Partage externe</span>
            </button>
          </div>

          {/* Send to Travel Groups */}
          <div className="pt-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#A8C4A2] mb-2">
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
                            : 'bg-white/10 hover:bg-[#A8C4A2] hover:text-[#17402C] text-white'
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
