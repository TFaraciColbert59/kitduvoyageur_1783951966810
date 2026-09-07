'use client';

import React, { useState, useTransition } from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, Mail, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { EmptyState } from '@/components/ui/EmptyState';
import { TripBadge } from './TripBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { inviteCollaboratorAction, updateRoleAction, removeCollaboratorAction } from '@/app/voyages/collab-actions';
import type { TripFull } from '../types/trip.types';

interface TripTeamViewProps {
  trip: TripFull;
}

export function TripTeamView({ trip }: TripTeamViewProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ collaboratorId: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { triggerHaptic } = useHapticFeedback();

  const isOwner = trip.permissions.canInvite; // Seul l'owner a canInvite

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
        setInviteError(res.error || 'Erreur lors de l\'invitation');
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
    <div className="space-y-6">
      {/* En-tête de section */}
      {actionError && (
        <div className="p-3 rounded-xl glass tone-danger text-xs text-[var(--lkv-danger)] flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-lkv-primary flex items-center gap-2">
            <Users size={22} className="text-lkv-secondary" />
            <span>Équipe & Compagnons de Route</span>
          </h3>
          <p className="text-xs text-lkv-secondary mt-1">
            Gérez les participants, attribuez les rôles (organisateur, éditeur, lecteur) et coordonnez votre expédition.
          </p>
        </div>

        {isOwner && (
          <GlassCapsuleBtn
            variant="primary"
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            icon={<UserPlus size={16} />}
          >
            Inviter un voyageur
          </GlassCapsuleBtn>
        )}
      </div>

      {/* Explication des rôles */}
      <GlassCard tone="neutral" className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 text-xs text-[var(--lkv-text-muted)]">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-lkv-secondary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-lkv-primary">Droits &amp; Rôles sur l&apos;expédition</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div>
                <strong className="text-lkv-primary">Organisateur (Owner) :</strong> Contrôle total, invitation/retrait, suppression, budget.
              </div>
              <div>
                <strong className="text-lkv-primary">Éditeur :</strong> Modification de l&apos;itinéraire, matériel, saisie des dépenses et documents.
              </div>
              <div>
                <strong className="text-lkv-primary">Lecteur :</strong> Consultation de l&apos;itinéraire et du kit en lecture seule.
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Liste des membres */}
      {trip.collaborators.length === 0 ? (
        <EmptyState
          icon={<Users size={32} className="text-lkv-secondary" />}
          title="Aucun compagnon de route"
          description="Vous préparez actuellement cette expédition en solo. Invitez des coéquipiers pour partager l'itinéraire, le matériel et les dépenses."
          actionLabel={isOwner ? "Inviter un voyageur" : undefined}
          onAction={isOwner ? () => setIsInviteOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trip.collaborators.map(collab => {
            const isCollabOwner = collab.role === 'owner';
            const name = collab.profile?.full_name || 'Voyageur LKDV';
            const initials = name
              .split(' ')
              .map(n => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'V';

            return (
              <GlassCard
                key={collab.id}
                tone="neutral"
                className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 flex flex-col justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-lkv-primary text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-lkv-primary">{name}</div>
                      <div className="text-xs text-lkv-secondary">
                        Rejoint le {new Date(collab.joined_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>

                  <TripBadge type="role" value={collab.role} size="sm" />
                </div>

                {/* Contrôles de rôle & retrait pour l'Owner */}
                {isOwner && !isCollabOwner && (
                  <div className="flex items-center justify-between pt-3 border-t border-black/5 gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-lkv-secondary">
                      <span>Rôle :</span>
                      <select
                        value={collab.role}
                        disabled={isPending}
                        onChange={e => handleRoleChange(collab.id, e.target.value as any)}
                        className="glass-input text-xs font-semibold px-2 py-1 text-[var(--lkv-text-primary)]"
                      >
                        <option value="editor">Éditeur</option>
                        <option value="viewer">Lecteur</option>
                      </select>
                    </div>

                    <button
                      onClick={() => requestRemove(collab.id, name)}
                      disabled={isPending}
                      title="Retirer de l'expédition"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 hover:text-[var(--lkv-danger)] transition-all shadow-2xs"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Modal d'invitation */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <GlassCard
            tone="neutral"
            className="w-full max-w-md p-6 rounded-[var(--lkv-radius-xl)] border border-white/80 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/40">
              <h4 className="text-base font-bold text-lkv-primary flex items-center gap-2">
                <UserPlus size={18} className="text-lkv-secondary" />
                <span>Inviter un compagnon</span>
              </h4>
              <button
                onClick={() => setIsInviteOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <X size={18} />
              </button>
            </div>

            {inviteError && (
              <div className="p-3 rounded-xl glass tone-danger text-xs text-[var(--lkv-danger)] flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteSuccess && (
              <div className="p-3 rounded-xl glass tone-sage text-xs text-[var(--lkv-success)] flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Email ou Pseudo LKDV du voyageur
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-[var(--lkv-text-muted)]" />
                  <input
                    type="text"
                    name="identifier"
                    required
                    placeholder="ex: marie.curie@example.com ou montagnard74"
                    className="glass-input w-full pl-9 pr-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Rôle attribué
                </label>
                <select
                  name="role"
                  defaultValue="editor"
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)] cursor-pointer"
                >
                  <option value="editor">Éditeur (peut modifier l&apos;itinéraire et les listes)</option>
                  <option value="viewer">Lecteur (consultation seule)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <GlassCapsuleBtn
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setIsInviteOpen(false)}
                >
                  Annuler
                </GlassCapsuleBtn>
                <GlassCapsuleBtn
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
                </GlassCapsuleBtn>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Modale de confirmation de retrait */}
      <ConfirmDialog
        open={confirmState !== null}
        title="Retirer ce membre ?"
        message={confirmState ? `${confirmState.name} sera retiré(e) de cette expédition.` : undefined}
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
