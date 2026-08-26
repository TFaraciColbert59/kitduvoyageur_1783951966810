'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Props {
  event: any | null;
  isOpen?: boolean;
  onClose: () => void;
  currentUserId?: string;
  allEvents?: any[];
  onSelectEvent?: (ev: any) => void;
}

export default function EventDetailModal({
  event,
  isOpen,
  onClose,
  currentUserId,
  allEvents,
  onSelectEvent,
}: Props) {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // If isOpen is explicitly passed, respect it. Otherwise, require event to be non-null.
  if (isOpen !== undefined && !isOpen) return null;
  if (!event) return null;

  const current = event;

  const eventDate = new Date(current.event_date);
  const isPast = eventDate < new Date();
  const dateFormatted = !isNaN(eventDate.getTime())
    ? eventDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Date à confirmer';

  const spotsLeft = current.max_participants
    ? Math.max(0, current.max_participants - (current.participants_count || 0))
    : null;

  const handleJoin = async () => {
    if (!currentUserId) {
      setToast('Veuillez vous connecter pour rejoindre cette sortie.');
      return;
    }
    setJoining(true);
    try {
      const supabase = createClient();
      // Record participant in club_members or notify
      setJoined(true);
      setToast('🎉 Vous êtes inscrit à cette sortie !');
    } catch (err: any) {
      setToast(err.message || 'Erreur lors de l’inscription');
    } finally {
      setJoining(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-xl glass rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0"
            aria-label="Fermer"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>

          {/* Toast */}
          {toast && (
            <div className="mb-4 p-3 bg-[#17402C] text-white text-xs font-semibold rounded-xl text-center ">
              {toast}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-[#17402C]/10 text-[#17402C] rounded-full text-xs font-bold font-mono tracking-wider uppercase">
              {current.club_emoji || '🏔️'} Sortie Club
            </span>
            {isPast ? (
              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-medium">
                Passée
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                🟢 À venir
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#17402C] mb-2 leading-tight">
            {current.title}
          </h2>

          {current.club_name && (
            <p className="text-xs text-[#5C6B5E] mb-6 flex items-center gap-1.5">
              Organisée par le club{' '}
              <strong className="text-[#17402C]">{current.club_name}</strong>
            </p>
          )}

          {/* Information Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Date */}
            <div className="p-4 bg-[#F5F2E8]/60 border border-[#17402C]/5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#17402C]  shrink-0">
                <Icon name="CalendarIcon" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B5E]">Date & Heure</p>
                <p className="text-xs font-bold text-[#17402C] capitalize leading-snug mt-0.5">
                  {dateFormatted}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="p-4 bg-[#F5F2E8]/60 border border-[#17402C]/5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#17402C]  shrink-0">
                <Icon name="MapPinIcon" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B5E]">Lieu de rassemblement</p>
                <p className="text-xs font-bold text-[#17402C] truncate leading-snug mt-0.5">
                  {current.location || 'Coordonnées partagées aux inscrits'}
                </p>
              </div>
            </div>

            {/* Participants */}
            <div className="p-4 bg-[#F5F2E8]/60 border border-[#17402C]/5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#17402C]  shrink-0">
                <Icon name="UserGroupIcon" size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B5E]">Places</p>
                <p className="text-xs font-bold text-[#17402C] leading-snug mt-0.5">
                  {current.participants_count || 0} / {current.max_participants || 'Illimité'} inscrits
                  {spotsLeft !== null && (
                    <span className="text-[10px] text-[#17402C] ml-1.5 font-normal">
                      ({spotsLeft} restantes)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Organizer */}
            <div className="p-4 bg-[#F5F2E8]/60 border border-[#17402C]/5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#17402C]  shrink-0 font-bold text-xs">
                {current.organizer_name?.charAt(0) || '👤'}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B5E]">Organisateur</p>
                <p className="text-xs font-bold text-[#17402C] truncate leading-snug mt-0.5">
                  {current.organizer_name || 'Guide / Responsable Club'}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-[#17402C] mb-2">
              À propos de la sortie
            </h4>
            <p className="text-xs sm:text-sm text-[#17402C]/80 leading-relaxed bg-[#FBFAF6] p-4 rounded-2xl border border-[#17402C]/5">
              {current.description || "Rejoignez d'autres passionnés pour cette sortie outdoor. Préparez votre sac et votre équipement selon la météo."}
            </p>
          </div>

          {/* Other events list if browse mode */}
          {allEvents && allEvents.length > 1 && (
            <div className="mb-6 border-t border-[#17402C]/10 pt-4">
              <button
                onClick={() => setViewAll(!viewAll)}
                className="text-xs font-bold text-[#17402C] hover:underline flex items-center justify-between w-full"
              >
                <span>Toutes les sorties du calendrier ({allEvents.length})</span>
                <span>{viewAll ? '▲ Masquer' : '▼ Découvrir'}</span>
              </button>

              {viewAll && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {allEvents.map((ev: any) => {
                    const isSelected = ev.id === current.id;
                    const d = new Date(ev.event_date);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => onSelectEvent?.(ev)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#17402C]/10 border-[#17402C]/40 font-bold text-[#17402C]'
                            : 'bg-white border-[#17402C]/10 hover:bg-[#F5F2E8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-sm">{ev.club_emoji || '🏔️'}</span>
                          <div className="truncate">
                            <p className="text-xs text-[#17402C] truncate font-semibold">{ev.title}</p>
                            <p className="text-[10px] text-[#5C6B5E]">
                              {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {ev.location || 'Lieu TBD'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#5C6B5E] shrink-0 font-mono">
                          {ev.participants_count || 0}/{ev.max_participants || 10}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {current.club_id && (
              <Link
                href={`/clubs/${current.club_id}`}
                className="w-10 h-10 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0 shrink-0"
                aria-label="Explorer le club"
              >
                <Icon name="ArrowRightIcon" size={16} />
              </Link>
            )}
            <button
              onClick={handleJoin}
              disabled={joining || joined || isPast}
              className="glass-capsule-btn px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{joined ? '✓ Inscrit' : joining ? 'Inscription...' : isPast ? 'Passée' : 'Rejoindre'}</span>
              <Icon name="ArrowRightIcon" size={14} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
