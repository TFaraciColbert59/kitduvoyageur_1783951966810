"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Conversation, ConversationMember } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Crown, Shield, User, UserMinus, LogOut, X, Edit2, Check, ExternalLink, Users } from 'lucide-react';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: string;
  onRefreshConversations?: () => void;
  onLeaveSuccess?: () => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onRefreshConversations,
  onLeaveSuccess,
}) => {
  const { haptic } = useHapticFeedback();
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(conversation.title || 'Groupe d\'expédition');
  const [avatarUrl, setAvatarUrl] = useState(conversation.avatar_url || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const myMember = members.find((m) => m.user_id === currentUserId);
  const isOwner = myMember?.role === 'owner';
  const isAdmin = myMember?.role === 'admin' || isOwner;

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    messagingService.getGroupMembers(conversation.id).then((data) => {
      if (isMounted) {
        setMembers(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, conversation.id]);

  if (!isOpen) return null;

  const handleSaveGroupInfo = async () => {
    haptic('light');
    setLoading(true);
    setErrorMessage(null);

    const ok = await messagingService.updateGroupInfo(conversation.id, {
      title,
      avatar_url: avatarUrl || undefined,
    });

    setLoading(false);
    if (ok) {
      setIsEditingTitle(false);
      if (onRefreshConversations) onRefreshConversations();
    } else {
      setErrorMessage('Erreur lors de la mise à jour du groupe.');
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: 'member' | 'admin' | 'owner') => {
    haptic('light');
    setErrorMessage(null);

    const res = await messagingService.updateMemberRole(conversation.id, targetUserId, newRole);

    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole } : m))
      );
      if (onRefreshConversations) onRefreshConversations();
    } else {
      setErrorMessage(res.error || 'Privilèges insuffisants pour cette modification.');
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!confirm(`Voulez-vous vraiment retirer ${targetName} du groupe ?`)) return;

    haptic('medium');
    setErrorMessage(null);

    const res = await messagingService.removeGroupMember(conversation.id, targetUserId);

    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
      if (onRefreshConversations) onRefreshConversations();
    } else {
      setErrorMessage(res.error || 'Erreur lors du retrait du membre.');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Voulez-vous vraiment quitter ce groupe d\'expédition ?')) return;

    haptic('medium');
    setErrorMessage(null);

    const res = await messagingService.leaveGroup(conversation.id, currentUserId);

    if (res.success) {
      onClose();
      if (onRefreshConversations) onRefreshConversations();
      if (onLeaveSuccess) onLeaveSuccess();
    } else {
      setErrorMessage(res.error || 'Erreur lors du départ du groupe.');
    }
  };

  // Linked Expedition Departure Cockpit URL for expedition groups
  const expeditionUrl = conversation.id === 'demo-conv-2' ? '/materiel/depart/demo-expedition' : '/materiel/depart';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="glass rounded-3xl max-w-md w-full p-5 text-[#14140F] relative overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/60 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#17402C]" />
            <h3 className="font-bold text-base text-[#17402C]">Gestion du Groupe</h3>
          </div>
          <button
            onClick={onClose}
            className="glass-circle-btn w-9 h-9 text-[#5A574E] hover:text-[#17402C] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 bg-rose-50/90 border border-rose-200 text-[#A8443A] rounded-2xl text-xs font-semibold shrink-0">
            {errorMessage}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* Group Header Info Edit */}
          <div className="p-3.5 bg-white/70 rounded-2xl border border-stone-200/60 flex flex-col gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden relative ring-2 ring-[#17402C]/20 bg-stone-200 shrink-0">
                <Image
                  src={avatarUrl || conversation.avatar_url || '/assets/images/no_image.png'}
                  alt={title}
                  fill
                  className="object-cover"
                  sizes="48px"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                  }}
                />
              </div>

              <div className="flex-1 overflow-hidden">
                {isEditingTitle && isAdmin ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-[16px] md:text-xs rounded-xl border border-[#17402C]/50 bg-white font-bold text-[#17402C] shadow-inner-xs"
                    />
                    <button
                      onClick={handleSaveGroupInfo}
                      className="glass-circle-btn primary w-8 h-8 shrink-0 flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-sm text-[#17402C] truncate">{title}</h4>
                    {isAdmin && (
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="glass-circle-btn w-8 h-8 text-[#5A574E] hover:text-[#17402C] shrink-0"
                        title="Modifier le nom"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-[#5A574E] font-medium">{members.length} membres inscrits</p>
              </div>
            </div>

            {/* Pinned Expedition Link Card */}
            <Link
              href={expeditionUrl}
              onClick={onClose}
              className="flex items-center justify-between p-2.5 bg-[#5B7F55]/10 hover:bg-[#5B7F55]/20 border border-[#5B7F55]/30 rounded-2xl text-xs text-[#17402C] font-bold transition-all group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎒</span>
                <span>Fiche Cockpit / Matériel Partagé</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#17402C] group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Members List */}
          <div>
            <h4 className="text-xs font-bold text-[#5A574E] uppercase tracking-wider mb-2">
              Membres de l&apos;Expédition ({members.length})
            </h4>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-stone-100/80 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((mem) => {
                  const isMe = mem.user_id === currentUserId;
                  const name = mem.profile?.full_name || (isMe ? 'Vous' : 'Voyageur LKDV');
                  const avatar = mem.profile?.avatar_url || '/assets/images/no_image.png';

                  return (
                    <div
                      key={mem.id}
                      className="p-2.5 bg-white/70 hover:bg-white/90 border border-stone-200/60 rounded-2xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-full overflow-hidden relative shrink-0 bg-stone-200 ring-1 ring-white">
                          <Image
                            src={avatar}
                            alt={name}
                            fill
                            className="object-cover"
                            sizes="32px"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                            }}
                          />
                        </div>

                        <div className="overflow-hidden">
                          <p className="font-bold text-xs text-[#17402C] truncate flex items-center gap-1">
                            <span>{name}</span>
                            {isMe && <span className="text-[10px] text-[#5A574E] font-normal">(Vous)</span>}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              mem.role === 'owner'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : mem.role === 'admin'
                                ? 'bg-[#5B7F55]/15 text-[#17402C] border border-[#5B7F55]/40'
                                : 'bg-stone-100 text-[#5A574E]'
                            }`}
                          >
                            {mem.role === 'owner' ? (
                              <>
                                <Crown className="w-2.5 h-2.5 text-amber-600" /> Organisateur
                              </>
                            ) : mem.role === 'admin' ? (
                              <>
                                <Shield className="w-2.5 h-2.5 text-[#5B7F55]" /> Admin
                              </>
                            ) : (
                              <>
                                <User className="w-2.5 h-2.5 text-[#5A574E]" /> Membre
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Admin Controls */}
                      {isAdmin && !isMe && (
                        <div className="flex items-center gap-1 shrink-0">
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRoleChange(
                                  mem.user_id,
                                  mem.role === 'admin' ? 'member' : 'admin'
                                )
                              }
                              className="glass-capsule-btn xs text-[#17402C]"
                              title={mem.role === 'admin' ? 'Rétrograder en membre' : 'Promouvoir en Admin'}
                            >
                              {mem.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(mem.user_id, name)}
                            className="glass-circle-btn w-8 h-8 text-[#A8443A] hover:bg-rose-50"
                            title="Retirer du groupe"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Leave Group */}
        <div className="pt-3 border-t border-stone-200/60 mt-2 shrink-0">
          <button
            onClick={handleLeaveGroup}
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 px-4 bg-rose-50/80 hover:bg-rose-100/90 text-[#A8443A] border border-rose-200/80 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <LogOut className="w-4 h-4 text-[#A8443A]" />
            Quitter le groupe d&apos;expédition
          </button>
        </div>
      </div>
    </div>
  );
};
