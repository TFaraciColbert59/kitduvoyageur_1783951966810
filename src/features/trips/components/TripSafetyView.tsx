'use client';

import React, { useState, useTransition } from 'react';
import { TripFull, TripSafetyCheckpoint } from '../types/trip.types';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Shield, CheckCircle2, Clock, AlertTriangle, PhoneCall, Radio, Plus } from 'lucide-react';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { checkTripSafetyPoint } from '../actions/checkTripSafetyPoint';

interface TripSafetyViewProps {
  trip: TripFull;
}

const STATUS_CONFIG: Record<
  TripSafetyCheckpoint['status'],
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'En attente',
    bg: 'bg-[var(--lkv-warning)]/10 text-[var(--lkv-warning)] border-[var(--lkv-warning)]/20',
    text: 'text-[var(--lkv-warning)]',
    icon: <Clock size={14} />,
  },
  checked: {
    label: 'Validé',
    bg: 'bg-[var(--lkv-success)]/10 text-[var(--lkv-success)] border-[var(--lkv-success)]/20',
    text: 'text-[var(--lkv-success)]',
    icon: <CheckCircle2 size={14} />,
  },
  missed: {
    label: 'En retard',
    bg: 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)] border-[var(--lkv-danger)]/20',
    text: 'text-[var(--lkv-danger)]',
    icon: <AlertTriangle size={14} />,
  },
  alert_sent: {
    label: 'Alerte envoyée',
    bg: 'bg-[var(--lkv-danger)]/15 text-[var(--lkv-danger)] border-[var(--lkv-danger)]/30',
    text: 'text-[var(--lkv-danger)]',
    icon: <Radio size={14} />,
  },
};

/** Poids de criticité (plus bas = plus critique, affiché en premier). */
const STATUS_WEIGHT: Record<TripSafetyCheckpoint['status'], number> = {
  alert_sent: 0,
  missed: 1,
  pending: 2,
  checked: 3,
};

/** Tri : criticité puis horaire programmé le plus proche. */
function sortCheckpoints(checkpoints: TripSafetyCheckpoint[]): TripSafetyCheckpoint[] {
  return [...checkpoints].sort((a, b) => {
    const weightDiff = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
    if (weightDiff !== 0) return weightDiff;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });
}

export function TripSafetyView({ trip }: TripSafetyViewProps) {
  const [infoNote, setInfoNote] = useState(false);
  const [checkpoints, setCheckpoints] = useState<TripSafetyCheckpoint[]>(trip.safety_checkpoints || []);
  const [isPending, startTransition] = useTransition();
  const [pointerError, setPointerError] = useState<string | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const sortedCheckpoints = React.useMemo(
    () => sortCheckpoints(checkpoints),
    [checkpoints]
  );

  // Pointage persistant : UI optimiste + revert si l'action serveur échoue.
  const handleCheckIn = (cpId: string) => {
    triggerHaptic('success');
    let snapshot: TripSafetyCheckpoint | undefined;
    setCheckpoints(prev => {
      snapshot = prev.find(c => c.id === cpId);
      return prev.map(c => (c.id === cpId ? { ...c, status: 'checked' as const, checked_at: new Date().toISOString() } : c));
    });

    startTransition(async () => {
      const res = await checkTripSafetyPoint(trip.id, cpId, trip.slug);
      if (!res.ok) {
        if (snapshot) {
          setCheckpoints(prev => prev.map(c => (c.id === cpId ? snapshot! : c)));
        }
        setPointerError(res.error ?? 'Pointage impossible pour le moment.');
      } else {
        setPointerError(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {pointerError && (
        <p role="alert" className="glass rounded-xl border border-[var(--lkv-danger)]/30 bg-[var(--lkv-danger)]/10 px-3 py-2 text-xs font-semibold text-[var(--lkv-danger)]">
          {pointerError}
        </p>
      )}
      {/* En-tête Sécurité & Checkpoints */}
      <div className="flex items-center justify-between gap-4">
        {trip.permissions.canEdit && (
          <GlassCapsuleBtn
            variant="secondary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setInfoNote(true)}
          >
            Nouveau point
          </GlassCapsuleBtn>
        )}
      </div>
      {infoNote && (
        <div className="p-3 rounded-2xl glass tone-info text-xs text-[var(--lkv-info)] flex items-center gap-2">
          <Shield size={16} className="shrink-0" />
          <span>La configuration de nouveaux points de contrôle sera disponible prochainement.</span>
        </div>
      )}

      {/* Liste des checkpoints ou état vide */}
      {sortedCheckpoints.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-display text-xs font-bold text-lkv-primary px-1">
            Points de passage programmés ({sortedCheckpoints.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedCheckpoints.map(cp => {
              const statusCfg = STATUS_CONFIG[cp.status] || STATUS_CONFIG.pending;
              const isCritical = cp.status === 'missed' || cp.status === 'alert_sent';
              return (
                <GlassCard
                  key={cp.id}
                  tone={isCritical ? 'danger' : 'neutral'}
                  className="p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-base text-lkv-primary">{cp.label}</div>
                      <div className="text-xs text-lkv-secondary mt-1 flex items-center gap-1.5">
                        <Clock size={13} />
                        {new Date(cp.scheduled_at).toLocaleString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {cp.contact_name && (
                        <div className="text-xs text-lkv-secondary mt-2 flex items-center gap-1.5">
                          <PhoneCall size={12} />
                          <span>Contact : {cp.contact_name}</span>
                          {cp.contact_phone && <span className="text-lkv-primary font-medium">({cp.contact_phone})</span>}
                        </div>
                      )}
                      {cp.notes && (
                        <p className="text-xs text-lkv-secondary/90 italic mt-2">
                          « {cp.notes} »
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 shrink-0 ${statusCfg.bg}`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                      {cp.status !== 'checked' && trip.permissions.canEdit && (
                        <button
                          type="button"
                          onClick={() => handleCheckIn(cp.id)}
                          className="min-h-[44px] px-3 py-1.5 rounded-full text-xs font-semibold glass-sub-card border border-white/60 hover:bg-white text-[var(--lkv-primary)] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                          aria-label={`Pointer le passage : ${cp.label}`}
                        >
                          <CheckCircle2 size={13} className="text-[var(--lkv-success)]" />
                          <span>Pointer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Radio className="w-8 h-8" />}
          title="Aucun point de contrôle configuré"
          description="Définissez des points de passage clés pour sécuriser votre progression et transmettre vos alertes en cas d'imprévu."
        />
      )}

      {/* Rappels de sécurité & Urgences */}
      <GlassCard tone="neutral" blur="sm" className="p-6 rounded-[var(--lkv-radius-card)] border border-white/60">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-lkv-primary/10 text-lkv-primary">
            <PhoneCall size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-lkv-primary">
              Numéros d&apos;urgence & Consignes terrain
            </h3>
            <p className="text-xs sm:text-sm text-lkv-secondary mt-1 leading-relaxed">
              En Europe, composez le <strong>112</strong> en cas d&apos;urgence vitale (accessible même sans réseau de votre opérateur). Pour les alertes par SMS en zone blanche ou silencieuse, envoyez un message au <strong>114</strong>. En montagne, vérifiez toujours les prévisions météo locales avant le départ.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
