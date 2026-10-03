'use client';

import Icon from '@/components/ui/Icon';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrendingUpIcon as TrendingUp } from '@/components/icons/trending-up';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { MountainIcon as Mountain } from '@/components/icons/mountain';
import { Share2Icon as Share2 } from '@/components/icons/share-2';
import { DownloadIcon as Download } from '@/components/icons/download';
import { ClockIcon as Clock } from '@/components/icons/clock';
import type { MapTrail } from './types';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
import { listOfflineRoutes } from '@/lib/offlineStorage';
import { Badge, Button, Card, IconButton, Sheet } from '@/components/ui';
import {
  getTrailImage,
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
} from './types';

interface Props {
  trail: MapTrail;
  onClose: () => void;
  /** Permet l'animation de sortie Radix avant démontage. */
  open?: boolean;
}

const SCORE_LABELS: { key: keyof MapTrail; label: string; icon: string }[] = [
  { key: 'adventure_score', label: 'Aventure', icon: '⛰️' },
  { key: 'nature_score', label: 'Immersion Nature', icon: '🌿' },
  { key: 'panorama_score', label: 'Points de vue', icon: '🔭' },
];

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="glass-progress w-full">
      <div
        className="glass-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card variant="compact" className="flex flex-col items-center justify-center gap-0.5 text-center">
      <div className="text-[color:var(--lkv-text-primary)]">{icon}</div>
      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
        {label}
      </span>
      <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
        {value}
      </span>
    </Card>
  );
}

/**
 * TrailDetailPanel — fiche détail d'un sentier, en feuille canonique
 * (poignée, scroll interne, safe-area, fermeture par glissement).
 */
