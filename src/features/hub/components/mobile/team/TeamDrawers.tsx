'use client';

import { useState, type FormEvent } from 'react';
import { Dog, HeartPulse, Plus, Trash2, UserPlus } from 'lucide-react';
import Icon from '@/components/ui/Icon';
import type { HumanParticipant, DogParticipant } from '@/features/participants/types/participant.types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { carnetRoleLabel, dogLoadView, formatJoinDate, personInitials, teamRoleLabel } from '../../../mobile/teamEngine';
import { GroupeDrawer } from '../groupe/GroupeDrawer';

const ROLE_TONES: Record<string, string> = {
  guide: 'bg-[var(--lkv-primary)]/12 text-[var(--lkv-primary)]',
  medic: 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]',
  member: 'bg-[var(--sage-50)] text-[var(--sage-700)]',
};

/* ─────────────── Équipiers & invitation ─────────────── */

export interface TeamMemberRow {
  id: string;
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
}

export interface TeamMembersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMemberRow[];
  isOwner: boolean;
  isPending: boolean;
  inviteError: string | null;
  inviteSuccess: string | null;
  onInviteSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRoleChange: (collaboratorId: string, role: 'editor' | 'viewer') => void;
  onRequestRemove: (collaboratorId: string, name: string) => void;
}

