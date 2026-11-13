'use client';

/**
 * Lot D03-UI — paquets de cartes et d’itinéraires hors ligne sur montre.
 *
 * L’écran ne déclare jamais un paquet disponible à la création : il lit
 * l’état vérifié du serveur (`queued`, `transferring`, `verifying`, `available`,
 * `degraded`, `error`) et affiche les ressources manquantes telles quelles.
 */

import type { WatchOfflinePackRecord } from '@/features/watches';
import { RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import {
  formatBytes,
  formatDateTime,
  packErrorLabel,
  packStatusLabel,
} from './format';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  Progress,
  Section,
  StatusPill,
  type PillTone,
} from './primitives';

function packTone(status: WatchOfflinePackRecord['status']): PillTone {
  switch (status) {
    case 'available':
      return 'ok';
    case 'degraded':
    case 'verifying':
    case 'transferring':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'neutral';
  }
}

const CAPABILITY_LABELS: Array<{
  key: keyof WatchOfflinePackRecord['capabilities'];
  label: string;
}> = [
  { key: 'viewRouteTrace', label: 'Trace' },
  { key: 'viewBaseMap', label: 'Fond de carte' },
  { key: 'followTurnByTurn', label: 'Guidage' },
  { key: 'localPlaceSearch', label: 'Recherche locale' },
  { key: 'localRerouting', label: 'Recalcul local' },
  { key: 'liveWeatherAndClosures', label: 'Météo / fermetures' },
];

export interface WatchPacksScreenProps {
  packs: WatchOfflinePackRecord[];
  availableStorageBytes: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onVerify?: (packId: string, checksumSha256: string) => Promise<void>;
  onRemove?: (packId: string) => Promise<void>;
}