export default function TrailDetailPanel({ trail, onClose, open = true }: Props) {
  const router = useRouter();
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);

  const [description, setDescription] = useState<string | null>(trail.ai_description || null);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState<boolean>(false);
  const offline = useOfflineDownload();

  // Check offline status
  useEffect(() => {
    listOfflineRoutes()
      .then((routes) => {
        setIsOfflineAvailable(routes.some((r) => r.routeId === String(trail.id)));
      })
      .catch(() => {});
  }, [trail.id]);

  const handleOfflineToggle = useCallback(async () => {
    if (isOfflineAvailable) {
      await offline.deleteOffline(String(trail.id));
      setIsOfflineAvailable(false);
      offline.reset();
    } else {
      await offline.downloadForOffline(trail);
      setIsOfflineAvailable(true);
    }
  }, [isOfflineAvailable, offline, trail]);

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: trail.name,
          text: `Découvre ce sentier de randonnée sur Le Kit du Voyageur : ${trail.name}`,
          url: window.location.href,
        })
        .catch(() => {});
    }
  };

  const [isMaterializing, setIsMaterializing] = useState(false);
  const isOsm = String(trail.id).startsWith('osm:relation:') || (trail as any).source === 'openstreetmap';
  const rawGeomStatus = (trail as any).geometryStatus;
  const hasGeom = Boolean((trail as any).geom || (trail as any).geojson);
  const isUnavailableGeometry =
    rawGeomStatus === 'unavailable' ||
    (!hasGeom && !isOsm) ||
    (!hasGeom && (trail as any).detail !== undefined);
  const isPartialGeometry = rawGeomStatus === 'partial';

  const getCanonicalId = useCallback(async (): Promise<string | number | null> => {
    if (!String(trail.id).startsWith('osm:relation:')) {
      return trail.id;
    }
    const osmRelationId = parseInt(String(trail.id).replace('osm:relation:', ''), 10);
    setIsMaterializing(true);
    try {
      const res = await fetch('/api/explorer/osm/materialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          osmRelationId,
        }),
      });
      if (!res.ok) throw new Error('Échec de la matérialisation');
      const data = await res.json();
      return data.canonicalId;
    } catch (err) {
      console.error('Erreur matérialisation:', err);
      return null;
    } finally {
      setIsMaterializing(false);
    }
  }, [trail]);

  const handlePrepare = async () => {
    const canonicalId = await getCanonicalId();
    if (canonicalId) {
      router.push(`/preparer-sentier/${canonicalId}`);
    }
  };

  const handleStart = async () => {
    if (isUnavailableGeometry) return;
    const canonicalId = await getCanonicalId();
    if (canonicalId) {
      router.push(`/randonnee-active?routeId=${canonicalId}`);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={trail.name}
      hideTitle
      detent="large"
      dragToDismiss
      footer={
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            variant="secondary"
            className="h-12 flex-1"
            disabled={isMaterializing}
            onClick={handlePrepare}
          >
            <span>{isMaterializing ? 'Préparation LKDV…' : 'Préparer le matériel'}</span>
          </Button>

          <Button
            variant="primary"
            className="h-12 flex-1"
            disabled={isMaterializing || isUnavailableGeometry}
            onClick={handleStart}
            title={isUnavailableGeometry ? 'Tracé GPS non disponible pour la navigation' : 'Commencer tout de suite'}
          >
            <span>
              {isUnavailableGeometry
                ? 'Tracé non disponible'
                : isMaterializing
                ? 'Initialisation…'
                : 'Commencer tout de suite'}
            </span>
          </Button>
        </div>
      }
    >
      <div className="-mx-[var(--space-5)] -mt-[var(--space-1)] flex flex-col gap-3.5">
        {/* Header Hero Image */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[color:var(--glass-bg-medium)] sm:h-56">
          <img src={imgUrl} alt={trail.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          <div className="absolute left-3.5 right-3.5 top-3.5 z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge className="border-transparent text-white" style={{ backgroundColor: diffColor }}>
                {diffLabel}
              </Badge>
              {isUnavailableGeometry && (
                <Badge tone="warn" className="backdrop-blur-sm text-[length:var(--lkv-text-caption-2)]">
                  Tracé indisponible
                </Badge>
              )}
              {!isUnavailableGeometry && isOsm && (
                <>
                  <Badge tone="stone" className="border-white/30 bg-black/40 text-white backdrop-blur-sm text-[length:var(--lkv-text-caption-2)]">
                    OSM · ODbL
                  </Badge>
                  <Badge
                    tone={isPartialGeometry ? 'warn' : 'sage'}
                    className="backdrop-blur-sm text-[length:var(--lkv-text-caption-2)]"
                  >
                    {isPartialGeometry ? 'Tracé partiel' : 'Tracé complet'}
                  </Badge>
                </>
              )}
            </div>

            <IconButton
              variant="glass"
              size="sm"
              onClick={handleShare}
              aria-label="Partager le sentier"
              title="Partager"
            >
              <Share2 size={15} />
            </IconButton>
          </div>

          <div className="absolute bottom-3 left-3.5 right-3.5">
            <Card className="rounded-[var(--lkv-radius-md)] px-3.5 py-2.5 shadow-xs">
              <p className="mb-0.5 flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
                <Icon name="map-pin" size={11} className="text-[color:var(--lkv-text-primary)]" />
                <span>{trail.network || trail.terrain_type || 'Massif Alpin'}</span>
              </p>
              <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold leading-tight text-[color:var(--lkv-text-primary)] line-clamp-2">
                {trail.name}
              </h2>
            </Card>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex flex-col gap-3.5 px-[var(--space-5)]">
          {/* Key Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill
              icon={<TrendingUp size={16} />}
              label="Distance"
              value={formatDistance(trail.distance_km)}
            />
            <StatPill
              icon={<Mountain size={16} />}
              label="Dénivelé +"
              value={
                trail.elevation_gain !== null && trail.elevation_gain !== undefined
                  ? `+${Math.round(trail.elevation_gain)} m`
                  : 'Non renseigné'
              }
            />
            <StatPill
              icon={<Clock size={16} />}
              label="Durée estimée"
              value={formatDuration(trail.duration_hours)}
            />
          </div>

          {/* Scores Breakdown */}
          <Card variant="compact" className="flex flex-col gap-2.5 p-3.5">
            <h3 className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Indicateurs d'expérience
            </h3>
            {SCORE_LABELS.map(({ key, label, icon }) => {
              const val = typeof trail[key] === 'number' ? (trail[key] as number) : 75;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">{icon}</span>
                      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider">
                        {label}
                      </span>
                    </span>
                    <span className="font-mono text-[color:var(--lkv-text-primary)]">{Math.round(val)}/100</span>
                  </div>
                  <ScoreBar value={val} />
                </div>
              );
            })}
          </Card>

          {/* AI Description / Insights */}
          <Card variant="compact" className="flex flex-col gap-2 p-3.5">
            <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              <Icon name="sparkles" size={13} className="text-[color:var(--lkv-text-primary)]" />
              <span>Guide & Points d'intérêt</span>
            </div>
            <p className="text-[length:var(--lkv-text-body-sm)] font-normal leading-relaxed text-[color:var(--lkv-text-secondary)]">
              {description ||
                `Cet itinéraire de ${formatDistance(trail.distance_km)} offre une immersion complète au cœur de panoramas remarquables. Idéal pour les randonneurs en quête d'air pur et de sentiers balisés.`}
            </p>
          </Card>

          {/* Offline Storage Card */}
          <Card variant="compact" className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                {isOfflineAvailable ? <Icon name="check" size={16} /> : <Download size={16} />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                  {isOfflineAvailable ? 'Disponible hors-ligne' : 'Mode hors-ligne'}
                </p>
                <p className="truncate text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {isOfflineAvailable
                    ? 'Tracé GPS & carte préchargés'
                    : 'Télécharger pour naviguer sans réseau'}
                </p>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={handleOfflineToggle} className="shrink-0">
              {isOfflineAvailable ? 'Supprimer' : 'Télécharger'}
            </Button>
          </Card>
        </div>
      </div>
    </Sheet>
  );
}
