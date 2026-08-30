'use client';
import { useState, useTransition } from 'react';
import {
  Calendar,
  Backpack,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  Edit2,
  Check,
  X,
  MapPin,
  Clock,
  Droplets,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { formatDistanceKm, formatWeight } from '@/features/materiel/domain/departCalculations';
import { updateDepartMeta } from '@/features/materiel/actions/updateDepartMeta';
import { cn } from '@/lib/utils';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

interface DepartHeaderProps {
  depart: DepartDetail;
  isRealKit?: boolean;
  onOpenDepartureSheet?: () => void;
}

export function DepartHeader({ depart, isRealKit = true, onOpenDepartureSheet }: DepartHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(depart.destination);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(
    depart.startsAt ? new Date(depart.startsAt).toISOString().split('T')[0] : ''
  );
  const [isPending, startTransition] = useTransition();

  const checkedCount = depart.assignedKit.items.filter((i) => i.is_checked).length;
  const totalCount = depart.assignedKit.items.length;
  const remainingCount = totalCount - checkedCount;

  const score = depart.readinessScore;
  const statusTone = score.status === 'ok' ? 'sage' : score.status === 'warning' ? 'warn' : 'danger';

  // Calcul du compte à rebours humain
  const targetDate = depart.startsAt ? new Date(depart.startsAt) : null;
  const diffDays = targetDate
    ? Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isLast24Hours = diffDays !== null && diffDays <= 1 && diffDays >= 0;
  const humanDateText = diffDays === null
    ? 'Date à définir'
    : diffDays === 0
    ? 'Aujourd’hui'
    : diffDays === 1
    ? 'Demain'
    : diffDays > 1
    ? `Dans ${diffDays} jours`
    : 'Date passée';

  // CTA State Machine (§4A & §5)
  let ctaLabel = 'Compléter mon sac';
  let ctaIcon = ArrowRight;
  let ctaAction = () => {
    const el = document.getElementById('section-depart-checklist');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  if (score.status === 'critical' && score.missingVitals.length > 0) {
    ctaLabel = `Compléter mon sac (${score.missingVitals.length} vitaux manquants)`;
    ctaIcon = Zap;
    ctaAction = () => {
      const el = document.getElementById('section-depart-checklist');
      el?.scrollIntoView({ behavior: 'smooth' });
    };
  } else if (score.status === 'critical') {
    ctaLabel = 'Vérifier les alertes critiques';
    ctaIcon = AlertTriangle;
    ctaAction = () => {
      const el = document.getElementById('section-depart-alerts');
      el?.scrollIntoView({ behavior: 'smooth' });
    };
  } else if (remainingCount > 0) {
    ctaLabel = `Compléter mon sac (${remainingCount} restants)`;
    ctaIcon = ArrowRight;
    ctaAction = () => {
      const el = document.getElementById('section-depart-checklist');
      el?.scrollIntoView({ behavior: 'smooth' });
    };
  } else {
    ctaLabel = 'Tout est prêt ✓ Voir la fiche de départ';
    ctaIcon = CheckCircle2;
    ctaAction = () => {
      if (onOpenDepartureSheet) {
        onOpenDepartureSheet();
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open-departure-sheet'));
      }
    };
  }

  // Sauvegarde inline du nom
  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    setIsEditingName(false);
    if (!isRealKit) return;

    startTransition(async () => {
      await updateDepartMeta({ kitId: depart.id, name: nameInput.trim() });
    });
  };

  // Sauvegarde inline de la date
  const handleSaveDate = () => {
    setIsEditingDate(false);
    if (!isRealKit) return;

    startTransition(async () => {
      const isoDate = dateInput ? new Date(dateInput).toISOString() : null;
      await updateDepartMeta({ kitId: depart.id, startsAt: isoDate });
    });
  };

  const totalPackKg = (depart.totalPackWeightG / 1000).toFixed(1);
  const baseKg = (depart.baseWeightG / 1000).toFixed(1);
  const consumablesKg = (depart.consumablesWeightG / 1000).toFixed(1);

  const CtaIcon = ctaIcon;

  return (
    <GlassCard tone={statusTone} as="article" ariaLabelledBy="depart-heading" className="w-full">
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* ════ LIGNE 1 : Eyebrow + Titre éditable + Badge statut explicite ════ */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Eyebrow>Cockpit de départ</Eyebrow>
              {depart.trail && (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#5A7064] bg-white/30 px-2 py-0.5 rounded-full">
                  <MapPin size={10} className="text-[#2D6B4A]" />
                  <span className="truncate max-w-[200px]">{depart.trail.name}</span>
                  {depart.trail.distance_km && (
                    <span className="font-mono text-[10px] opacity-80">
                      ({formatDistanceKm(depart.trail.distance_km)})
                    </span>
                  )}
                </span>
              )}
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-2.5 py-1 rounded-xl text-base sm:text-xl font-display font-bold text-[#17402C] bg-white/70 border border-[#17402C]/30 focus:outline-none focus:ring-2 focus:ring-[#17402C] w-full max-w-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="p-1.5 rounded-lg bg-[#17402C] text-white hover:bg-[#17402C]/90"
                  aria-label="Enregistrer le titre"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(depart.destination);
                    setIsEditingName(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/50 text-[#5A7064] hover:bg-white/80"
                  aria-label="Annuler la modification"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1
                  id="depart-heading"
                  className="text-lg sm:text-2xl font-display font-bold tracking-tight text-[#17402C] leading-tight truncate"
                >
                  {depart.destination}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#5A7064] hover:text-[#17402C] rounded"
                  aria-label="Renommer la destination"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Badge textuel explicite (jamais la couleur seule) */}
          <div className="shrink-0 mt-0.5">
            <Badge tone={statusTone}>
              <span className="flex items-center gap-1 font-bold text-[10.5px] sm:text-[12px] whitespace-nowrap">
                {score.status === 'ok' && '✓ '}
                {score.status === 'warning' && '⚠️ '}
                {score.status === 'critical' && '⛔ '}
                <span>{score.label}</span>
              </span>
            </Badge>
          </div>
        </div>

        {/* ════ LIGNE 2 : Barre de progression pondérée ════ */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#5A7064]">
            <span className="flex items-center gap-1">
              <span>Préparation du pack</span>
              {score.missingVitals.length > 0 && (
                <span className="text-[#8A241B] font-bold text-[10.5px]">
                  ({score.missingVitals.length} vital manquant)
                </span>
              )}
            </span>
            <span className="font-mono font-bold text-[#17402C] tabular-nums">
              {score.percentage}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden p-0.5">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                score.status === 'ok'
                  ? 'bg-[#2D6B4A]'
                  : score.status === 'warning'
                  ? 'bg-[#8C6418]'
                  : 'bg-[#8A241B]'
              )}
              style={{ width: `${score.percentage}%` }}
              role="progressbar"
              aria-valuenow={score.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* ════ LIGNE 3 : 3 Chiffres vitaux + Date humaine + CTA Unique ════ */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Métrique 1 : Date & Compte à rebours */}
          <div className="glass-sub-card p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/40 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0">
              <Calendar size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064]">
                  Départ
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingDate(true)}
                  className="text-[9.5px] text-[#5A7064] hover:text-[#17402C]"
                  aria-label="Modifier la date"
                >
                  <Edit2 size={10} />
                </button>
              </div>

              {isEditingDate ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="px-1.5 py-0.5 rounded text-[11px] font-mono text-[#17402C] bg-white/80 border border-[#17402C]/30 w-full"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveDate}
                    className="p-1 rounded bg-[#17402C] text-white"
                  >
                    <Check size={11} />
                  </button>
                </div>
              ) : (
                <div className="text-xs sm:text-[13px] font-bold text-[#17402C] truncate">
                  {isLast24Hours ? (
                    <div className="font-mono text-xs">
                      <CountdownLive target={depart.startsAt} />
                    </div>
                  ) : (
                    <span>{humanDateText}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Métrique 2 : Poids au dos */}
          <div className="glass-sub-card p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/40 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0">
              <Backpack size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] block">
                Poids au dos
              </span>
              <div className="text-xs sm:text-[13px] font-mono font-bold text-[#17402C] truncate">
                {totalPackKg} kg{' '}
                <span className="text-[10px] font-sans font-normal text-[#5A7064]">
                  (base {baseKg}k)
                </span>
              </div>
            </div>
          </div>

          {/* Métrique 3 : Articles prêts & Autonomie */}
          <div className="glass-sub-card p-2.5 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/40 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0">
              <CheckCircle2 size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] block">
                Articles & Autonomie
              </span>
              <div className="text-xs sm:text-[13px] font-bold text-[#17402C] truncate">
                {checkedCount}/{totalCount}{' '}
                <span className="text-[10px] font-medium text-[#5A7064]">
                  · {depart.durationDays}j vivres
                </span>
              </div>
            </div>
          </div>

          {/* CTA Contextuel Unique (§4A) */}
          <div className="sm:col-span-1 flex items-center">
            <button
              type="button"
              onClick={ctaAction}
              className={cn(
                'w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer',
                score.status === 'ok'
                  ? 'bg-[#17402C] text-white hover:bg-[#17402C]/90 hover:scale-[1.01]'
                  : score.status === 'warning'
                  ? 'bg-[#2D6B4A] text-white hover:bg-[#2D6B4A]/90'
                  : 'bg-[#8A241B] text-white hover:bg-[#8A241B]/90'
              )}
            >
              <CtaIcon size={14} className="shrink-0" />
              <span className="truncate">{ctaLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
