'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Backpack,
  Compass,
  Droplets,
  Flame,
  Lamp,
  Package,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tent,
} from 'lucide-react';
import type {
  CarnetDetail,
  CarnetKit,
  CarnetKitItemRow,
  KitVerdictType,
} from '@/features/carnet/detail/types';
import { AnimatedNumber, CARNET_SPRING, StaggerCard, StaggerList } from './CarnetDrawerMotion';

const CATEGORY_ORDER = [
  'Portage',
  'Abri',
  'Sommeil',
  'Cuisine',
  'Eau',
  'Nutrition',
  'Vêtements',
  'Électronique',
  'Sécurité',
  'Navigation',
  'Hygiène',
  'Réparation',
  'Divers',
] as const;

const CHART_COLORS = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d'] as const;

function renderCategoryIcon(category: string, size = 13) {
  switch (category) {
    case 'Portage':
      return <Backpack size={size} aria-hidden="true" />;
    case 'Abri':
    case 'Sommeil':
      return <Tent size={size} aria-hidden="true" />;
    case 'Cuisine':
    case 'Nutrition':
      return <Flame size={size} aria-hidden="true" />;
    case 'Eau':
      return <Droplets size={size} aria-hidden="true" />;
    case 'Vêtements':
      return <Shirt size={size} aria-hidden="true" />;
    case 'Électronique':
      return <Lamp size={size} aria-hidden="true" />;
    case 'Sécurité':
      return <ShieldCheck size={size} aria-hidden="true" />;
    case 'Navigation':
      return <Compass size={size} aria-hidden="true" />;
    case 'Hygiène':
    case 'Réparation':
      return <Sparkles size={size} aria-hidden="true" />;
    default:
      return <ShoppingBag size={size} aria-hidden="true" />;
  }
}

function inferCategory(item: CarnetKitItemRow): string {
  if (item.category && (CATEGORY_ORDER as readonly string[]).includes(item.category)) {
    return item.category;
  }
  const text = `${item.name} ${item.detail ?? ''}`.toLowerCase();
  if (/sac\s*\d|sac à dos|bâton|baton|portage/.test(text)) return 'Portage';
  if (/tente|tarp|bivouac|abri|sardine|arceau/.test(text)) return 'Abri';
  if (/duvet|matelas|oreiller|sac de couchage|couchage|drap/.test(text)) return 'Sommeil';
  if (/réchaud|rechaud|popote|gaz|briquet|couteau|spork|tasse|cuisine/.test(text)) return 'Cuisine';
  if (/eau|gourde|flasque|poche à eau|filtre|pastille/.test(text)) return 'Eau';
  if (/repas|lyo|barre|gel|nutrition|café|thé|nourriture/.test(text)) return 'Nutrition';
  if (/veste|polaire|doudoune|pantalon|chaussette|gant|bonnet|casquette|t-shirt|merino|mérinos|coupe-vent|cape|poncho/.test(text)) {
    return 'Vêtements';
  }
  if (/frontale|lampe|batterie|powerbank|gps|montre|téléphone|câble|chargeur|panneau/.test(text)) {
    return 'Électronique';
  }
  if (/secours|trousse|casque|crampon|piolet|couverture de survie|sifflet|dva|pelle|sonde/.test(text)) {
    return 'Sécurité';
  }
  if (/carte|boussole|topo|ign/.test(text)) return 'Navigation';
  if (/hygiène|brosse|savon|serviette|crème|mouchoir/.test(text)) return 'Hygiène';
  if (/réparation|scotch|duct|rustine|colle|aiguille/.test(text)) return 'Réparation';
  return 'Divers';
}

function layerOfItem(item: CarnetKitItemRow, category: string): 'porte' | 'sac' | 'conso' {
  if (item.carryMode === 'porte' || item.carryMode === 'sac' || item.carryMode === 'conso') {
    return item.carryMode;
  }
  const norm = category.toLowerCase();
  if (norm === 'vêtements' || norm === 'vetements') return 'porte';
  if (norm === 'eau' || norm === 'nutrition') return 'conso';
  return 'sac';
}

function formatWeight(grams: number | null | undefined): string {
  const g = Math.max(0, Math.round(grams ?? 0));
  if (g >= 1000) {
    return `${(g / 1000).toFixed(1).replace('.', ',')} kg`;
  }
  return `${g} g`;
}

function formatKg(grams: number | null | undefined): string {
  const g = Math.max(0, Math.round(grams ?? 0));
  return `${(g / 1000).toFixed(1).replace('.', ',')} kg`;
}

function weightGoalLabel(weightG: number): { label: string; maxG: number } {
  if (weightG <= 4500) return { label: 'Ultraléger', maxG: 4500 };
  if (weightG <= 7500) return { label: 'Léger', maxG: 7500 };
  return { label: 'Standard', maxG: 20000 };
}

