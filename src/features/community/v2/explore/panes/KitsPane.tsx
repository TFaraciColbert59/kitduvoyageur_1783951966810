'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { KitFilter } from '../../shared/types';
import { KitRectangularPreviewV2 } from '../../create/forms/KitFormV2';
import type { KitFormValuesV2, KitItemV2 } from '../../create/engine/createSchemasV2';
import { ExploreEmpty, ExploreError, ExploreOfflineBanner, ExploreSkeleton } from '../ExploreStates';
import { ExploreWorldMap } from '../details/LazyExploreWorldMap';
import { Check, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ExploreKitEntry {
  id: string;
  values: Pick<KitFormValuesV2, 'name' | 'model' | 'season' | 'seasons' | 'goal'>;
  items: KitItemV2[];
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
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
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
              layer: 'sac',
              ownershipId: null,
              productId: null,
            });
            itemsByKit.set(kId, list);
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
              goal: 'leger',
            },
            items: itemsByKit.get(id) ?? [],
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
          description="Compose ton sac en couches et partage ton kit avec la communauté."
        >
          <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--primary" onClick={onCreateKit}>
            Créer un kit
          </button>
        </ExploreEmpty>
      </div>
    );
  }

  const handleImport = async (kitId: string) => {
    if (!userId) {
      toast.info('Connecte-toi pour importer un kit.');
      return;
    }
    setImportingId(kitId);
    try {
      const res = await fetch('/api/materiel/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId }),
      });
      if (!res.ok) throw new Error('Import impossible');
      setImportedIds((prev) => [...prev, kitId]);
      toast.success('Kit importé dans ton matériel.');
    } catch {
      toast.error('Impossible d’importer ce kit.');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="lkdv-cv2x-pane">
      {!online ? <ExploreOfflineBanner /> : null}
      <div className="lkdv-cv2x-hrail" data-hscroll="" role="list" aria-label="Liste des kits">
        {kits.map((kit) => {
          const isImported = importedIds.includes(kit.id);
          return (
            <div key={kit.id} className="lkdv-cv2x-hrail-item lkdv-cv2x-hrail-item--wide" role="listitem">
              <KitRectangularPreviewV2 items={kit.items} values={kit.values} />
              <div className="lkdv-cv2x-kit-bar">
                <button
                  type="button"
                  className="lkdv-feed-kit-import-pill"
                  disabled={importingId === kit.id || isImported}
                  onClick={() => void handleImport(kit.id)}
                >
                  {isImported ? <Check size={12} aria-hidden="true" /> : <Download size={12} aria-hidden="true" />}
                  <span>{isImported ? 'Importé' : importingId === kit.id ? 'Import…' : 'Importer dans mon matériel'}</span>
                </button>
              </div>
            </div>
          );
        })}
        <div ref={sentinelRef} className="lkdv-cv2x-hrail-sentinel" aria-hidden="true" />
      </div>
    </div>
  );
}

export default KitsPane;
