'use client';
import { useState, useTransition } from 'react';
import {
  Printer,
  Share2,
  Check,
  MapPin,
  Calendar,
  Backpack,
  ShieldCheck,
  Droplets,
  Thermometer,
  Zap,
} from 'lucide-react';
import { XIcon as XAnimated } from '@/components/icons/x';
import { PlayIcon as PlayAnimated } from '@/components/icons/play';
import { RotateCCWIcon as RotateCcwAnimated } from '@/components/icons/rotate-ccw';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceKm, formatWeight } from '@/features/materiel/domain/departCalculations';
import { updateDepartStatus } from '@/features/materiel/actions/updateDepartStatus';
import { cn } from '@/lib/utils';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

interface DepartureSheetModalProps {
  depart: DepartDetail;
  weather: WeatherForecast | null;
  isOpen: boolean;
  onClose: () => void;
  isRealKit?: boolean;
}

export function DepartureSheetModal({
  depart,
  weather,
  isOpen,
  onClose,
  isRealKit = true,
}: DepartureSheetModalProps) {
  const [copied, setCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(depart.status);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const departsAt = depart.startsAt ? new Date(depart.startsAt) : null;
  const dateLabel = departsAt
    ? departsAt.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date non fixée';

  const vitalItems = depart.assignedKit.items.filter((i) => i.is_vital || i.is_checked);

  const handleShare = async () => {
    const text = `FICHE DE DÉPART LKDV\nDestination : ${depart.destination}\nDate : ${dateLabel}\nPoids au dos : ${formatWeight(depart.totalPackWeightG)}\nContact ICE : ${depart.emergencyContact || 'Non renseigné'}\nLien : ${typeof window !== 'undefined' ? window.location.href : ''}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Fiche de départ — ${depart.destination}`,
          text,
          url: window.location.href,
        });
        return;
      } catch {}
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleToggleStatus = (nextStatus: 'active' | 'done' | 'ready') => {
    setCurrentStatus(nextStatus);
    if (!isRealKit) return;

    startTransition(async () => {
      await updateDepartStatus(depart.id, nextStatus);
    });
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="departure-sheet-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-[#FAF9F5] text-[#17402C] rounded-[28px] shadow-2xl border border-white/80 p-5 sm:p-7 space-y-4 my-auto overflow-hidden font-sans"
        >
          {/* Header de la Fiche */}
          <div className="flex items-start justify-between gap-3 border-b border-black/10 pb-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#5A7064]">
                <span>Fiche officielle de départ</span>
                <span>·</span>
                <span className={cn('px-2 py-0.5 rounded-full font-bold', currentStatus === 'active' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900')}>
                  {currentStatus === 'active' ? 'En cours de trek' : currentStatus === 'done' ? 'Trek terminé' : 'Prêt pour le départ'}
                </span>
              </div>
              <h2 id="departure-sheet-title" className="text-xl sm:text-2xl font-display font-bold leading-tight text-[#17402C]">
                {depart.destination}
              </h2>
              {depart.trail && (
                <p className="text-xs text-[#5A7064] flex items-center gap-1">
                  <MapPin size={12} className="text-[#2D6B4A]" />
                  <span>{depart.trail.name} ({formatDistanceKm(depart.trail.distance_km)})</span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 text-[#5A7064] hover:text-[#17402C] transition-colors"
              aria-label="Fermer la fiche de départ"
            >
              <XAnimated size={18} />
            </button>
          </div>

          {/* Grille des paramètres vitaux */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
              <div className="flex items-center gap-1 text-[#5A7064] text-[10px] font-semibold uppercase">
                <Calendar size={12} />
                <span>Date</span>
              </div>
              <p className="text-xs font-bold text-[#17402C] truncate">{dateLabel}</p>
            </div>

            <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
              <div className="flex items-center gap-1 text-[#5A7064] text-[10px] font-semibold uppercase">
                <Backpack size={12} />
                <span>Poids total</span>
              </div>
              <p className="text-xs font-mono font-bold text-[#17402C]">
                {formatWeight(depart.totalPackWeightG)}{' '}
                <span className="text-[10px] text-[#5A7064] font-normal font-sans">(base {formatWeight(depart.baseWeightG)})</span>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
              <div className="flex items-center gap-1 text-[#5A7064] text-[10px] font-semibold uppercase">
                <Droplets size={12} />
                <span>Vivres</span>
              </div>
              <p className="text-xs font-bold text-[#17402C]">
                {depart.durationDays}j autonomie
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
              <div className="flex items-center gap-1 text-[#5A7064] text-[10px] font-semibold uppercase">
                <Thermometer size={12} />
                <span>Météo J-1</span>
              </div>
              <p className="text-xs font-mono font-bold text-[#17402C]">
                {weather ? `${weather.current.tempC}°C` : 'Non disponible'}
              </p>
            </div>
          </div>

          {/* Contact d'urgence ICE & Équipe */}
          <div className="p-3.5 rounded-2xl bg-[#8A241B]/8 border border-[#8A241B]/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck size={18} className="text-[#8A241B] shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A241B]">
                  Contact de sécurité ICE
                </p>
                <p className="text-xs font-mono font-bold text-[#17402C] truncate">
                  {depart.emergencyContact || 'Non renseigné'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 text-[11px] text-[#5A7064]">
              <span>Équipe : <strong>{depart.participants.length} randonneur(s)</strong></span>
            </div>
          </div>

          {/* Checklist des vitaux validés */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A7064] flex items-center gap-1.5">
              <Check size={13} className="text-[#2D6B4A]" />
              <span>Équipements et vivres validés ({vitalItems.length})</span>
            </h3>
            <div className="max-h-36 overflow-y-auto no-scrollbar grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/50 border border-black/5">
              {vitalItems.map((item) => (
                <div key={item.id ?? item.name} className="flex items-center gap-1.5 text-xs text-[#17402C] p-1 truncate">
                  <Check size={11} className="text-[#2D6B4A] shrink-0" />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions : Imprimer, Partager, Bascule de statut */}
          <div className="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Printer size={13} />
                <span>Imprimer</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 transition-colors cursor-pointer"
              >
                {copied ? <Check size={13} /> : <Share2 size={13} />}
                <span>{copied ? 'Copié !' : 'Partager'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {currentStatus !== 'active' ? (
                <button
                  type="button"
                  onClick={() => handleToggleStatus('active')}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#17402C] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#17402C]/90 transition-all cursor-pointer"
                >
                  <PlayAnimated size={12} />
                  <span>Démarrer le trek (Mode Actif)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleStatus('done')}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#2D6B4A] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#2D6B4A]/90 transition-all cursor-pointer"
                >
                  <RotateCcwAnimated size={12} />
                  <span>Terminer et archiver le trek</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
