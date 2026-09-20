'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { Badge, Button, Card, Chip, EmptyState, IconButton } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { TripCompletionModal } from './TripCompletionModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { addTripNoteAction, deleteTripNoteAction } from '@/app/voyages/completion-actions';
import { updateTripNoteAction } from '@/features/trips/actions/updateTripNoteAction';
import { getTripDuration } from '../hooks/useTripDuration';
import type { TripFull, TripNote } from '../types/trip.types';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

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
  const [editState, setEditState] = useState<{ noteId: string; title: string | null } | null>(null);
  const [editContent, setEditContent] = useState('');
  const { triggerHaptic } = useHapticFeedback();

  const canEdit = trip.permissions.canEdit;
  const notes = trip.notes || [];

  // Filtrage des notes
  const filteredNotes = notes.filter((n) => {
    if (selectedDayFilter === 'all') return true;
    return n.day_number === selectedDayFilter;
  });

  // Liste des jours disponibles
  const availableDays = Array.from(
    new Set(notes.map((n) => n.day_number).filter((d): d is number => typeof d === 'number'))
  ).sort((a, b) => a - b);

  // ——— Statistiques LIVE du carnet (dérivées des données réelles, zéro mock) ———
  const now = new Date();
  const tripDuration = getTripDuration(trip);
  const maxNoteDay = notes.reduce(
    (max, n) => (typeof n.day_number === 'number' && n.day_number > max ? n.day_number : max),
    0
  );
  const jourCouvert = maxNoteDay > 0 ? maxNoteDay : tripDuration.currentDay;
  const notesDuJour = jourCouvert ? notes.filter((n) => n.day_number === jourCouvert).length : 0;
  const notesCreatedToday = notes.filter((n) => isSameDay(new Date(n.created_at), now)).length;
  const lastNote = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  const pinnedNote = notes.find((n) => n.is_pinned);
  const daysTold = availableDays.length;
  const totalTripDays = tripDuration.durationDays;
  const progressPct =
    totalTripDays > 0 ? Math.min(100, Math.round((daysTold / totalTripDays) * 100)) : 0;

  const handleDelete = (noteId: string, title?: string | null) => {
    const label = title ? `"${title}"` : 'cette note';
    setConfirmState({ noteId, label });
  };

  const handleEditOpen = (note: TripNote) => {
    setErrorMessage(null);
    triggerHaptic('light');
    setEditState({ noteId: note.id, title: note.title });
    setEditContent(note.content);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editState) return;
    const trimmed = editContent.trim();
    if (trimmed === '') {
      setErrorMessage('Le contenu de la note est requis');
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const res = await updateTripNoteAction(editState.noteId, trimmed);
      if (res.ok) {
        triggerHaptic('success');
        setEditState(null);
      } else {
        setErrorMessage(res.error || 'Erreur lors de la mise à jour de la note');
      }
    });
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
        setErrorMessage(res.error || "Erreur lors de l'ajout de la note");
      }
    });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      {/* Panneau « Carnet en création » — stats live dérivées des données réelles */}
      <Card as="section" aria-label="Carnet en création" className="space-y-[var(--space-3)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
          <h3 className="flex items-center gap-[var(--space-2)] font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            <Icon
              name="book-open"
              size={14}
              className="shrink-0 text-[color:var(--lkv-secondary)]"
              aria-hidden="true"
            />
            Carnet en création
          </h3>
          <Badge tone="stone">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {notesCreatedToday}{' '}
            aujourd&apos;hui
          </Badge>
        </div>

        <dl className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
          <Card variant="compact" className="flex flex-col gap-[var(--space-1)]">
            <dt className="text-[10px] font-semibold text-[color:var(--lkv-text-muted)]">
              Jour couvert
            </dt>
            <dd className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {jourCouvert ? `Jour ${jourCouvert}` : '—'}
            </dd>
            <p className="text-[10px] leading-tight text-[color:var(--lkv-text-muted)]">
              {jourCouvert
                ? `${notesDuJour} ${notesDuJour === 1 ? 'note' : 'notes'} ce jour`
                : 'Aucun jour raconté'}
            </p>
          </Card>

          <Card variant="compact" className="flex flex-col gap-[var(--space-1)]">
            <dt className="text-[10px] font-semibold text-[color:var(--lkv-text-muted)]">
              Dernière note
            </dt>
            <dd className="truncate font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {lastNote ? lastNote.title || 'Sans titre' : '—'}
            </dd>
            <p
              className="truncate text-[10px] leading-tight text-[color:var(--lkv-text-muted)]"
              suppressHydrationWarning
            >
              {lastNote ? formatRelativeTime(new Date(lastNote.created_at), now) : 'Carnet vierge'}
            </p>
          </Card>

          <Card variant="compact" className="flex flex-col gap-[var(--space-1)]">
            <dt className="text-[10px] font-semibold text-[color:var(--lkv-text-muted)]">
              Note épinglée
            </dt>
            <dd className="truncate font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {pinnedNote ? pinnedNote.title || 'Sans titre' : '—'}
            </dd>
            <p className="text-[10px] leading-tight text-[color:var(--lkv-text-muted)]">
              {pinnedNote ? 'Mise en avant' : 'Aucune épinglée'}
            </p>
          </Card>

          <Card variant="compact" className="flex flex-col gap-[var(--space-1)]">
            <dt className="text-[10px] font-semibold text-[color:var(--lkv-text-muted)]">
              Progression
            </dt>
            <dd className="font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {daysTold} / {totalTripDays} jours
            </dd>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--lkv-surface-muted)]">
              <div
                className="h-full rounded-full bg-[color:var(--lkv-primary)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] leading-tight text-[color:var(--lkv-text-muted)]">
              {daysTold} {daysTold === 1 ? 'jour raconté' : 'jours racontés'} / {totalTripDays}{' '}
              {totalTripDays === 1 ? 'jour de voyage' : 'jours de voyage'}
            </p>
          </Card>
        </dl>
      </Card>

      {/* Bannière de statut & Action Clôture */}
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-4)]">
        {trip.status === 'completed' && (
          <Badge tone="sage">
            <Icon name="check-circle2" size={13} aria-hidden="true" />
            <span>Expédition terminée</span>
          </Badge>
        )}
        {canEdit && (
          <div className="flex shrink-0 items-center gap-[var(--space-2)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCompletionOpen(true)}
              icon={<Icon name="award" size={16} />}
            >
              {trip.status === 'completed' ? 'Bilan & Rétrospective' : 'Clôturer le voyage'}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              icon={<Icon name="plus" size={16} />}
            >
              Ajouter un récit
            </Button>
          </div>
        )}
      </div>

      {/* Barre de filtres par jour */}
      {availableDays.length > 0 && (
        <div className="flex items-center gap-[var(--space-2)] overflow-x-auto pb-1">
          <Chip selected={selectedDayFilter === 'all'} onClick={() => setSelectedDayFilter('all')}>
            Toutes ({notes.length})
          </Chip>
          {availableDays.map((day) => (
            <Chip key={day} selected={selectedDayFilter === day} onClick={() => setSelectedDayFilter(day)}>
              Jour {day}
            </Chip>
          ))}
        </div>
      )}

      {/* Liste des notes */}
      {filteredNotes.length === 0 ? (
        <EmptyState
          icon={<Icon name="book-open" size={36} className="text-[color:var(--lkv-secondary)]/40" />}
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
        <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className={`transition-shadow ${
                note.is_pinned ? 'shadow-elevation-2' : ''
              }`}
            >
              <div className="mb-[var(--space-2)] flex items-start justify-between gap-[var(--space-3)]">
                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                  {note.day_number && <Badge tone="sage">Jour {note.day_number}</Badge>}
                  {note.is_pinned && (
                    <Badge tone="warn">
                      <Icon name="pin" size={11} /> Épinglé
                    </Badge>
                  )}
                </div>

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-[var(--space-2)]">
                    <IconButton
                      type="button"
                      size="sm"
                      onClick={() => handleEditOpen(note)}
                      disabled={isPending}
                      aria-label="Éditer la note"
                    >
                      <Icon name="pencil" size={16} />
                    </IconButton>
                    <IconButton
                      type="button"
                      size="sm"
                      onClick={() => handleDelete(note.id, note.title)}
                      disabled={isPending}
                      aria-label="Supprimer la note"
                    >
                      <Icon name="trash2" size={16} />
                    </IconButton>
                  </div>
                )}
              </div>

              {note.title && (
                <h4 className="mb-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                  {note.title}
                </h4>
              )}

              <p className="whitespace-pre-wrap text-[length:var(--lkv-text-body-sm)] leading-relaxed text-[color:var(--lkv-text-primary)]/90">
                {note.content}
              </p>

              <div className="mt-[var(--space-4)] flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)] text-[11px] text-[color:var(--lkv-text-secondary)]">
                <div className="flex items-center gap-[var(--space-2)]">
                  <Icon name="user" size={12} />
                  <span>{note.author?.full_name || 'Explorateur'}</span>
                </div>
                <div className="flex items-center gap-[var(--space-2)]">
                  <Icon name="calendar" size={12} />
                  <span>{new Date(note.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal d'ajout de note */}
      <Sheet
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Nouvelle page du carnet de bord"
      >
        <div className="space-y-[var(--space-4)] pb-2">
          {errorMessage && (
            <Card
              role="alert"
              tone="danger"
              className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
            >
              {errorMessage}
            </Card>
          )}

          <form onSubmit={handleAddSubmit} className="space-y-[var(--space-4)]">
            <label className="block">
              <span className={LABEL_CLASS}>Titre de la note (optionnel)</span>
              <input
                type="text"
                name="title"
                placeholder="Ex : Sommet atteint au lever du jour"
                className={FIELD_CLASS}
              />
            </label>

            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <label className="block">
                <span className={LABEL_CLASS}>Jour de trek (optionnel)</span>
                <input
                  type="number"
                  name="dayNumber"
                  min={1}
                  max={60}
                  placeholder="Ex : 1"
                  className={FIELD_CLASS}
                />
              </label>

              <div className="flex items-center pt-5">
                <label className="flex cursor-pointer select-none items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]">
                  <input
                    type="checkbox"
                    name="isPinned"
                    value="true"
                    className="h-4 w-4 rounded accent-[color:var(--lkv-primary)]"
                  />
                  Épingler en haut
                </label>
              </div>
            </div>

            <label className="block">
              <span className={LABEL_CLASS}>Récit & Notes de terrain *</span>
              <textarea
                name="content"
                required
                rows={4}
                placeholder="Conditions du sentier, faune observée, sensations, astuces..."
                className={FIELD_CLASS}
              />
            </label>

            <div className="flex items-center justify-end gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" loading={isPending}>
                {isPending ? 'Enregistrement...' : 'Enregistrer la note'}
              </Button>
            </div>
          </form>
        </div>
      </Sheet>

      {/* Modal d'édition sur place */}
      <Sheet
        open={editState !== null}
        onOpenChange={(open) => {
          if (!open) setEditState(null);
        }}
        title="Éditer la note"
      >
        <div className="space-y-[var(--space-4)] pb-2">
          {errorMessage && (
            <Card
              role="alert"
              tone="danger"
              className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
            >
              {errorMessage}
            </Card>
          )}

          {editState?.title && (
            <p className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-secondary)]">
              {editState.title}
            </p>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-[var(--space-4)]">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
              aria-label="Contenu de la note"
              className={FIELD_CLASS}
            />
            <div className="flex items-center justify-end gap-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditState(null)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" loading={isPending}>
                {isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </div>
      </Sheet>

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
        message={
          confirmState ? `${confirmState.label} sera supprimée du carnet de bord.` : undefined
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
