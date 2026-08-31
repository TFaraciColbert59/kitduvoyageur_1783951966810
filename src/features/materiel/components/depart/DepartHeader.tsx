'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Backpack, CheckCircle2, AlertTriangle, Zap, ArrowRight, Check, MapPin, Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Sparkles } from 'lucide-react';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { UsersIcon as Users } from '@/components/icons/users';
import { CalendarIcon as Calendar } from '@/components/icons/calendar';
import { Edit2Icon as Edit2 } from '@/components/icons/edit-2';
import { XIcon as X } from '@/components/icons/x';
import { ClockIcon as Clock } from '@/components/icons/clock';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { formatDistanceKm } from '@/features/materiel/domain/departCalculations';
import { updateDepartMeta } from '@/features/materiel/actions/updateDepartMeta';
import { cn } from '@/lib/utils';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

interface DepartHeaderProps {
  depart: DepartDetail;
  weather?: WeatherForecast | null;
  kits?: { id: string; name: string }[];
  isRealKit?: boolean;
  onOpenDepartureSheet?: () => void;
}

function cleanText(text: string): string {
  return (text || '').replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim();
}

function getWeatherIcon(code?: number) {
  if (code === undefined || code === null) return Sun;
  if (code === 0) return Sun;
  if (code <= 3) return CloudSun;
  if (code <= 48) return CloudFog;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 86) return CloudRain;
  return CloudLightning;
}

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return 'En direct';
  try {
    const diffMin = Math.round((Date.now() - new Date(isoString).getTime()) / (1000 * 60));
    if (diffMin < 2) return 'Actualisé à l’instant';
    if (diffMin < 60) return `Actualisé il y a ${diffMin} min`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `Actualisé il y a ${diffHours}h`;
    return `Actualisé il y a ${Math.round(diffHours / 24)}j`;
  } catch {
    return 'En direct';
  }
}

