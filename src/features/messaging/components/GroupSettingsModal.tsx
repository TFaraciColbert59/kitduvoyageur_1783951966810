'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { lkvConfirm } from '@/components/ui/dialogs';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import type { Conversation, ConversationMember } from '../types/messaging.types';
import { messagingService } from '../services/messagingService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUserId: string;
  onRefreshConversations?: () => void;
  onLeaveSuccess?: () => void;
}

/** Défilement interne de la liste des membres : `.sh-b` ne défile pas. */
const SCROLL = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} as const;

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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const avatarUrl = conversation.avatar_url || '';
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

  return (
    <AccountDrawerHost
      open={isOpen}
      title="Gestion du groupe"
      subtitle={conversation.title || undefined}
      onClose={onClose}
      onBack={isEditingTitle && isAdmin ? () => setIsEditingTitle(false) : undefined}
    >
      {errorMessage ? (
        <div className="s2" role="alert" style={{ color: 'var(--bad)', padding: '6px 2px' }}>
          {errorMessage}
        </div>
      ) : null}

      <div className="li">
        <span className="avi" style={{ overflow: 'hidden' }}>
          <Image
            src={avatarUrl || conversation.avatar_url || '/assets/images/no_image.png'}
            alt={title}
            fill
            sizes="30px"
            style={{ objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
            }}
          />
        </span>
        <div>
          {isEditingTitle && isAdmin ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Nom du groupe"
              className="mfield"
              style={{ borderRadius: 12, minHeight: 36 }}
            />
          ) : (
            <div className="ttl">
              <span>{title}</span>
            </div>
          )}
          <div className="s2">
            {loading ? 'Chargement des membres…' : `${members.length} membres`}
          </div>
        </div>
        {isEditingTitle && isAdmin ? (
          <button
            type="button"
            className="mbtn p"
            disabled={loading}
            onClick={handleSaveGroupInfo}
            aria-label="Enregistrer le nom"
          >
            Enregistrer
          </button>
        ) : isAdmin ? (
          <button
            type="button"
            className="mbtn"
            onClick={() => setIsEditingTitle(true)}
            aria-label="Modifier le nom"
            title="Modifier le nom"
          >
            Modifier
          </button>
        ) : null}
      </div>

      <div className="li nt">
        <div>
          <div className="ttl">Fiche Cockpit</div>
          <div className="s2">Matériel partagé de l’expédition</div>
        </div>
        <Link className="mbtn" href={expeditionUrl} onClick={onClose}>
          Ouvrir
        </Link>
      </div>

      <div className="s2" style={{ padding: '8px 2px 2px' }}>
        {`Membres · ${members.length}`}
      </div>

      <div style={SCROLL}>
        {loading ? (
          <div className="s2" style={{ padding: '8px 2px' }}>
            Chargement des membres…
          </div>
        ) : members.length === 0 ? (
          <div className="s2" style={{ padding: '8px 2px' }}>
            Aucun membre à afficher.
          </div>
        ) : (
          members.map((mem) => {
            const isMe = mem.user_id === currentUserId;
            const name = mem.profile?.full_name || (isMe ? 'Vous' : 'Voyageur LKDV');
            const avatar = mem.profile?.avatar_url || '/assets/images/no_image.png';

            return (
              <div className="li" key={mem.id}>
                <Link
                  href={`/profil/${mem.user_id}`}
                  className="avi"
                  style={{ overflow: 'hidden' }}
                  title={`Voir le profil de ${name}`}
                  aria-label={`Voir le profil de ${name}`}
                >
                  <Image
                    src={avatar}
                    alt={name}
                    fill
                    sizes="30px"
                    style={{ objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                    }}
                  />
                </Link>

                <div>
                  <div className="ttl">
                    <Link
                      href={`/profil/${mem.user_id}`}
                      title={`Voir le profil de ${name}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      <span>{name}</span>
                    </Link>
                    {isMe ? <span>(Vous)</span> : null}
                  </div>
                  <div className="tags">
                    <span className={mem.role === 'owner' ? 'tg p' : 'tg'}>
                      {mem.role === 'owner'
                        ? 'Organisateur'
                        : mem.role === 'admin'
                          ? 'Admin'
                          : 'Membre'}
                    </span>
                  </div>
                </div>

                {isAdmin && !isMe ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isOwner ? (
                      <button
                        type="button"
                        className="mbtn"
                        onClick={() =>
                          handleRoleChange(mem.user_id, mem.role === 'admin' ? 'member' : 'admin')
                        }
                        title={
                          mem.role === 'admin' ? 'Rétrograder en membre' : 'Promouvoir en Admin'
                        }
                      >
                        {mem.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="lg gbtn"
                      style={{ width: 38, height: 38, color: 'var(--bad)' }}
                      onClick={() => handleRemoveMember(mem.user_id, name)}
                      title="Retirer du groupe"
                      aria-label="Retirer du groupe"
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="9" cy="8" r="3.5" />
                        <path d="M3 20a6 6 0 0 1 12 0" />
                        <path d="M17 12h5" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="li nt">
        <div>
          <div className="ttl">Quitter le groupe</div>
          <div className="s2">Vous ne recevrez plus les messages de l’expédition.</div>
        </div>
        <button
          type="button"
          className="mbtn"
          style={{ color: 'var(--bad)' }}
          disabled={loading}
          onClick={handleLeaveGroup}
        >
          Quitter
        </button>
      </div>
    </AccountDrawerHost>
  );
};
