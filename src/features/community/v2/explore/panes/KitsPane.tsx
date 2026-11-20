'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { KitFilter } from '../../shared/types';
import { KitRectangularPreviewV2 } from '../../create/forms/KitFormV2';
import type { KitFormValuesV2, KitItemV2 } from '../../create/engine/createSchemasV2';
import { ExploreEmpty, ExploreError, ExploreOfflineBanner, ExploreSkeleton } from '../ExploreStates';
import { ExploreWorldMap } from '../details/LazyExploreWorldMap';
import { normalizeRouteTrace } from '../../data/communityFeedMappers';
import { routeTraceFromMapPoints } from '../../data/communityDetails';

function kitSvgPath(points: ReadonlyArray<[number, number]>): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

interface KitUsageTrace {
  label: string;
  points: Array<[number, number]>;
}

interface ExploreKitEntry {
  id: string;
  values: Pick<KitFormValuesV2, 'name' | 'model' | 'season' | 'seasons' | 'goal'>;
  items: KitItemV2[];
  usage?: KitUsageTrace | null;
}

export interface KitsPaneProps {
  filter: KitFilter;
  userId: string | null;
  online: boolean;
  onCreateKit: () => void;
}

const PAGE_SIZE = 10;

export function KitsPane({ filter, userId, online, onCreateKit }: KitsPaneProps) {
  const [kits, setKits] = useState<ExploreKitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (filter === 'map') return;
      if (filter === 'mine' && !userId) {
        setKits([]);
        setLoading(false);
        setHasMore(false);
        return;
      }
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const supabase = createClient();
        let query = supabase
          .from('materiel_kits')
          .select('id, name, season, created_at')
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (filter === 'mine' && userId) {
          query = query.eq('user_id', userId);
        } else {
          query = query.eq('is_public', true);
        }
        const { data: kitRows, error: qErr } = await query;
        if (qErr) throw qErr;
        const rows = (kitRows ?? []) as Array<Record<string, unknown>>;
        const kitIds = rows.map((r) => String(r.id));
        let itemsByKit = new Map<string, KitItemV2[]>();
        if (kitIds.length > 0) {
          const { data: itemRows } = await supabase
            .from('materiel_kit_items')
            .select('id, kit_id, name, category, weight_g, quantity, is_checked')
            .in('kit_id', kitIds)
            .limit(300);
          for (const ir of (itemRows ?? []) as Array<Record<string, unknown>>) {
            const kId = String(ir.kit_id ?? '');
            const list = itemsByKit.get(kId) ?? [];
            list.push({
              id: String(ir.id ?? ''),
              name: String(ir.name ?? 'Objet'),
              category: String(ir.category ?? 'Divers'),
              weightG: Number(ir.weight_g ?? 0) || 0,
              quantity: Math.max(1, Number(ir.quantity ?? 1) || 1),
              isChecked: Boolean(ir.is_checked ?? true),
              ownershipId: null,
              productId: null,
            });
            itemsByKit.set(kId, list);
          }
        }
        let usageByKit = new Map<string, KitUsageTrace>();
        if (filter === 'mine' && kitIds.length > 0) {
          const [{ data: eventRows }, { data: postRows }] = await Promise.all([
            supabase
              .from('events')
              .select('id, title, location, kit_id')
              .in('kit_id', kitIds)
              .limit(40),
            supabase
              .from('community_posts')
              .select('linked_kit_id, creation_meta, snapshot_payload')
              .in('linked_kit_id', kitIds)
              .limit(40),
          ]);
          for (const er of (eventRows ?? []) as Array<Record<string, unknown>>) {
            const kId = String(er.kit_id ?? '');
            if (!kId || usageByKit.has(kId)) continue;
            usageByKit.set(kId, {
              label: String(er.title ?? er.location ?? 'Sortie'),
              points: [],
            });
          }
          const carnetIds = new Set<string>();
          const postCarnetByKit = new Map<string, string>();
          for (const pr of (postRows ?? []) as Array<Record<string, unknown>>) {
            const kId = String(pr.linked_kit_id ?? '');
            const meta = (pr.creation_meta ?? pr.snapshot_payload ?? {}) as Record<string, unknown>;
            const rawTrace = normalizeRouteTrace(
              meta.trace ?? (meta.map_points as { trace?: unknown } | undefined)?.trace,
            );
            if (kId && rawTrace && rawTrace.length >= 2) {
              usageByKit.set(kId, {
                label: typeof meta.title === 'string' && meta.title ? meta.title : 'Itinéraire',
                points: rawTrace,
              });
            }
            const cid = meta.carnet_id;
            if (kId && typeof cid === 'string' && cid) {
              carnetIds.add(cid);
              postCarnetByKit.set(cid, kId);
            }
          }
          if (carnetIds.size > 0) {
            const { data: carnetRows } = await supabase
              .from('carnets')
              .select('id, title, destination, map_points')
              .in('id', Array.from(carnetIds));
            for (const cr of (carnetRows ?? []) as Array<Record<string, unknown>>) {
              const kId = postCarnetByKit.get(String(cr.id ?? ''));
              if (!kId) continue;
              const pts = normalizeRouteTrace(routeTraceFromMapPoints(cr.map_points)) ?? [];
              usageByKit.set(kId, {
                label: String(cr.title ?? cr.destination ?? 'Carnet'),
                points: pts,
              });
            }
          }
        }
        const entries: ExploreKitEntry[] = rows.map((r) => {
          const id = String(r.id);
          return {
            id,
            values: {
              name: String(r.name ?? 'Kit d’aventure'),
              model: 'bivouac',
              season: (String(r.season ?? 'toute_saison') as KitFormValuesV2['season']),
              seasons: [],
              goal: 'light',
            },
            items: itemsByKit.get(id) ?? [],
            usage: usageByKit.get(id) ?? null,
          };
        });
        setKits((prev) =>
          replace ? entries : [...prev, ...entries.filter((e) => !prev.some((p) => p.id === e.id))],
        );
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        if (replace) setError('Kits indisponibles pour le moment.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, userId],
  );

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadPage(kits.length, false);
        }
      },
      { rootMargin: '120px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, kits.length, loadPage, loading, loadingMore]);

  if (filter === 'map') {
    return (
      <div className="lkdv-cv2x-pane lkdv-cv2x-pane--map">
        <ExploreWorldMap kind="kits" />
      </div>
    );
  }

  if (error && kits.length === 0) {
    return (
      <div className="lkdv-cv2x-pane">
        <ExploreError title="Kits indisponibles" onRetry={() => void loadPage(0, true)} />
      </div>
    );
  }

  if (loading && kits.length === 0) {
    return (
      <div className="lkdv-cv2x-pane">
        <ExploreSkeleton variant="tickets" />
      </div>
    );
  }

  if (!loading && kits.length === 0) {
    return (
      <div className="lkdv-cv2x-pane">
        <ExploreEmpty
          icon="backpack"
          title={filter === 'mine' ? 'Aucun kit créé' : 'Aucun kit partagé'}
          description={
            filter === 'mine'
              ? 'Compose ton premier kit matériel pour le retrouver ici avec son tracé.'
              : 'Partage ton sac et ton équipement pour inspirer la communauté.'
          }
        >
          <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateKit}>
            Créer un kit
          </button>
        </ExploreEmpty>
      </div>
    );
  }

  return (
    <div className="lkdv-cv2x-pane">
      {!online ? <ExploreOfflineBanner /> : null}
      <div className="lkdv-cv2x-hrail" data-hscroll="" role="list" aria-label="Liste des kits">
        {kits.map((kit) => {
          const svgPath = kit.usage && kit.usage.points.length >= 2 ? kitSvgPath(kit.usage.points) : null;
          return (
            <div key={kit.id} className="lkdv-cv2x-hrail-item lkdv-cv2x-hrail-item--wide lkdv-cv2x-kit-card-wrap" role="listitem">
              <KitRectangularPreviewV2 items={kit.items} values={kit.values} />
              {filter === 'mine' && kit.usage ? (
                <span className="lkdv-cv2x-kit-trace-pill lkdv-cv2x-kit-trace-pill--top" title={kit.usage.label}>
                  {svgPath ? (
                    <svg width="24" height="18" viewBox="0 0 100 100" aria-hidden="true">
                      <path d={svgPath} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                  <span>{kit.usage.label}</span>
                </span>
              ) : null}
            </div>
          );
        })}
        <div ref={sentinelRef} className="lkdv-cv2x-hrail-sentinel" aria-hidden="true" />
      </div>
    </div>
  );
}

export default KitsPane;
