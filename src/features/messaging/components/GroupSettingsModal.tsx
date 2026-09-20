'use client';
import Icon from '@/components/ui/Icon';
import { lkvConfirm } from '@/components/ui/dialogs';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, Button, Card, IconButton, Skeleton } from '@/components/ui';
import type { Conversation, ConversationMember } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { MobileSheet } from './MobileSheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
  const [title, setTitle] = useState(conversation.title || "Groupe d'expédition");
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
    if (!(await lkvConfirm(`Voulez-vous vraiment retirer ${targetName} du groupe ?`))) return;

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
    if (!(await lkvConfirm("Voulez-vous vraiment quitter ce groupe d'expédition ?"))) return;

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
  const expeditionUrl =
    conversation.id === 'demo-conv-2' ? '/hub/depart?id=demo-expedition' : '/hub/depart';

  // Bottom sheet Liquid Glass (MobileSheet) : pattern canonique des modales
  // messagerie mobile (drag-to-dismiss, scrim), au lieu d'une
  // modale centrée hors système.
  return (
    <MobileSheet isOpen={isOpen} onClose={onClose} title="Gestion du groupe">
      {errorMessage && (
        <div className="mb-[var(--space-3)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)]/25 bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-danger-dark)]">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-[var(--space-4)]">
        {/* Group Header Info Edit */}
        <Card variant="compact" className="flex flex-col gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)] ring-2 ring-[color:var(--lkv-primary)]/20">
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
                <div className="flex items-center gap-[var(--space-1)]">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label="Nom du groupe"
                    className="w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-primary)]/50 bg-[color:var(--lkv-field-bg)] px-[var(--space-2)] py-1.5 text-[16px] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-1 md:text-[length:var(--lkv-text-caption)]"
                  />
                  <IconButton
                    variant="solid"
                    size="sm"
                    onClick={handleSaveGroupInfo}
                    aria-label="Enregistrer le nom"
                    className="shrink-0"
                  >
                    <Icon name="check" className="size-3.5" aria-hidden="true" />
                  </IconButton>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-[var(--space-1)]">
                  <h4 className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                    {title}
                  </h4>
                  {isAdmin && (
                    <IconButton
                      size="sm"
                      onClick={() => setIsEditingTitle(true)}
                      className="shrink-0 text-[color:var(--lkv-text-secondary)] hover:text-[color:var(--lkv-text-primary)]"
                      title="Modifier le nom"
                      aria-label="Modifier le nom"
                    >
                      <Icon name="edit2" className="size-3.5" aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
              )}
              <p className="text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-secondary)]">
                {members.length} membres inscrits
              </p>
            </div>
          </div>

          {/* Pinned Expedition Link Card */}
          <Link
            href={expeditionUrl}
            onClick={onClose}
            className="group flex items-center justify-between rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-secondary)]/30 bg-[color:var(--lkv-secondary)]/10 p-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-1 transition-colors hover:bg-[color:var(--lkv-secondary)]/20"
          >
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="text-base">🎒</span>
              <span>Fiche Cockpit / Matériel Partagé</span>
            </div>
            <Icon
              name="external-link"
              className="size-3.5 text-[color:var(--lkv-text-primary)] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </Card>

        {/* Members List */}
        <div>
          <h4 className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
            Membres de l&apos;Expédition ({members.length})
          </h4>

          {loading ? (
            <div className="space-y-[var(--space-2)]">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-[var(--lkv-radius-md)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-[var(--space-2)]">
              {members.map((mem) => {
                const isMe = mem.user_id === currentUserId;
                const name = mem.profile?.full_name || (isMe ? 'Vous' : 'Voyageur LKDV');
                const avatar = mem.profile?.avatar_url || '/assets/images/no_image.png';

                return (
                  <Card
                    key={mem.id}
                    variant="compact"
                    className="flex items-center justify-between gap-[var(--space-2)]"
                  >
                    <div className="flex items-center gap-[var(--space-2)] overflow-hidden">
                      <Link
                        href={`/profil/${mem.user_id}`}
                        className="relative size-8 shrink-0 overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)] ring-1 ring-[color:var(--glass-border)] transition-shadow hover:ring-2 hover:ring-[color:var(--lkv-secondary)]"
                        title={`Voir le profil de ${name}`}
                        aria-label={`Voir le profil de ${name}`}
                      >
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
                      </Link>

                      <div className="overflow-hidden">
                        <Link
                          href={`/profil/${mem.user_id}`}
                          className="flex items-center gap-[var(--space-1)] truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] underline-offset-2 hover:underline"
                          title={`Voir le profil de ${name}`}
                        >
                          <span>{name}</span>
                          {isMe && (
                            <span className="text-[length:var(--lkv-text-caption-2)] font-normal text-[color:var(--lkv-text-secondary)]">(Vous)</span>
                          )}
                        </Link>
                        <Badge
                          tone={mem.role === 'owner' ? 'warn' : mem.role === 'admin' ? 'sage' : 'stone'}
                          className="mt-0.5"
                        >
                          {mem.role === 'owner' ? (
                            <>
                              <Icon name="crown" className="size-2.5 text-[color:var(--lkv-warning)]" aria-hidden="true" /> Organisateur
                            </>
                          ) : mem.role === 'admin' ? (
                            <>
                              <Icon name="shield" className="size-2.5 text-[color:var(--lkv-secondary)]" aria-hidden="true" /> Admin
                            </>
                          ) : (
                            <>
                              <Icon name="user" className="size-2.5 text-[color:var(--lkv-text-secondary)]" aria-hidden="true" /> Membre
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>

                    {/* Admin Controls */}
                    {isAdmin && !isMe && (
                      <div className="flex shrink-0 items-center gap-[var(--space-1)]">
                        {isOwner && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRoleChange(
                                mem.user_id,
                                mem.role === 'admin' ? 'member' : 'admin'
                              )
                            }
                            title={
                              mem.role === 'admin' ? 'Rétrograder en membre' : 'Promouvoir en Admin'
                            }
                          >
                            {mem.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                          </Button>
                        )}
                        <IconButton
                          type="button"
                          size="sm"
                          onClick={() => handleRemoveMember(mem.user_id, name)}
                          className="text-[color:var(--lkv-danger)] hover:bg-[color:var(--lkv-danger-bg)]"
                          title="Retirer du groupe"
                          aria-label="Retirer du groupe"
                        >
                          <Icon name="user-minus" className="size-3.5" aria-hidden="true" />
                        </IconButton>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Leave Group */}
      <div className="mt-[var(--space-3)] shrink-0 border-t border-[color:var(--lkv-border)] pt-[var(--space-3)]">
        <Button
          type="button"
          variant="destructive"
          fullWidth
          disabled={loading}
          onClick={handleLeaveGroup}
          icon={<Icon name="log-out" className="size-4" aria-hidden="true" />}
        >
          Quitter le groupe d&apos;expédition
        </Button>
      </div>
    </MobileSheet>
  );
};
