'use client';

import React, { useState, useTransition } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  Pin,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { EmptyState } from '@/components/ui/EmptyState';
import { TripCompletionModal } from './TripCompletionModal';
import { ConfirmDialog } from './ConfirmDialog';
import { addTripNoteAction, deleteTripNoteAction } from '@/app/voyages/completion-actions';
import type { TripFull } from '../types/trip.types';

interface TripNotesViewProps {
  trip: TripFull;
}

export function TripNotesView({ trip }: TripNotesViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ noteId: string; label: string } | null>(null);

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

  const handleDelete = (noteId: string, title?: string | null) => {
    const label = title ? `"${title}"` : 'cette note';
    setConfirmState({ noteId, label });
  };

  const confirmDelete = () => {
    if (!confirmState) return;
    const { noteId } = confirmState;
    setConfirmState(null);
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
        setIsAddOpen(false);
        form.reset();
      } else {
        setErrorMessage(res.error || 'Erreur lors de l\'ajout de la note');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Bannière de statut & Action Clôture */}
      <GlassCard tone="sage" className="p-5 rounded-[var(--lkv-radius-xl)] border border-white/60 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--lkv-primary)]/10 flex items-center justify-center text-[var(--lkv-primary)] shrink-0">
              {trip.status === 'completed' ? <CheckCircle2 size={22} /> : <BookOpen size={22} />}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--lkv-text-primary)] text-base">
                {trip.status === 'completed'
                  ? 'Expédition terminée · Carnet de bord clôturé'
                  : 'Carnet de bord & Récits de voyage'}
              </h3>
              <p className="text-xs text-[var(--lkv-text-secondary)]">
                {trip.status === 'completed'
                  ? 'Votre rétrospective est enregistrée et prête à inspirer les futurs trekkeurs.'
                  : 'Immortalisez vos journées, conditions météo, topos et anecdotes au jour le jour.'}
              </p>
            </div>
          </div>

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
      </GlassCard>

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
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-note-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
        >
          <div className="glass rounded-[var(--lkv-radius-xl)] border border-white/60 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/40 pb-3">
              <h3 id="add-note-title" className="text-base font-bold text-lkv-primary flex items-center gap-2">
                <Edit3 size={18} />
                Nouvelle page du carnet de bord
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:bg-white transition-all shadow-2xs"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

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
        </div>
      )}

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
