'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { Dog, HeartPulse, Plus, UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/features/trips/components/ConfirmDialog';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { HumanParticipant } from '@/features/participants/types/participant.types';
import { useParticipantsStore } from '@/features/participants/stores/useParticipantsStore';
import { GlassBreakModal } from '@/features/participants/components/GlassBreakModal';
import {
  inviteCollaboratorAction,
  removeCollaboratorAction,
  updateRoleAction,
} from '@/app/voyages/collab-actions';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { carnetRoleLabel, dogLoadView, formatJoinDate, personInitials, teamRoleLabel } from '../../../mobile/teamEngine';
import { GroupeRail } from '../groupe/GroupeRail';
import { TeamHero } from './TeamHero';
import { TeamCarnetDrawer, TeamDogsDrawer, TeamMembersDrawer } from './TeamDrawers';

export interface TeamMobileExperienceProps {
  trip: TripFull;
}

const CARNET_ROLE_TONES: Record<string, string> = {
  guide: 'bg-[var(--lkv-primary)]/12 text-[var(--lkv-primary)]',
  medic: 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]',
  member: 'bg-[var(--sage-50)] text-[var(--sage-700)]',
};

/** Expérience mobile de la section Groupe d'une sortie (équipiers + carnet + chiens). */
export function TeamMobileExperience({ trip }: TeamMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isPending, startTransition] = useTransition();
  const [membersOpen, setMembersOpen] = useState(false);
  const [carnetOpen, setCarnetOpen] = useState(false);
  const [dogsOpen, setDogsOpen] = useState(false);
  const [selectedHuman, setSelectedHuman] = useState<HumanParticipant | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<
    { kind: 'collab' | 'human' | 'dog'; id: string; name: string } | null
  >(null);

  const humans = useParticipantsStore((state) => state.humans);
  const dogs = useParticipantsStore((state) => state.dogs);
  const addHuman = useParticipantsStore((state) => state.addHuman);
  const removeHuman = useParticipantsStore((state) => state.removeHuman);
  const addDog = useParticipantsStore((state) => state.addDog);
  const removeDog = useParticipantsStore((state) => state.removeDog);
  const updateDog = useParticipantsStore((state) => state.updateDog);
  const unlockParticipant = useParticipantsStore((state) => state.unlockParticipant);
  const lockParticipant = useParticipantsStore((state) => state.lockParticipant);
  const getGroupStats = useParticipantsStore((state) => state.getGroupStats);

  const stats = getGroupStats();
  const isOwner = trip.permissions.canInvite;

  const memberRows = useMemo(
    () =>
      trip.collaborators.map((collab) => ({
        id: collab.id,
        userId: collab.user_id,
        name: collab.profile?.full_name || 'Voyageur LKDV',
        role: collab.role,
        joinedAt: collab.joined_at,
      })),
    [trip.collaborators]
  );

  const daysLeft = useMemo(() => {
    if (!trip.start_date) return null;
    const start = new Date(`${trip.start_date}T00:00:00Z`).getTime();
    if (Number.isNaN(start)) return null;
    return Math.ceil((start - Date.now()) / 86400000);
  }, [trip.start_date]);

  /* ---------------- Actions ---------------- */

  const handleInviteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);

    startTransition(async () => {
      const res = await inviteCollaboratorAction(null, formData);
      if (!res.success) {
        setInviteError(res.error || "Erreur lors de l'invitation");
      } else {
        triggerHaptic('success');
        setInviteSuccess('Invitation envoyée ! Le voyageur a été ajouté.');
        form.reset();
        setTimeout(() => setInviteSuccess(null), 2000);
      }
    });
  };

  const handleRoleChange = (collaboratorId: string, role: 'editor' | 'viewer') => {
    triggerHaptic('selection');
    setActionError(null);
    startTransition(async () => {
      const res = await updateRoleAction(trip.id, collaboratorId, role, trip.slug);
      if (!res.success) setActionError(res.error || 'Impossible de modifier le rôle');
    });
  };

  const confirmRemove = () => {
    if (!confirmState) return;
    const { kind, id } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    if (kind === 'human') {
      removeHuman(id);
      return;
    }
    if (kind === 'dog') {
      removeDog(id);
      return;
    }
    startTransition(async () => {
      const res = await removeCollaboratorAction(trip.id, id, trip.slug);
      if (!res.success) setActionError(res.error || 'Impossible de retirer ce membre');
    });
  };

  const handleAddHuman = (payload: {
    firstName: string;
    packWeightKg: number;
    bloodType: string;
    iceName: string;
    icePhone: string;
  }) => {
    addHuman({
      type: 'human',
      publicData: {
        id: `human-${Date.now()}`,
        firstName: payload.firstName,
        avatarUrl: '',
        packWeightKg: payload.packWeightKg,
        fitnessScore: 80,
        role: 'member',
      },
      privateData: {
        bloodType: payload.bloodType as HumanParticipant['privateData']['bloodType'],
        allergies: [],
        iceContact: {
          name: payload.iceName || 'À renseigner',
          phone: payload.icePhone || '—',
          relationship: '',
        },
      },
    });
  };

  const handleAddDog = (payload: { name: string; breed: string; weightKg: number }) => {
    addDog({
      type: 'dog',
      name: payload.name,
      breed: payload.breed,
      weightKg: payload.weightKg,
      isCarryingPack: false,
      packWeightKg: Math.round(payload.weightKg * 0.1 * 10) / 10,
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      {actionError && (
        <div
          className="glass tone-danger flex items-center justify-between gap-2 rounded-xl p-3 text-xs text-[var(--lkv-danger)]"
          role="alert"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-muted)]"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      <TeamHero
        title={trip.title}
        daysLeft={daysLeft}
        collaboratorNames={memberRows.map((member) => member.name)}
        humansCount={humans.length}
        dogsCount={dogs.length}
        packWeightKg={stats.totalPackWeightKg}
        waterLiters={stats.totalWaterDailyLiters}
        isOwner={isOwner}
        onInvite={() => setMembersOpen(true)}
        onOpenCarnet={() => setCarnetOpen(true)}
      />

      {/* ── RAIL ÉQUIPIERS (comptes) ── */}
      <GroupeRail
        title="Équipiers"
        subtitle={`${memberRows.length} membre${memberRows.length > 1 ? 's' : ''} du voyage`}
        actionLabel="Gérer"
        onAction={() => setMembersOpen(true)}
        ariaLabel="Équipiers du voyage"
      >
        {memberRows.length === 0 ? (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="glass-sub-card flex h-[9rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4 text-left"
            >
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Sortie en solo</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Invitez un compagnon de route.
              </span>
            </button>
          </li>
        ) : (
          memberRows.map((member) => (
            <li key={member.id} className="shrink-0 snap-start">
              <div className="glass flex h-[9rem] w-[9.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.4rem] p-3 text-center">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-xs font-bold uppercase text-white"
                  aria-hidden="true"
                >
                  {personInitials(member.name)}
                </span>
                <span className="w-full truncate text-[12px] font-bold text-[var(--lkv-text-primary)]">
                  {member.name}
                </span>
                <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--lkv-primary)]">
                  {teamRoleLabel(member.role as never) || member.role}
                </span>
                <span className="text-[9.5px] font-medium text-[var(--lkv-text-primary)]/60">
                  {formatJoinDate(member.joinedAt)}
                </span>
              </div>
            </li>
          ))
        )}
        {isOwner && memberRows.length > 0 && (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              aria-label="Inviter un voyageur"
              className="glass-sub-card flex h-[9rem] w-[9.5rem] flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-[var(--lkv-primary)]/30 p-3"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]">
                <UserPlus size={17} aria-hidden="true" />
              </span>
              <span className="text-[11px] font-bold text-[var(--lkv-text-primary)]">Inviter</span>
            </button>
          </li>
        )}
      </GroupeRail>

      {/* ── RAIL CARNET D'ÉQUIPAGE ── */}
      <GroupeRail
        title="Carnet d'équipage"
        subtitle={`${humans.length} humain${humans.length > 1 ? 's' : ''} · ${dogs.length} chien${dogs.length > 1 ? 's' : ''}`}
        actionLabel="Gérer"
        onAction={() => setCarnetOpen(true)}
        ariaLabel="Carnet d'équipage"
      >
        {humans.map((human) => (
          <li key={human.id} className="shrink-0 snap-start">
            <div className="glass flex h-[9.5rem] w-[9.5rem] flex-col rounded-[1.4rem] p-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--lkv-forest-900)] text-[11px] font-bold text-white"
                aria-hidden="true"
              >
                {personInitials(human.publicData.firstName)}
              </span>
              <p className="mt-1.5 truncate text-[12.5px] font-bold text-[var(--lkv-text-primary)]">
                {human.publicData.firstName}
              </p>
              <span
                className={`mt-0.5 w-fit rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                  CARNET_ROLE_TONES[human.publicData.role] ?? CARNET_ROLE_TONES.member
                }`}
              >
                {carnetRoleLabel(human.publicData.role)}
              </span>
              <p className="mt-1 text-[10px] font-medium text-[var(--lkv-text-primary)]/65">
                Sac {human.publicData.packWeightKg} kg · Forme {human.publicData.fitnessScore}%
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedHuman(human);
                }}
                aria-label={`Fiche médicale de ${human.publicData.firstName}`}
                className="glass-capsule-btn mt-auto inline-flex min-h-[44px] items-center justify-center gap-1 !py-2 text-[10.5px] font-bold"
              >
                <HeartPulse size={13} aria-hidden="true" />
                Fiche ICE
              </button>
            </div>
          </li>
        ))}
        <li className="shrink-0 snap-start">
          <button
            type="button"
            onClick={() => setCarnetOpen(true)}
            aria-label="Ajouter un équipier au carnet"
            className="glass-sub-card flex h-[9.5rem] w-[9.5rem] flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-[var(--lkv-primary)]/30 p-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]">
              <Plus size={17} aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold text-[var(--lkv-text-primary)]">Ajouter</span>
          </button>
        </li>
      </GroupeRail>

      {/* ── RAIL CHIENS ── */}
      <GroupeRail
        title="Compagnons canins"
        subtitle={dogs.length > 0 ? `${dogs.length} chien${dogs.length > 1 ? 's' : ''} · portage 15 %` : 'Aucun chien'}
        actionLabel="Gérer"
        onAction={() => setDogsOpen(true)}
        ariaLabel="Compagnons canins"
      >
        {dogs.length === 0 ? (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setDogsOpen(true)}
              className="glass-sub-card flex h-[9.5rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4 text-left"
            >
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucun compagnon canin</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Ajoutez un chien et son sac de bât.
              </span>
            </button>
          </li>
        ) : (
          dogs.map((dog) => {
            const load = dogLoadView(dog);
            return (
              <li key={dog.id} className="shrink-0 snap-start">
                <div className="glass flex h-[9.5rem] w-[9.5rem] flex-col rounded-[1.4rem] p-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lkv-secondary)]/15 text-[var(--lkv-text-primary)]"
                      aria-hidden="true"
                    >
                      <Dog size={15} />
                    </span>
                    <span className="min-w-0 truncate text-[12.5px] font-bold text-[var(--lkv-text-primary)]">
                      {dog.name}
                    </span>
                  </span>
                  <p className="mt-1 truncate text-[10px] font-medium text-[var(--lkv-text-primary)]/65">
                    {dog.breed} · {dog.weightKg} kg
                  </p>
                  <p
                    className={`mt-1 text-[10.5px] font-bold ${
                      load.over ? 'text-[var(--lkv-danger)]' : 'text-[var(--lkv-text-primary)]/75'
                    }`}
                  >
                    Sac · {load.label}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--lkv-forest-100)]">
                    <div
                      className={`h-full rounded-full ${
                        load.over ? 'bg-[var(--lkv-danger)]' : 'bg-[var(--lkv-primary)]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, load.pct))}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dog.isCarryingPack}
                    aria-label={`${dog.name} porte le sac`}
                    onClick={() => {
                      triggerHaptic('selection');
                      updateDog(dog.id, { isCarryingPack: !dog.isCarryingPack });
                    }}
                    className={`glass-capsule-btn mt-auto inline-flex min-h-[44px] items-center justify-center gap-1.5 !py-2 text-[10.5px] font-bold ${
                      dog.isCarryingPack ? 'primary' : ''
                    }`}
                  >
                    {dog.isCarryingPack ? 'Porte le sac ✓' : 'Sac au repos'}
                  </button>
                </div>
              </li>
            );
          })
        )}
      </GroupeRail>

      {/* ── TIROIRS ── */}
      <TeamMembersDrawer
        open={membersOpen}
        onOpenChange={setMembersOpen}
        members={memberRows}
        isOwner={isOwner}
        isPending={isPending}
        inviteError={inviteError}
        inviteSuccess={inviteSuccess}
        onInviteSubmit={handleInviteSubmit}
        onRoleChange={handleRoleChange}
        onRequestRemove={(id, name) => setConfirmState({ kind: 'collab', id, name })}
      />

      <TeamCarnetDrawer
        open={carnetOpen}
        onOpenChange={setCarnetOpen}
        humans={humans}
        onMedical={(human) => {
          setCarnetOpen(false);
          setSelectedHuman(human);
        }}
        onRemove={(id) => {
          const human = humans.find((entry) => entry.id === id);
          setConfirmState({ kind: 'human', id, name: human?.publicData.firstName ?? 'cet équipier' });
        }}
        onAddHuman={handleAddHuman}
      />

      <TeamDogsDrawer
        open={dogsOpen}
        onOpenChange={setDogsOpen}
        dogs={dogs}
        onToggleCarrying={(id, carrying) => updateDog(id, { isCarryingPack: carrying })}
        onRemove={(id) => {
          const dog = dogs.find((entry) => entry.id === id);
          setConfirmState({ kind: 'dog', id, name: dog?.name ?? 'ce chien' });
        }}
        onAddDog={handleAddDog}
      />

      {selectedHuman && (
        <GlassBreakModal
          participant={selectedHuman}
          isOpen={selectedHuman !== null}
          onClose={() => setSelectedHuman(null)}
          onUnlock={unlockParticipant}
          onLock={lockParticipant}
        />
      )}

      <ConfirmDialog
        open={confirmState !== null}
        title={
          confirmState?.kind === 'collab'
            ? 'Retirer ce membre ?'
            : confirmState?.kind === 'dog'
              ? 'Retirer ce chien ?'
              : 'Retirer du carnet ?'
        }
        message={
          confirmState
            ? confirmState.kind === 'collab'
              ? `${confirmState.name} sera retiré(e) de cette expédition.`
              : confirmState.kind === 'dog'
                ? `${confirmState.name} sera retiré(e) des compagnons canins.`
                : `${confirmState.name} sera retiré(e) du carnet d'équipage.`
            : undefined
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

export default TeamMobileExperience;
