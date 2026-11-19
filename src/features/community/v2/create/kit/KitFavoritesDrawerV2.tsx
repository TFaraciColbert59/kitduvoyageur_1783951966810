'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Backpack, BookOpen, Bookmark, FileText, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { loadCarnetKitItemsV2, loadKitItemsV2 } from '../kit/kitSourcesV2';
import type { KitItemV2 } from '../engine/createSchemasV2';

type FavTab = 'post' | 'carnet' | 'model';

interface FavItem {
  id: string;
  title: string;
  subtitle: string;
  kitId: string;
  source: 'kit' | 'carnet';
}

export interface KitFavoritesDrawerV2Props {
  open: boolean;
  userId: string;
  onClose: () => void;
  onImport: (items: KitItemV2[]) => void;
}

const TABS: { id: FavTab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'post', label: 'Posts', Icon: FileText },
  { id: 'carnet', label: 'Carnets', Icon: BookOpen },
  { id: 'model', label: 'Modèles enregistrés', Icon: Bookmark },
];

/**
 * Tiroir « Nos favoris » : permet de repartir d'un Post, Carnet ou Modèle
 * enregistré possédant un kit rattaché.
 */
export function KitFavoritesDrawerV2({
  open,
  userId,
  onClose,
  onImport,
}: KitFavoritesDrawerV2Props) {
  const [tab, setTab] = useState<FavTab>('post');
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [itemsByTab, setItemsByTab] = useState<Record<FavTab, FavItem[] | null>>({
    post: null,
    carnet: null,
    model: null,
  });

  useEffect(() => {
    if (!open) return;
    if (itemsByTab[tab] !== null) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        if (tab === 'post') {
          const { data: saves } = userId
            ? await supabase.from('post_saves').select('post_id').eq('user_id', userId).limit(40)
            : { data: [] };
          const savedIds = (saves ?? []).map((r: { post_id: string }) => r.post_id).filter(Boolean);
          let query = supabase
            .from('community_posts')
            .select('id, content, linked_kit_id')
            .not('linked_kit_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(25);
          if (savedIds.length > 0) {
            query = supabase
              .from('community_posts')
              .select('id, content, linked_kit_id')
              .in('id', savedIds)
              .not('linked_kit_id', 'is', null)
              .limit(25);
          }
          const { data: posts } = await query;
          const mapped: FavItem[] = (posts ?? [])
            .filter((p: { linked_kit_id?: string | null }) => Boolean(p.linked_kit_id))
            .map((p: { id: string; content?: string | null; linked_kit_id: string }) => ({
              id: p.id,
              title: (p.content ?? 'Publication avec kit').slice(0, 68),
              subtitle: 'Post enregistré · Kit rattaché',
              kitId: p.linked_kit_id,
              source: 'kit',
            }));
          if (!cancelled) setItemsByTab((cur) => ({ ...cur, post: mapped }));
        } else if (tab === 'carnet') {
          const { data: carnets } = await supabase
            .from('carnets')
            .select('id, title, destination, kit_id')
            .not('kit_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(25);
          const mapped: FavItem[] = (carnets ?? [])
            .filter((c: { kit_id?: string | null }) => Boolean(c.kit_id))
            .map((c: { id: string; title?: string | null; destination?: string | null; kit_id: string }) => ({
              id: c.id,
              title: c.title || 'Carnet sans titre',
              subtitle: c.destination || 'Carnet avec kit',
              kitId: c.kit_id,
              source: 'kit',
            }));
          if (!cancelled) setItemsByTab((cur) => ({ ...cur, carnet: mapped }));
        } else {
          let localSaved: string[] = [];
          try {
            localSaved = JSON.parse(localStorage.getItem('lkdv_saved_kits') || '[]') as string[];
          } catch {
            localSaved = [];
          }
          let query = supabase
            .from('materiel_kits')
            .select('id, name, total_weight_g, is_souche')
            .eq('is_trashed', false)
            .or('is_souche.eq.true,is_public.eq.true')
            .order('updated_at', { ascending: false })
            .limit(25);
          if (localSaved.length > 0) {
            query = supabase
              .from('materiel_kits')
              .select('id, name, total_weight_g, is_souche')
              .in('id', localSaved)
              .eq('is_trashed', false)
              .limit(25);
          }
          const { data: kits } = await query;
          const mapped: FavItem[] = (kits ?? []).map(
            (k: { id: string; name?: string | null; total_weight_g?: number | null }) => ({
              id: k.id,
              title: k.name || 'Modèle de kit',
              subtitle:
                k.total_weight_g && k.total_weight_g > 0
                  ? `${(k.total_weight_g / 1000).toFixed(1).replace('.', ',')} kg`
                  : 'Modèle enregistré',
              kitId: k.id,
              source: 'kit',
            }),
          );
          if (!cancelled) setItemsByTab((cur) => ({ ...cur, model: mapped }));
        }
      } catch {
        if (!cancelled) setItemsByTab((cur) => ({ ...cur, [tab]: [] }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [itemsByTab, open, tab, userId]);

  if (!open || typeof document === 'undefined') return null;

  const list = itemsByTab[tab] ?? [];

  const handleSelect = async (entry: FavItem) => {
    setImportingId(entry.id);
    try {
      const res =
        entry.source === 'carnet'
          ? await loadCarnetKitItemsV2(entry.id)
          : await loadKitItemsV2(entry.kitId);
      if (res.data.length > 0) {
        onImport(res.data);
        onClose();
      }
    } finally {
      setImportingId(null);
    }
  };

  const activeTabIndex = Math.max(
    0,
    TABS.findIndex((t) => t.id === tab),
  );

  return createPortal(
    <>
      <div className="lkdv-cv2c-stack-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="lkdv-cv2c-stack-overlay" role="dialog" aria-modal="true" aria-label="Nos favoris">
        <div className="lkdv-cv2-grab" aria-hidden="true">
          <span />
        </div>
        <div className="lkdv-cv2c-stack-head">
          <button
            type="button"
            className="lkdv-cv2c-stack-close"
            aria-label="Fermer Nos favoris"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <div
            className="segc lg-tabs lens-on lkdv-capsule lkdv-cv2-capsule lkdv-cv2c-stack-capsule"
            role="tablist"
            aria-label="Type de favoris"
            style={{ '--n': TABS.length } as React.CSSProperties}
          >
            <span
              className="sel-lens"
              aria-hidden="true"
              style={{ '--i': activeTabIndex } as React.CSSProperties}
            />
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  title={label}
                  className={active ? 'active' : ''}
                  onClick={() => setTab(id)}
                >
                  <span className="ic s">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      <div className="lkdv-cv2c-stack-body">
        {loading ? (
          <p className="lkdv-cv2-field-hint" style={{ padding: 16 }} role="status">
            <Loader2 size={14} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement…
          </p>
        ) : list.length === 0 ? (
          <div className="lkdv-cv2c-stack-empty">
            <Backpack size={22} aria-hidden="true" />
            <b>Aucun favori avec kit rattaché</b>
            <small>Enregistre des publications, carnets ou modèles contenant un kit pour les retrouver ici.</small>
          </div>
        ) : (
          <ul className="lkdv-cv2c-fav-list" role="list">
            {list.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="lkdv-cv2c-fav-row"
                  disabled={importingId === entry.id}
                  onClick={() => void handleSelect(entry)}
                >
                  <span className="lkdv-cv2c-fav-ico" aria-hidden="true">
                    <Backpack size={15} />
                  </span>
                  <span className="lkdv-cv2c-fav-txt">
                    <b>{entry.title}</b>
                    <small>{entry.subtitle}</small>
                  </span>
                  {importingId === entry.id ? (
                    <Loader2 size={14} className="lkdv-cv2c-spin" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </>,
    document.body,
  );
}
