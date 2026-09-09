'use client';

import React, { useState, useTransition } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Pin,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { EmptyState } from '@/components/ui/EmptyState';
import { TripCompletionModal } from './TripCompletionModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { addTripNoteAction, deleteTripNoteAction } from '@/app/voyages/completion-actions';
import { getTripDuration } from '../hooks/useTripDuration';
import type { TripFull } from '../types/trip.types';

interface TripNotesViewProps {
  trip: TripFull;
}

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(diffMs / 3600000);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(diffMs / 86400000);
  return rtf.format(-days, 'day');
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function TripNotesView({ trip }: TripNotesViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ noteId: string; label: string } | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const canEdit = trip.permissions.canEdit;
  const notes = trip.notes || [];

  // Filtrage des notes
  const filteredNotes = notes.filter(n => {
    if (selectedDayFilter === 'all') return true;
    return n.day_number === selectedDayFilter;
  });

  // Liste des jours disponibles
  const availableDays = Array.from(
    new Set(notes.map(n => n.day_number).filter((d): d is number => typeof d === 'number'))
  ).sort((a, b) => a - b);

  // ——— Statistiques LIVE du carnet (dérivées des données réelles, zéro mock) ———
  const now = new Date();
  const tripDuration = getTripDuration(trip);
  const maxNoteDay = notes.reduce(
    (max, n) => (typeof n.day_number === 'number' && n.day_number > max ? n.day_number : max),
    0
  );
  const jourCouvert = maxNoteDay > 0 ? maxNoteDay : tripDuration.currentDay;
  const notesDuJour = jourCouvert
    ? notes.filter(n => n.day_number === jourCouvert).length
    : 0;
  const notesCreatedToday = notes.filter(n => isSameDay(new Date(n.created_at), now)).length;
  const lastNote = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  const pinnedNote = notes.find(n => n.is_pinned);
  const daysTold = availableDays.length;
  const totalTripDays = tripDuration.durationDays;
  const progressPct =
    totalTripDays > 0 ? Math.min(100, Math.round((daysTold / totalTripDays) * 100)) : 0;

  const handleDelete = (noteId: string, title?: string | null) => {
    const label = title ? `"${title}"` : 'cette note';
    setConfirmState({ noteId, label });
  };

  const confirmDelete = () => {
    if (!confirmState) return;
    const { noteId } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    startTransition(async () => {
      const formData = new FormData();
      formData.set('tripId', trip.id);
      formData.set('noteId', noteId);
      formData.set('tripSlug', trip.slug);
      const res = await deleteTripNoteAction(null, formData);
      if (!res.success) {
        setErrorMessage(res.error || 'Erreur lors de la suppression de la note');
      }
    });
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);

    startTransition(async () => {
      const res = await addTripNoteAction(null, formData);
      if (res.success) {
        triggerHaptic('success');
        setIsAddOpen(false);
        form.reset();
      } else {
        setErrorMessage(res.error || 'Erreur lors de l\'ajout de la note');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Panneau « Carnet en création » — stats live dérivées des données réelles */}
      <section
        aria-label="Carnet en création"
        className="glass rounded-[var(--lkv-radius-card)] p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-display text-xs font-bold text-lkv-primary flex items-center gap-1.5">
            <BookOpen size={14} className="text-lkv-secondary shrink-0" aria-hidden="true" />
            Carnet en création
          </h3>
          <span className="glass-pill text-[10px] font-semibold text-[var(--lkv-text-secondary)]">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {notesCreatedToday} aujourd&apos;hui
          </span>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-sub-card rounded-xl p-3 flex flex-col gap-1">
            <dt className="text-[10px] font-semibold text-[var(--lkv-text-muted)]">
              Jour couvert
            </dt>
            <dd className="font-display text-sm font-bold text-[var(--lkv-text-primary)]">
              {jourCouvert ? `Jour ${jourCouvert}` : '—'}
            </dd>
            <p className="text-[10px] text-[var(--lkv-text-muted)] leading-tight">
              {jourCouvert
                ? `${notesDuJour} ${notesDuJour === 1 ? 'note' : 'notes'} ce jour`
                : 'Aucun jour raconté'}
            </p>
          </div>

          <div className="glass-sub-card rounded-xl p-3 flex flex-col gap-1">
            <dt className="text-[10px] font-semibold text-[var(--lkv-text-muted)]">
              Dernière note
            </dt>
            <dd className="font-display text-sm font-bold text-[var(--lkv-text-primary)] truncate">
              {lastNote ? lastNote.title || 'Sans titre' : '—'}
            </dd>
            <p className="text-[10px] text-[var(--lkv-text-muted)] leading-tight truncate" suppressHydrationWarning>
              {lastNote ? formatRelativeTime(new Date(lastNote.created_at), now) : 'Carnet vierge'}
            </p>
          </div>

          <div className="glass-sub-card rounded-xl p-3 flex flex-col gap-1">
            <dt className="text-[10px] font-semibold text-[var(--lkv-text-muted)]">
              Note épinglée
            </dt>
            <dd className="font-display text-sm font-bold text-[var(--lkv-text-primary)] truncate">
              {pinnedNote ? pinnedNote.title || 'Sans titre' : '—'}
            </dd>
            <p className="text-[10px] text-[var(--lkv-text-muted)] leading-tight">
              {pinnedNote ? 'Mise en avant' : 'Aucune épinglée'}
            </p>
          </div>

          <div className="glass-sub-card rounded-xl p-3 flex flex-col gap-1">
            <dt className="text-[10px] font-semibold text-[var(--lkv-text-muted)]">
              Progression
            </dt>
            <dd className="font-display text-sm font-bold text-[var(--lkv-text-primary)]">
              {daysTold} / {totalTripDays} jours
            </dd>
            <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--lkv-primary)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-[var(--lkv-text-muted)] leading-tight">
              {daysTold} {daysTold === 1 ? 'jour raconté' : 'jours racontés'} / {totalTripDays}{' '}
              {totalTripDays === 1 ? 'jour de voyage' : 'jours de voyage'}
            </p>
          </div>
        </dl>
      </section>

      {/* Bannière de statut & Action Clôture */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {trip.status === 'completed' && (
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--lkv-primary)]/10 text-lkv-primary font-semibold">
            <CheckCircle2 size={13} aria-hidden="true" />
            <span>Expédition terminée</span>
          </span>
        )}
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <GlassCapsuleBtn
              variant="secondary"
              size="sm"
              onClick={() => setIsCompletionOpen(true)}
              icon={<Award size={16} />}
            >
              {trip.status === 'completed' ? 'Bilan & Rétrospective' : 'Clôturer le voyage'}
            </GlassCapsuleBtn>
            <GlassCapsuleBtn
              variant="primary"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              icon={<Plus size={16} />}
            >
              Ajouter un récit
            </GlassCapsuleBtn>
          </div>
        )}
      </div>

      {/* Barre de filtres par jour */}
      {availableDays.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all shadow-2xs ${
              selectedDayFilter === 'all'
                ? 'bg-[var(--lkv-primary)] text-white shadow-sm'
                : 'glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] hover:bg-white/90'
            }`}
          >
            Toutes ({notes.length})
          </button>
          {availableDays.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDayFilter(day)}
              className={`px-3 py-1.5 rounded-full font-medium transition-all shadow-2xs ${
                selectedDayFilter === day
                  ? 'bg-[var(--lkv-primary)] text-white shadow-sm'
                  : 'glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)] hover:bg-white/90'
              }`}
            >
              Jour {day}
            </button>
          ))}
        </div>
      )}

      {/* Liste des notes */}
      {filteredNotes.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={36} className="text-lkv-secondary/40" />}
          title="Aucune note enregistrée"
          description={
            canEdit
              ? 'Racontez votre première étape ou vos impressions de terrain pour enrichir votre carnet.'
              : "Aucun récit n'a encore été partagé pour ce voyage."
          }
          actionLabel={canEdit ? 'Écrire dans le carnet' : undefined}
          onAction={canEdit ? () => setIsAddOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map(note => (
            <GlassCard
              key={note.id}
              tone="neutral"
              className={`p-5 rounded-[var(--lkv-radius-lg)] border transition-shadow ${
                note.is_pinned
                  ? 'border-lkv-primary/30 shadow-sm'
                  : 'border-white/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {note.day_number && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-lkv-primary/10 text-lkv-primary">
                      Jour {note.day_number}
                    </span>
                  )}
                  {note.is_pinned && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--lkv-warning)]/10 text-[var(--lkv-warning)] border border-[var(--lkv-warning)]/20 flex items-center gap-1">
                      <Pin size={11} /> Épinglé
                    </span>
                  )}
                </div>

                {canEdit && (
                  <button
                    onClick={() => handleDelete(note.id, note.title)}
                    disabled={isPending}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
                    aria-label="Supprimer la note"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {note.title && (
                <h4 className="font-semibold text-base text-lkv-primary mb-2">{note.title}</h4>
              )}

              <p className="text-sm text-lkv-primary/90 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>

              <div className="mt-4 pt-3 border-t border-white/40 flex items-center justify-between text-[11px] text-lkv-secondary">
                <div className="flex items-center gap-1.5">
                  <User size={12} />
                  <span>{note.author?.full_name || 'Explorateur'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>{new Date(note.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Modal d'ajout de note */}
      <GlassModal open={isAddOpen} onOpenChange={setIsAddOpen} title="Nouvelle page du carnet de bord" variant="sheet">
        <div className="pb-2 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs border">
              {errorMessage}
            </div>
          )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Titre de la note (optionnel)
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="Ex : Sommet atteint au lever du jour"
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Jour de trek (optionnel)
                  </label>
                  <input
                    type="number"
                    name="dayNumber"
                    min={1}
                    max={60}
                    placeholder="Ex : 1"
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-lkv-primary font-medium">
                    <input
                      type="checkbox"
                      name="isPinned"
                      value="true"
                      className="w-4 h-4 rounded text-lkv-primary focus:ring-lkv-primary"
                    />
                    Épingler en haut
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Récit & Notes de terrain *
                </label>
                <textarea
                  name="content"
                  required
                  rows={4}
                  placeholder="Conditions du sentier, faune observée, sensations, astuces..."
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/40">
                <GlassCapsuleBtn
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isPending}
                >
                  Annuler
                </GlassCapsuleBtn>
                <GlassCapsuleBtn
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? 'Enregistrement...' : 'Enregistrer la note'}
                </GlassCapsuleBtn>
              </div>
            </form>
        </div>
      </GlassModal>

      {/* Modal de rétrospective & clôture */}
      <TripCompletionModal
        trip={trip}
        isOpen={isCompletionOpen}
        onClose={() => setIsCompletionOpen(false)}
      />

      {/* Modale de confirmation de suppression */}
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