export function TeamMembersDrawer({
  open,
  onOpenChange,
  members,
  isOwner,
  isPending,
  inviteError,
  inviteSuccess,
  onInviteSubmit,
  onRoleChange,
  onRequestRemove,
}: TeamMembersDrawerProps) {
  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Équipiers & invitation" width={470}>
      {isOwner && (
        <form onSubmit={onInviteSubmit} className="glass-sub-card space-y-3 rounded-2xl p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
            Inviter un voyageur
          </p>
          {inviteError && (
            <p className="glass tone-danger rounded-xl p-2.5 text-xs text-[var(--lkv-danger)]" role="alert">
              {inviteError}
            </p>
          )}
          {inviteSuccess && (
            <p className="glass rounded-xl p-2.5 text-xs text-[var(--lkv-primary)]" role="status">
              {inviteSuccess}
            </p>
          )}
          <div className="relative">
            <Icon
              name="mail"
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lkv-text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              name="identifier"
              required
              placeholder="Email ou pseudo LKDV"
              aria-label="Email ou pseudo du voyageur à inviter"
              className="glass-input w-full py-3 pl-10 pr-3 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
            />
          </div>
          <select
            name="role"
            defaultValue="editor"
            aria-label="Rôle attribué à l'invité"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          >
            <option value="editor">Éditeur — peut modifier</option>
            <option value="viewer">Lecteur — consultation seule</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold disabled:opacity-50"
          >
            <UserPlus size={15} aria-hidden="true" />
            {isPending ? 'Envoi…' : "Envoyer l'invitation"}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {members.map((member) => {
          const isRowOwner = member.role === 'owner';
          return (
            <li key={member.id} className="glass-sub-card rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-xs font-bold uppercase text-white"
                  aria-hidden="true"
                >
                  {personInitials(member.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--lkv-text-primary)]">
                    {member.name}
                  </span>
                  <span className="block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                    {formatJoinDate(member.joinedAt)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--lkv-primary)]">
                  {teamRoleLabel(member.role as never) || member.role}
                </span>
              </div>

              {isOwner && !isRowOwner && (
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-black/5 pt-2.5">
                  <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--lkv-text-primary)]/70">
                    Rôle
                    <select
                      value={member.role}
                      disabled={isPending}
                      onChange={(event) => onRoleChange(member.id, event.target.value as 'editor' | 'viewer')}
                      aria-label={`Rôle de ${member.name}`}
                      className="glass-input px-2 py-1.5 text-[11px] font-semibold text-[var(--lkv-text-primary)] min-h-[44px]"
                    >
                      <option value="editor">Éditeur</option>
                      <option value="viewer">Lecteur</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => onRequestRemove(member.id, member.name)}
                    disabled={isPending}
                    aria-label={`Retirer ${member.name} de l'expédition`}
                    className="glass-sub-card inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-danger)] disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </GroupeDrawer>
  );
}

/* ─────────────── Carnet d'équipage (humains) ─────────────── */

export interface TeamCarnetDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  humans: HumanParticipant[];
  onMedical: (human: HumanParticipant) => void;
  onRemove: (id: string) => void;
  onAddHuman: (payload: {
    firstName: string;
    packWeightKg: number;
    bloodType: string;
    iceName: string;
    icePhone: string;
  }) => void;
}

export function TeamCarnetDrawer({
  open,
  onOpenChange,
  humans,
  onMedical,
  onRemove,
  onAddHuman,
}: TeamCarnetDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [firstName, setFirstName] = useState('');
  const [packWeight, setPackWeight] = useState('10');
  const [bloodType, setBloodType] = useState('UNKNOWN');
  const [iceName, setIceName] = useState('');
  const [icePhone, setIcePhone] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstName.trim()) return;
    triggerHaptic('success');
    onAddHuman({
      firstName: firstName.trim(),
      packWeightKg: Math.max(0, Number(packWeight) || 0),
      bloodType,
      iceName: iceName.trim(),
      icePhone: icePhone.trim(),
    });
    setFirstName('');
    setPackWeight('10');
    setBloodType('UNKNOWN');
    setIceName('');
    setIcePhone('');
  };

  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Carnet d'équipage" width={470}>
      <ul className="space-y-2">
        {humans.map((human) => (
          <li key={human.id} className="glass-sub-card rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-forest-900)] text-xs font-bold text-white"
                aria-hidden="true"
              >
                {personInitials(human.publicData.firstName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-[var(--lkv-text-primary)]">
                    {human.publicData.firstName}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ${
                      ROLE_TONES[human.publicData.role] ?? ROLE_TONES.member
                    }`}
                  >
                    {carnetRoleLabel(human.publicData.role)}
                  </span>
                </span>
                <span className="mt-0.5 block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                  Sac {human.publicData.packWeightKg} kg · Forme {human.publicData.fitnessScore}%
                </span>
              </span>
              {onRemove && humans.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(human.id)}
                  aria-label={`Retirer ${human.publicData.firstName} du carnet`}
                  className="glass-sub-card inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--lkv-danger)]"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onMedical(human);
              }}
              className="glass-capsule-btn mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-2.5 text-xs font-bold"
            >
              <HeartPulse size={14} aria-hidden="true" />
              Fiche médicale / ICE
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="glass-sub-card space-y-3 rounded-2xl p-3.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
          <Plus size={12} aria-hidden="true" />
          Ajouter un équipier
        </p>
        <input
          type="text"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Prénom"
          aria-label="Prénom du nouvel équipier"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={packWeight}
            onChange={(event) => setPackWeight(event.target.value)}
            aria-label="Poids du sac en kg"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <select
            value={bloodType}
            onChange={(event) => setBloodType(event.target.value)}
            aria-label="Groupe sanguin"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          >
            <option value="UNKNOWN">Groupe sanguin ?</option>
            <option value="A+">A+</option>
            <option value="O+">O+</option>
            <option value="B+">B+</option>
            <option value="AB+">AB+</option>
            <option value="A-">A−</option>
            <option value="O-">O−</option>
            <option value="B-">B−</option>
            <option value="AB-">AB−</option>
          </select>
        </div>
        <input
          type="text"
          value={iceName}
          onChange={(event) => setIceName(event.target.value)}
          placeholder="Contact ICE (nom)"
          aria-label="Nom du contact d'urgence ICE"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <input
          type="tel"
          value={icePhone}
          onChange={(event) => setIcePhone(event.target.value)}
          placeholder="Téléphone ICE"
          aria-label="Téléphone du contact d'urgence ICE"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <button
          type="submit"
          disabled={!firstName.trim()}
          className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center !py-3 text-sm font-bold disabled:opacity-50"
        >
          Ajouter au carnet
        </button>
      </form>
    </GroupeDrawer>
  );
}

/* ─────────────── Compagnons canins ─────────────── */

export interface TeamDogsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dogs: DogParticipant[];
  onToggleCarrying: (id: string, carrying: boolean) => void;
  onRemove: (id: string) => void;
  onAddDog: (payload: { name: string; breed: string; weightKg: number }) => void;
}

export function TeamDogsDrawer({
  open,
  onOpenChange,
  dogs,
  onToggleCarrying,
  onRemove,
  onAddDog,
}: TeamDogsDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [weight, setWeight] = useState('20');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    triggerHaptic('success');
    onAddDog({ name: name.trim(), breed: breed.trim() || 'Chien', weightKg: Math.max(0, Number(weight) || 0) });
    setName('');
    setBreed('');
    setWeight('20');
  };

  return (
    <GroupeDrawer open={open} onOpenChange={onOpenChange} title="Compagnons canins" width={470}>
      <ul className="space-y-2">
        {dogs.map((dog) => {
          const load = dogLoadView(dog);
          return (
            <li key={dog.id} className="glass-sub-card rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-secondary)]/15 text-[var(--lkv-text-primary)]"
                  aria-hidden="true"
                >
                  <Dog size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-[var(--lkv-text-primary)]">{dog.name}</span>
                    <span className="shrink-0 rounded-full bg-[var(--sage-50)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--sage-700)]">
                      {dog.breed}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                    {dog.weightKg} kg · Capacité max {dog.maxCarryingCapacityKg} kg
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(dog.id)}
                  aria-label={`Retirer ${dog.name}`}
                  className="glass-sub-card inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--lkv-danger)]"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-black/5 pt-2.5">
                <span className="text-[11px] font-semibold text-[var(--lkv-text-primary)]/70">
                  Sac de bât · {load.label}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dog.isCarryingPack}
                  aria-label={`${dog.name} porte le sac`}
                  onClick={() => onToggleCarrying(dog.id, !dog.isCarryingPack)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    dog.isCarryingPack ? 'bg-[var(--lkv-primary)]' : 'bg-black/15'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      dog.isCarryingPack ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--lkv-forest-100)]">
                <div
                  className={`h-full rounded-full ${
                    load.over ? 'bg-[var(--lkv-danger)]' : 'bg-[var(--lkv-primary)]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, load.pct))}%` }}
                />
              </div>
              {load.over && (
                <p className="mt-1.5 text-[10.5px] font-semibold text-[var(--lkv-danger)]">
                  Charge excessive — dépasse 15 % du poids physiologique.
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <span className="glass-sub-card rounded-xl px-2.5 py-1.5 text-[10.5px] font-semibold text-[var(--lkv-text-primary)]/75">
                  Eau / jour · {dog.waterRationLitersPerDay} L
                </span>
                <span className="glass-sub-card rounded-xl px-2.5 py-1.5 text-[10.5px] font-semibold text-[var(--lkv-text-primary)]/75">
                  Croquettes · {dog.foodRationGramsPerDay} g
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <form onSubmit={submit} className="glass-sub-card space-y-3 rounded-2xl p-3.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/70">
          <Plus size={12} aria-hidden="true" />
          Ajouter un chien
        </p>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom"
          aria-label="Nom du chien"
          className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={breed}
            onChange={(event) => setBreed(event.target.value)}
            placeholder="Race"
            aria-label="Race du chien"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            aria-label="Poids du chien en kg"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
        </div>
        <p className="text-[10.5px] font-medium text-[var(--lkv-text-primary)]/60">
          Capacité de portage estimée à 15 % du poids : {(Math.max(0, Number(weight) || 0) * 0.15).toFixed(1)} kg
        </p>
        <button
          type="submit"
          disabled={!name.trim()}
          className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center !py-3 text-sm font-bold disabled:opacity-50"
        >
          Ajouter le compagnon
        </button>
      </form>
    </GroupeDrawer>
  );
}
