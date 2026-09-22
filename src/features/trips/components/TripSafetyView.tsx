'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { TripFull, TripSafetyCheckpoint } from '../types/trip.types';
import { Badge, Button, Card, EmptyState, type BadgeTone } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { checkTripSafetyPoint } from '../actions/checkTripSafetyPoint';

interface TripSafetyViewProps {
  trip: TripFull;
}

const STATUS_CONFIG: Record<
  TripSafetyCheckpoint['status'],
  { label: string; tone: BadgeTone; icon: React.ReactNode }
> = {
  pending: {
    label: 'En attente',
    tone: 'warn',
    icon: <Icon name="clock" size={14} />,
  },
  checked: {
    label: 'Validé',
    tone: 'sage',
    icon: <Icon name="check-circle2" size={14} />,
  },
  missed: {
    label: 'En retard',
    tone: 'danger',
    icon: <Icon name="alert-triangle" size={14} />,
  },
  alert_sent: {
    label: 'Alerte envoyée',
    tone: 'danger',
    icon: <Icon name="radio" size={14} />,
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
  const [checkpoints, setCheckpoints] = useState<TripSafetyCheckpoint[]>(
    trip.safety_checkpoints || []
  );
  const [isPending, startTransition] = useTransition();
  const [pointerError, setPointerError] = useState<string | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const sortedCheckpoints = React.useMemo(() => sortCheckpoints(checkpoints), [checkpoints]);

  // Pointage persistant : UI optimiste + revert si l'action serveur échoue.
  const handleCheckIn = (cpId: string) => {
    triggerHaptic('success');
    let snapshot: TripSafetyCheckpoint | undefined;
    setCheckpoints((prev) => {
      snapshot = prev.find((c) => c.id === cpId);
      return prev.map((c) =>
        c.id === cpId
          ? { ...c, status: 'checked' as const, checked_at: new Date().toISOString() }
          : c
      );
    });

    startTransition(async () => {
      const res = await checkTripSafetyPoint(trip.id, cpId, trip.slug);
      if (!res.ok) {
        if (snapshot) {
          setCheckpoints((prev) => prev.map((c) => (c.id === cpId ? snapshot! : c)));
        }
        setPointerError(res.error ?? 'Pointage impossible pour le moment.');
      } else {
        setPointerError(null);
      }
    });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      {pointerError && (
        <Card
          role="alert"
          tone="danger"
          className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-danger-dark)]"
        >
          {pointerError}
        </Card>
      )}
      {/* En-tête Sécurité & Checkpoints */}
      <div className="flex items-center justify-between gap-[var(--space-4)]">
        {trip.permissions.canEdit && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="plus" size={16} />}
            onClick={() => setInfoNote(true)}
          >
            Nouveau point
          </Button>
        )}
      </div>
      {infoNote && (
        <Card tone="info" className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-info)]">
          <Icon name="shield" size={16} className="shrink-0" />
          <span>
            La configuration de nouveaux points de contrôle sera disponible prochainement.
          </span>
        </Card>
      )}

      {/* Liste des checkpoints ou état vide */}
      {sortedCheckpoints.length > 0 ? (
        <div className="space-y-[var(--space-3)]">
          <h3 className="px-1 font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            Points de passage programmés ({sortedCheckpoints.length})
          </h3>
          <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
            {sortedCheckpoints.map((cp) => {
              const statusCfg = STATUS_CONFIG[cp.status] || STATUS_CONFIG.pending;
              const isCritical = cp.status === 'missed' || cp.status === 'alert_sent';
              return (
                <Card
                  key={cp.id}
                  tone={isCritical ? 'danger' : 'neutral'}
                  className="transition-shadow hover:shadow-elevation-2"
                >
                  <div className="flex items-start justify-between gap-[var(--space-3)]">
                    <div>
                      <div className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                        {cp.label}
                      </div>
                      <div className="mt-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                        <Icon name="clock" size={13} />
                        {new Date(cp.scheduled_at).toLocaleString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {cp.contact_name && (
                        <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                          <Icon name="phone-call" size={12} />
                          <span>Contact : {cp.contact_name}</span>
                          {cp.contact_phone && (
                            <span className="font-medium text-[color:var(--lkv-text-primary)]">
                              ({cp.contact_phone})
                            </span>
                          )}
                        </div>
                      )}
                      {cp.notes && (
                        <p className="mt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] italic text-[color:var(--lkv-text-secondary)]/90">
                          « {cp.notes} »
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-[var(--space-2)]">
                      <Badge tone={statusCfg.tone}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                      {cp.status !== 'checked' && trip.permissions.canEdit && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCheckIn(cp.id)}
                          icon={<Icon name="check-circle2" size={13} />}
                          disabled={isPending}
                          aria-label={`Pointer le passage : ${cp.label}`}
                        >
                          Pointer
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Icon name="radio" size={32} />}
          title="Aucun point de contrôle configuré"
          description="Définissez des points de passage clés pour sécuriser votre progression et transmettre vos alertes en cas d'imprévu."
        />
      )}

      {/* Rappels de sécurité & Urgences */}
      <Card>
        <div className="flex items-start gap-[var(--space-4)]">
          <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn p-[var(--space-2)] text-[color:var(--lkv-primary)]">
            <Icon name="phone-call" size={20} />
          </div>
          <div>
            <h3 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              Numéros d&apos;urgence & Consignes terrain
            </h3>
            <p className="mt-1 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)] sm:text-[length:var(--lkv-text-body-sm)]">
              En Europe, composez le <strong>112</strong> en cas d&apos;urgence vitale (accessible
              même sans réseau de votre opérateur). Pour les alertes par SMS en zone blanche ou
              silencieuse, envoyez un message au <strong>114</strong>. En montagne, vérifiez
              toujours les prévisions météo locales avant le départ.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
