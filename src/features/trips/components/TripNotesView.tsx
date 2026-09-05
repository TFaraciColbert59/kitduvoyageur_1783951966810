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
import { LkvButton } from '@/components/ui/LkvButton';
import { TripCompletionModal } from './TripCompletionModal';
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
    if (confirm(`Supprimer ${label} du carnet de bord ?`)) {
      startTransition(async () => {
        const formData = new FormData();
        formData.set('tripId', trip.id);
        formData.set('noteId', noteId);
        formData.set('tripSlug', trip.slug);
        const res = await deleteTripNoteAction(null, formData);
        if (!res.success) {
          alert(res.error || 'Erreur lors de la suppression de la note');
        }
      });
    }
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
      <GlassCard tone="sage" className="p-5 rounded-[24px] border border-white/60 bg-[#17402C] text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
              {trip.status === 'completed' ? <CheckCircle2 size={22} /> : <BookOpen size={22} />}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {trip.status === 'completed'
                  ? 'Expédition terminée · Carnet de bord clôturé'
                  : 'Carnet de bord & Récits de voyage'}
              </h3>
              <p className="text-xs text-white/80">
                {trip.status === 'completed'
                  ? 'Votre rétrospective est enregistrée et prête à inspirer les futurs trekkeurs.'
                  : 'Immortalisez vos journées, conditions météo, topos et anecdotes au jour le jour.'}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <LkvButton
                variant="ghost-light"
                size="sm"
                onClick={() => setIsCompletionOpen(true)}
                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
              >
                <Award size={16} className="mr-1.5" />
                {trip.status === 'completed' ? 'Bilan & Rétrospective' : 'Clôturer le voyage'}
              </LkvButton>
              <LkvButton
                variant="primary"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="bg-white text-[#17402C] hover:bg-white/90"
              >
                <Plus size={16} className="mr-1.5" />
                Ajouter un récit
              </LkvButton>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Barre de filtres par jour */}
      {availableDays.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              selectedDayFilter === 'all'
                ? 'bg-[#17402C] text-white'
                : 'bg-black/5 text-[#5B7F55] hover:bg-black/10'
            }`}
          >
            Toutes ({notes.length})
          </button>
          {availableDays.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDayFilter(day)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
                selectedDayFilter === day
                  ? 'bg-[#17402C] text-white'
                  : 'bg-black/5 text-[#5B7F55] hover:bg-black/10'
              }`}
            >
              Jour {day}
            </button>
          ))}
        </div>
      )}

      {/* Liste des notes */}
      {filteredNotes.length === 0 ? (
        <GlassCard tone="neutral" className="p-8 rounded-[24px] text-center border border-white/60">
          <BookOpen size={36} className="mx-auto text-[#5B7F55]/40 mb-2" />
          <h4 className="text-sm font-semibold text-[#17402C]">Aucune note enregistrée</h4>
          <p className="text-xs text-[#5B7F55] mt-1 max-w-sm mx-auto">
            {canEdit
              ? 'Racontez votre première étape ou vos impressions de terrain pour enrichir votre carnet.'
              : 'Aucun récit n\'a encore été partagé pour ce voyage.'}
          </p>
          {canEdit && (
            <LkvButton
              variant="secondary"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="mt-4"
            >
              <Plus size={16} className="mr-1" />
              Écrire dans le carnet
            </LkvButton>
          )}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map(note => (
            <GlassCard
              key={note.id}
              tone="neutral"
              className={`p-5 rounded-[22px] border transition-shadow ${
                note.is_pinned
                  ? 'border-[#17402C]/30 bg-[#FAF8F5]/90 shadow-sm'
                  : 'border-white/70 bg-white/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {note.day_number && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C]">
                      Jour {note.day_number}
                    </span>
                  )}
                  {note.is_pinned && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <Pin size={11} /> Épinglé
                    </span>
                  )}
                </div>

                {canEdit && (
                  <button
                    onClick={() => handleDelete(note.id, note.title)}
                    disabled={isPending}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#5B7F55] hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label="Supprimer la note"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {note.title && (
                <h4 className="font-semibold text-base text-[#17402C] mb-2">{note.title}</h4>
              )}

              <p className="text-sm text-[#17402C]/90 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>

              <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between text-[11px] text-[#5B7F55]">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn"
        >
          <div className="bg-[#FAF8F5] border border-white/80 rounded-[26px] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <h3 id="add-note-title" className="text-base font-bold text-[#17402C] flex items-center gap-2">
                <Edit3 size={18} />
                Nouvelle page du carnet de bord
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-[#5B7F55]"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17402C] mb-1">
                  Titre de la note (optionnel)
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="Ex : Sommet atteint au lever du jour"
                  className="w-full text-sm px-3 py-2 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#17402C] mb-1">
                    Jour de trek (optionnel)
                  </label>
                  <input
                    type="number"
                    name="dayNumber"
                    min={1}
                    max={60}
                    placeholder="Ex : 1"
                    className="w-full text-sm px-3 py-2 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#17402C] font-medium">
                    <input
                      type="checkbox"
                      name="isPinned"
                      value="true"
                      className="w-4 h-4 rounded border-gray-300 text-[#17402C] focus:ring-[#17402C]"
                    />
                    Épingler en haut
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17402C] mb-1">
                  Récit & Notes de terrain *
                </label>
                <textarea
                  name="content"
                  required
                  rows={4}
                  placeholder="Conditions du sentier, faune observée, sensations, astuces..."
                  className="w-full text-sm px-3 py-2 rounded-xl border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                <LkvButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isPending}
                >
                  Annuler
                </LkvButton>
                <LkvButton type="submit" variant="primary" size="sm" disabled={isPending}>
                  {isPending ? 'Enregistrement...' : 'Enregistrer la note'}
                </LkvButton>
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
    </div>
  );
}
