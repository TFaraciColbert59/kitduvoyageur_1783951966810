'use client';

import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  CloudRain,
  Compass,
  Copy,
  Flame,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Tag,
  Wind,
  X,
} from 'lucide-react';
import type { PickerProduct, KitSource } from '@/features/community/create/kit/types';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';

const CATEGORIES = ['Abri', 'Couchage', 'Cuisine', 'Vêtements', 'Hydratation', 'Divers'] as const;
const PRIORITIES = ['Essentiel', 'Confort', 'Sécurité'] as const;
const PACK_ZONES = ['Fond du sac', 'Milieu', 'Accès rapide', 'Sur soi'] as const;
const WEAR_STATES = ['Neuf', 'Très bon', 'Bon', 'À réviser'] as const;
const WEATHER_TAGS = [
  { id: 'pluie', label: 'Pluie', Icon: CloudRain },
  { id: 'vent', label: 'Vent', Icon: Wind },
  { id: 'froid', label: 'Froid', Icon: Snowflake },
  { id: '4s', label: '4 saisons', Icon: Compass },
] as const;

const CATEGORY_BENCHMARK_G: Record<string, number> = {
  Abri: 1100,
  Couchage: 900,
  Cuisine: 450,
  Vêtements: 650,
  Hydratation: 350,
  Divers: 400,
};

const SOURCE_LABELS: Record<KitSource, string> = {
  inventory: 'Mon inventaire',
  achat: 'Boutique neuf',
  location: 'Location',
  occasion: 'Occasion',
  pret: 'Prêt',
};

export interface ProductAddOverrides {
  category?: string;
  quantity?: number;
  weightG?: number;
  borrowed?: boolean;
}

export interface KitProductSheetV2Props {
  product: PickerProduct;
  initialCategory?: string;
  currentKitWeightG: number;
  onClose: () => void;
  onAdd: (product: PickerProduct, overrides: ProductAddOverrides, keepOpen: boolean) => void;
}

function readFavIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('lkdv_fav_products') || '[]') as string[];
  } catch {
    return [];
  }
}