const VERDICT_LABELS: Record<KitVerdictType, string> = {
  essentiel: 'Essentiel',
  utile: 'Utile',
  jamais_servi: 'Jamais servi',
  defaillant: 'Défaillant',
  manquait: 'Manquait',
  top: 'Top',
  flop: 'Flop',
  neutre: 'Neutre',
};

const VERDICT_STYLES: Record<KitVerdictType, { bg: string; color: string }> = {
  essentiel: { bg: 'var(--mint, #E1EBDE)', color: 'var(--good, #3D7A52)' },
  utile: { bg: 'var(--fill2, rgba(23,43,36,.06))', color: 'var(--info, #4B6B7C)' },
  jamais_servi: { bg: 'var(--fill2, rgba(23,43,36,.06))', color: 'var(--label2, #56665D)' },
  defaillant: { bg: 'var(--bad-bg, #F5DDD9)', color: 'var(--bad, #A8443A)' },
  manquait: { bg: 'var(--warn-bg, #FBF1DC)', color: 'var(--warn, #B98A2E)' },
  top: { bg: 'var(--mint, #E1EBDE)', color: 'var(--good, #3D7A52)' },
  flop: { bg: 'var(--bad-bg, #F5DDD9)', color: 'var(--bad, #A8443A)' },
  neutre: { bg: 'var(--fill2, rgba(23,43,36,.06))', color: 'var(--label2, #56665D)' },
};

interface CarnetKitDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  initialUserId?: string | null;
  verdictFilter: 'all' | KitVerdictType;
  onVerdictFilterChange: (next: 'all' | KitVerdictType) => void;
  onSelectItem: (item: CarnetKitItemRow) => void;
  onForkAll: (ids: string[]) => void;
}

