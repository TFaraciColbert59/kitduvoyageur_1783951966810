'use client';
import Icon from '@/components/ui/Icon';
import { useState, useTransition } from 'react';
import { PlayIcon as PlayAnimated } from '@/components/icons/play';
import { RotateCCWIcon as RotateCcwAnimated } from '@/components/icons/rotate-ccw';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
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
    <GlassDrawer
      open={isOpen}
      onOpenChange={(v) => !v && onClose()}
      title="Fiche officielle"
      titleId="departure-sheet-title"
      width={560}
    >
      <div className="space-y-4 font-sans text-[var(--lkv-primary)]">
        {/* En-tête de la Fiche : statut, destination, sentier */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
            <span>Fiche officielle de départ</span>
            <span>·</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full font-bold',
                currentStatus === 'active'
                  ? 'bg-[var(--lkv-warning)]/20 text-[var(--lkv-warning)]'
                  : 'bg-[var(--lkv-success)]/20 text-[var(--lkv-success)]'
              )}
            >
              {currentStatus === 'active'
                ? 'En cours de trek'
                : currentStatus === 'done'
                  ? 'Trek terminé'
                  : 'Prêt pour le départ'}
            </span>
          </div>
          <p className="text-xl font-display font-bold leading-tight text-[var(--lkv-primary)]">
            {depart.destination}
          </p>
          {depart.trail && (
            <p className="text-xs text-[var(--lkv-text-muted)] flex items-center gap-1">
              <Icon name="map-pin" size={12} className="text-[var(--lkv-primary-hover)]" />
              <span>
                {depart.trail.name} ({formatDistanceKm(depart.trail.distance_km)})
              </span>
            </p>
          )}
        </div>

        {/* Grille des paramètres vitaux */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[var(--lkv-text-muted)] text-[10px] font-semibold uppercase">
              <Icon name="calendar" size={12} />
              <span>Date</span>
            </div>
            <p className="text-xs font-bold text-[var(--lkv-primary)] truncate">{dateLabel}</p>
          </div>

          <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[var(--lkv-text-muted)] text-[10px] font-semibold uppercase">
              <Icon name="backpack" size={12} />
              <span>Poids total</span>
            </div>
            <p className="text-xs font-mono font-bold text-[var(--lkv-primary)]">
              {formatWeight(depart.totalPackWeightG)}{' '}
              <span className="text-[10px] text-[var(--lkv-text-muted)] font-normal font-sans">
                (base {formatWeight(depart.baseWeightG)})
              </span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[var(--lkv-text-muted)] text-[10px] font-semibold uppercase">
              <Icon name="droplets" size={12} />
              <span>Vivres</span>
            </div>
            <p className="text-xs font-bold text-[var(--lkv-primary)]">
              {depart.durationDays}j autonomie
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/70 border border-black/5 space-y-0.5">
            <div className="flex items-center gap-1 text-[var(--lkv-text-muted)] text-[10px] font-semibold uppercase">
              <Icon name="thermometer" size={12} />
              <span>Météo J-1</span>
            </div>
            <p className="text-xs font-mono font-bold text-[var(--lkv-primary)]">
              {weather ? `${weather.current.tempC}°C` : 'Non disponible'}
            </p>
          </div>
        </div>

        {/* Contact d'urgence ICE & Équipe */}
        <div className="p-3.5 rounded-2xl bg-[var(--lkv-danger)]/8 border border-[var(--lkv-danger)]/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon name="shield-check" size={18} className="text-[var(--lkv-danger)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lkv-danger)]">
                Contact de sécurité ICE
              </p>
              <p className="text-xs font-mono font-bold text-[var(--lkv-primary)] truncate">
                {depart.emergencyContact || 'Non renseigné'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 text-[11px] text-[var(--lkv-text-muted)]">
            <span>
              Équipe : <strong>{depart.participants.length} randonneur(s)</strong>
            </span>
          </div>
        </div>

        {/* Checklist des vitaux validés */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1.5">
            <Icon name="check" size={13} className="text-[var(--lkv-primary-hover)]" />
            <span>Équipements et vivres validés ({vitalItems.length})</span>
          </h3>
          <div className="max-h-36 overflow-y-auto no-scrollbar grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/50 border border-black/5">
            {vitalItems.map((item) => (
              <div
                key={item.id ?? item.name}
                className="flex items-center gap-1.5 text-xs text-[var(--lkv-primary)] p-1 truncate"
              >
                <Icon
                  name="check"
                  size={11}
                  className="text-[var(--lkv-primary-hover)] shrink-0"
                />
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
              onClick={() => window['print']()}
              className="px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 transition-colors cursor-pointer"
            >
              <Icon name="printer" size={13} />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 transition-colors cursor-pointer"
            >
              {copied ? <Icon name="check" size={13} /> : <Icon name="share2" size={13} />}
              <span>{copied ? 'Copié !' : 'Partager'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentStatus !== 'active' ? (
              <button
                type="button"
                onClick={() => handleToggleStatus('active')}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-[var(--lkv-primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[var(--lkv-primary)]/90 transition-all cursor-pointer"
              >
                <PlayAnimated size={12} />
                <span>Démarrer le trek (Mode Actif)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleStatus('done')}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-[var(--lkv-primary-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[var(--lkv-primary-hover)]/90 transition-all cursor-pointer"
              >
                <RotateCcwAnimated size={12} />
                <span>Terminer et archiver le trek</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassDrawer>
  );
}
