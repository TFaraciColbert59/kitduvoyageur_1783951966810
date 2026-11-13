'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, RefreshCw, Wrench } from 'lucide-react';
import { inferGearKind } from '@/features/gear/domain/gearKind';
import type { GearMileagePayload } from '@/features/gear/server/mileage';
import styles from './GearMileagePanel.module.css';

export interface GearMileagePanelProps {
  gearItemId: string;
  /** Nom et catégorie déjà connus du drawer, pour classer le matériel. */
  gearName?: string | null;
  gearCategory?: string | null;
}

const COMPONENT_KINDS = [
  { value: 'chaine', label: 'Chaîne' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'plaquettes', label: 'Plaquettes' },
  { value: 'plateau', label: 'Plateau' },
  { value: 'cassette', label: 'Cassette' },
  { value: 'derailleur', label: 'Dérailleur' },
  { value: 'roue', label: 'Roue' },
  { value: 'autre', label: 'Autre' },
] as const;

function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Non mesuré';
  if (value < 10) return `${value.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(value)} km`;
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json();
}

/**
 * Fiche matériel → kilomètres, seuil, alerte et composants.
 *
 * Le panneau ne s'affiche que pour le propriétaire (l'API est bornée par RLS).
 * Sans séance éligible, il annonce « non mesuré » et n'écrit aucun zéro. Une
 * alerte n'est consommée qu'après une action explicite ; le serveur garantit
 * l'unicité par version de seuil.
 */
