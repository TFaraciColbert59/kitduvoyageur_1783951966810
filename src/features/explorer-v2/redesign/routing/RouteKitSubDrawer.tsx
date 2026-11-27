'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Backpack,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Package,
  Scale,
} from 'lucide-react';
import type { UserKitOption } from '../../routing/types';

interface ApiKitItem {
  id: string;
  name: string;
  category?: string | null;
  weight_g?: number | null;
  quantity?: number | null;
  is_checked?: boolean | null;
}

interface ApiKit {
  id: string;
  name: string;
  season?: string | null;
  total_weight_g?: number | null;
  is_favorite?: boolean | null;
  materiel_kit_items?: ApiKitItem[];
}

export interface RouteKitSubDrawerProps {
  activeKitId: string | null;
  packWeightKg: number;
  fallbackKits: readonly UserKitOption[];
  onSelectKit: (kitId: string | null, weightKg: number) => void;
  onBack: () => void;
}

const QUICK_WEIGHTS = [
  { label: 'Léger', kg: 3.0 },
  { label: 'Jour', kg: 6.0 },
  { label: 'Rando', kg: 10.0 },
  { label: 'Bivouac', kg: 15.0 },
];

function normalizeKitName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function kitComputedWeightG(kit: ApiKit): number {
  const items = kit.materiel_kit_items ?? [];
  if (typeof kit.total_weight_g === 'number' && kit.total_weight_g > 0) {
    return kit.total_weight_g;
  }
  return items.reduce((s, it) => s + (it.weight_g ?? 0) * (it.quantity ?? 1), 0);
}

function scoreKitCanonicality(kit: ApiKit, activeKitId: string | null): number {
  let score = 0;
  if (activeKitId && kit.id === activeKitId) score += 10_000;
  if (kit.is_favorite) score += 1_000;
  const itemCount = kit.materiel_kit_items?.length ?? 0;
  score += Math.min(itemCount, 100) * 10;
  if (kitComputedWeightG(kit) > 0) score += 5;
  return score;
}

function dedupeKits(rawKits: readonly ApiKit[], activeKitId: string | null): ApiKit[] {
  const byId = new Map<string, ApiKit>();
  for (const kit of rawKits) {
    if (!kit?.id) continue;
    if (!byId.has(kit.id)) {
      byId.set(kit.id, kit);
    }
  }

  const byNameOrder: string[] = [];
  const bestByName = new Map<string, ApiKit>();
  for (const kit of byId.values()) {
    const key = normalizeKitName(kit.name || kit.id);
    const existing = bestByName.get(key);
    if (!existing) {
      byNameOrder.push(key);
      bestByName.set(key, kit);
    } else if (scoreKitCanonicality(kit, activeKitId) > scoreKitCanonicality(existing, activeKitId)) {
      bestByName.set(key, kit);
    }
  }

  return byNameOrder
    .map((key) => bestByName.get(key))
    .filter((kit): kit is ApiKit => Boolean(kit));
}