export function CarnetKitDrawerBody({
  detail,
  lensId,
  initialUserId,
  verdictFilter,
  onVerdictFilterChange,
  onSelectItem,
  onForkAll,
}: CarnetKitDrawerBodyProps) {
  const participants = detail.participants ?? [];
  const defaultUserId = initialUserId ?? detail.author?.id ?? participants[0]?.userId ?? null;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(defaultUserId);

  useEffect(() => {
    if (initialUserId) setSelectedUserId(initialUserId);
  }, [initialUserId]);

  const activeUserId = useMemo(() => {
    if (selectedUserId && participants.some((p) => p.userId === selectedUserId)) {
      return selectedUserId;
    }
    return defaultUserId;
  }, [selectedUserId, participants, defaultUserId]);

  const activeParticipant = useMemo(
    () => participants.find((p) => p.userId === activeUserId) ?? null,
    [participants, activeUserId],
  );

  const activeKit: CarnetKit & { kitName?: string | null } = useMemo(() => {
    if (activeUserId && detail.memberKits?.[activeUserId]) {
      return detail.memberKits[activeUserId];
    }
    if (!activeUserId || activeUserId === detail.author?.id) {
      return detail.kit;
    }
    return { totalWeightG: null, items: [] };
  }, [activeUserId, detail]);

  const totalWeightG = useMemo(() => {
    if (typeof activeKit.totalWeightG === 'number' && activeKit.totalWeightG > 0) {
      return activeKit.totalWeightG;
    }
    return activeKit.items.reduce(
      (sum, item) => sum + (item.weightG ?? 0) * (item.quantity ?? 1),
      0,
    );
  }, [activeKit]);

  const layers = useMemo(() => {
    const out = { porte: 0, sac: 0, conso: 0 };
    for (const item of activeKit.items) {
      const cat = inferCategory(item);
      const layer = layerOfItem(item, cat);
      out[layer] += (item.weightG ?? 0) * (item.quantity ?? 1);
    }
    return out;
  }, [activeKit.items]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, CarnetKitItemRow[]>();
    for (const item of activeKit.items) {
      const cat = inferCategory(item);
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a[0] as (typeof CATEGORY_ORDER)[number]) -
        CATEGORY_ORDER.indexOf(b[0] as (typeof CATEGORY_ORDER)[number]),
    );
  }, [activeKit.items]);

  const categoryTotals = useMemo(() => {
    return groupedItems
      .map(([cat, items]) => ({
        name: cat,
        weightG: items.reduce((sum, i) => sum + (i.weightG ?? 0) * (i.quantity ?? 1), 0),
      }))
      .filter((entry) => entry.weightG > 0)
      .sort((a, b) => b.weightG - a.weightG)
      .slice(0, 5);
  }, [groupedItems]);

  const userRail =
    participants.length > 1 ? (
      <div
        className="lkdv-carnet-kit-users-rail"
        role="tablist"
        aria-label="Équipement par participant"
      >
        {participants.map((p) => {
          const active = p.userId === activeUserId;
          const displayName = p.name?.trim() || p.handle?.trim() || 'Voyageur';
          const shortName = displayName.split(' ')[0] || displayName;
          const initial = shortName.slice(0, 1).toUpperCase();
          const pKit =
            detail.memberKits?.[p.userId] ??
            (p.userId === detail.author?.id ? detail.kit : undefined);
          const pWeight =
            pKit?.totalWeightG && pKit.totalWeightG > 0 ? formatKg(pKit.totalWeightG) : null;
          return (
            <button
              key={p.userId}
              type="button"
              role="tab"
              aria-selected={active}
              className={`lkdv-carnet-kit-user-pill${active ? ' is-active' : ''}`}
              onClick={() => setSelectedUserId(p.userId)}
            >
              <span className="lkdv-carnet-kit-user-avatar" aria-hidden="true">
                {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initial}
              </span>
              <span className="lkdv-carnet-kit-user-name">{shortName}</span>
              {pWeight ? <span className="lkdv-carnet-kit-user-wt">{pWeight}</span> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  const goal = weightGoalLabel(totalWeightG);
  const ringPercent = totalWeightG > 0 ? Math.min(100, Math.round((totalWeightG / goal.maxG) * 100)) : 0;
  const layerTotal = Math.max(1, layers.porte + layers.sac + layers.conso);

  const weightPanel = (
    <div className="lkdv-carnet-kit-weight-panel">
      <div
        className="lkdv-carnet-kit-ring"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.maxG}
        aria-valuenow={totalWeightG}
        aria-label={`Poids total ${formatKg(totalWeightG)}`}
        style={{ '--p': ringPercent } as React.CSSProperties}
      >
        <div className="lkdv-carnet-kit-ring-core">
          <b>
            <AnimatedNumber
              value={Number((totalWeightG / 1000).toFixed(1))}
              suffix=" kg"
              maximumFractionDigits={1}
            />
          </b>
          <small>{goal.label}</small>
        </div>
      </div>
      <div className="lkdv-carnet-kit-weight-side">
        <div className="lkdv-carnet-kit-layers" role="group" aria-label="Sac en couches">
          {([
            ['porte', 'Porté'],
            ['sac', 'Sac'],
            ['conso', 'Consommable'],
          ] as const).map(([key, label]) => (
            <span key={key} className="lkdv-carnet-kit-layer" data-layer={key}>
              <motion.i
                aria-hidden="true"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((layers[key] / layerTotal) * 100)}%` }}
                transition={CARNET_SPRING}
              />
              <b>{label}</b>
              <small>{formatKg(layers[key])}</small>
            </span>
          ))}
        </div>
        <small>
          {activeKit.items.length} objet{activeKit.items.length > 1 ? 's' : ''} · {formatKg(totalWeightG)}
          {activeKit.kitName ? ` · ${activeKit.kitName}` : ''}
        </small>
      </div>
    </div>
  );

  if (lensId === 'kit') {
    if (activeKit.items.length === 0) {
      const targetName =
        activeParticipant?.name?.trim() || activeParticipant?.handle?.trim() || null;
      return (
        <div style={{ position: 'relative', minHeight: '100%' }}>
          {userRail}
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px', color: 'var(--label)' }}>
              {participants.length > 1 && targetName
                ? `Aucun équipement partagé pour ${targetName}`
                : 'Aucun équipement renseigné dans ce carnet'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--label2)' }}>
              {participants.length > 1
                ? 'Le matériel apparaîtra ici lorsque ce participant partagera son kit.'
                : 'Le matériel emporté apparaîtra ici lorsque l’auteur complètera son sac.'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="lkdv-carnet-kit-pane" style={{ position: 'relative', minHeight: '100%', paddingBottom: '56px' }}>
        {userRail}
        <div className="lkdv-carnet-kit-stack">
          {weightPanel}

          <div className="lkdv-carnet-kit-groups">
            {groupedItems.map(([category, groupItems]) => {
              const catWeightG = groupItems.reduce(
                (sum, item) => sum + (item.weightG ?? 0) * (item.quantity ?? 1),
                0,
              );
              return (
                <section key={category} className="lkdv-carnet-kit-group" data-kit-category={category}>
                  <div className="lkdv-carnet-kit-group-head">
                    {renderCategoryIcon(category, 14)}
                    <span>{category}</span>
                    <small>
                      {groupItems.length} · {formatWeight(catWeightG)}
                    </small>
                  </div>
                  <div className="lkdv-carnet-kit-plus-row">
                    {groupItems.map((item) => {
                      const qty = item.quantity ?? 1;
                      const itemWeightG = (item.weightG ?? 0) * qty;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="lkdv-carnet-kit-mini-tile"
                          onClick={() => onSelectItem(item)}
                        >
                          <div className="lkdv-carnet-kit-mini-tile-top">
                            <span className="lkdv-carnet-kit-mini-ico" aria-hidden="true">
                              {renderCategoryIcon(category, 13)}
                            </span>
                            {qty > 1 ? (
                              <span className="lkdv-carnet-kit-mini-qty">×{qty}</span>
                            ) : null}
                          </div>
                          <b title={item.name}>{item.name}</b>
                          <div className="lkdv-carnet-kit-mini-tile-foot">
                            <small>{item.weightG ? formatWeight(itemWeightG) : '—'}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (lensId === 'verdicts') {
    const verdictsList = activeKit.items.filter((i) => i.verdict);
    const filtered = verdictsList.filter((v) => {
      if (verdictFilter === 'all') return true;
      return v.verdict === verdictFilter;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px' }}>
        {userRail}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
          }}
        >
          {(
            [
              ['all', 'Tous'],
              ['essentiel', 'Essentiels'],
              ['utile', 'Utiles'],
              ['jamais_servi', 'Jamais servis'],
              ['defaillant', 'Défaillants'],
              ['manquait', 'Manquants'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onVerdictFilterChange(key)}
              style={{
                flexShrink: 0,
                height: '28px',
                padding: '0 10px',
                borderRadius: '99px',
                border: 0,
                background:
                  verdictFilter === key ? '#1B4332' : 'var(--fill2, rgba(23,43,36,0.08))',
                color: verdictFilter === key ? '#FFFFFF' : 'var(--label)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--label2)' }}>
            Aucun verdict dans cette catégorie.
          </div>
        ) : null}

        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              background: 'var(--drawer-card-bg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: '13px' }}>{item.name}</b>
              {item.verdict ? (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: VERDICT_STYLES[item.verdict]?.bg ?? '#EFEFEA',
                    color: VERDICT_STYLES[item.verdict]?.color ?? '#1E2C24',
                  }}
                >
                  {VERDICT_LABELS[item.verdict] ?? item.verdict}
                </span>
              ) : null}
            </div>
            {item.verdictNote ? (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--label2)' }}>
                « {item.verdictNote} »
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  // lensId === 'poids'
  const canObserveResize = typeof ResizeObserver !== 'undefined';
  const chartData = categoryTotals.map((c) => ({
    name: c.name,
    kg: Number((c.weightG / 1000).toFixed(2)),
    weightG: c.weightG,
  }));
  const maxCategoryG = Math.max(1, ...categoryTotals.map((c) => c.weightG));
  const heaviestItems = [...activeKit.items]
    .filter((i) => (i.weightG ?? 0) > 0)
    .sort((a, b) => (b.weightG ?? 0) * (b.quantity ?? 1) - (a.weightG ?? 0) * (a.quantity ?? 1))
    .slice(0, 3);

  return (
    <StaggerList className="lkdv-carnet-kit-pane">
      {userRail}
      <div className="lkdv-carnet-kit-stack">
        {weightPanel}
        {chartData.length > 0 ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Répartition par catégorie (kg)</span>
            {canObserveResize ? (
              <div style={{ width: '100%', height: Math.max(92, chartData.length * 28) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={82}
                      tick={{ fontSize: 11, fill: '#111827' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(v) => [`${v} kg`, 'Poids']} />
                    <Bar dataKey="kg" radius={[0, 6, 6, 0]} barSize={14}>
                      {chartData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="lkdv-carnet-kit-bars">
                {categoryTotals.map((entry, idx) => (
                  <div key={entry.name} className="lkdv-carnet-kit-bar-row">
                    <span className="lkdv-carnet-kit-bar-label">{entry.name}</span>
                    <div className="lkdv-carnet-kit-bar-track">
                      <div
                        className="lkdv-carnet-kit-bar-fill"
                        style={{
                          width: `${Math.max(8, Math.round((entry.weightG / maxCategoryG) * 100))}%`,
                          background: CHART_COLORS[idx % CHART_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="lkdv-carnet-kit-bar-val">{formatKg(entry.weightG)}</span>
                  </div>
                ))}
              </div>
            )}
          </StaggerCard>
        ) : null}

        {heaviestItems.length > 0 ? (
          <StaggerCard className="lkdv-carnet-chart-card">
            <span className="lkdv-carnet-kit-eyebrow">Top 3 objets les plus lourds</span>
            <div className="lkdv-carnet-cards-col">
              {heaviestItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className="lkdv-carnet-budget-row"
                  style={{ width: '100%', border: 0, cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => onSelectItem(item)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="lkdv-carnet-chip-dark">#{idx + 1}</span>
                    <b>{item.name}</b>
                  </div>
                  <b>{formatWeight((item.weightG ?? 0) * (item.quantity ?? 1))}</b>
                </button>
              ))}
            </div>
          </StaggerCard>
        ) : null}
      </div>
    </StaggerList>
  );
}
