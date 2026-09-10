'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { CalendarDays, NotebookPen, Pin, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/features/trips/components/ConfirmDialog';
import { TripCompletionModal } from '@/features/trips/components/TripCompletionModal';
import type { TripFull, TripNote } from '@/features/trips/types/trip.types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { addTripNoteAction, deleteTripNoteAction } from '@/app/voyages/completion-actions';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';
import {
  availableNoteDays,
  buildJournalStats,
  formatRelativeTime,
  notesForDay,
  sortJournalNotes,
} from '../../../mobile/journalEngine';
import { BudgetRing } from '../budget/BudgetRing';
import { GroupeChipsRow, type GroupeChipDef } from '../groupe/GroupeChipsRow';
import { GroupeDrawer } from '../groupe/GroupeDrawer';
import { GroupeRail } from '../groupe/GroupeRail';

export interface JournalMobileExperienceProps {
  trip: TripFull;
}

function noteTitle(note: TripNote): string {
  return note.title?.trim() || note.content.split('\n')[0].slice(0, 60) || 'Note de terrain';
}

export function JournalMobileExperience({ trip }: JournalMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isPending, startTransition] = useTransition();
  const notes = useMemo(() => trip.notes || [], [trip.notes]);
  const sorted = useMemo(() => sortJournalNotes(notes), [notes]);
  const duration = useMemo(() => getTripDuration(trip), [trip]);
  const stats = useMemo(() => buildJournalStats(notes, duration.durationDays), [notes, duration.durationDays]);
  const days = useMemo(() => availableNoteDays(notes), [notes]);
  const pinned = sorted.filter((note) => note.is_pinned);

  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [listOpen, setListOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [selected, setSelected] = useState<TripNote | null>(null);
  const [confirmState, setConfirmState] = useState<{ id: string; label: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canEdit = trip.permissions.canEdit;

  const filtered = dayFilter === 'all' ? sorted : notesForDay(sorted, dayFilter);

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);
    startTransition(async () => {
      const res = await addTripNoteAction(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || "Impossible d'enregistrer cette note");
      } else {
        triggerHaptic('success');
        form.reset();
        setEditorOpen(false);
      }
    });
  };

  const confirmDelete = () => {
    if (!confirmState) return;
    const { id } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    startTransition(async () => {
      const formData = new FormData();
      formData.set('tripId', trip.id);
      formData.set('noteId', id);
      formData.set('tripSlug', trip.slug);
      const res = await deleteTripNoteAction(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || 'Erreur lors de la suppression de la note');
      } else {
        setSelected((prev) => (prev?.id === id ? null : prev));
      }
    });
  };

  const chips: GroupeChipDef[] = [
    {
      key: 'notes',
      icon: NotebookPen,
      value: String(stats.total),
      label: 'notes',
      onClick: () => {
        setDayFilter('all');
        setListOpen(true);
      },
    },
    {
      key: 'days',
      icon: CalendarDays,
      value: `${stats.daysTold}/${duration.durationDays}`,
      label: 'jours couverts',
      tone: stats.daysTold > 0 ? 'accent' : 'default',
      onClick: () => {
        setDayFilter('all');
        setListOpen(true);
      },
    },
    {
      key: 'pinned',
      icon: Pin,
      value: String(stats.pinned),
      label: 'épinglées',
      onClick: () => {
        setDayFilter('all');
        setListOpen(true);
      },
    },
  ];

  const noteCard = (note: TripNote) => (
    <li key={note.id} className="shrink-0 snap-start">
      <button
        type="button"
        onClick={() => {
          triggerHaptic('selection');
          setSelected(note);
        }}
        aria-label={`Note ${noteTitle(note)}`}
        className="glass flex h-[10rem] w-[14.5rem] flex-col rounded-[1.4rem] p-3.5 text-left transition-transform active:scale-[0.98]"
      >
        <span className="flex items-center gap-1.5">
          {note.is_pinned && <Pin size={12} className="text-[var(--lkv-primary)]" aria-hidden="true" />}
          {note.day_number != null && (
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9.5px] font-bold text-[var(--lkv-primary)]">
              Jour {note.day_number}
            </span>
          )}
          <span className="ml-auto text-[9.5px] font-medium text-[var(--lkv-text-primary)]/60">
            {formatRelativeTime(note.created_at)}
          </span>
        </span>
        <span className="mt-2 line-clamp-1 text-[12.5px] font-bold text-[var(--lkv-text-primary)]">
          {noteTitle(note)}
        </span>
        <span className="mt-1 line-clamp-3 text-[11px] font-medium leading-snug text-[var(--lkv-text-primary)]/70">
          {note.content}
        </span>
      </button>
    </li>
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      {errorMsg && (
        <div
          className="glass tone-danger flex items-center justify-between gap-2 rounded-xl p-3 text-xs text-[var(--lkv-danger)]"
          role="alert"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-muted)]"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      <section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Carnet de bord">
        <header className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Carnet de bord
          </p>
          <span className="glass-pill shrink-0 uppercase tracking-[0.08em]">{stats.total} notes</span>
        </header>

        <div className="mt-3 flex items-center gap-4">
          <BudgetRing pct={stats.progressPct}>
            <span className="font-display text-2xl font-extrabold leading-none text-[var(--lkv-text-primary)]">
              {stats.progressPct}%
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
              couvert
            </span>
          </BudgetRing>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
              {stats.daysTold}/{duration.durationDays} jour{duration.durationDays > 1 ? 's' : ''} raconté{stats.daysTold > 1 ? 's' : ''}
            </p>
            <p className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
              {stats.lastCreatedAt
                ? `Dernière note ${formatRelativeTime(stats.lastCreatedAt)}`
                : 'Aucune note pour le moment.'}
            </p>
            {pinned.length > 0 && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-[var(--lkv-primary)]">
                <Pin size={11} aria-hidden="true" />
                {pinned.length} note{pinned.length > 1 ? 's' : ''} épinglée{pinned.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setEditorOpen(true);
              }}
              className="glass-capsule-btn primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 !py-3 text-sm font-bold"
            >
              <Plus size={15} aria-hidden="true" />
              Écrire
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setCompletionOpen(true);
              }}
              className="glass-capsule-btn inline-flex min-h-[44px] flex-1 items-center justify-center !py-3 text-sm font-bold"
            >
              Clôturer
            </button>
          </div>
        )}
      </section>

      <GroupeChipsRow chips={chips} />

      {pinned.length > 0 && (
        <GroupeRail
          title="Épinglées"
          subtitle={`${pinned.length} note${pinned.length > 1 ? 's' : ''} en haut du carnet`}
          actionLabel="Tout voir"
          onAction={() => {
            setDayFilter('all');
            setListOpen(true);
          }}
          ariaLabel="Notes épinglées"
        >
          {pinned.map(noteCard)}
        </GroupeRail>
      )}

      <GroupeRail
        title="Dernières notes"
        subtitle={`${stats.total} note${stats.total > 1 ? 's' : ''} de terrain`}
        actionLabel="Tout voir"
        onAction={() => {
          setDayFilter('all');
          setListOpen(true);
        }}
        ariaLabel="Dernières notes"
      >
        {sorted.slice(0, 8).map(noteCard)}
        {sorted.length === 0 && (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[10rem] w-[14.5rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Carnet vide</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Racontez votre première journée.
              </span>
            </div>
          </li>
        )}
      </GroupeRail>

      {/* Tiroir : liste des notes */}
      <GroupeDrawer open={listOpen} onOpenChange={setListOpen} title="Carnet de bord" width={470}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDayFilter('all')}
            aria-pressed={dayFilter === 'all'}
            className={`min-h-[44px] rounded-full px-3.5 text-xs font-bold transition-colors ${
              dayFilter === 'all' ? 'bg-[var(--lkv-primary)] text-white' : 'glass-sub-card text-[var(--lkv-text-primary)]/75'
            }`}
          >
            Tous les jours
          </button>
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setDayFilter(day)}
              aria-pressed={dayFilter === day}
              className={`min-h-[44px] rounded-full px-3.5 text-xs font-bold transition-colors ${
                dayFilter === day ? 'bg-[var(--lkv-primary)] text-white' : 'glass-sub-card text-[var(--lkv-text-primary)]/75'
              }`}
            >
              Jour {day}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-[var(--lkv-text-primary)]/70">
            Aucune note pour ce filtre.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => {
                    setListOpen(false);
                    setSelected(note);
                  }}
                  className="glass-sub-card flex min-h-[44px] w-full items-center gap-3 rounded-2xl p-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--lkv-secondary)]">
                    {note.is_pinned ? <Pin size={15} aria-hidden="true" /> : <NotebookPen size={15} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[var(--lkv-text-primary)]">
                      {noteTitle(note)}
                    </span>
                    <span className="block truncate text-[10.5px] font-medium text-[var(--lkv-text-primary)]/65">
                      {note.day_number != null ? `Jour ${note.day_number} · ` : ''}
                      {formatRelativeTime(note.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </GroupeDrawer>

      {/* Tiroir : note */}
      <GroupeDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? noteTitle(selected) : 'Note'}
        width={460}
      >
        {selected && (
          <div className="space-y-4">
            <div className="glass-sub-card flex flex-wrap items-center gap-2 rounded-2xl p-3">
              {selected.day_number != null && (
                <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--lkv-primary)]">
                  Jour {selected.day_number}
                </span>
              )}
              {selected.is_pinned && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--sage-50)] px-2.5 py-1 text-[10px] font-bold text-[var(--sage-700)]">
                  <Pin size={11} aria-hidden="true" />
                  Épinglée
                </span>
              )}
              <span className="ml-auto text-[10.5px] font-medium text-[var(--lkv-text-primary)]/60">
                {formatRelativeTime(selected.created_at)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-[var(--lkv-text-primary)]">
              {selected.content}
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setConfirmState({ id: selected.id, label: `« ${noteTitle(selected)} »` })}
                className="glass-capsule-btn inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold text-[var(--lkv-danger)]"
              >
                <Trash2 size={15} aria-hidden="true" />
                Supprimer la note
              </button>
            )}
          </div>
        )}
      </GroupeDrawer>

      {/* Tiroir : nouvelle note */}
      <GroupeDrawer open={editorOpen} onOpenChange={setEditorOpen} title="Nouvelle page du carnet" width={460}>
        {errorMsg && (
          <p className="glass tone-danger rounded-xl p-3 text-xs text-[var(--lkv-danger)]" role="alert">
            {errorMsg}
          </p>
        )}
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <input
            type="text"
            name="title"
            placeholder="Titre (optionnel)"
            aria-label="Titre de la note"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              name="dayNumber"
              min={1}
              max={60}
              placeholder="Jour du trek"
              aria-label="Jour du trek"
              className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
            />
            <label className="glass-input flex min-h-[44px] cursor-pointer items-center gap-2 px-3 text-xs font-semibold text-[var(--lkv-text-primary)]">
              <input type="checkbox" name="isPinned" value="true" className="h-4 w-4 rounded" />
              Épingler
            </label>
          </div>
          <textarea
            name="content"
            required
            rows={5}
            placeholder="Récit, conditions du sentier, sensations…"
            aria-label="Récit de la note"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)]"
          />
          <button
            type="submit"
            disabled={isPending}
            className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center !py-3 text-sm font-bold disabled:opacity-50"
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer la note'}
          </button>
        </form>
      </GroupeDrawer>

      <TripCompletionModal trip={trip} isOpen={completionOpen} onClose={() => setCompletionOpen(false)} />

      <ConfirmDialog
        open={confirmState !== null}
        title="Supprimer cette note ?"
        message={confirmState ? `${confirmState.label} sera supprimée du carnet de bord.` : undefined}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

export default JournalMobileExperience;
