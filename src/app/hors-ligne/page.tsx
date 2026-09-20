'use client';
import { lkvConfirm } from '@/components/ui/dialogs';

import React, { useEffect, useState, useCallback } from 'react';
import { listOfflineRoutes, getOfflineTileSize, formatSize, type OfflineRoute } from '@/lib/offlineStorage';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui';

interface RouteWithSize extends OfflineRoute {
  sizeBytes: number;
}

export default function HorsLignePage() {
  const [routes, setRoutes] = useState<RouteWithSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const offline = useOfflineDownload();

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listOfflineRoutes();
      const withSizes = await Promise.all(
        list.map(async (r) => ({
          ...r,
          sizeBytes: await getOfflineTileSize(r.routeId),
        }))
      );
      // Plus récentes en premier
      withSizes.sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
      setRoutes(withSizes);
    } catch (err) {
      console.error('[HorsLignePage] loadRoutes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const handleDelete = useCallback(async (routeId: string) => {
    if (!(await lkvConfirm('Supprimer cette randonnée du stockage hors-ligne ?'))) return;
    setDeletingId(routeId);
    try {
      await offline.deleteOffline(routeId);
      setRoutes((prev) => prev.filter((r) => r.routeId !== routeId));
    } finally {
      setDeletingId(null);
    }
  }, [offline]);

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return iso; }
  }

  const totalBytes = routes.reduce((sum, r) => sum + r.sizeBytes, 0);
  const totalTiles = routes.reduce((sum, r) => sum + r.tileCount, 0);

  return (
    <AppShell
      background="transparent"
      header={
        <PageHeader
          variant="large"
          back
          backHref="/explorer"
          title="Hors-ligne"
          subtitle="Randonnées disponibles sans connexion"
        />
      }
    >
      <div className="space-y-[var(--space-3)] px-[var(--space-4)] pb-[var(--space-8)] pt-[var(--space-4)]">
        {/* Résumé stockage */}
        {!loading && routes.length > 0 && (
          <Card className="flex items-center gap-[var(--space-4)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-success-bg)]">
              <span aria-hidden="true" className="text-xl">💾</span>
            </div>
            <div>
              <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                {routes.length} randonnée{routes.length > 1 ? 's' : ''} stockée{routes.length > 1 ? 's' : ''}
              </p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                {totalTiles} tuiles · {formatSize(totalBytes)}
              </p>
            </div>
          </Card>
        )}

        {/* Contenu */}
        {loading ? (
          <div className="space-y-[var(--space-3)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} variant="compact" className="space-y-[var(--space-2)] p-[var(--space-4)]">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </Card>
            ))}
          </div>
        ) : routes.length === 0 ? (
          <EmptyState
            title="Aucune randonnée hors-ligne"
            description="Depuis la page d'une randonnée, appuie sur « Télécharger pour hors-ligne » avant de partir."
            actionLabel="Explorer les randonnées"
            actionHref="/explorer"
          />
        ) : (
          routes.map((route) => (
            <Card key={route.routeId} className="overflow-hidden p-0">
              <div className="p-[var(--space-4)]">
                <div className="flex items-start justify-between gap-[var(--space-2)]">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[length:var(--lkv-text-body-sm)] font-semibold leading-tight text-[color:var(--lkv-text-primary)] line-clamp-2">
                      {route.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
                      {route.distanceKm && (
                        <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                          📏 {route.distanceKm.toFixed(1)} km
                        </span>
                      )}
                      {route.difficulty && (
                        <span className="text-[length:var(--lkv-text-caption)] capitalize text-[color:var(--lkv-text-muted)]">
                          🎯 {route.difficulty}
                        </span>
                      )}
                      <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                        💾 {formatSize(route.sizeBytes)} · {route.tileCount} tuiles
                      </span>
                    </div>
                    <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                      Téléchargé le {formatDate(route.cachedAt)}
                    </p>
                  </div>

                  {/* Badge offline */}
                  <Badge tone="sage" className="shrink-0">
                    ✅ Hors-ligne
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t border-[color:var(--lkv-border)]">
                <Link
                  href={`/randonnee-active?routeId=${route.routeId}`}
                  className="flex-1 py-[var(--space-3)] text-center text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-primary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
                >
                  🥾 Démarrer
                </Link>
                <div className="w-px bg-[color:var(--lkv-border)]" aria-hidden="true" />
                <Button
                  id={`delete-offline-${route.routeId}`}
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(route.routeId)}
                  disabled={deletingId === route.routeId}
                  className="flex-1 rounded-none"
                >
                  {deletingId === route.routeId ? '⏳ Suppression…' : '🗑 Supprimer'}
                </Button>
              </div>
            </Card>
          ))
        )}

        {/* Note légale */}
        <p className="px-[var(--space-1)] pb-[var(--space-4)] text-center text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          Les tuiles de carte sont fournies par CartoDB / OpenStreetMap.
          Le cache est limité à 400 tuiles par randonnée.
        </p>
      </div>
    </AppShell>
  );
}
