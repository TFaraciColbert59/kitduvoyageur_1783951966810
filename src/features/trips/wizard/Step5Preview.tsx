'use client';

import Icon from '@/components/ui/Icon';
import React, { useEffect, useState } from 'react';
import type { TripWizardState } from './wizardTypes';
import type { PlannerOutput } from '../engine/types';
import { generateAndPersistItinerary } from '@/app/voyages/actions';
import { Badge, Button, Card, EmptyState, LoadingState } from '@/components/ui';

interface Step5PreviewProps {
  state: TripWizardState;
  suggestedTitle: string;
  onUpdateDraft: (updates: Partial<TripWizardState>) => void;
  onComplete: (slug: string) => void;
  onBackToEdit: () => void;
}

export function Step5Preview({
  state,
  suggestedTitle,
  onUpdateDraft,
  onComplete,
  onBackToEdit,
}: Step5PreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<PlannerOutput | null>(state.generatedOutput);
  const [persistedSlug, setPersistedSlug] = useState<string | null>(state.slug);

  const finalTitle = state.title.trim() || suggestedTitle;

  useEffect(() => {
    let isMounted = true;

    async function runGeneration() {
      // Si on a déjà un output en cache pour les mêmes paramètres, on l'affiche
      if (state.generatedOutput && state.slug) {
        setOutput(state.generatedOutput);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await generateAndPersistItinerary({
          tripId: state.tripId || undefined,
          title: finalTitle,
          description: state.description || undefined,
          countries: state.countries.map((c) => c.code),
          destinationName: state.countries.map((c) => c.name).join(', '),
          startDate: state.startDate || undefined,
          endDate: state.endDate || undefined,
          durationDays: state.durationDays,
          pace: state.pace,
          activityType: state.activityType,
          difficulty: state.difficulty,
          accommodationType: state.accommodationType,
          travelersCount: state.travelersCount,
          groupType: state.groupType,
          groupId: state.groupId,
          publishStatus: 'planned',
        });

        if (!isMounted) return;

        if (res.success) {
          setOutput(res.output);
          if (res.slug) setPersistedSlug(res.slug);
          onUpdateDraft({
            generatedOutput: res.output,
            tripId: res.tripId,
            slug: res.slug,
          });
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[LKDV wizard] Erreur génération itinéraire:', err);
        setError(err.message || 'Impossible de générer l’itinéraire.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    runGeneration();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="space-y-[var(--space-4)] py-16">
        <LoadingState label="Calcul déterministe de votre itinéraire…" />
        <p className="mx-auto max-w-sm text-center text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Répartition des étapes journalières, calcul altimétrique et sélection du matériel selon
          les règles de sécurité LKDV.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Card tone="danger" className="flex flex-col items-center gap-[var(--space-3)] text-center">
        <Icon name="alert-triangle" size={32} className="text-[color:var(--lkv-danger)]" />
        <h3 className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-danger-dark)]">
          Erreur de planification
        </h3>
        <p className="mx-auto max-w-md text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]">
          {error}
        </p>
        <Button type="button" onClick={onBackToEdit}>
          Modifier les paramètres
        </Button>
      </Card>
    );
  }

  if (!output) return null;

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
          <Icon name="sparkles" size={14} />
          <span>Étape 5 sur 5 — Aperçu complet</span>
        </div>
        <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
          {finalTitle}
        </h2>
        <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Voici votre proposition d&apos;itinéraire détaillée, calculée sans compromis et prête pour
          l&apos;aventure.
        </p>
      </div>

      {/* Métriques clés */}
      <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
        <Card variant="compact" className="text-center">
          <div className="text-[11px] font-semibold uppercase text-[color:var(--lkv-text-secondary)]">
            Durée
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            {output.total_days} jours
          </div>
        </Card>
        <Card variant="compact" className="text-center">
          <div className="text-[11px] font-semibold uppercase text-[color:var(--lkv-text-secondary)]">
            Distance estimée
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            {output.total_distance_km} km
          </div>
        </Card>
        <Card variant="compact" className="text-center">
          <div className="text-[11px] font-semibold uppercase text-[color:var(--lkv-text-secondary)]">
            Dénivelé positif
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            +{output.total_elevation_gain_m}m D+
          </div>
        </Card>
        <Card variant="compact" className="text-center">
          <div className="text-[11px] font-semibold uppercase text-[color:var(--lkv-text-secondary)]">
            Rythme
          </div>
          <div className="mt-0.5 text-[length:var(--lkv-text-title-sm)] font-bold capitalize text-[color:var(--lkv-text-primary)]">
            {state.pace}
          </div>
        </Card>
      </div>

      {/* Alertes météo / saisonnalité */}
      {output.warnings.length > 0 && (
        <div className="space-y-[var(--space-2)]">
          {output.warnings.map((w, idx) => (
            <Card
              key={idx}
              tone={w.severity === 'alert' ? 'danger' : 'warn'}
              className="flex items-start gap-[var(--space-3)]"
            >
              <Icon
                name="alert-triangle"
                size={18}
                className={
                  w.severity === 'alert'
                    ? 'shrink-0 text-[color:var(--lkv-danger)]'
                    : 'shrink-0 text-[color:var(--lkv-warning-dark)]'
                }
              />
              <div className="text-[length:var(--lkv-text-footnote)] leading-relaxed">
                <span className="mb-0.5 block font-semibold">Note du guide :</span>
                {w.message}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Déroulé des étapes jour par jour */}
      <div>
        <div className="mb-[var(--space-3)] flex items-center justify-between">
          <h3 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            <Icon name="navigation" size={15} />
            <span>Itinéraire jour par jour ({output.steps.length} étapes)</span>
          </h3>
        </div>

        <ul className="space-y-[var(--space-3)]">
          {output.steps.map((step, idx) => (
            <li key={idx}>
              <Card className="flex flex-col justify-between gap-[var(--space-3)] sm:flex-row sm:items-center">
                <div className="space-y-[var(--space-1)]">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Badge tone="sage">Jour {step.day_number}</Badge>
                    <span className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-secondary)]">
                      {step.country_code}
                    </span>
                    {step.accommodation_name && (
                      <span className="text-[11px] text-[color:var(--lkv-text-muted)]">
                        · {step.accommodation_name}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                    {step.title}
                  </h4>
                  {step.description && (
                    <p className="max-w-xl text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                      {step.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-[var(--space-4)] self-start text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-muted)] sm:self-center">
                  {step.distance_km ? (
                    <span className="flex items-center gap-[var(--space-1)]">
                      <Icon name="footprints" size={14} className="text-[color:var(--lkv-secondary)]" />
                      {step.distance_km} km
                    </span>
                  ) : null}
                  {step.elevation_gain_m ? (
                    <span className="flex items-center gap-[var(--space-1)] font-semibold text-[color:var(--lkv-text-primary)]">
                      +{step.elevation_gain_m}m D+
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      {/* Liste d'équipement suggérée */}
      <div>
        <div className="mb-[var(--space-3)] flex items-center justify-between">
          <h3 className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            <Icon name="package" size={15} />
            <span>Matériel & sac à dos recommandé ({output.items.length} articles)</span>
          </h3>
        </div>

        {output.items.length === 0 ? (
          <EmptyState compact title="Aucun article recommandé pour ce profil." />
        ) : (
          <ul className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2">
            {output.items.map((it, idx) => (
              <li key={idx}>
                <Card variant="compact" className="flex items-center justify-between">
                  <div>
                    <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                      {it.item_name}
                    </div>
                    <div className="text-[10px] text-[color:var(--lkv-text-secondary)]">
                      {it.category || 'Général'} · Qté : {it.quantity}
                    </div>
                  </div>
                  {it.weight_grams ? (
                    <span className="text-[11px] font-medium text-[color:var(--lkv-text-muted)]">
                      {it.weight_grams}g
                    </span>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Barre d'action finale */}
      <div className="flex flex-col items-center justify-between gap-[var(--space-3)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)] sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          onClick={onBackToEdit}
          icon={<Icon name="rotate-ccw" size={14} />}
          className="w-full min-h-[48px] sm:w-auto"
        >
          Modifier les paramètres
        </Button>

        <Button
          type="button"
          onClick={() => onComplete(persistedSlug || 'mon-voyage')}
          icon={<Icon name="arrow-right" size={16} />}
          iconPosition="trailing"
          className="w-full min-h-[48px] sm:w-auto"
        >
          Enregistrer et ouvrir mon voyage
        </Button>
      </div>
    </div>
  );
}