export function RouteKitSubDrawer({
  activeKitId,
  packWeightKg,
  fallbackKits,
  onSelectKit,
  onBack,
}: RouteKitSubDrawerProps) {
  const [kits, setKits] = useState<ApiKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);
  const [expandedKitId, setExpandedKitId] = useState<string | null>(activeKitId);
  const [customKg, setCustomKg] = useState<number>(packWeightKg);

  useEffect(() => {
    setCustomKg(packWeightKg);
  }, [packWeightKg]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch('/api/materiel/kits')
      .then(async (res) => {
        if (res.status === 401) {
          if (!cancelled) {
            setUnauth(true);
            setLoading(false);
          }
          return;
        }
        const data = (await res.json()) as { kits?: ApiKit[] };
        if (!cancelled) {
          setKits(Array.isArray(data.kits) ? data.kits : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayKits: ApiKit[] = useMemo(() => {
    const source: ApiKit[] =
      kits.length > 0
        ? kits
        : fallbackKits.map((k) => ({
            id: k.id,
            name: k.name,
            season: k.season,
            total_weight_g: Math.round(k.weightKg * 1000),
            materiel_kit_items: [],
          }));
    return dedupeKits(source, activeKitId);
  }, [kits, fallbackKits, activeKitId]);

  return (
    <div className="xp20-route-subsheet" role="region" aria-label="Mon sac et mes kits matériel">
      <div className="xp20-route-header">
        <button
          type="button"
          className="xp20-route-icon-btn"
          onClick={onBack}
          aria-label="Retour à l’itinéraire"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="xp20-route-header-copy">
          <h2 className="xp20-route-title">Mon Kit & Sac</h2>
          <p className="xp20-route-subtitle">
            {packWeightKg.toFixed(1)} kg · impacte durée, calories & sécurité
          </p>
        </div>
        <Link
          href="/hub/kit"
          className="xp20-route-icon-btn"
          aria-label="Ouvrir mes kits matériel"
          title="Gérer mes kits"
        >
          <ExternalLink size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="xp20-route-scroll">
        {/* Visual Weight Adjuster */}
        <div className="xp20-kit-weight-card">
          <div className="xp20-kit-weight-head">
            <span>
              <Scale size={14} aria-hidden="true" /> Poids porté
            </span>
            <strong>{customKg.toFixed(1)} kg</strong>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            step={0.5}
            value={customKg}
            className="xp20-kit-slider"
            aria-label="Poids du sac en kilogrammes"
            onChange={(e) => setCustomKg(Number(e.target.value))}
            onPointerUp={() => onSelectKit(null, customKg)}
            onKeyUp={() => onSelectKit(null, customKg)}
          />
          <div className="xp20-kit-presets">
            {QUICK_WEIGHTS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="xp20-kit-preset-btn"
                data-active={Math.abs(customKg - p.kg) < 0.3 && !activeKitId ? 'true' : 'false'}
                onClick={() => {
                  setCustomKg(p.kg);
                  onSelectKit(null, p.kg);
                  onBack();
                }}
              >
                <span>{p.label}</span>
                <strong>{p.kg} kg</strong>
              </button>
            ))}
          </div>
        </div>

        {/* Real Saved LKDV Kits */}
        <div className="xp20-kit-section-head">
          <span>
            <Backpack size={13} aria-hidden="true" /> Mes kits enregistrés
          </span>
          {loading ? <Loader2 size={13} className="xp20-route-spin" aria-hidden="true" /> : null}
        </div>

        {displayKits.length > 0 ? (
          <div className="xp20-kit-list">
            {displayKits.map((kit) => {
              const items = kit.materiel_kit_items ?? [];
              const computedG =
                typeof kit.total_weight_g === 'number' && kit.total_weight_g > 0
                  ? kit.total_weight_g
                  : items.reduce((s, it) => s + (it.weight_g ?? 0) * (it.quantity ?? 1), 0);
              const kg = Math.max(0.5, Number((computedG / 1000).toFixed(1)));
              const selected = kit.id === activeKitId;
              const expanded = kit.id === expandedKitId;

              return (
                <div key={kit.id} className="xp20-kit-card" data-selected={selected ? 'true' : 'false'}>
                  <div className="xp20-kit-card-row">
                    <button
                      type="button"
                      className="xp20-kit-select-btn"
                      onClick={() => {
                        onSelectKit(kit.id, kg);
                        onBack();
                      }}
                    >
                      <span className="xp20-kit-badge">
                        {selected ? <Check size={14} aria-hidden="true" /> : <Package size={14} aria-hidden="true" />}
                      </span>
                      <div className="xp20-kit-copy">
                        <strong>{kit.name}</strong>
                        <span>
                          {kg.toFixed(1)} kg
                          {items.length > 0 ? ` · ${items.length} objets` : ''}
                          {kit.season ? ` · ${kit.season}` : ''}
                        </span>
                      </div>
                    </button>
                    {items.length > 0 ? (
                      <button
                        type="button"
                        className="xp20-xai-mini-btn"
                        aria-expanded={expanded}
                        aria-label={`Voir le contenu du kit ${kit.name}`}
                        onClick={() => setExpandedKitId(expanded ? null : kit.id)}
                      >
                        <ChevronDown
                          size={15}
                          aria-hidden="true"
                          style={{
                            transform: expanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.15s ease',
                          }}
                        />
                      </button>
                    ) : null}
                  </div>

                  {expanded && items.length > 0 ? (
                    <div className="xp20-kit-items-list">
                      {items.slice(0, 12).map((it) => (
                        <div key={it.id} className="xp20-kit-item-row">
                          <span>{it.name}</span>
                          <strong>
                            {it.weight_g ? `${it.weight_g >= 1000 ? `${(it.weight_g / 1000).toFixed(2)} kg` : `${it.weight_g} g`}` : '—'}
                          </strong>
                        </div>
                      ))}
                      {items.length > 12 ? (
                        <div className="xp20-kit-item-more">+{items.length - 12} autres équipements</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : !loading ? (
          <div className="xp20-kit-empty">
            <p>
              {unauth
                ? 'Connectez-vous pour charger vos kits et équipements personnels.'
                : 'Aucun kit enregistré pour le moment.'}
            </p>
            <Link href={unauth ? '/connexion' : '/hub/kit'} className="xp20-route-secondary-btn">
              {unauth ? 'Se connecter' : 'Créer un kit'}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