export function WatchPacksScreen({
  packs,
  availableStorageBytes,
  loading = false,
  error = null,
  onRefresh,
  onVerify,
  onRemove,
}: WatchPacksScreenProps) {
  const totalBytes = packs.reduce((sum, pack) => sum + pack.manifest.totalBytes, 0);

  return (
    <div className="lkv-watch__stack" data-testid="watch-packs-screen">
      <div className="lkv-watch__grid lkv-watch__grid--3">
        <Card>
          <p className="lkv-watch__stat-label">Paquets</p>
          <p className="lkv-watch__stat-value">{packs.length}</p>
        </Card>
        <Card>
          <p className="lkv-watch__stat-label">Espace occupé</p>
          <p className="lkv-watch__stat-value">{formatBytes(totalBytes)}</p>
        </Card>
        <Card>
          <p className="lkv-watch__stat-label">Stockage libre déclaré</p>
          <p className="lkv-watch__stat-value">{formatBytes(availableStorageBytes)}</p>
        </Card>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Section
        title="Paquets hors ligne"
        hint="Un paquet n’est utilisable qu’après transfert complet et vérification du checksum."
        action={
          <Button variant="ghost" onClick={onRefresh} disabled={loading || !onRefresh}>
            <RefreshCw size={15} aria-hidden="true" /> Rafraîchir
          </Button>
        }
      >
        {loading && packs.length === 0 ? (
          <Notice tone="info">Lecture des paquets hors ligne…</Notice>
        ) : packs.length === 0 ? (
          <EmptyState title="Aucun paquet hors ligne">
            Prépare un paquet depuis la trace d’un itinéraire. Tant qu’il n’est pas vérifié,
            il ne doit pas être annoncé comme disponible sur la montre.
          </EmptyState>
        ) : (
          <ul className="lkv-watch__list">
            {packs.map((pack) => {
              const progress =
                pack.manifest.totalBytes > 0
                  ? (pack.transferredBytes / pack.manifest.totalBytes) * 100
                  : 0;
              const complete =
                pack.ackedChunkIndex + 1 >= pack.totalChunks || pack.status === 'verifying';
              const errorLabel = packErrorLabel(pack.errorReason);
              return (
                <li key={pack.manifest.packId}>
                  <Card as="article" className="lkv-watch__pack" data-testid="watch-pack-card">
                    <div className="lkv-watch__row">
                      <div>
                        <h3 className="lkv-watch__card-title">{pack.manifest.routeId}</h3>
                        <p className="lkv-watch__hint">
                          {pack.manifest.provider} · révision {pack.manifest.routeRevision} ·{' '}
                          {pack.manifest.styleVersion}
                        </p>
                      </div>
                      <StatusPill tone={packTone(pack.status)}>
                        {packStatusLabel(pack.status)}
                      </StatusPill>
                    </div>

                    <Progress
                      value={progress}
                      label={`Transfert du paquet ${pack.manifest.packId}`}
                    />
                    <p className="lkv-watch__hint">
                      {formatBytes(pack.transferredBytes)} /{' '}
                      {formatBytes(pack.manifest.totalBytes)} · blocs{' '}
                      {Math.max(0, pack.ackedChunkIndex + 1)}/{pack.totalChunks}
                    </p>

                    <div className="lkv-watch__chips" aria-label="Capacités du paquet">
                      {CAPABILITY_LABELS.map((capability) => {
                        const enabled = pack.capabilities[capability.key];
                        return (
                          <StatusPill key={capability.key} tone={enabled ? 'ok' : 'neutral'}>
                            {enabled ? '✓' : '✕'} {capability.label}
                          </StatusPill>
                        );
                      })}
                    </div>

                    <dl className="lkv-watch__facts">
                      <div>
                        <dt>Dernière vérification</dt>
                        <dd>{formatDateTime(pack.lastVerifiedAtUtcMs)}</dd>
                      </div>
                      <div>
                        <dt>Ressources vérifiées</dt>
                        <dd>
                          {pack.verifiedResourceIds.length}/{pack.manifest.resources.length}
                        </dd>
                      </div>
                      <div>
                        <dt>Révision précédente</dt>
                        <dd>{pack.previousValidManifest ? 'conservée' : 'aucune'}</dd>
                      </div>
                    </dl>

                    {pack.missingResourceIds.length > 0 ? (
                      <p className="lkv-watch__hint">
                        Manquant : {pack.missingResourceIds.join(', ')}
                      </p>
                    ) : null}

                    {errorLabel ? <Notice tone="warning">{errorLabel}</Notice> : null}

                    <div className="lkv-watch__actions">
                      {onVerify ? (
                        <Button
                          variant="primary"
                          disabled={!complete}
                          onClick={() =>
                            void onVerify(pack.manifest.packId, pack.manifest.checksumSha256)
                          }
                          title={
                            complete
                              ? 'Vérifier le checksum et les ressources'
                              : 'Tous les blocs ne sont pas encore reçus'
                          }
                        >
                          <ShieldCheck size={15} aria-hidden="true" /> Vérifier
                        </Button>
                      ) : null}
                      {onRemove ? (
                        <Button
                          variant="ghost"
                          onClick={() => void onRemove(pack.manifest.packId)}
                          aria-label={`Retirer le paquet ${pack.manifest.routeId}`}
                        >
                          <Trash2 size={15} aria-hidden="true" /> Retirer
                        </Button>
                      ) : null}
                    </div>

                    <p className="lkv-watch__hint">
                      Propriétaire : {pack.manifest.ownerUserId} · limites{' '}
                      {pack.manifest.bounds.west.toFixed(3)}, {pack.manifest.bounds.south.toFixed(3)}{' '}
                      → {pack.manifest.bounds.east.toFixed(3)}, {pack.manifest.bounds.north.toFixed(3)}{' '}
                      · zoom {pack.manifest.minZoom}–{pack.manifest.maxZoom}. Plateforme cible non
                      stockée dans le manifeste ; le transfert reste lié au compagnon.
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Notice tone="info">
        Les capacités « recherche locale » et « recalcul local » restent désactivées : le seul
        paquet cartographique montre n’acquiert ni index d’adresses ni graphe de routage.
      </Notice>
    </div>
  );
}
