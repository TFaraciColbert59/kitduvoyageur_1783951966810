'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { AggregateContributionPreferences } from '@/features/heatmaps/types';
import { Button, ErrorState, Spinner, Switch } from '@/components/ui';
import {
  HeatmapClientError,
  fetchHeatmapPreferences,
  isSessionError,
  optOutOfGlobalHeatmap,
  patchHeatmapPreferences,
} from './apiClient';
import {
  HeatmapCard,
  HeatmapPrivacyNote,
  HeatmapSectionTitle,
  HeatmapSignInPrompt,
  HeatmapStat,
} from './HeatmapParts';
import { formatIsoDate } from './heatmapViewModel';

export interface ContributionPreferencesPanelProps {
  loadPreferences?: typeof fetchHeatmapPreferences;
  savePreferences?: typeof patchHeatmapPreferences;
  optOut?: typeof optOutOfGlobalHeatmap;
}

type EditablePreferences = Pick<
  AggregateContributionPreferences,
  'globalHeatmap' | 'globalHeatmapOptOut' | 'routeRecommendations' | 'mobilityAggregates'
>;

function toEditable(preferences: AggregateContributionPreferences): EditablePreferences {
  return {
    globalHeatmap: preferences.globalHeatmap,
    globalHeatmapOptOut: preferences.globalHeatmapOptOut,
    routeRecommendations: preferences.routeRecommendations,
    mobilityAggregates: preferences.mobilityAggregates,
  };
}

const SCOPES: readonly {
  key: keyof EditablePreferences;
  title: string;
  description: string;
}[] = [
  {
    key: 'globalHeatmap',
    title: 'Heatmap mondiale',
    description:
      'Vos passages terminés alimentent la carte communautaire agrégée, jamais votre trace ni votre nom.',
  },
  {
    key: 'routeRecommendations',
    title: 'Recommandations de parcours',
    description:
      'La popularité agrégée de vos itinéraires peut nourrir des suggestions de parcours.',
  },
  {
    key: 'mobilityAggregates',
    title: 'Agrégats de mobilité',
    description:
      'Vos segments et déplacements peuvent contribuer à des statistiques de mobilité anonymes.',
  },
];

