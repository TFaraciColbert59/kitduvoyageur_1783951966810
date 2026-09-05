'use client';

import React, { useState, useTransition } from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, Mail, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { TripBadge } from './TripBadge';
import { inviteCollaboratorAction, updateRoleAction, removeCollaboratorAction } from '@/app/voyages/collab-actions';
import type { TripFull } from '../types/trip.types';

interface TripTeamViewProps {
  trip: TripFull;
}

export function TripTeamView({ trip }: TripTeamViewProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = trip.permissions.canInvite; // Seul l'owner a canInvite

  const handleRoleChange = (collaboratorId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    startTransition(async () => {
      const res = await updateRoleAction(trip.id, collaboratorId, newRole, trip.slug);
      if (!res.success) {
        alert(res.error || 'Impossible de modifier le rôle');
      }
    });
  };

  const handleRemove = (collaboratorId: string, name: string) => {
    if (confirm(`Confirmez-vous le retrait de ${name} de cette expédition ?`)) {
      startTransition(async () => {
        const res = await removeCollaboratorAction(trip.id, collaboratorId, trip.slug);
        if (!res.success) {
          alert(res.error || 'Impossible de retirer ce membre');
        }
      });
    }
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#17402C] flex items-center gap-2">
            <Users size={22} className="text-[#5B7F55]" />
            <span>Équipe & Compagnons de Route</span>
          </h3>
          <p className="text-xs text-[#5B7F55] mt-1">
            Gérez les participants, attribuez les rôles (organisateur, éditeur, lecteur) et coordonnez votre expédition.
          </p>
        </div>

        {isOwner && (
          <LkvButton
            variant="primary"
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 min-h-[44px]"
          >
            <UserPlus size={16} />
            <span>Inviter un voyageur</span>
          </LkvButton>
        )}
      </div>

      {/* Explication des rôles */}
      <GlassCard tone="neutral" className="p-4 rounded-[20px] border border-white/60 text-xs text-gray-700">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-[#5B7F55] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-[#17402C]">Droits &amp; Rôles sur l&apos;expédition</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div>
                <strong className="text-[#17402C]">Organisateur (Owner) :</strong> Contrôle total, invitation/retrait, suppression, budget.
              </div>
              <div>
                <strong className="text-[#17402C]">Éditeur :</strong> Modification de l&apos;itinéraire, matériel, saisie des dépenses et documents.
              </div>
              <div>
                <strong className="text-[#17402C]">Lecteur :</strong> Consultation de l&apos;itinéraire et du kit en lecture seule.
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Liste des membres */}
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
              className="p-4 rounded-[20px] border border-white/60 flex flex-col justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#17402C]">{name}</div>
                    <div className="text-xs text-[#5B7F55]">
                      Rejoint le {new Date(collab.joined_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>

                <TripBadge type="role" value={collab.role} size="sm" />
              </div>

              {/* Contrôles de rôle & retrait pour l'Owner */}
              {isOwner && !isCollabOwner && (
                <div className="flex items-center justify-between pt-3 border-t border-black/5 gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#5B7F55]">
                    <span>Rôle :</span>
                    <select
                      value={collab.role}
                      disabled={isPending}
                      onChange={e => handleRoleChange(collab.id, e.target.value as any)}
                      className="text-xs font-semibold bg-white/80 border border-gray-200 rounded-lg px-2 py-1 text-[#17402C] focus:outline-none focus:ring-1 focus:ring-[#17402C]"
                    >
                      <option value="editor">Éditeur</option>
                      <option value="viewer">Lecteur</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleRemove(collab.id, name)}
                    disabled={isPending}
                    title="Retirer de l'expédition"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Modal d'invitation */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <GlassCard
            tone="neutral"
            className="w-full max-w-md p-6 rounded-[24px] bg-white border border-white/80 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h4 className="text-base font-bold text-[#17402C] flex items-center gap-2">
                <UserPlus size={18} className="text-[#5B7F55]" />
                <span>Inviter un compagnon</span>
              </h4>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {inviteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17402C] mb-1">
                  Email ou Pseudo LKDV du voyageur
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    name="identifier"
                    required
                    placeholder="ex: marie.curie@example.com ou montagnard74"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17402C] mb-1">
                  Rôle attribué
                </label>
                <select
                  name="role"
                  defaultValue="editor"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                >
                  <option value="editor">Éditeur (peut modifier l&apos;itinéraire et les listes)</option>
                  <option value="viewer">Lecteur (consultation seule)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <LkvButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsInviteOpen(false)}
                >
                  Annuler
                </LkvButton>
                <LkvButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                  className="min-h-[44px]"
                >
                  {isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
                </LkvButton>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
