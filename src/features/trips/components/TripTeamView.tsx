'use client';

import Icon from '@/components/ui/Icon';
import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, EmptyState, IconButton } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui';
import { TripBadge } from './TripBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { MemberProfileBadges } from './MemberProfileBadges';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  inviteCollaboratorAction,
  updateRoleAction,
  removeCollaboratorAction,
} from '@/app/voyages/collab-actions';
import type { TripFull } from '../types/trip.types';

interface TripTeamViewProps {
  trip: TripFull;
}

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

export function TripTeamView({ trip }: TripTeamViewProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ collaboratorId: string; name: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const { triggerHaptic } = useHapticFeedback();

  const isOwner = trip.permissions.canInvite; // Seul l'owner a canInvite

  // Task 19 — provenance des données de préparation par membre.
  const memberProfileByUser = useMemo(
    () => new Map((trip.member_profiles ?? []).map((profile) => [profile.user_id, profile])),
    [trip.member_profiles]
  );

  const handleRoleChange = (collaboratorId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    triggerHaptic('selection');
    setActionError(null);
    startTransition(async () => {
      const res = await updateRoleAction(trip.id, collaboratorId, newRole, trip.slug);
      if (!res.success) {
        setActionError(res.error || 'Impossible de modifier le rôle');
      }
    });
  };

  const requestRemove = (collaboratorId: string, name: string) => {
    setActionError(null);
    setConfirmState({ collaboratorId, name });
  };

  const confirmRemove = () => {
    if (!confirmState) return;
    const { collaboratorId } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    startTransition(async () => {
      const res = await removeCollaboratorAction(trip.id, collaboratorId, trip.slug);
      if (!res.success) {
        setActionError(res.error || 'Impossible de retirer ce membre');
      }
    });
  };

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);

    startTransition(async () => {
      const res = await inviteCollaboratorAction(null, formData);
      if (!res.success) {
        setInviteError(res.error || "Erreur lors de l'invitation");
      } else {
        triggerHaptic('success');
        setInviteSuccess('Invitation envoyée ! Le voyageur a été ajouté.');
        setTimeout(() => {
          setIsInviteOpen(false);
          setInviteSuccess(null);
        }, 1500);
      }
    });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      {/* En-tête de section */}
      {actionError && (
        <Card
          role="alert"
          tone="danger"
          className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
        >
          <Icon name="alert-circle" size={16} className="shrink-0" />
          <span>{actionError}</span>
        </Card>
      )}
      <div className="flex items-center justify-end">
        {isOwner && (
          <Button
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            icon={<Icon name="user-plus" size={16} />}
          >
            Inviter un voyageur
          </Button>
        )}
      </div>

      {/* Liste des membres */}
      {trip.collaborators.length === 0 ? (
        <EmptyState
          icon={<Icon name="users" size={32} className="text-[color:var(--lkv-secondary)]" />}
          title="Aucun compagnon de route"
          description="Vous préparez actuellement cette expédition en solo. Invitez des coéquipiers pour partager l'itinéraire, le matériel et les dépenses."
          actionLabel={isOwner ? 'Inviter un voyageur' : undefined}
          onAction={isOwner ? () => setIsInviteOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
          {trip.collaborators.map((collab) => {
            const isCollabOwner = collab.role === 'owner';
            const name = collab.profile?.full_name || 'Voyageur LKDV';
            const initials =
              name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'V';

            return (
              <Card key={collab.id} className="flex flex-col justify-between gap-[var(--space-4)]">
                <div className="flex items-start justify-between gap-[var(--space-3)]">
                  <Link
                    href={`/profil/${collab.user_id}`}
                    className="-mx-1 flex min-h-[44px] items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-sm)] px-1 transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
                    title={`Voir le profil de ${name}`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] shadow-inner">
                      {initials}
                    </div>
                    <div>
                      <div className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] underline-offset-2 decoration-[color:var(--lkv-secondary)]/60 group-hover:underline">
                        {name}
                      </div>
                      <div className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                        Rejoint le {new Date(collab.joined_at).toLocaleDateString('fr-FR')}
                      </div>
                      <MemberProfileBadges
                        profile={memberProfileByUser.get(collab.user_id)}
                        maxFields={4}
                        className="mt-1.5"
                      />
                    </div>
                  </Link>

                  <TripBadge type="role" value={collab.role} size="sm" />
                </div>

                {/* Contrôles de rôle & retrait pour l'Owner */}
                {isOwner && !isCollabOwner && (
                  <div className="flex items-center justify-between gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)]">
                    <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                      <span>Rôle :</span>
                      <select
                        value={collab.role}
                        disabled={isPending}
                        onChange={(e) =>
                          handleRoleChange(
                            collab.id,
                            e.target.value as 'owner' | 'editor' | 'viewer'
                          )
                        }
                        aria-label={`Rôle de ${name}`}
                        className={`${FIELD_CLASS} min-h-0 px-2 py-1 font-semibold`}
                      >
                        <option value="editor">Éditeur</option>
                        <option value="viewer">Lecteur</option>
                      </select>
                    </div>

                    <IconButton
                      type="button"
                      size="sm"
                      onClick={() => requestRemove(collab.id, name)}
                      disabled={isPending}
                      aria-label={`Retirer ${name} de l'expédition`}
                      title="Retirer de l'expédition"
                    >
                      <Icon name="trash2" size={16} />
                    </IconButton>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal d'invitation */}
      <Sheet
        open={isInviteOpen}
        onOpenChange={(open) => {
          if (!open) setIsInviteOpen(false);
        }}
        title="Inviter un compagnon"
      >
        <div className="space-y-[var(--space-4)] pb-2">
          {inviteError && (
            <Card
              role="alert"
              tone="danger"
              className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
            >
              <Icon name="alert-circle" size={16} className="shrink-0" />
              <span>{inviteError}</span>
            </Card>
          )}

          {inviteSuccess && (
            <Card
              tone="sage"
              className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]"
            >
              <Icon name="check-circle2" size={16} className="shrink-0" />
              <span>{inviteSuccess}</span>
            </Card>
          )}

          <form onSubmit={handleInviteSubmit} className="space-y-[var(--space-4)]">
            <label className="block">
              <span className={LABEL_CLASS}>Email ou Pseudo LKDV du voyageur</span>
              <span className="relative block">
                <Icon
                  name="mail"
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--lkv-text-muted)]"
                />
                <input
                  type="text"
                  name="identifier"
                  required
                  placeholder="ex: marie.curie@example.com ou montagnard74"
                  className={`${FIELD_CLASS} pl-9`}
                />
              </span>
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Rôle attribué</span>
              <select name="role" defaultValue="editor" className={`${FIELD_CLASS} cursor-pointer`}>
                <option value="editor">
                  Éditeur (peut modifier l&apos;itinéraire et les listes)
                </option>
                <option value="viewer">Lecteur (consultation seule)</option>
              </select>
            </label>

            <div className="flex items-center justify-end gap-[var(--space-3)] pt-[var(--space-2)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsInviteOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" loading={isPending}>
                {isPending ? 'Envoi...' : "Envoyer l'invitation"}
              </Button>
            </div>
          </form>
        </div>
      </Sheet>

      {/* Modale de confirmation de retrait */}
      <ConfirmDialog
        open={confirmState !== null}
        title="Retirer ce membre ?"
        message={
          confirmState ? `${confirmState.name} sera retiré(e) de cette expédition.` : undefined
        }
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
