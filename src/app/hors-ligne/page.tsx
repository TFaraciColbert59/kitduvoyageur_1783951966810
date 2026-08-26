'use client';

import React, { useEffect, useState, useCallback } from 'react';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { listOfflineRoutes, getOfflineTileSize, formatSize, type OfflineRoute } from '@/lib/offlineStorage';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
import Link from 'next/link';

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
    if (!confirm('Supprimer cette randonnée du stockage hors-ligne ?')) return;
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
    <MobilePageShell background="#F8F5EE">
      <div className="min-h-screen bg-[#F8F5EE]">
        {/* Header */}
        <div className="bg-[#17402C] text-white px-4 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/explorer"
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Retour"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">Hors-ligne</h1>
          </div>
          <p className="text-white/55 text-sm ml-11">
            Randonnées disponibles sans connexion
          </p>
        </div>

        {/* Résumé stockage */}
        {!loading && routes.length > 0 && (
          <div className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-[#E8E4D8] flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#EDF7F0] flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💾</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#17402C]">
                {routes.length} randonnée{routes.length > 1 ? 's' : ''} stockée{routes.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-[#7A8A7D]">
                {totalTiles} tuiles · {formatSize(totalBytes)}
              </p>
            </div>
          </div>
        )}

        {/* Contenu */}
        <div className="px-4 py-4 space-y-3">
          {loading ? (
            // Skeletons
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-[#E8E4D8] animate-pulse">
                <div className="h-4 bg-[#E8E4D8] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[#E8E4D8] rounded w-1/2" />
              </div>
            ))
          ) : routes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#E8E4D8] flex items-center justify-center mb-4">
                <span className="text-3xl">📵</span>
              </div>
              <h2 className="text-base font-semibold text-[#17402C] mb-1">
                Aucune randonnée hors-ligne
              </h2>
              <p className="text-sm text-[#7A8A7D] max-w-60">
                Depuis la page d&apos;une randonnée, appuie sur &ldquo;Télécharger pour hors-ligne&rdquo; avant de partir.
              </p>
              <Link
                href="/explorer"
                className="mt-6 px-5 py-2.5 bg-[#17402C] text-white text-sm font-semibold rounded-xl hover:bg-[#2D3F35] transition-colors"
              >
                Explorer les randonnées
              </Link>
            </div>
          ) : (
            routes.map((route) => (
              <div
                key={route.routeId}
                className="bg-white rounded-2xl border border-[#E8E4D8] overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#17402C] leading-tight line-clamp-2">
                        {route.name}
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {route.distanceKm && (
                          <span className="text-xs text-[#7A8A7D]">
                            📏 {route.distanceKm.toFixed(1)} km
                          </span>
                        )}
                        {route.difficulty && (
                          <span className="text-xs text-[#7A8A7D] capitalize">
                            🎯 {route.difficulty}
                          </span>
                        )}
                        <span className="text-xs text-[#7A8A7D]">
                          💾 {formatSize(route.sizeBytes)} · {route.tileCount} tuiles
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A0A89D] mt-1">
                        Téléchargé le {formatDate(route.cachedAt)}
                      </p>
                    </div>

                    {/* Badge offline */}
                    <span className="flex-shrink-0 px-2 py-1 bg-[#EDF7F0] text-[#2D6A4F] text-[11px] font-semibold rounded-full border border-[#B7E4C7]">
                      ✅ Hors-ligne
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-[#F0EDE5] flex">
                  <Link
                    href={`/randonnee-active?routeId=${route.routeId}`}
                    className="flex-1 py-3 text-center text-xs font-semibold text-[#2D5A27] hover:bg-[#EDF7F0] transition-colors"
                  >
                    🥾 Démarrer
                  </Link>
                  <div className="w-px bg-[#F0EDE5]" />
                  <button
                    id={`delete-offline-${route.routeId}`}
                    onClick={() => handleDelete(route.routeId)}
                    disabled={deletingId === route.routeId}
                    className="flex-1 py-3 text-center text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === route.routeId ? '⏳ Suppression…' : '🗑 Supprimer'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Note légale */}
        <div className="px-4 pb-8">
          <p className="text-[11px] text-[#A0A89D] text-center leading-relaxed">
            Les tuiles de carte sont fournies par CartoDB / OpenStreetMap.
            Le cache est limité à 400 tuiles par randonnée.
          </p>
        </div>
      </div>
    </MobilePageShell>
  );
}