export default function ContributionPreferencesPanel({
  loadPreferences = fetchHeatmapPreferences,
  savePreferences = patchHeatmapPreferences,
  optOut = optOutOfGlobalHeatmap,
}: ContributionPreferencesPanelProps) {
  const [preferences, setPreferences] = useState<AggregateContributionPreferences | null>(null);
  const [draft, setDraft] = useState<EditablePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsSession, setNeedsSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setErrorCode(null);

    loadPreferences(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setPreferences(response.preferences);
        setDraft(toEditable(response.preferences));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (isSessionError(cause)) {
          setNeedsSession(true);
          return;
        }
        setErrorCode(cause instanceof HeatmapClientError ? cause.code : 'network_error');
        setError(
          cause instanceof Error ? cause.message : 'Impossible de charger vos préférences.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, loadPreferences]);

  const updateDraft = useCallback((key: keyof EditablePreferences, value: boolean) => {
    setNotice(null);
    setDraft((current) => {
      if (!current) return current;
      if (key === 'globalHeatmap') {
        return { ...current, globalHeatmap: value, globalHeatmapOptOut: !value };
      }
      return { ...current, [key]: value };
    });
  }, []);

  const dirty =
    preferences !== null &&
    draft !== null &&
    (preferences.globalHeatmap !== draft.globalHeatmap ||
      preferences.globalHeatmapOptOut !== draft.globalHeatmapOptOut ||
      preferences.routeRecommendations !== draft.routeRecommendations ||
      preferences.mobilityAggregates !== draft.mobilityAggregates);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    setErrorCode(null);
    setNotice(null);
    try {
      const response = await savePreferences(draft);
      setPreferences(response.preferences);
      setDraft(toEditable(response.preferences));
      setNotice('Préférences enregistrées. La prochaine agrégation en tient compte.');
    } catch (cause) {
      if (isSessionError(cause)) {
        setNeedsSession(true);
      } else {
        setErrorCode(cause instanceof HeatmapClientError ? cause.code : 'network_error');
        setError(
          cause instanceof Error ? cause.message : "Impossible d'enregistrer vos préférences."
        );
      }
    } finally {
      setSaving(false);
    }
  }, [draft, saving, savePreferences]);

  const revoke = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setErrorCode(null);
    setNotice(null);
    try {
      const response = await optOut(false);
      setPreferences(response.preferences);
      setDraft(toEditable(response.preferences));
      setNotice(
        `Opt-out strict actif depuis le ${formatIsoDate(response.revokedAt)}. Les autres finalités restent inchangées.`
      );
    } catch (cause) {
      if (isSessionError(cause)) {
        setNeedsSession(true);
      } else {
        setErrorCode(cause instanceof HeatmapClientError ? cause.code : 'network_error');
        setError(cause instanceof Error ? cause.message : "Impossible d'activer l'opt-out.");
      }
    } finally {
      setSaving(false);
    }
  }, [optOut, saving]);

  if (needsSession) {
    return (
      <HeatmapSignInPrompt
        title="Vos contributions, votre choix"
        description="Connectez-vous pour choisir précisément ce qui peut alimenter les agrégats. Par défaut, rien n'est partagé."
      />
    );
  }

  return (
    <div className="space-y-3" aria-busy={loading || saving}>
      <HeatmapCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
              Contribution aux agrégats
            </h2>
            <p className="mt-1 max-w-xl text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
              Trois finalités indépendantes. Aucun consentement n&apos;est implicite : sans choix
              explicite, rien n&apos;est partagé. L&apos;opt-out de la heatmap mondiale est
              prioritaire et immédiat.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border-color)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">
            S6.17
          </span>
        </div>
      </HeatmapCard>

      {loading && (
        <div className="flex min-h-[180px] items-center justify-center">
          <Spinner />
          <span className="sr-only">Chargement de vos préférences</span>
        </div>
      )}

      {!loading && error && !preferences && (
        <HeatmapCard>
          <ErrorState
            title={
              errorCode === 'preferences_unavailable'
                ? 'Préférences indisponibles'
                : 'Chargement impossible'
            }
            message={
              errorCode === 'preferences_unavailable'
                ? "La persistance des consentements n'est pas encore disponible. Aucune contribution n'est activée par défaut."
                : error
            }
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        </HeatmapCard>
      )}

      {!loading && draft && (
        <>
          <HeatmapCard>
            <HeatmapSectionTitle hint="Chaque finalité est séparée">
              Ce que vous autorisez
            </HeatmapSectionTitle>
            <ul className="divide-y divide-[color:var(--lkv-border-subtle)]">
              {SCOPES.map((scope) => (
                <li key={scope.key} className="py-3 first:pt-1 last:pb-1">
                  <Switch
                    checked={draft[scope.key]}
                    onCheckedChange={(value) => updateDraft(scope.key, value)}
                    label={
                      <span className="block">
                        <span className="block text-[length:var(--lkv-text-footnote)] font-semibold">
                          {scope.title}
                        </span>
                        <span className="mt-0.5 block max-w-md text-[length:var(--lkv-text-caption-2)] font-normal leading-relaxed text-[color:var(--lkv-text-secondary)]">
                          {scope.description}
                        </span>
                      </span>
                    }
                    disabled={saving}
                  />
                </li>
              ))}
            </ul>

            {preferences?.globalHeatmapOptOut && (
              <p className="mt-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] bg-[var(--lkv-forest-50)] px-3 py-2 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                Opt-out strict actif : la heatmap mondiale est désactivée même si l&apos;interrupteur
                ci-dessus était réactivé par erreur. Utilisez « Réactiver » après avoir choisi.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={save}
                loading={saving}
                disabled={!dirty || saving}
              >
                Enregistrer mes choix
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={revoke}
                disabled={saving}
              >
                Couper la heatmap mondiale
              </Button>
              {notice && (
                <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                  {notice}
                </span>
              )}
            </div>

            {error && preferences && (
              <p role="alert" className="mt-2 text-[length:var(--lkv-text-caption-2)] text-red-700">
                {error}
              </p>
            )}
          </HeatmapCard>

          <dl className="grid grid-cols-2 gap-2">
            <HeatmapStat
              label="État"
              value={draft.globalHeatmap && !draft.globalHeatmapOptOut ? 'Actif' : 'Coupé'}
              hint="Heatmap mondiale"
            />
            <HeatmapStat
              label="Dernière révision"
              value={preferences ? formatIsoDate(preferences.updatedAt) : '—'}
              hint={preferences ? `Version ${preferences.revision}` : undefined}
            />
          </dl>

          <HeatmapPrivacyNote>
            Les cellules publiques ne sont calculées qu&apos;à partir de contributeurs consentants,
            avec un minimum de 5 personnes distinctes. Retirer son consentement retire l&apos;apport
            dès la requête suivante : aucun cache chaud ne conserve l&apos;ancien agrégat.
          </HeatmapPrivacyNote>
        </>
      )}
    </div>
  );
}