function parsePriceEuro(label: string | null): number | null {
  if (!label) return null;
  const match = label.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/**
 * Fiche produit Kit niveau 2 : fond blanc pur (#FFFFFF), 20 améliorations
 * visuelles et 20 améliorations fonctionnelles interactives.
 */
export function KitProductSheetV2({
  product,
  initialCategory,
  currentKitWeightG,
  onClose,
  onAdd,
}: KitProductSheetV2Props) {
  const defaultCat =
    initialCategory && (CATEGORIES as readonly string[]).includes(initialCategory)
      ? initialCategory
      : product.category && (CATEGORIES as readonly string[]).includes(product.category)
        ? product.category
        : 'Divers';

  const [zoomed, setZoomed] = useState(false);
  const [favorite, setFavorite] = useState(() => readFavIds().includes(product.id));
  const [copied, setCopied] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [weightG, setWeightG] = useState<number>(product.weightG ?? 0);
  const [category, setCategory] = useState<string>(defaultCat);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('Essentiel');
  const [packZone, setPackZone] = useState<(typeof PACK_ZONES)[number]>('Milieu');
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);
  const [borrowed, setBorrowed] = useState(product.source === 'pret');
  const [weatherTags, setWeatherTags] = useState<string[]>(['4s']);
  const [wearState, setWearState] = useState<(typeof WEAR_STATES)[number]>('Neuf');
  const [note, setNote] = useState('');
  const [addedFlash, setAddedFlash] = useState(false);

  const imgSrc =
    product.image || generatedProductImage(product.name, product.category ?? category ?? 'Matériel');

  const effectiveAddWeight = worn ? 0 : Math.max(0, weightG) * quantity;
  const projectedTotalG = currentKitWeightG + effectiveAddWeight;
  const kitSharePct =
    projectedTotalG > 0 ? Math.min(100, Math.round((effectiveAddWeight / projectedTotalG) * 100)) : 0;

  const benchmarkG = CATEGORY_BENCHMARK_G[category] ?? 500;
  const benchStatus =
    weightG <= 0
      ? 'Poids non saisi'
      : weightG <= benchmarkG * 0.75
        ? 'Ultraléger'
        : weightG <= benchmarkG * 1.15
          ? 'Standard'
          : 'Confort / Robuste';

  const priceEuro = parsePriceEuro(product.priceLabel);
  const euroPer100g = useMemo(() => {
    if (!priceEuro || weightG <= 0) return null;
    return ((priceEuro / weightG) * 100).toFixed(1).replace('.', ',');
  }, [priceEuro, weightG]);

  const toggleFav = () => {
    const cur = readFavIds();
    const next = favorite ? cur.filter((id) => id !== product.id) : [...cur, product.id];
    try {
      localStorage.setItem('lkdv_fav_products', JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
    setFavorite(!favorite);
  };

  const copySpecs = async () => {
    const summary = `${product.name}${product.brand ? ` (${product.brand})` : ''} — ${weightG} g · Catégorie : ${category}${product.priceLabel ? ` · ${product.priceLabel}` : ''}`;
    try {
      await navigator.clipboard?.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore clipboard denied */
    }
  };

  const resetOverrides = () => {
    setQuantity(1);
    setWeightG(product.weightG ?? 0);
    setCategory(defaultCat);
    setPriority('Essentiel');
    setPackZone('Milieu');
    setWorn(false);
    setConsumable(false);
    setBorrowed(product.source === 'pret');
    setWeatherTags(['4s']);
    setWearState('Neuf');
    setNote('');
  };

  const triggerAdd = (qtyOverride?: number, keepOpen = false) => {
    onAdd(
      product,
      {
        category,
        quantity: qtyOverride ?? quantity,
        weightG,
        borrowed,
      },
      keepOpen,
    );
    if (keepOpen) {
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 1200);
    }
  };

  return (
    <div
      className="lkdv-cv2c-stack-overlay is-level2 is-product-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Détails : ${product.name}`}
    >
      <div className="lkdv-cv2-grab" aria-hidden="true">
        <span />
      </div>

      {/* En-tête minimaliste blanc */}
      <div className="lkdv-cv2c-ps-head">
        <button
          type="button"
          className="lkdv-cv2c-stack-close"
          aria-label="Fermer la fiche produit"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
        <span className="lkdv-cv2c-ps-head-title">Fiche produit</span>
        <div className="lkdv-cv2c-ps-head-actions">
          <button
            type="button"
            className="lkdv-cv2c-ps-iconbtn"
            aria-label="Copier les caractéristiques"
            title="Copier les specs"
            onClick={() => void copySpecs()}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="lkdv-cv2c-ps-iconbtn"
            aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={favorite}
            onClick={toggleFav}
          >
            <Bookmark size={14} fill={favorite ? '#1b4332' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lkdv-cv2c-ps-iconbtn"
            aria-label="Réinitialiser les réglages"
            title="Réinitialiser"
            onClick={resetOverrides}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Corps scrollable sur fond blanc pur */}
      <div className="lkdv-cv2c-ps-body">
        {/* Hero média + zoom + badges flottants */}
        <div className="lkdv-cv2c-ps-hero" data-zoomed={zoomed || undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- photo produit */}
          <img src={imgSrc} alt={product.name} className="lkdv-cv2c-ps-hero-img" />
          <span className="lkdv-cv2c-ps-badge is-left">{SOURCE_LABELS[product.source]}</span>
          {product.priceLabel ? (
            <span className="lkdv-cv2c-ps-badge is-right">{product.priceLabel}</span>
          ) : null}
          <button
            type="button"
            className="lkdv-cv2c-ps-zoom-btn"
            aria-label={zoomed ? 'Réduire la photo' : 'Zoomer sur la photo'}
            onClick={() => setZoomed((z) => !z)}
          >
            {zoomed ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
          </button>
        </div>

        {/* Identité & Titre */}
        <div className="lkdv-cv2c-ps-title-block">
          <div className="lkdv-cv2c-ps-eyebrow-row">
            {product.brand ? <span className="lkdv-cv2c-ps-brand">{product.brand}</span> : null}
            <span className="lkdv-cv2c-ps-bench">{benchStatus}</span>
          </div>
          <h3 className="lkdv-cv2c-ps-name">{product.name}</h3>
        </div>

        {/* 3 tuiles KPI tabulaires */}
        <div className="lkdv-cv2c-ps-kpi-grid">
          <div className="lkdv-cv2c-ps-kpi">
            <small>Poids total</small>
            <b>{effectiveAddWeight >= 1000 ? `${(effectiveAddWeight / 1000).toFixed(2).replace('.', ',')} kg` : `${effectiveAddWeight} g`}</b>
          </div>
          <div className="lkdv-cv2c-ps-kpi">
            <small>Impact sac</small>
            <b>{kitSharePct}%</b>
          </div>
          <div className="lkdv-cv2c-ps-kpi">
            <small>{euroPer100g ? 'Coût / 100g' : 'Repère'}</small>
            <b>{euroPer100g ? `${euroPer100g} €` : `${benchmarkG} g`}</b>
          </div>
        </div>

        {/* Barre visuelle de part du sac */}
        <div className="lkdv-cv2c-ps-card">
          <div className="lkdv-cv2c-ps-row-head">
            <span>Part dans ton kit projeté</span>
            <b>{kitSharePct}% ({projectedTotalG >= 1000 ? `${(projectedTotalG / 1000).toFixed(2).replace('.', ',')} kg` : `${projectedTotalG} g`})</b>
          </div>
          <div className="lkdv-cv2c-ps-progress-track">
            <span className="lkdv-cv2c-ps-progress-fill" style={{ width: `${Math.max(4, kitSharePct)}%` }} />
          </div>
        </div>

        {/* Quantité & Poids unitaire éditables */}
        <div className="lkdv-cv2c-ps-card lkdv-cv2c-ps-grid-2">
          <div>
            <span className="lkdv-cv2c-ps-label">Quantité</span>
            <div className="lkdv-cv2c-ps-stepper">
              <button
                type="button"
                aria-label="Diminuer la quantité"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} />
              </button>
              <output>{quantity}</output>
              <button
                type="button"
                aria-label="Augmenter la quantité"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="ps-custom-weight" className="lkdv-cv2c-ps-label">
              Poids unitaire (g)
            </label>
            <input
              id="ps-custom-weight"
              type="number"
              min={0}
              max={60000}
              className="lkdv-cv2c-ps-input"
              value={weightG}
              onChange={(e) => setWeightG(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        {/* Catégorie de destination dans le kit */}
        <div className="lkdv-cv2c-ps-card">
          <span className="lkdv-cv2c-ps-label">
            <Tag size={11} aria-hidden="true" /> Catégorie dans le kit
          </span>
          <div className="lkdv-cv2c-ps-pills">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="lkdv-cv2c-ps-pill"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Priorité & Zone de rangement */}
        <div className="lkdv-cv2c-ps-card">
          <span className="lkdv-cv2c-ps-label">
            <ShieldAlert size={11} aria-hidden="true" /> Priorité & Rangement
          </span>
          <div className="lkdv-cv2c-ps-pills" style={{ marginBottom: 8 }}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className="lkdv-cv2c-ps-pill"
                aria-pressed={priority === p}
                onClick={() => setPriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="lkdv-cv2c-ps-pills">
            {PACK_ZONES.map((zone) => (
              <button
                key={zone}
                type="button"
                className="lkdv-cv2c-ps-pill"
                aria-pressed={packZone === zone}
                onClick={() => setPackZone(zone)}
              >
                <Layers size={10} aria-hidden="true" /> {zone}
              </button>
            ))}
          </div>
        </div>

        {/* État / Usure & Attributs rapides (Porté / Consommable / Emprunté) */}
        <div className="lkdv-cv2c-ps-card">
          <span className="lkdv-cv2c-ps-label">
            <Package size={11} aria-hidden="true" /> État & Attributs
          </span>
          <div className="lkdv-cv2c-ps-pills" style={{ marginBottom: 8 }}>
            {WEAR_STATES.map((st) => (
              <button
                key={st}
                type="button"
                className="lkdv-cv2c-ps-pill"
                aria-pressed={wearState === st}
                onClick={() => setWearState(st)}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="lkdv-cv2c-ps-pills">
            <button
              type="button"
              className="lkdv-cv2c-ps-pill"
              aria-pressed={worn}
              onClick={() => setWorn((v) => !v)}
            >
              <Sparkles size={10} aria-hidden="true" /> Porté sur soi
            </button>
            <button
              type="button"
              className="lkdv-cv2c-ps-pill"
              aria-pressed={consumable}
              onClick={() => setConsumable((v) => !v)}
            >
              <Flame size={10} aria-hidden="true" /> Consommable
            </button>
            <button
              type="button"
              className="lkdv-cv2c-ps-pill"
              aria-pressed={borrowed}
              onClick={() => setBorrowed((v) => !v)}
            >
              Emprunté
            </button>
          </div>
        </div>

        {/* Conditions météo adaptées */}
        <div className="lkdv-cv2c-ps-card">
          <span className="lkdv-cv2c-ps-label">Conditions adaptées</span>
          <div className="lkdv-cv2c-ps-pills">
            {WEATHER_TAGS.map(({ id, label, Icon }) => {
              const active = weatherTags.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className="lkdv-cv2c-ps-pill"
                  aria-pressed={active}
                  onClick={() =>
                    setWeatherTags((cur) =>
                      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                    )
                  }
                >
                  <Icon size={11} aria-hidden="true" /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mémo / Note personnelle */}
        <div className="lkdv-cv2c-ps-card">
          <label htmlFor="ps-personal-note" className="lkdv-cv2c-ps-label">
            Note / Entretien
          </label>
          <input
            id="ps-personal-note"
            type="text"
            className="lkdv-cv2c-ps-input"
            placeholder="Ex : vérifier piles, réimperméabiliser…"
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* Pied collant blanc avec double action */}
      <div className="lkdv-cv2c-ps-foot">
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
          onClick={() => triggerAdd(quantity, true)}
        >
          {addedFlash ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          {addedFlash ? 'Ajouté' : '+ Continuer'}
        </button>
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
          onClick={() => triggerAdd(Math.min(20, quantity * 2), false)}
          title="Ajouter en double"
        >
          ×2
        </button>
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--primary"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => triggerAdd(quantity, false)}
        >
          <Plus size={15} aria-hidden="true" /> Ajouter au kit
        </button>
      </div>
    </div>
  );
}