export function DepartHeader({
  depart,
  weather,
  kits = [],
  isRealKit = true,
  onOpenDepartureSheet,
}: DepartHeaderProps) {
  const router = useRouter();
  const cleanDest = cleanText(depart.destination);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(cleanDest);
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

  // Calcul du compte à rebours humain (J-X)
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
    ? 'Demain (J-1)'
    : diffDays > 1
    ? `Dans ${diffDays} jours (J-${diffDays})`
    : 'Date passée';

  // Météo express pictogramme
  const currentWeather = weather?.current ?? (weather?.days?.[0] ? {
    tempC: Math.round((weather.days[0].tempMinC + weather.days[0].tempMaxC) / 2),
    weathercode: weather.days[0].weathercode,
  } : null);
  const WeatherIconComp = getWeatherIcon(currentWeather?.weathercode);

  // Participants & groupe
  const participantsCount = depart.participants.length || 1;
  const groupLabel = participantsCount === 1 ? 'Solo' : `${participantsCount} pers.`;

  // Swipe navigation entre départs sur mobile
  const currentKitIndex = kits.findIndex((k) => k.id === depart.id);
  const handleSwipe = (direction: 'left' | 'right') => {
    if (kits.length <= 1 || currentKitIndex === -1) return;
    if (direction === 'left' && currentKitIndex < kits.length - 1) {
      router.push(`/materiel/depart/${kits[currentKitIndex + 1].id}`);
    } else if (direction === 'right' && currentKitIndex > 0) {
      router.push(`/materiel/depart/${kits[currentKitIndex - 1].id}`);
    }
  };

  // CTA State Machine (§4A & §5)
  let ctaLabel = 'Compléter mon sac';
  let ctaIcon = ArrowRight;
  let ctaAction = () => {
    const el = document.getElementById('section-depart-checklist');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  if (score.status === 'critical' && score.missingVitals.length > 0) {
    ctaLabel = `Compléter mon sac (${score.missingVitals.length} vital manquant${score.missingVitals.length > 1 ? 's' : ''})`;
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
    ctaLabel = `Compléter mon sac (${remainingCount} restant${remainingCount > 1 ? 's' : ''})`;
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

  const CtaIcon = ctaIcon;

  const handleSaveName = () => {
    setIsEditingName(false);
    const sanitized = cleanText(nameInput);
    if (!sanitized || sanitized === cleanDest) return;

    if (isRealKit) {
      startTransition(async () => {
        await updateDepartMeta({ kitId: depart.id, name: sanitized });
      });
    }
  };

  const handleSaveDate = () => {
    setIsEditingDate(false);
    if (!dateInput) return;

    if (isRealKit) {
      startTransition(async () => {
        await updateDepartMeta({ kitId: depart.id, startsAt: new Date(dateInput).toISOString() });
      });
    }
  };

  const baseKg = (depart.baseWeightG / 1000).toFixed(1);
  const totalPackKg = (depart.totalPackWeightG / 1000).toFixed(1);

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="depart-main-heading" className="overflow-hidden relative">
      {/* ════ FOND DE COUVERTURE VISUELLE (PHASE 1) ════ */}
      {depart.coverImageUrl ? (
        <div className="absolute inset-0 h-28 sm:h-32 w-full overflow-hidden pointer-events-none opacity-25 dark:opacity-20 mask-gradient-b">
          <Image
            src={depart.coverImageUrl}
            alt={cleanDest}
            fill
            className="object-cover object-center"
            priority
            sizes="(max-width: 768px) 100vw, 800px"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F7F9F6]/80 to-[#F7F9F6] dark:via-[#111A15]/80 dark:to-[#111A15]" />
        </div>
      ) : (
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-br from-[#17402C]/10 via-[#2D6B4A]/5 to-transparent rounded-bl-full pointer-events-none" />
      )}

      {/* Conteneur principal avec support de swipe mobile */}
      <motion.div
        drag={kits.length > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onPanEnd={(_, info) => {
          if (info.offset.x < -60) handleSwipe('left');
          else if (info.offset.x > 60) handleSwipe('right');
        }}
        className="p-4 sm:p-5 space-y-3.5 relative z-10"
      >
        {/* ════ LIGNE 1 : Surtitre avec Fraîcheur & Activité + Badge Statut ════ */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-[10px] sm:text-[11px] font-semibold text-[#5A7064]">
              <span className="uppercase tracking-wider font-bold text-[#17402C]">
                Cockpit de départ
              </span>
              <span>•</span>
              {depart.activityType && (
                <span className="px-1.5 py-0.2 rounded-md bg-[#17402C]/10 text-[#17402C] font-medium">
                  {depart.activityType}
                </span>
              )}
              <span className="flex items-center gap-1 opacity-80" title="Dernière actualisation des données">
                <Clock size={10} />
                <span>{formatRelativeTime(depart.updatedAt)}</span>
              </span>
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-1.5 max-w-md pt-0.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-2.5 py-1 rounded-xl text-base sm:text-lg font-display font-bold text-[#17402C] bg-white/90 border border-[#17402C]/30 focus:outline-none w-full"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="p-1.5 rounded-xl bg-[#17402C] text-white hover:bg-[#17402C]/90 cursor-pointer"
                  aria-label="Valider le nom"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="p-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-[#5A7064] cursor-pointer"
                  aria-label="Annuler"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group pt-0.5">
                <h1
                  id="depart-main-heading"
                  className="text-lg sm:text-xl md:text-2xl font-display font-bold text-[#17402C] leading-tight truncate"
                >
                  {cleanDest}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-lg hover:bg-white/40 text-[#5A7064] hover:text-[#17402C] transition-opacity cursor-pointer opacity-70 group-hover:opacity-100"
                  title="Renommer la destination"
                  aria-label="Modifier le nom de la destination"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            )}

            {/* Sous-titre : Tracé lié + Effectif du groupe */}
            <div className="flex items-center gap-2.5 text-xs text-[#5A7064] flex-wrap">
              {depart.trail ? (
                <span className="flex items-center gap-1 font-medium text-[#17402C]">
                  <MapPin size={11} className="text-[#2D6B4A]" />
                  <span>{depart.trail.name} ({formatDistanceKm(depart.trail.distance_km)})</span>
                </span>
              ) : (
                <span className="text-[11.5px] italic text-[#5A7064] flex items-center gap-1">
                  <Compass size={11} />
                  <span>Checklist autonome · Aucun tracé lié</span>
                </span>
              )}

              <span className="flex items-center gap-1 font-medium text-[#17402C] bg-white/40 px-1.5 py-0.2 rounded-md">
                <Users size={11} className="text-[#5A7064]" />
                <span>{groupLabel}</span>
              </span>
            </div>

            {/* Rappel discret de trek comparable (§Phase 1) */}
            {depart.comparableTrip && (
              <div className="pt-0.5 flex items-center gap-1.5 text-[11px] text-[#2D6B4A] font-medium">
                <Sparkles size={11} className="shrink-0" />
                <span>
                  {depart.comparableTrip.name} ({depart.comparableTrip.timeAgo}) · {depart.comparableTrip.similarity}
                </span>
              </div>
            )}
          </div>

          {/* Badge statut explicite */}
          <div className="shrink-0 self-start">
            <Badge tone={statusTone}>
              <span className="text-xs font-bold font-sans">
                {score.status === 'ok'
                  ? '✓ Prêt pour le départ'
                  : score.status === 'warning'
                  ? '⚠️ À finaliser'
                  : '⛔ Critique — Départ déconseillé'}
              </span>
            </Badge>
          </div>
        </div>

        {/* Pagination par points sur mobile si plusieurs kits */}
        {kits.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-0.5 md:hidden">
            {kits.map((k, idx) => (
              <button
                key={k.id}
                type="button"
                onClick={() => router.push(`/materiel/depart/${k.id}`)}
                className={cn(
                  'h-1.5 rounded-full transition-all cursor-pointer',
                  k.id === depart.id ? 'w-5 bg-[#17402C]' : 'w-1.5 bg-black/20 hover:bg-black/40'
                )}
                aria-label={`Aller au départ ${cleanText(k.name)}`}
              />
            ))}
          </div>
        )}

        {/* ════ LIGNE 2 : Barre de Progression Pondérée ════ */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#5A7064]">
            <span>Préparation du pack</span>
            <span className="font-mono font-bold text-[#17402C]">{score.percentage}%</span>
          </div>

          <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
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

        {/* ════ LIGNE 3 : 3 Chiffres vitaux en grille équilibrée ════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Métrique 1 : Date & Météo Express J-X */}
          <div className="glass-sub-card p-3 rounded-2xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/50 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0 shadow-2xs">
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
                  className="text-[9.5px] text-[#5A7064] hover:text-[#17402C] cursor-pointer"
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
                    className="p-1 rounded bg-[#17402C] text-white cursor-pointer"
                  >
                    <Check size={11} />
                  </button>
                </div>
              ) : (
                <div className="text-xs sm:text-[12.5px] font-bold text-[#17402C] truncate flex items-center gap-1.5">
                  {isLast24Hours ? (
                    <div className="font-mono text-xs">
                      <CountdownLive target={depart.startsAt} />
                    </div>
                  ) : (
                    <span>{humanDateText}</span>
                  )}
                  {currentWeather && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#2D6B4A] bg-emerald-50/80 px-1.5 py-0.2 rounded-full shrink-0">
                      <WeatherIconComp size={11} />
                      <span>{currentWeather.tempC}°C</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Métrique 2 : Poids au dos */}
          <div className="glass-sub-card p-3 rounded-2xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/50 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0 shadow-2xs">
              <Backpack size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] block">
                Poids au dos
              </span>
              <div className="text-xs sm:text-[12.5px] font-mono font-bold text-[#17402C] truncate">
                {totalPackKg} kg{' '}
                <span className="text-[10px] font-sans font-normal text-[#5A7064]">
                  (base {baseKg}k)
                </span>
              </div>
            </div>
          </div>

          {/* Métrique 3 : Articles prêts & Autonomie */}
          <div className="glass-sub-card p-3 rounded-2xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/50 border border-white/60 flex items-center justify-center text-[#17402C] shrink-0 shadow-2xs">
              <CheckCircle2 size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[#5A7064] block">
                Articles & Autonomie
              </span>
              <div className="text-xs sm:text-[12.5px] font-bold text-[#17402C] truncate">
                {checkedCount}/{totalCount}{' '}
                <span className="text-[10px] font-medium text-[#5A7064]">
                  · {depart.durationDays}j vivres
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ════ LIGNE 4 : CTA Contextuel Unique & Large ════ */}
        <div className="pt-1">
          <button
            type="button"
            onClick={ctaAction}
            className={cn(
              'w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer',
              score.status === 'ok'
                ? 'bg-[#17402C] text-white hover:bg-[#17402C]/90 hover:scale-[1.005]'
                : score.status === 'warning'
                ? 'bg-[#2D6B4A] text-white hover:bg-[#2D6B4A]/90 hover:scale-[1.005]'
                : 'bg-[#8A241B] text-white hover:bg-[#8A241B]/90 hover:scale-[1.005]'
            )}
          >
            <CtaIcon size={16} className="shrink-0" />
            <span className="truncate">{ctaLabel}</span>
          </button>
        </div>
      </motion.div>
    </GlassCard>
  );
}
