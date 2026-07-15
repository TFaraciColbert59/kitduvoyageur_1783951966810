'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useChat } from '@/lib/hooks/useChat';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopProduct {
  id: string;
  product_id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  category_main: string;
  category_sub: string;
  price_eur: number;
  weight_g: number;
  weight_grams: number;
  dimensions: string;
  materials: string;
  warranty: string;
  description_why: string;
  advantages_array: string[];
  disadvantages_array: string[];
  alt_premium_id: string | null;
  alt_budget_id: string | null;
  available_europe: boolean;
  available_usa: boolean;
  score_quality: number;
  score_price: number;
  score_durability: number;
  source_review: string;
  score_kdv: number;
  essentiality: string;
  versatility_10: number;
  cabin_compatible: boolean;
  repairability_10: number;
  travel_types_array: string[];
  climates_array: string[];
  justification_ai: string;
  image: string;
  image_alt: string;
  rating: number;
  review_count: number;
  available: boolean;
  is_active: boolean;
  deleted_at: string | null;
  stock: number;
  created_at: string;
  updated_at: string;
}

interface Compatibility {
  id: string;
  product_id_1: string;
  product_id_2: string;
  relation_type: string;
  notes: string;
}

interface Alternative {
  id: string;
  original_product_id: string;
  substitute_product_id: string;
  priority: number;
  reason: string;
}

interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_table: string;
  target_id: string;
  target_name: string;
  created_at: string;
}

type AdminView = 'dashboard' | 'list' | 'form' | 'relations' | 'import' | 'audit';

const ESSENTIALITY_OPTIONS = ['Indispensable', 'Recommandé', 'Confort', 'Luxe'];
const TRAVEL_TYPES = ['Backpacking', 'Trek', 'Van Life', 'Road Trip', 'Camping', 'Tour du monde', 'Moto', 'Vélo', 'Business', 'Week-end'];
const CLIMATES = ['Tropical', 'Désertique', 'Tempéré', 'Montagne', 'Arctique', 'Méditerranéen', 'Humide', 'Aride'];
const RELATION_TYPES = ['compatible_with', 'completes', 'requires', 'replaces'];

const SCORE_KDV_COLOR = (score: number) => {
  if (score >= 85) return 'text-emerald-400 bg-emerald-400/10';
  if (score >= 70) return 'text-blue-400 bg-blue-400/10';
  if (score >= 55) return 'text-amber-400 bg-amber-400/10';
  return 'text-red-400 bg-red-400/10';
};