export function GearMileagePanel({ gearItemId, gearName, gearCategory }: GearMileagePanelProps) {
  const [payload, setPayload] = useState<GearMileagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');
  const [componentName, setComponentName] = useState('');
  const [componentKind, setComponentKind] = useState<string>('chaine');
  const [installedAtKm, setInstalledAtKm] = useState('');
  const [componentThresholdKm, setComponentThresholdKm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await requestJson(`/api/gear/${gearItemId}/mileage`)) as GearMileagePayload;
      setPayload(data);
      setThresholdInput(
        data.settings.thresholdKm === null ? '' : String(data.settings.thresholdKm).replace('.', ',')
      );
    } catch (caught) {
      const status = caught instanceof Error ? caught.message : '';
      // Un visiteur n'a pas accès à cette fiche : on n'affiche pas d'erreur.
      if (status === 'http_404' || status === 'http_401') setPayload(null);
      else setError('Kilométrage indisponible pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [gearItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const kind = useMemo(
    () => inferGearKind(gearName ?? payload?.gear.name, gearCategory ?? payload?.gear.category),
    [gearCategory, gearName, payload?.gear.category, payload?.gear.name]
  );

  const saveThreshold = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    try {
      const raw = thresholdInput.trim().replace(',', '.');
      const thresholdKm = raw === '' ? null : Number(raw);
      if (thresholdKm !== null && (!Number.isFinite(thresholdKm) || thresholdKm <= 0)) {
        setFormError('Le seuil doit être un nombre de kilomètres supérieur à 0.');
        return;
      }
      await requestJson(`/api/gear/${gearItemId}/mileage`, {
        method: 'PATCH',
        body: JSON.stringify({ thresholdKm }),
      });
      await load();
    } catch {
      setFormError('Le seuil n’a pas pu être enregistré.');
    } finally {
      setBusy(false);
    }
  }, [gearItemId, load, thresholdInput]);

  const acknowledge = useCallback(
    async (action: 'seen' | 'dismiss') => {
      setBusy(true);
      setFormError(null);
      try {
        await requestJson(`/api/gear/${gearItemId}/mileage`, {
          method: 'POST',
          body: JSON.stringify({ action }),
        });
        await load();
      } catch {
        setFormError('L’alerte n’a pas pu être acquittée.');
      } finally {
        setBusy(false);
      }
    },
    [gearItemId, load]
  );

  const addComponent = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    try {
      const name = componentName.trim();
      if (!name) {
        setFormError('Donne un nom au composant.');
        return;
      }
      const installed = installedAtKm.trim() === '' ? null : Number(installedAtKm.replace(',', '.'));
      const threshold = componentThresholdKm.trim() === '' ? null : Number(componentThresholdKm.replace(',', '.'));
      if (installed !== null && (!Number.isFinite(installed) || installed < 0)) {
        setFormError('Le kilométrage d’installation doit être positif ou nul.');
        return;
      }
      if (threshold !== null && (!Number.isFinite(threshold) || threshold <= 0)) {
        setFormError('Le seuil du composant doit être supérieur à 0.');
        return;
      }
      await requestJson(`/api/gear/${gearItemId}/components`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          kind: componentKind,
          installedAtKm: installed,
          thresholdKm: threshold,
        }),
      });
      setComponentName('');
      setInstalledAtKm('');
      setComponentThresholdKm('');
      await load();
    } catch {
      setFormError('Le composant n’a pas pu être ajouté.');
    } finally {
      setBusy(false);
    }
  }, [componentKind, componentName, componentThresholdKm, gearItemId, installedAtKm, load]);

  const replaceComponent = useCallback(
    async (componentId: string) => {
      setBusy(true);
      setFormError(null);
      try {
        await requestJson(`/api/gear/${gearItemId}/components`, {
          method: 'PATCH',
          body: JSON.stringify({ componentId }),
        });
        await load();
      } catch (caught) {
        const status = caught instanceof Error ? caught.message : '';
        setFormError(
          status === 'http_409'
            ? 'Aucun kilométrage éligible pour dater le remplacement.'
            : 'Le remplacement n’a pas pu être enregistré.'
        );
      } finally {
        setBusy(false);
      }
    },
    [gearItemId, load]
  );

  if (loading) {
    return (
      <div className={styles.panel} aria-busy="true">
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.panel}>
        <p className={styles.error} role="alert">
          {error}{' '}
          <button type="button" className={styles.action} onClick={() => void load()}>
            <RefreshCw size={11} aria-hidden="true" /> Réessayer
          </button>
        </p>
      </div>
    );
  }

  if (!payload) return null;

  if (!payload.persistenceReady) {
    return (
      <div className={styles.panel}>
        <span className={styles.kicker}>Kilométrage</span>
        <p className={styles.empty}>
          Le suivi de kilométrage n’est pas encore activé sur cette version. Aucun total n’est affiché
          tant que la migration du lot n’est pas appliquée.
        </p>
      </div>
    );
  }

  const { mileage, alert: mileageAlert, settings, components } = payload;
  const hasMileage = mileage.sessionCount > 0;
  const thresholdLabel =
    settings.thresholdKm === null ? 'Seuil non défini' : `Seuil ${formatKm(settings.thresholdKm)}`;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <span className={styles.kicker}>Kilométrage</span>
          <span className={styles.total}>
            {formatKm(hasMileage ? mileage.totalKm : null)}
            {hasMileage ? <small> cumulés</small> : null}
          </span>
          <p className={styles.sub}>
            {hasMileage
              ? `${mileage.sessionCount} sortie${mileage.sessionCount > 1 ? 's' : ''} comptée${
                  mileage.sessionCount > 1 ? 's' : ''
                }${mileage.missingDistanceSessions > 0 ? ` · ${mileage.missingDistanceSessions} sans distance` : ''}`
              : mileage.missingDistanceSessions > 0
                ? `${mileage.missingDistanceSessions} sortie${mileage.missingDistanceSessions > 1 ? 's' : ''} liée${
                    mileage.missingDistanceSessions > 1 ? 's' : ''
                  } sans distance mesurée`
                : 'Aucune sortie éligible liée à ce matériel.'}
          </p>
        </div>
      </div>

      {settings.thresholdKm !== null ? (
        <div
          className={styles.track}
          role="progressbar"
          aria-label={`Kilométrage de ${payload.gear.name}`}
          aria-valuemin={0}
          aria-valuemax={settings.thresholdKm}
          aria-valuenow={hasMileage ? mileage.totalKm : undefined}
          aria-valuetext={hasMileage ? `${formatKm(mileage.totalKm)} sur ${formatKm(settings.thresholdKm)}` : 'Non mesuré'}
          data-due={mileageAlert.due ? 'true' : 'false'}
        >
          <i style={{ width: `${hasMileage ? mileageAlert.progressPercent ?? 0 : 0}%` }} />
        </div>
      ) : null}

      {mileageAlert.due ? (
        <div className={styles.alert} role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <b>{thresholdLabel} atteint</b>
            <span>
              {mileageAlert.shouldNotify
                ? 'Entretien recommandé. Une seule alerte est créée par version de seuil.'
                : 'Alerte déjà signalée pour ce seuil.'}
            </span>
            {mileageAlert.shouldNotify ? (
              <div className={styles.alertActions}>
                <button
                  type="button"
                  className={`${styles.action} ${styles.primary}`}
                  disabled={busy}
                  onClick={() => void acknowledge('seen')}
                >
                  <Check size={11} aria-hidden="true" /> Marquer comme vue
                </button>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy}
                  onClick={() => void acknowledge('dismiss')}
                >
                  Ne plus afficher
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Seuil d’entretien (km)</span>
          <input
            type="text"
            inputMode="decimal"
            value={thresholdInput}
            onChange={(event) => setThresholdInput(event.target.value)}
            placeholder="Non défini"
            aria-label="Seuil d’entretien en kilomètres"
          />
        </label>
        <button type="button" className={styles.action} disabled={busy} onClick={() => void saveThreshold()}>
          Enregistrer
        </button>
      </div>

      {kind === 'bike' ? (
        <>
          <h3 className={styles.sectionTitle}>
            <Wrench size={11} aria-hidden="true" /> Composants
          </h3>
          {components.length === 0 ? (
            <p className={styles.empty}>Aucun composant suivi. Ajoute une chaîne, des pneus ou des plaquettes.</p>
          ) : (
            <ul className={styles.componentList}>
              {components.map((component) => {
                const value = component.mileage.km;
                return (
                  <li className={styles.component} key={component.id}>
                    <div>
                      <span className={styles.componentName}>{component.name}</span>
                      <span className={styles.componentMeta}>
                        {formatKm(value)} depuis l’installation
                        {component.mileage.due ? <span className={styles.due}> · seuil atteint</span> : null}
                        {component.thresholdKm !== null
                          ? ` · seuil ${formatKm(component.thresholdKm)}`
                          : ' · sans seuil'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.action}
                      disabled={busy || component.replacedAtKm !== null}
                      onClick={() => void replaceComponent(component.id)}
                      aria-label={`Remplacer ${component.name}`}
                    >
                      {component.replacedAtKm !== null ? 'Remplacé' : 'Remplacer'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.form}>
            <label className={styles.field}>
              <span>Composant</span>
              <input
                type="text"
                value={componentName}
                onChange={(event) => setComponentName(event.target.value)}
                placeholder="Chaîne 11v"
                aria-label="Nom du composant"
              />
            </label>
            <label className={styles.field}>
              <span>Type</span>
              <select
                value={componentKind}
                onChange={(event) => setComponentKind(event.target.value)}
                aria-label="Type de composant"
              >
                {COMPONENT_KINDS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Installé à (km)</span>
              <input
                type="text"
                inputMode="decimal"
                value={installedAtKm}
                onChange={(event) => setInstalledAtKm(event.target.value)}
                placeholder="Non renseigné"
                aria-label="Kilométrage d’installation du composant"
              />
            </label>
            <label className={styles.field}>
              <span>Seuil (km)</span>
              <input
                type="text"
                inputMode="decimal"
                value={componentThresholdKm}
                onChange={(event) => setComponentThresholdKm(event.target.value)}
                placeholder="Non défini"
                aria-label="Seuil du composant en kilomètres"
              />
            </label>
            <button type="button" className={styles.action} disabled={busy} onClick={() => void addComponent()}>
              <Plus size={11} aria-hidden="true" /> Ajouter
            </button>
          </div>
        </>
      ) : null}

      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );
}

export default GearMileagePanel;
