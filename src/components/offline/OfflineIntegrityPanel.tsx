'use client';

/**
 * Lot N02-UI / Intégrité — Carte d’intégrité et matrice de capacités.
 *
 * Aucune confiance implicite : le manifeste est revalidé par
 * `validatePackManifest` (fournisseur, licences, SHA-256, confidentialité) et
 * la matrice de capacités vient de l’enregistrement installé.
 */

import React from 'react';
import {
  getTileProviderPolicy,
  validatePackManifest,
  type OfflineCapabilityMatrix,
  type ManifestValidationResult,
  type OfflineInstalledPackRecord,
  type OfflinePackManifest,
  type OfflinePackStatus,
} from '@/features/offline';
import {
  OfflineBadge,
  OfflineEmpty,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineStatusBadge,
  formatBytes,
  formatDate,
} from './primitives';
import styles from './offlineUi.module.css';

type ValidationReason = NonNullable<ManifestValidationResult['reason']>;

const VALIDATION_LABEL: Readonly<Record<ValidationReason, string>> = {
  unlicensed_or_forbidden_provider: 'Fournisseur non autorisé pour un paquet hors ligne.',
  empty_resources: 'Le manifeste ne contient aucune ressource.',
  total_bytes_mismatch: 'La somme des tailles ne correspond pas au total du manifeste.',
  manifest_checksum_mismatch: 'La somme de contrôle SHA-256 du manifeste ne correspond pas.',
  private_resource_in_public_pack:
    'Une ressource privée est présente dans un paquet partagé publiquement.',
  ephemeral_token_in_resource_uri: 'Une URI de ressource contient encore un jeton temporaire.',
  missing_resource_license: 'Une ressource est dépourvue de licence explicite.',
  invalid_zoom_range: 'La plage de zooms du manifeste est invalide.',
};

const CAPABILITY_LABEL: Readonly<Record<keyof OfflineCapabilityMatrix, string>> = {
  viewRoute: 'Voir le tracé',
  viewMapAround: 'Voir la carte alentour',
  followInstructions: 'Suivre les instructions',
  searchAddresses: 'Chercher une adresse',
  recalculateRoute: 'Recalculer hors ligne',
  liveWeatherAndClosures: 'Météo et fermetures',
};

const CAPABILITY_TONE = {
  available: 'success',
  degraded: 'warning',
  unavailable: 'neutral',
} as const;

const CAPABILITY_STATUS_LABEL = {
  available: 'Disponible',
  degraded: 'Dégradé',
  unavailable: 'Indisponible',
} as const;

export interface OfflineIntegrityPanelProps {
  record?: OfflineInstalledPackRecord | null;
  manifest?: OfflinePackManifest | null;
  status?: OfflinePackStatus;
  failureReason?: string | null;
  preservedPreviousVersionOnFailure?: boolean;
}

export function OfflineIntegrityPanel({
  record = null,
  manifest = null,
  status,
  failureReason = null,
  preservedPreviousVersionOnFailure = false,
}: OfflineIntegrityPanelProps) {
  const effectiveManifest = manifest ?? record?.manifest ?? null;

  if (!effectiveManifest) {
    return (
      <OfflinePanel ariaLabel="Intégrité du paquet hors ligne">
        <OfflinePanelHeader
          eyebrow="Intégrité"
          title="Aucun paquet à vérifier"
          subtitle="Le manifeste et les sommes de contrôle apparaîtront après estimation."
        />
        <OfflineEmpty
          title="Rien à vérifier"
          hint="Sélectionnez une région ou une zone pour préparer un manifeste."
          icon="shield"
        />
      </OfflinePanel>
    );
  }

  const effectiveStatus = status ?? record?.status ?? 'estimated';
  const validation = validatePackManifest(effectiveManifest);
  const providerPolicy = getTileProviderPolicy(effectiveManifest.providerId);
  const requiredCount = effectiveManifest.resources.filter((resource) => resource.required).length;
  const capabilities = record?.capabilities ?? null;
  const checksum = effectiveManifest.manifestSha256;
  const shortChecksum =
    checksum.length > 24 ? `${checksum.slice(0, 12)}…${checksum.slice(-8)}` : checksum;

  return (
    <OfflinePanel ariaLabel="Intégrité du paquet hors ligne">
      <OfflinePanelHeader
        eyebrow="Intégrité · Recherche 04"
        title={effectiveManifest.title}
        subtitle={`${effectiveManifest.resources.length} ressources · ${requiredCount} obligatoires · vérifié le ${formatDate(
          effectiveManifest.verifiedAtMs
        )}`}
        action={<OfflineStatusBadge status={effectiveStatus} />}
      />

      {validation.valid ? (
        <OfflineNotice tone="success" icon="shield">
          Manifeste intègre : fournisseur licencié, sommes de contrôle et confidentialité conformes.
        </OfflineNotice>
      ) : (
        <OfflineNotice tone="danger" icon="alert">
          <strong>Manifeste refusé.</strong>{' '}
          {validation.reason ? VALIDATION_LABEL[validation.reason] : 'Raison inconnue.'}
        </OfflineNotice>
      )}

      {failureReason ? (
        <OfflineNotice tone="danger" icon="alert">
          Échec du paquet : <span className={styles.mono}>{failureReason}</span>
        </OfflineNotice>
      ) : null}

      {preservedPreviousVersionOnFailure ? (
        <OfflineNotice tone="warning" icon="repeat">
          La dernière version valide a été conservée : le remplacement a échoué.
        </OfflineNotice>
      ) : null}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Empreinte</span>
          <span className={styles.metricValue}>
            {formatBytes(record?.actualStoredBytes ?? effectiveManifest.totalExpectedBytes)}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Version</span>
          <span className={styles.metricValue}>v{effectiveManifest.version}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Expire</span>
          <span className={styles.metricValue}>{formatDate(effectiveManifest.expiresAtMs)}</span>
        </div>
      </div>

      <dl className={styles.stackTight} style={{ margin: 0 }}>
        <div className={styles.row}>
          <dt className={styles.label}>SHA-256 du manifeste</dt>
          <dd className={styles.mono} style={{ margin: 0 }}>
            {shortChecksum}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>Fournisseur</dt>
          <dd className={styles.itemMeta} style={{ margin: 0 }}>
            {providerPolicy.providerId}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.label}>Licence</dt>
          <dd className={styles.itemMeta} style={{ margin: 0 }}>
            {providerPolicy.attributionRequired}
          </dd>
        </div>
      </dl>

      {capabilities ? (
        <section className={styles.stackTight} aria-label="Matrice de capacités hors ligne">
          <OfflineBadge tone="neutral" icon="layers">
            Capacités publiées par le paquet
          </OfflineBadge>
          <div className={styles.capabilityGrid}>
            {(Object.keys(CAPABILITY_LABEL) as Array<keyof OfflineCapabilityMatrix>).map((key) => {
              const entry = capabilities[key];
              return (
                <div key={key} className={styles.capability}>
                  <span className={styles.capabilityLabel}>{CAPABILITY_LABEL[key]}</span>
                  <OfflineBadge tone={CAPABILITY_TONE[entry.status]}>
                    {CAPABILITY_STATUS_LABEL[entry.status]}
                  </OfflineBadge>
                  {entry.reason ? <p className={styles.capabilityReason}>{entry.reason}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <OfflineNotice tone="neutral" icon="info">
          La matrice de capacités sera publiée après le téléchargement vérifié.
        </OfflineNotice>
      )}
    </OfflinePanel>
  );
}