const ESSENTIALITY_COLOR: Record<string, string> = {
  Indispensable: 'text-red-400 bg-red-400/10 border-red-400/20',
  Recommandé: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Confort: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Luxe: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

// ─── Empty product form ───────────────────────────────────────────────────────

const EMPTY_PRODUCT: Partial<ShopProduct> = {
  product_id: '',
  slug: '',
  name: '',
  brand: '',
  model: '',
  category: '',
  category_main: '',
  category_sub: '',
  price_eur: 0,
  weight_g: 0,
  weight_grams: 0,
  dimensions: '',
  materials: '',
  warranty: '',
  description_why: '',
  advantages_array: [],
  disadvantages_array: [],
  alt_premium_id: null,
  alt_budget_id: null,
  available_europe: true,
  available_usa: true,
  score_quality: 0,
  score_price: 0,
  score_durability: 0,
  source_review: '',
  score_kdv: 0,
  essentiality: 'Recommandé',
  versatility_10: 0,
  cabin_compatible: false,
  repairability_10: 0,
  travel_types_array: [],
  climates_array: [],
  justification_ai: '',
  image: '',
  image_alt: '',
  rating: 0,
  review_count: 0,
  available: true,
  is_active: true,
  stock: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logAudit(supabase: ReturnType<typeof createClient>, action: string, targetId: string, targetName: string, oldData?: unknown, newData?: unknown) {
  return supabase.from('admin_audit_logs').insert({
    action,
    target_table: 'shop_products',
    target_id: targetId,
    target_name: targetName,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({ products }: { products: ShopProduct[] }) {
  const active = products.filter(p => !p.deleted_at && p.is_active !== false);
  const byCategory = active.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category_main || p.category || 'Autre';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const byEssentiality = active.reduce<Record<string, number>>((acc, p) => {
    const e = p.essentiality || 'Recommandé';
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});
  const avgPrice = active.length ? active.reduce((s, p) => s + Number(p.price_eur), 0) / active.length : 0;
  const avgWeight = active.length ? active.reduce((s, p) => s + Number(p.weight_g || p.weight_grams || 0), 0) / active.length : 0;
  const avgKdv = active.length ? active.reduce((s, p) => s + Number(p.score_kdv || 0), 0) / active.length : 0;
  const cabinCount = active.filter(p => p.cabin_compatible).length;
  const noImage = active.filter(p => !p.image).length;
  const noDesc = active.filter(p => !p.description_why).length;
  const brands = new Set(active.map(p => p.brand).filter(Boolean)).size;

  const kpis = [
    { label: 'Produits actifs', value: active.length, icon: 'ArchiveBoxIcon', color: 'text-emerald-400' },
    { label: 'Prix moyen', value: `${avgPrice.toFixed(0)} €`, icon: 'CurrencyEuroIcon', color: 'text-blue-400' },
    { label: 'Poids moyen', value: `${(avgWeight / 1000).toFixed(1)} kg`, icon: 'ScaleIcon', color: 'text-purple-400' },
    { label: 'Score KDV moyen', value: avgKdv.toFixed(1), icon: 'StarIcon', color: 'text-amber-400' },
    { label: 'Compatibles cabine', value: cabinCount, icon: 'PaperAirplaneIcon', color: 'text-sky-400' },
    { label: 'Marques', value: brands, icon: 'TagIcon', color: 'text-pink-400' },
  ];

  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = sortedCats[0]?.[1] || 1;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <Icon name={k.icon as string} size={16} variant="outline" className={k.color} />
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Live</span>
            </div>
            <div className="font-mono text-xl font-700 text-white">{k.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(noImage > 0 || noDesc > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="ExclamationTriangleIcon" size={14} variant="outline" className="text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Alertes catalogue</span>
          </div>
          {noImage > 0 && <p className="text-xs text-amber-300/70">⚠️ {noImage} produit(s) sans image</p>}
          {noDesc > 0 && <p className="text-xs text-amber-300/70">⚠️ {noDesc} produit(s) sans description_why</p>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Categories */}
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Répartition par catégorie</h3>
          <div className="space-y-2">
            {sortedCats.slice(0, 10).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-white/50 w-28 truncate">{cat}</span>
                <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full bg-[#E4501C] rounded-full transition-all" style={{ width: `${(count / maxCat) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-white/40 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Essentiality */}
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Répartition essentialité</h3>
          <div className="space-y-3">
            {ESSENTIALITY_OPTIONS.map(e => (
              <div key={e} className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ESSENTIALITY_COLOR[e] || 'text-white/40 bg-white/5 border-white/10'}`}>{e}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E4501C] rounded-full" style={{ width: `${((byEssentiality[e] || 0) / (active.length || 1)) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-white/40 w-6 text-right">{byEssentiality[e] || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product List Section ─────────────────────────────────────────────────────

function ProductListSection({
  products,
  onEdit,
  onDelete,
  onBulkAction,
}: {
  products: ShopProduct[];
  onEdit: (p: ShopProduct) => void;
  onDelete: (ids: string[]) => void;
  onBulkAction: (action: string, ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterEss, setFilterEss] = useState('');
  const [filterCabin, setFilterCabin] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortField, setSortField] = useState<keyof ShopProduct>('score_kdv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const categories = useMemo(() => [...new Set(products.map(p => p.category_main || p.category).filter(Boolean))].sort(), [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (filterStatus === 'active') list = list.filter(p => !p.deleted_at && p.is_active !== false);
    else if (filterStatus === 'inactive') list = list.filter(p => p.is_active === false && !p.deleted_at);
    else if (filterStatus === 'deleted') list = list.filter(p => !!p.deleted_at);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.product_id?.toLowerCase().includes(q) || p.model?.toLowerCase().includes(q));
    }
    if (filterCat) list = list.filter(p => (p.category_main || p.category) === filterCat);
    if (filterEss) list = list.filter(p => p.essentiality === filterEss);
    if (filterCabin === 'yes') list = list.filter(p => p.cabin_compatible);
    if (filterCabin === 'no') list = list.filter(p => !p.cabin_compatible);
    list = [...list].sort((a, b) => {
      const av = a[sortField] as number | string;
      const bv = b[sortField] as number | string;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [products, search, filterCat, filterEss, filterCabin, filterStatus, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (field: keyof ShopProduct) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map(p => p.id)));
  };

  const SortIcon = ({ field }: { field: keyof ShopProduct }) => (
    <span className={`ml-1 ${sortField === field ? 'text-[#E4501C]' : 'text-white/20'}`}>
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const exportCSV = () => {
    const toExport = selected.size > 0 ? filtered.filter(p => selected.has(p.id)) : filtered;
    const headers = ['product_id', 'name', 'brand', 'model', 'category_main', 'category_sub', 'price_eur', 'weight_g', 'score_kdv', 'essentiality', 'cabin_compatible', 'available_europe', 'available_usa', 'score_quality', 'score_price', 'score_durability'];
    const rows = toExport.map(p => headers.map(h => {
      const v = (p as Record<string, unknown>)[h];
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
      return v ?? '';
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogue_kdv_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1E2B25] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Icon name="ExclamationTriangleIcon" size={18} variant="outline" className="text-red-400" />
              </div>
              <h3 className="font-semibold text-white">Supprimer {confirmDelete.length} produit(s) ?</h3>
            </div>
            <p className="text-sm text-white/50 mb-6">Soft delete — les produits seront masqués mais conservés en base.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white transition-all">Annuler</button>
              <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); setSelected(new Set()); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Icon name="MagnifyingGlassIcon" size={14} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" placeholder="Rechercher nom, marque, ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#1E2B25] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#E4501C]/50 transition-colors" />
        </div>

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-[#1E2B25] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#E4501C]/50">
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="deleted">Supprimés</option>
          <option value="all">Tous</option>
        </select>

        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}
          className="bg-[#1E2B25] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#E4501C]/50">
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterEss} onChange={e => { setFilterEss(e.target.value); setPage(1); }}
          className="bg-[#1E2B25] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#E4501C]/50">
          <option value="">Essentialité</option>
          {ESSENTIALITY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select value={filterCabin} onChange={e => { setFilterCabin(e.target.value); setPage(1); }}
          className="bg-[#1E2B25] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#E4501C]/50">
          <option value="">Cabine</option>
          <option value="yes">✈️ Compatible</option>
          <option value="no">❌ Non compatible</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">{selected.size} sélectionné(s)</span>
              <button onClick={() => onBulkAction('activate', [...selected])} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs hover:bg-emerald-500/25 transition-all">Activer</button>
              <button onClick={() => onBulkAction('deactivate', [...selected])} className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs hover:bg-amber-500/25 transition-all">Désactiver</button>
              <button onClick={() => setConfirmDelete([...selected])} className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs hover:bg-red-500/25 transition-all">Supprimer</button>
            </div>
          )}
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white transition-all">
            <Icon name="ArrowDownTrayIcon" size={13} variant="outline" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0} onChange={toggleAll}
                    className="rounded border-white/20 bg-transparent" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('product_id')}>
                  ID <SortIcon field="product_id" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('name')}>
                  Produit <SortIcon field="name" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('brand')}>
                  Marque <SortIcon field="brand" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('category_main')}>
                  Catégorie <SortIcon field="category_main" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('price_eur')}>
                  Prix <SortIcon field="price_eur" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('weight_g')}>
                  Poids <SortIcon field="weight_g" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3 cursor-pointer hover:text-white/60" onClick={() => toggleSort('score_kdv')}>
                  KDV <SortIcon field="score_kdv" />
                </th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3">Ess.</th>
                <th className="text-left font-mono text-white/30 uppercase tracking-wider px-3 py-3">Statut</th>
                <th className="px-3 py-3 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginated.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-white/30">Aucun produit trouvé</td></tr>
              ) : paginated.map(p => (
                <tr key={p.id} className={`hover:bg-white/3 transition-colors ${selected.has(p.id) ? 'bg-[#E4501C]/5' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="rounded border-white/20 bg-transparent" />
                  </td>
                  <td className="px-3 py-3 font-mono text-white/40">{p.product_id || '—'}</td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-white/85 truncate max-w-[160px]">{p.name}</p>
                    <p className="text-white/30 text-[10px] mt-0.5">{p.model}</p>
                  </td>
                  <td className="px-3 py-3 text-white/50">{p.brand}</td>
                  <td className="px-3 py-3 text-white/40 truncate max-w-[100px]">{p.category_main || p.category}</td>
                  <td className="px-3 py-3 font-mono font-700 text-[#E4501C]">{p.price_eur}€</td>
                  <td className="px-3 py-3 font-mono text-white/50">{p.weight_g || p.weight_grams}g</td>
                  <td className="px-3 py-3">
                    <span className={`font-mono font-700 text-xs px-2 py-0.5 rounded-full ${SCORE_KDV_COLOR(p.score_kdv || 0)}`}>{p.score_kdv || 0}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ESSENTIALITY_COLOR[p.essentiality] || 'text-white/40 bg-white/5 border-white/10'}`}>
                      {p.essentiality?.slice(0, 4)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {p.deleted_at ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full text-red-400 bg-red-400/10">Supprimé</span>
                    ) : p.is_active === false ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10">Inactif</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10">Actif</span>
                    )}
                    {p.cabin_compatible && <span className="ml-1 text-[10px]">✈️</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(p)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all" title="Éditer">
                        <Icon name="PencilIcon" size={13} variant="outline" />
                      </button>
                      <Link href={`/produit/${p.slug}`} target="_blank" className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all" title="Voir">
                        <Icon name="EyeIcon" size={13} variant="outline" />
                      </Link>
                      <button onClick={() => setConfirmDelete([p.id])} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-all" title="Supprimer">
                        <Icon name="TrashIcon" size={13} variant="outline" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">{filtered.length} produits</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs text-white/50 focus:outline-none">
              <option value={25}>25/page</option>
              <option value={50}>50/page</option>
              <option value={100}>100/page</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white disabled:opacity-30 transition-all">
              <Icon name="ChevronLeftIcon" size={13} variant="outline" />
            </button>
            <span className="text-xs text-white/40 px-2">{page} / {totalPages || 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white disabled:opacity-30 transition-all">
              <Icon name="ChevronRightIcon" size={13} variant="outline" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Form Section ─────────────────────────────────────────────────────

function ProductFormSection({
  product,
  allProducts,
  onSave,
  onCancel,
}: {
  product: Partial<ShopProduct> | null;
  allProducts: ShopProduct[];
  onSave: (data: Partial<ShopProduct>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<ShopProduct>>(product ?? EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'identity' | 'specs' | 'scores' | 'content' | 'relations' | 'media'>('identity');
  const [aiLoading, setAiLoading] = useState<'desc' | 'coherence' | 'alternatives' | null>(null);
  const [aiResult, setAiResult] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(product?.image || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const { sendMessage, isLoading: chatLoading, response: chatResponse } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  // Draft autosave
  useEffect(() => {
    const key = `kdv_draft_${(product?.product_id) || 'new'}`;
    const saved = localStorage.getItem(key);
    if (saved && !product?.id) {
      try { setForm(JSON.parse(saved)); } catch (_e) { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = `kdv_draft_${form.product_id || 'new'}`;
    const timer = setTimeout(() => localStorage.setItem(key, JSON.stringify(form)), 1000);
    return () => clearTimeout(timer);
  }, [form]);

  const set = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = 'Nom requis';
    if (!form.brand?.trim()) e.brand = 'Marque requise';
    if (!form.category_main?.trim()) e.category_main = 'Catégorie principale requise';
    if (!form.price_eur || Number(form.price_eur) <= 0) e.price_eur = 'Prix > 0 requis';
    if (!form.weight_g || Number(form.weight_g) <= 0) e.weight_g = 'Poids > 0 requis';
    if (!form.description_why?.trim()) e.description_why = 'Description requise';
    if (form.description_why && (form.description_why.length < 50 || form.description_why.length > 500)) e.description_why = '50–500 caractères';
    if (!form.essentiality) e.essentiality = 'Essentialité requise';
    if (form.score_kdv !== undefined && (Number(form.score_kdv) < 0 || Number(form.score_kdv) > 100)) e.score_kdv = '0–100';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image || null;
    const ext = imageFile.name.split('.').pop();
    const path = `products/${form.product_id || Date.now()}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true });
    if (error) return form.image || null;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let imageUrl = form.image;
      if (imageFile) {
        const uploaded = await uploadImage();
        if (uploaded) imageUrl = uploaded;
      }
      const slug = form.slug || (form.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await onSave({ ...form, image: imageUrl, slug, weight_grams: form.weight_g });
      const key = `kdv_draft_${form.product_id || 'new'}`;
      localStorage.removeItem(key);
    } finally {
      setSaving(false);
    }
  };

  const generateDescription = async () => {
    setAiLoading('desc');
    setAiResult('');
    const prompt = `Tu es expert en équipement outdoor. Génère une description_why (200-400 caractères) et une justification_ai (100-200 caractères) pour ce produit outdoor:
Nom: ${form.name}
Marque: ${form.brand}
Modèle: ${form.model}
Catégorie: ${form.category_main}
Prix: ${form.price_eur}€
Poids: ${form.weight_g}g
Matériaux: ${form.materials}
Réponds en JSON: {"description_why": "...", "justification_ai": "..."}`;
    sendMessage([{ role: 'user', content: prompt }], { temperature: 0.7, max_tokens: 500 });
    setAiLoading(null);
  };

  const analyzeCoherence = async () => {
    setAiLoading('coherence');
    setAiResult('');
    const prompt = `Analyse la cohérence des scores de ce produit outdoor:
Nom: ${form.name}, Prix: ${form.price_eur}€
Score qualité: ${form.score_quality}/10
Score prix: ${form.score_price}/10
Score durabilité: ${form.score_durability}/10
Score KDV: ${form.score_kdv}/100
Essentialité: ${form.essentiality}
Donne une analyse courte (max 200 caractères) et un verdict: COHÉRENT ou INCOHÉRENT. Réponds en JSON: {"verdict": "COHÉRENT|INCOHÉRENT", "analyse": "..."}`;
    sendMessage([{ role: 'user', content: prompt }], { temperature: 0.3, max_tokens: 300 });
    setAiLoading(null);
  };

  const suggestAlternatives = async () => {
    setAiLoading('alternatives');
    setAiResult('');
    const productList = allProducts.slice(0, 30).map(p => `${p.product_id}: ${p.name} (${p.brand}, ${p.price_eur}€, ${p.category_main})`).join('\n');
    const prompt = `Parmi ces produits du catalogue Le Kit du Voyageur, suggère l'alternative premium et budget pour:
Produit: ${form.name} (${form.brand}, ${form.price_eur}€, ${form.category_main})

Catalogue disponible:
${productList}

Réponds en JSON: {"alt_premium_id": "P0XX", "alt_budget_id": "P0XX", "raison_premium": "...", "raison_budget": "..."}`;
    sendMessage([{ role: 'user', content: prompt }], { temperature: 0.5, max_tokens: 300 });
    setAiLoading(null);
  };

  // Parse AI response when it arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!chatResponse || chatLoading) return;
    setAiResult(chatResponse);
    try {
      const jsonMatch = chatResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.description_why) setForm(prev => ({ ...prev, description_why: parsed.description_why }));
        if (parsed.justification_ai) setForm(prev => ({ ...prev, justification_ai: parsed.justification_ai }));
        if (parsed.alt_premium_id) setForm(prev => ({ ...prev, alt_premium_id: parsed.alt_premium_id }));
        if (parsed.alt_budget_id) setForm(prev => ({ ...prev, alt_budget_id: parsed.alt_budget_id }));
      }
    } catch (_e) { /* ignore */ }
  }, [chatResponse, chatLoading]);

  const TABS = [
    { id: 'identity', label: 'Identité', icon: 'IdentificationIcon' },
    { id: 'specs', label: 'Specs', icon: 'WrenchScrewdriverIcon' },
    { id: 'scores', label: 'Scores', icon: 'ChartBarIcon' },
    { id: 'content', label: 'Contenu', icon: 'DocumentTextIcon' },
    { id: 'relations', label: 'Relations', icon: 'LinkIcon' },
    { id: 'media', label: 'Médias', icon: 'PhotoIcon' },
  ] as const;

  const inputCls = (field: string) => `w-full bg-[#162019] border ${errors[field] ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#E4501C]/50 transition-colors`;
  const labelCls = 'block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{product?.id ? `Éditer ${product.name}` : 'Nouveau produit'}</h2>
          <p className="text-xs text-white/40 mt-0.5">Brouillon sauvegardé automatiquement</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white transition-all">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E4501C] text-white text-sm font-medium hover:bg-[#cc3d10] disabled:opacity-50 transition-all">
            {saving ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sauvegarde...</> : <><Icon name="CheckIcon" size={14} variant="outline" />Sauvegarder</>}
          </button>
        </div>
      </div>

      {/* AI Toolbar */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <Icon name="SparklesIcon" size={14} variant="outline" className="text-[#E4501C]" />
        <span className="text-xs text-white/40 mr-2">IA Gemini :</span>
        <button onClick={generateDescription} disabled={chatLoading || !form.name}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E4501C]/15 text-[#E4501C] text-xs hover:bg-[#E4501C]/25 disabled:opacity-40 transition-all">
          {chatLoading && aiLoading === 'desc' ? '...' : '✍️ Générer description'}
        </button>
        <button onClick={analyzeCoherence} disabled={chatLoading || !form.name}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs hover:bg-blue-500/25 disabled:opacity-40 transition-all">
          {chatLoading && aiLoading === 'coherence' ? '...' : '🔍 Analyser cohérence'}
        </button>
        <button onClick={suggestAlternatives} disabled={chatLoading || !form.name}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-xs hover:bg-purple-500/25 disabled:opacity-40 transition-all">
          {chatLoading && aiLoading === 'alternatives' ? '...' : '🔄 Suggérer alternatives'}
        </button>
        {chatLoading && <span className="text-xs text-white/30 animate-pulse">Gemini réfléchit...</span>}
        {aiResult && !chatLoading && (
          <div className="w-full mt-2 p-2 bg-white/5 rounded-lg text-xs text-white/60 max-h-20 overflow-y-auto">{aiResult}</div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1E2B25] border border-white/8 rounded-xl p-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${activeTab === tab.id ? 'bg-[#E4501C] text-white' : 'text-white/40 hover:text-white'}`}>
            <Icon name={tab.icon as string} size={12} variant="outline" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-5">
        {activeTab === 'identity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>ID Produit *</label><input value={form.product_id || ''} onChange={e => set('product_id', e.target.value)} placeholder="P001" className={inputCls('product_id')} /></div>
            <div><label className={labelCls}>Nom *</label><input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Osprey Exos 58L" className={inputCls('name')} />{errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}</div>
            <div><label className={labelCls}>Marque *</label><input value={form.brand || ''} onChange={e => set('brand', e.target.value)} placeholder="Osprey" className={inputCls('brand')} />{errors.brand && <p className="text-xs text-red-400 mt-1">{errors.brand}</p>}</div>
            <div><label className={labelCls}>Modèle</label><input value={form.model || ''} onChange={e => set('model', e.target.value)} placeholder="Exos 58" className={inputCls('model')} /></div>
            <div><label className={labelCls}>Catégorie principale *</label><input value={form.category_main || ''} onChange={e => set('category_main', e.target.value)} placeholder="Sacs à dos" className={inputCls('category_main')} />{errors.category_main && <p className="text-xs text-red-400 mt-1">{errors.category_main}</p>}</div>
            <div><label className={labelCls}>Sous-catégorie</label><input value={form.category_sub || ''} onChange={e => set('category_sub', e.target.value)} placeholder="Sacs de randonnée" className={inputCls('category_sub')} /></div>
            <div><label className={labelCls}>Essentialité *</label>
              <select value={form.essentiality || 'Recommandé'} onChange={e => set('essentiality', e.target.value)} className={inputCls('essentiality')}>
                {ESSENTIALITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Slug URL</label><input value={form.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="osprey-exos-58l" className={inputCls('slug')} /></div>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Prix (€) *</label><input type="number" value={form.price_eur || ''} onChange={e => set('price_eur', Number(e.target.value))} placeholder="299" className={inputCls('price_eur')} />{errors.price_eur && <p className="text-xs text-red-400 mt-1">{errors.price_eur}</p>}</div>
            <div><label className={labelCls}>Poids (g) *</label><input type="number" value={form.weight_g || ''} onChange={e => set('weight_g', Number(e.target.value))} placeholder="1420" className={inputCls('weight_g')} />{errors.weight_g && <p className="text-xs text-red-400 mt-1">{errors.weight_g}</p>}</div>
            <div><label className={labelCls}>Dimensions</label><input value={form.dimensions || ''} onChange={e => set('dimensions', e.target.value)} placeholder="70x35x25 cm" className={inputCls('dimensions')} /></div>
            <div><label className={labelCls}>Matériaux</label><input value={form.materials || ''} onChange={e => set('materials', e.target.value)} placeholder="Nylon 100D, aluminium" className={inputCls('materials')} /></div>
            <div><label className={labelCls}>Garantie</label><input value={form.warranty || ''} onChange={e => set('warranty', e.target.value)} placeholder="2 ans" className={inputCls('warranty')} /></div>
            <div><label className={labelCls}>Source avis</label><input value={form.source_review || ''} onChange={e => set('source_review', e.target.value)} placeholder="Wikiloc, Outdoor Gear Lab" className={inputCls('source_review')} /></div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.cabin_compatible} onChange={e => set('cabin_compatible', e.target.checked)} className="rounded border-white/20" />
                <span className="text-sm text-white/70">Compatible cabine avion ✈️</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.available_europe} onChange={e => set('available_europe', e.target.checked)} className="rounded border-white/20" />
                <span className="text-sm text-white/70">Disponible Europe 🇪🇺</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.available_usa} onChange={e => set('available_usa', e.target.checked)} className="rounded border-white/20" />
                <span className="text-sm text-white/70">Disponible USA 🇺🇸</span>
              </label>
            </div>
            <div>
              <label className={labelCls}>Types de voyage</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TRAVEL_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={(form.travel_types_array || []).includes(t)}
                      onChange={e => {
                        const arr = form.travel_types_array || [];
                        set('travel_types_array', e.target.checked ? [...arr, t] : arr.filter(x => x !== t));
                      }} className="rounded border-white/20" />
                    <span className="text-xs text-white/60">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Météo / Climats</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CLIMATES.map(c => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={(form.climates_array || []).includes(c)}
                      onChange={e => {
                        const arr = form.climates_array || [];
                        set('climates_array', e.target.checked ? [...arr, c] : arr.filter(x => x !== c));
                      }} className="rounded border-white/20" />
                    <span className="text-xs text-white/60">{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scores' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { field: 'score_quality', label: 'Note Qualité /10', max: 10, step: 0.1 },
              { field: 'score_price', label: 'Note Prix /10', max: 10, step: 0.1 },
              { field: 'score_durability', label: 'Note Durabilité /10', max: 10, step: 0.1 },
              { field: 'versatility_10', label: 'Polyvalence /10', max: 10, step: 0.1 },
              { field: 'repairability_10', label: 'Réparabilité /10', max: 10, step: 0.1 },
            ].map(({ field, label, max, step }) => (
              <div key={field}>
                <label className={labelCls}>{label}</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={max} step={step} value={Number((form as Record<string, unknown>)[field]) || 0}
                    onChange={e => set(field, Number(e.target.value))}
                    className="flex-1 accent-[#E4501C]" />
                  <span className="font-mono text-sm text-[#E4501C] w-10 text-right">{Number((form as Record<string, unknown>)[field] || 0).toFixed(1)}</span>
                </div>
              </div>
            ))}
            <div>
              <label className={labelCls}>Score KDV /100 *</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} step={1} value={Number(form.score_kdv) || 0}
                  onChange={e => set('score_kdv', Number(e.target.value))} className="flex-1 accent-[#E4501C]" />
                <span className={`font-mono text-sm font-700 w-10 text-right px-2 py-0.5 rounded-full ${SCORE_KDV_COLOR(Number(form.score_kdv) || 0)}`}>{form.score_kdv || 0}</span>
              </div>
              {errors.score_kdv && <p className="text-xs text-red-400 mt-1">{errors.score_kdv}</p>}
            </div>
            <div>
              <label className={labelCls}>Stock</label>
              <input type="number" value={form.stock || 0} onChange={e => set('stock', Number(e.target.value))} className={inputCls('stock')} />
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Pourquoi ce produit (description_why) * <span className="text-white/20 normal-case">{(form.description_why || '').length}/500</span></label>
              <textarea value={form.description_why || ''} onChange={e => set('description_why', e.target.value)} rows={4}
                placeholder="Expliquez pourquoi ce produit est recommandé pour les voyageurs..." className={`${inputCls('description_why')} resize-none`} />
              {errors.description_why && <p className="text-xs text-red-400 mt-1">{errors.description_why}</p>}
            </div>
            <div>
              <label className={labelCls}>Justification IA</label>
              <textarea value={form.justification_ai || ''} onChange={e => set('justification_ai', e.target.value)} rows={3}
                placeholder="Justification générée par IA..." className={`${inputCls('justification_ai')} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Avantages (un par ligne)</label>
              <textarea value={(form.advantages_array || []).join('\n')} onChange={e => set('advantages_array', e.target.value.split('\n').filter(Boolean))} rows={4}
                placeholder="Ultra léger&#10;Résistant à l'eau&#10;Ergonomique" className={`${inputCls('advantages_array')} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Inconvénients (un par ligne)</label>
              <textarea value={(form.disadvantages_array || []).join('\n')} onChange={e => set('disadvantages_array', e.target.value.split('\n').filter(Boolean))} rows={3}
                placeholder="Prix élevé&#10;Peu de poches" className={`${inputCls('disadvantages_array')} resize-none`} />
            </div>
          </div>
        )}

        {activeTab === 'relations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Alternative Premium (ID)</label>
              <input value={form.alt_premium_id || ''} onChange={e => set('alt_premium_id', e.target.value || null)} placeholder="P042"
                list="product-ids" className={inputCls('alt_premium_id')} />
              <datalist id="product-ids">
                {allProducts.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
              </datalist>
              {form.alt_premium_id && (
                <p className="text-xs text-white/30 mt-1">→ {allProducts.find(p => p.product_id === form.alt_premium_id)?.name || 'ID non trouvé'}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Alternative Budget (ID)</label>
              <input value={form.alt_budget_id || ''} onChange={e => set('alt_budget_id', e.target.value || null)} placeholder="P015"
                list="product-ids" className={inputCls('alt_budget_id')} />
              {form.alt_budget_id && (
                <p className="text-xs text-white/30 mt-1">→ {allProducts.find(p => p.product_id === form.alt_budget_id)?.name || 'ID non trouvé'}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Note qualité image alt</label>
              <input value={form.image_alt || ''} onChange={e => set('image_alt', e.target.value)} placeholder="Sac à dos Osprey Exos 58L vert" className={inputCls('image_alt')} />
            </div>
            <div>
              <label className={labelCls}>Note (rating)</label>
              <input type="number" min={0} max={5} step={0.1} value={form.rating || 0} onChange={e => set('rating', Number(e.target.value))} className={inputCls('rating')} />
            </div>
            <div>
              <label className={labelCls}>Nombre d&apos;avis</label>
              <input type="number" value={form.review_count || 0} onChange={e => set('review_count', Number(e.target.value))} className={inputCls('review_count')} />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} className="rounded border-white/20" />
                <span className="text-sm text-white/70">Produit actif</span>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Image principale</label>
              <div className="flex gap-4 items-start">
                {imagePreview && (
                  <div className="w-32 h-32 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 text-sm text-white/50 hover:text-white hover:border-white/40 transition-all w-full justify-center">
                    <Icon name="CloudArrowUpIcon" size={16} variant="outline" />
                    {imageFile ? imageFile.name : 'Choisir une image'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <p className="text-xs text-white/25">Formats: JPG, PNG, WebP. Max 5 MB.</p>
                  <div>
                    <label className={labelCls}>Ou URL externe</label>
                    <input value={form.image || ''} onChange={e => { set('image', e.target.value); setImagePreview(e.target.value); }}
                      placeholder="https://..." className={inputCls('image')} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Relations Section ────────────────────────────────────────────────────────

function RelationsSection({ products }: { products: ShopProduct[] }) {
  const [compatibilities, setCompatibilities] = useState<Compatibility[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'compat' | 'alt'>('compat');
  const [newCompat, setNewCompat] = useState({ product_id_1: '', product_id_2: '', relation_type: 'compatible_with', notes: '' });
  const [newAlt, setNewAlt] = useState({ original_product_id: '', substitute_product_id: '', priority: 1, reason: '' });
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    Promise.all([
      supabase.from('product_compatibilities').select('*').order('created_at', { ascending: false }),
      supabase.from('product_alternatives').select('*').order('priority'),
    ]).then(([c, a]) => {
      setCompatibilities(c.data ?? []);
      setAlternatives(a.data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  const addCompat = async () => {
    if (!newCompat.product_id_1 || !newCompat.product_id_2) return;
    const { data } = await supabase.from('product_compatibilities').insert(newCompat).select().single();
    if (data) { setCompatibilities(prev => [data, ...prev]); setNewCompat({ product_id_1: '', product_id_2: '', relation_type: 'compatible_with', notes: '' }); }
  };

  const deleteCompat = async (id: string) => {
    await supabase.from('product_compatibilities').delete().eq('id', id);
    setCompatibilities(prev => prev.filter(c => c.id !== id));
  };

  const addAlt = async () => {
    if (!newAlt.original_product_id || !newAlt.substitute_product_id) return;
    const { data } = await supabase.from('product_alternatives').insert(newAlt).select().single();
    if (data) { setAlternatives(prev => [...prev, data]); setNewAlt({ original_product_id: '', substitute_product_id: '', priority: 1, reason: '' }); }
  };

  const deleteAlt = async (id: string) => {
    await supabase.from('product_alternatives').delete().eq('id', id);
    setAlternatives(prev => prev.filter(a => a.id !== id));
  };

  const inputCls = 'bg-[#162019] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#E4501C]/50 transition-colors';
  const getProductName = (pid: string) => products.find(p => p.product_id === pid)?.name || pid;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['compat', 'alt'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-[#E4501C] text-white' : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'}`}>
            {t === 'compat' ? `Compatibilités (${compatibilities.length})` : `Alternatives (${alternatives.length})`}
          </button>
        ))}
      </div>

      {loading ? <div className="h-32 bg-[#1E2B25] rounded-xl animate-pulse" /> : (
        <>
          {tab === 'compat' && (
            <div className="space-y-3">
              <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">Ajouter une relation</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input value={newCompat.product_id_1} onChange={e => setNewCompat(p => ({ ...p, product_id_1: e.target.value }))}
                    placeholder="ID Produit A" list="product-ids-rel" className={inputCls} />
                  <input value={newCompat.product_id_2} onChange={e => setNewCompat(p => ({ ...p, product_id_2: e.target.value }))}
                    placeholder="ID Produit B" list="product-ids-rel" className={inputCls} />
                  <select value={newCompat.relation_type} onChange={e => setNewCompat(p => ({ ...p, relation_type: e.target.value }))} className={inputCls}>
                    {RELATION_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input value={newCompat.notes} onChange={e => setNewCompat(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" className={inputCls} />
                </div>
                <datalist id="product-ids-rel">{products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</datalist>
                <button onClick={addCompat} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E4501C] text-white text-sm hover:bg-[#cc3d10] transition-all">
                  <Icon name="PlusIcon" size={14} variant="outline" />Ajouter
                </button>
              </div>
              <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-white/3 border-b border-white/8">
                    <tr>{['Produit A', 'Relation', 'Produit B', 'Notes', ''].map(h => <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {compatibilities.map(c => (
                      <tr key={c.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3"><span className="font-mono text-[#E4501C] text-[10px]">{c.product_id_1}</span><p className="text-white/50 text-[10px] mt-0.5 truncate max-w-[120px]">{getProductName(c.product_id_1)}</p></td>
                        <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{c.relation_type}</span></td>
                        <td className="px-4 py-3"><span className="font-mono text-[#E4501C] text-[10px]">{c.product_id_2}</span><p className="text-white/50 text-[10px] mt-0.5 truncate max-w-[120px]">{getProductName(c.product_id_2)}</p></td>
                        <td className="px-4 py-3 text-white/40 truncate max-w-[120px]">{c.notes || '—'}</td>
                        <td className="px-4 py-3"><button onClick={() => deleteCompat(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-all"><Icon name="TrashIcon" size={12} variant="outline" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'alt' && (
            <div className="space-y-3">
              <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">Ajouter une substitution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input value={newAlt.original_product_id} onChange={e => setNewAlt(p => ({ ...p, original_product_id: e.target.value }))}
                    placeholder="Produit original" list="product-ids-rel" className={inputCls} />
                  <input value={newAlt.substitute_product_id} onChange={e => setNewAlt(p => ({ ...p, substitute_product_id: e.target.value }))}
                    placeholder="Substitution" list="product-ids-rel" className={inputCls} />
                  <input type="number" value={newAlt.priority} onChange={e => setNewAlt(p => ({ ...p, priority: Number(e.target.value) }))} placeholder="Priorité" className={inputCls} />
                  <input value={newAlt.reason} onChange={e => setNewAlt(p => ({ ...p, reason: e.target.value }))} placeholder="Raison" className={inputCls} />
                </div>
                <button onClick={addAlt} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E4501C] text-white text-sm hover:bg-[#cc3d10] transition-all">
                  <Icon name="PlusIcon" size={14} variant="outline" />Ajouter
                </button>
              </div>
              <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-white/3 border-b border-white/8">
                    <tr>{['Original', 'Substitution', 'Priorité', 'Raison', ''].map(h => <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {alternatives.map(a => (
                      <tr key={a.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3"><span className="font-mono text-[#E4501C] text-[10px]">{a.original_product_id}</span><p className="text-white/50 text-[10px] mt-0.5 truncate max-w-[120px]">{getProductName(a.original_product_id)}</p></td>
                        <td className="px-4 py-3"><span className="font-mono text-[#E4501C] text-[10px]">{a.substitute_product_id}</span><p className="text-white/50 text-[10px] mt-0.5 truncate max-w-[120px]">{getProductName(a.substitute_product_id)}</p></td>
                        <td className="px-4 py-3 font-mono text-white/50">{a.priority}</td>
                        <td className="px-4 py-3 text-white/40 truncate max-w-[120px]">{a.reason || '—'}</td>
                        <td className="px-4 py-3"><button onClick={() => deleteAlt(a.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-all"><Icon name="TrashIcon" size={12} variant="outline" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Import Section ───────────────────────────────────────────────────────────

function ImportSection({ onImportDone }: { onImportDone: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
    });
  };

  const validateRows = (rows: Record<string, string>[]) => {
    const errs: string[] = [];
    const ids = new Set<string>();
    rows.forEach((row, i) => {
      const lineNum = i + 2;
      if (!row.product_id) errs.push(`Ligne ${lineNum}: product_id manquant`);
      else if (ids.has(row.product_id)) errs.push(`Ligne ${lineNum}: product_id dupliqué (${row.product_id})`);
      else ids.add(row.product_id);
      if (!row.name) errs.push(`Ligne ${lineNum}: name manquant`);
      if (row.price_eur && Number(row.price_eur) <= 0) errs.push(`Ligne ${lineNum}: prix invalide`);
      if (row.score_kdv && (Number(row.score_kdv) < 0 || Number(row.score_kdv) > 100)) errs.push(`Ligne ${lineNum}: score_kdv hors plage (0-100)`);
    });
    return errs;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5));
      setErrors(validateRows(rows));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const rows = parseCSV(csvText);
    const errs = validateRows(rows);
    if (errs.length > 5) { setErrors(errs); return; }
    setImporting(true);
    let success = 0;
    let fail = 0;
    for (const row of rows) {
      const slug = (row.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + (row.product_id || '').toLowerCase();
      const product = {
        product_id: row.product_id,
        slug,
        name: row.name,
        brand: row.brand || '',
        model: row.model || '',
        category: row.category_main || '',
        category_main: row.category_main || '',
        category_sub: row.category_sub || '',
        price_eur: Number(row.price_eur) || 0,
        weight_g: Number(row.weight_g) || 0,
        weight_grams: Number(row.weight_g) || 0,
        score_kdv: Number(row.score_kdv) || 0,
        essentiality: row.essentiality || 'Recommandé',
        cabin_compatible: row.cabin_compatible === 'true',
        available_europe: row.available_europe !== 'false',
        available_usa: row.available_usa !== 'false',
        score_quality: Number(row.score_quality) || 0,
        score_price: Number(row.score_price) || 0,
        score_durability: Number(row.score_durability) || 0,
        description_why: row.description_why || '',
        is_active: true,
      };
      const { error } = await supabase.from('shop_products').upsert(product, { onConflict: 'product_id' });
      if (error) fail++;
      else success++;
    }
    setResult(`✅ ${success} produits importés, ❌ ${fail} erreurs`);
    setImporting(false);
    if (success > 0) onImportDone();
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Import CSV</h3>
        <p className="text-xs text-white/40">Colonnes attendues: product_id, name, brand, model, category_main, category_sub, price_eur, weight_g, score_kdv, essentiality, cabin_compatible, available_europe, available_usa, score_quality, score_price, score_durability, description_why</p>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/20 text-sm text-white/50 hover:text-white hover:border-white/40 transition-all w-full justify-center">
          <Icon name="CloudArrowUpIcon" size={16} variant="outline" />
          Choisir un fichier CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />

        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-xs font-medium text-red-400 mb-2">⚠️ {errors.length} erreur(s) détectée(s)</p>
            {errors.slice(0, 10).map((e, i) => <p key={i} className="text-xs text-red-300/70">{e}</p>)}
            {errors.length > 10 && <p className="text-xs text-red-300/50">... et {errors.length - 10} autres</p>}
          </div>
        )}

        {preview.length > 0 && (
          <div>
            <p className="text-xs text-white/40 mb-2">Aperçu (5 premières lignes) :</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/3">
                  <tr>{Object.keys(preview[0]).slice(0, 6).map(h => <th key={h} className="text-left font-mono text-white/30 px-3 py-2 uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {preview.map((row, i) => (
                    <tr key={i}>{Object.values(row).slice(0, 6).map((v, j) => <td key={j} className="px-3 py-2 text-white/60 truncate max-w-[100px]">{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {preview.length > 0 && (
          <button onClick={handleImport} disabled={importing || errors.length > 5}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-medium hover:bg-[#cc3d10] disabled:opacity-50 transition-all">
            {importing ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Import en cours...</> : <><Icon name="CloudArrowUpIcon" size={14} variant="outline" />Importer {parseCSV(csvText).length} produits</>}
          </button>
        )}

        {result && <p className="text-sm text-white/70 bg-white/5 rounded-xl px-4 py-3">{result}</p>}
      </div>
    </div>
  );
}

// ─── Audit Logs Section ───────────────────────────────────────────────────────

function AuditSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setLogs(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'text-emerald-400 bg-emerald-400/10',
    UPDATE: 'text-blue-400 bg-blue-400/10',
    DELETE: 'text-red-400 bg-red-400/10',
    RESTORE: 'text-purple-400 bg-purple-400/10',
    BULK_ACTIVATE: 'text-emerald-400 bg-emerald-400/10',
    BULK_DEACTIVATE: 'text-amber-400 bg-amber-400/10',
    BULK_DELETE: 'text-red-400 bg-red-400/10',
    IMPORT: 'text-blue-400 bg-blue-400/10',
  };

  return (
    <div className="space-y-4">
      {loading ? <div className="h-32 bg-[#1E2B25] rounded-xl animate-pulse" /> : (
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>{['Action', 'Cible', 'Produit', 'Admin', 'Date'].map(h => <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">Aucun log d&apos;audit</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'text-white/40 bg-white/5'}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-white/40 text-[10px]">{log.target_table}/{log.target_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white/60 truncate max-w-[160px]">{log.target_name || '—'}</td>
                  <td className="px-4 py-3 text-white/40">{log.admin_email}</td>
                  <td className="px-4 py-3 font-mono text-white/30 text-[10px]">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminProductsManager() {
  const [view, setView] = useState<AdminView>('dashboard');
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<ShopProduct | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('shop_products').select('*').order('score_kdv', { ascending: false });
    setProducts((data ?? []) as ShopProduct[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleEdit = (p: ShopProduct) => {
    setEditProduct(p);
    setView('form');
  };

  const handleNew = () => {
    setEditProduct(null);
    setView('form');
  };

  const handleSave = async (data: Partial<ShopProduct>) => {
    if (editProduct?.id) {
      const { error } = await supabase.from('shop_products').update(data).eq('id', editProduct.id);
      if (!error) {
        await logAudit(supabase, 'UPDATE', editProduct.id, data.name || editProduct.name, editProduct, data);
        await loadProducts();
        setView('list');
      }
    } else {
      const { data: created, error } = await supabase.from('shop_products').insert(data).select().single();
      if (!error && created) {
        await logAudit(supabase, 'CREATE', created.id, data.name || '', null, data);
        await loadProducts();
        setView('list');
      }
    }
  };

  const handleDelete = async (ids: string[]) => {
    const now = new Date().toISOString();
    await supabase.from('shop_products').update({ deleted_at: now, is_active: false }).in('id', ids);
    for (const id of ids) {
      const p = products.find(x => x.id === id);
      await logAudit(supabase, 'DELETE', id, p?.name || '');
    }
    await loadProducts();
  };

  const handleBulkAction = async (action: string, ids: string[]) => {
    if (action === 'activate') {
      await supabase.from('shop_products').update({ is_active: true, deleted_at: null }).in('id', ids);
      await logAudit(supabase, 'BULK_ACTIVATE', ids.join(','), `${ids.length} produits`);
    } else if (action === 'deactivate') {
      await supabase.from('shop_products').update({ is_active: false }).in('id', ids);
      await logAudit(supabase, 'BULK_DEACTIVATE', ids.join(','), `${ids.length} produits`);
    }
    await loadProducts();
  };

  const NAV_ITEMS: { id: AdminView; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'ChartBarIcon' },
    { id: 'list', label: 'Liste produits', icon: 'ArchiveBoxIcon', badge: products.filter(p => !p.deleted_at && p.is_active !== false).length },
    { id: 'form', label: 'Nouveau produit', icon: 'PlusCircleIcon' },
    { id: 'relations', label: 'Relations', icon: 'LinkIcon' },
    { id: 'import', label: 'Import CSV', icon: 'CloudArrowUpIcon' },
    { id: 'audit', label: 'Logs d\'audit', icon: 'ClipboardDocumentListIcon' },
  ];

  return (
    <div className="min-h-screen bg-[#0F1A14] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0F1A14]/95 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
            <Icon name="ChevronLeftIcon" size={14} variant="outline" />
            Admin
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="font-semibold text-white text-sm">Gestion Produits</h1>
          <span className="ml-auto font-mono text-xs text-white/30">{products.length} produits en base</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0">
          <nav className="space-y-1 sticky top-20">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => { setView(item.id); if (item.id !== 'form') setEditProduct(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${view === item.id ? 'bg-[#E4501C] text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <Icon name={item.icon as string} size={15} variant="outline" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${view === item.id ? 'bg-white/20 text-white' : 'bg-white/10 text-white/40'}`}>{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {loading && view !== 'form' ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="bg-[#1E2B25] border border-white/8 rounded-xl h-16 animate-pulse" />)}</div>
          ) : (
            <>
              {view === 'dashboard' && <DashboardSection products={products} />}
              {view === 'list' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Catalogue produits</h2>
                    <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E4501C] text-white text-sm font-medium hover:bg-[#cc3d10] transition-all">
                      <Icon name="PlusIcon" size={14} variant="outline" />Nouveau produit
                    </button>
                  </div>
                  <ProductListSection products={products} onEdit={handleEdit} onDelete={handleDelete} onBulkAction={handleBulkAction} />
                </div>
              )}
              {view === 'form' && (
                <ProductFormSection product={editProduct} allProducts={products} onSave={handleSave} onCancel={() => { setView('list'); setEditProduct(null); }} />
              )}
              {view === 'relations' && <RelationsSection products={products} />}
              {view === 'import' && <ImportSection onImportDone={loadProducts} />}
              {view === 'audit' && <AuditSection />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
