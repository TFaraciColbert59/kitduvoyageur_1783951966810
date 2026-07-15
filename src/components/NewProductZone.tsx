'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { saveCart, getCart } from '@/lib/cart';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface NewProductSpec {
  label: string;
  value: string;
}

export interface NewProductReview {
  author: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
}

export interface NewProductData {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  reference: string;
  categorie: string;
  prix_cents: number;
  poids_g: number;
  stock: number;
  /** 'en_stock' | 'rupture' | 'reappro' */
  stock_statut?: 'en_stock' | 'rupture' | 'reappro';
  /** ISO date string — shown when stock_statut === 'reappro' */
  reappro_date?: string;
  description: string;
  specs: NewProductSpec[];
  tags: string[];
  note: number;
  avis_count: number;
  reviews: NewProductReview[];
  images: { url: string; alt: string }[];
}

interface OccasionListing {
  slug: string;
  prix_cents: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0€';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Stock Badge ────────────────────────────────────────────────────────────────
function StockBadge({ statut, stock, reapproDate }: { statut: 'en_stock' | 'rupture' | 'reappro'; stock: number; reapproDate?: string }) {
  if (statut === 'en_stock') {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-green-500">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {stock > 0 ? `${stock} en stock` : 'En stock'}
      </div>
    );
  }
  if (statut === 'reappro') {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Réapprovisionnement prévu
        </div>
        {reapproDate && (
          <span className="text-xs text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
            vers le {fmtDate(reapproDate)}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-red-500">
      <span className="w-2 h-2 rounded-full bg-red-500" />
      Rupture de stock
    </div>
  );
}

// ── Occasion Banner ────────────────────────────────────────────────────────────
function OccasionBanner({ productId, productNom }: { productId: string; productNom: string }) {
  const [occasion, setOccasion] = useState<OccasionListing | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`/api/produit/occasion-check?produit_id=${productId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.listing) setOccasion(data.listing);
      } catch {
        // silent — banner simply doesn't show
      } finally {
        if (!cancelled) setChecked(true);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [productId]);

  if (!checked || !occasion) return null;

  return (
    <Link
      href={`/produit/${occasion.slug}`}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:border-amber-500/50 transition-colors group"
      aria-label={`Voir ${productNom} en occasion à partir de ${fmt(occasion.prix_cents)}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name="TagIcon" size={15} variant="outline" className="text-amber-400 flex-shrink-0" />
        <span className="text-sm text-amber-300 font-medium leading-snug">
          Aussi disponible en occasion à partir de{' '}
          <span className="font-mono font-700" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(occasion.prix_cents)}</span>
        </span>
      </div>
      <Icon name="ArrowRightIcon" size={14} variant="outline" className="text-amber-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

// ── AI: Description enrichie ───────────────────────────────────────────────────
function AIDescriptionPanel({ product }: { product: NewProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fetched = useRef(false);

  const generate = useCallback(async () => {
    if (fetched.current) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Tu es un rédacteur expert en équipement outdoor. Génère une description enrichie et engageante pour ce produit neuf, à partir de ses specs brutes. Ton professionnel, orienté terrain, 3-4 phrases. Pas de bullet points, texte fluide. En français.\n\nProduit : ${product.nom} (${product.marque})\nCatégorie : ${product.categorie}\nSpécifications : ${product.specs.map((s) => `${s.label}: ${s.value}`).join(', ')}\nDescription brute : ${product.description}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      setResult(data.content ?? data.message ?? 'Description non disponible.');
      fetched.current = true;
    } catch {
      setResult('Description IA temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [product]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="SparklesIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Description enrichie par IA</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Génération en cours…
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{result}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI: Comparateur intelligent ────────────────────────────────────────────────
interface ComparableProduct {
  nom: string;
  marque: string;
  prix: string;
  poids: string;
  avantage: string;
  inconvenient: string;
}

function AIComparatorPanel({ product }: { product: NewProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comparables, setComparables] = useState<ComparableProduct[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const fetched = useRef(false);

  const generate = useCallback(async () => {
    if (fetched.current) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Compare ce produit neuf avec 2 alternatives comparables (même catégorie, gamme de prix proche ±30%). Format JSON strict : {"comparables":[{"nom":"...","marque":"...","prix":"...","poids":"...","avantage":"...","inconvenient":"..."}],"verdict":"..."}. Verdict = 1 phrase. En français.\n\nProduit : ${product.nom} (${product.marque})\nCatégorie : ${product.categorie}\nPrix : ${fmt(product.prix_cents)}\nPoids : ${product.poids_g} g\nSpecs : ${product.specs.slice(0, 5).map((s) => `${s.label}: ${s.value}`).join(', ')}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setComparables(parsed.comparables ?? []);
        setVerdict(parsed.verdict ?? null);
      }
      fetched.current = true;
    } catch {
      setComparables([]);
      setVerdict('Comparateur IA temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [product]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="ArrowsRightLeftIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Comparateur intelligent (2-3 produits)</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse des alternatives en cours…
            </div>
          ) : (
            <>
              {/* Current product row */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-primary uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>Ce produit</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Sélectionné</span>
                </div>
                <p className="font-semibold text-foreground text-sm">{product.nom}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                  <span>{fmt(product.prix_cents)}</span>
                  <span>{product.poids_g} g</span>
                </div>
              </div>
              {/* Comparable products */}
              {comparables.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>{c.marque}</span>
                  </div>
                  <p className="font-semibold text-foreground text-sm">{c.nom}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                    <span>{c.prix}</span>
                    <span>{c.poids}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-1.5 text-xs text-emerald-400">
                      <Icon name="PlusCircleIcon" size={12} variant="outline" className="flex-shrink-0 mt-0.5" />
                      <span>{c.avantage}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-red-400">
                      <Icon name="MinusCircleIcon" size={12} variant="outline" className="flex-shrink-0 mt-0.5" />
                      <span>{c.inconvenient}</span>
                    </div>
                  </div>
                </div>
              ))}
              {verdict && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-start gap-2">
                    <Icon name="LightBulbIcon" size={14} variant="outline" className="text-info flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-foreground">{verdict}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI: Résumé des avis ────────────────────────────────────────────────────────
function AIReviewSummaryPanel({ product }: { product: NewProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pros: string[]; cons: string[]; verdict: string } | null>(null);
  const fetched = useRef(false);

  const generate = useCallback(async () => {
    if (fetched.current) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Analyse ces avis clients et génère un résumé structuré des points récurrents. Format JSON strict : {"pros":["...","..."],"cons":["..."],"verdict":"..."}. 2-3 points forts récurrents, 1-2 points faibles récurrents, verdict 1 phrase. En français.\n\nAvis : ${product.reviews.map((r) => `${r.rating}/5 — ${r.comment}`).join('\n')}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) setResult(JSON.parse(match[0]));
      else setResult({ pros: ['Qualité reconnue'], cons: ['Prix élevé'], verdict: 'Produit recommandé.' });
      fetched.current = true;
    } catch {
      setResult({ pros: ['Qualité reconnue'], cons: ['Prix élevé'], verdict: 'Résumé temporairement indisponible.' });
    } finally {
      setLoading(false);
    }
  }, [product]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="ChatBubbleLeftRightIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Résumé IA des avis (points récurrents)</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse des avis…
            </div>
          ) : result && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Points forts récurrents</p>
                {result.pros.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1.5">
                    <Icon name="CheckCircleIcon" size={14} variant="outline" className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
              {result.cons.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Points faibles récurrents</p>
                  {result.cons.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1.5">
                      <Icon name="ExclamationCircleIcon" size={14} variant="outline" className="text-red-400 flex-shrink-0 mt-0.5" />
                      {c}
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground">{result.verdict}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI: FAQ ────────────────────────────────────────────────────────────────────
function AIFAQPanel({ product }: { product: NewProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const fetched = useRef(false);

  const generate = useCallback(async () => {
    if (fetched.current) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Génère 4 questions-réponses FAQ pertinentes pour ce produit neuf, basées sur ses specs réelles ET les questions récurrentes dans les avis clients. Questions concrètes et pratiques, réponses courtes (2-3 phrases). Format JSON strict : [{"q":"...","a":"..."}]. En français.\n\nProduit : ${product.nom} (${product.marque})\nSpecs : ${product.specs.map((s) => `${s.label}: ${s.value}`).join(', ')}\nAvis : ${product.reviews.map((r) => r.comment).join(' | ')}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '[]';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) setFaqs(JSON.parse(match[0]));
      else setFaqs([{ q: 'FAQ temporairement indisponible', a: 'Veuillez réessayer.' }]);
      fetched.current = true;
    } catch {
      setFaqs([{ q: 'FAQ temporairement indisponible', a: 'Veuillez réessayer.' }]);
    } finally {
      setLoading(false);
    }
  }, [product]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="QuestionMarkCircleIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>FAQ générée (specs + avis réels)</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Génération des questions…
            </div>
          ) : faqs.map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{faq.q}</span>
                <Icon name={openIdx === i ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} variant="outline" className="text-muted-foreground flex-shrink-0" />
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main: NewProductZone ───────────────────────────────────────────────────────
/**
 * NewProductZone — Zone d'action complète pour les fiches produit de type NEUF.
 * Étend le composant ProductPage partagé sans le dupliquer.
 *
 * Inclut :
 * - Prix fixe + bouton "Ajouter au panier"
 * - Affichage du stock avec 3 états : en_stock / rupture / reappro (date si connue)
 * - Bandeau "Aussi disponible en occasion à partir de X€" (si listing actif trouvé)
 * - Panneaux IA : description enrichie, comparateur 2-3 produits, résumé avis, FAQ
 */
export default function NewProductZone({ product }: { product: NewProductData }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Derive stock status
  const stockStatut: 'en_stock' | 'rupture' | 'reappro' =
    product.stock_statut ??
    (product.stock > 0 ? 'en_stock' : 'rupture');

  const canBuy = stockStatut === 'en_stock' && product.stock > 0;

  const handleAddToCart = useCallback(() => {
    if (!canBuy) return;
    const existing = getCart();
    const idx = existing.findIndex((i) => i.id === product.id);
    if (idx >= 0) {
      existing[idx].quantity += quantity;
    } else {
      existing.push({
        id: product.id,
        slug: product.slug,
        name: product.nom,
        brand: product.marque,
        category: product.categorie,
        priceEur: product.prix_cents / 100,
        weightG: product.poids_g,
        quantity,
        image: product.images[0]?.url ?? '',
        imageAlt: product.images[0]?.alt ?? '',
      });
    }
    saveCart(existing);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }, [canBuy, product, quantity]);

  return (
    <div className="space-y-5">
      {/* ── Price + Stock ── */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p
              className="text-3xl font-display font-700 text-foreground"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {fmt(product.prix_cents)}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">TVA incluse · Livraison gratuite dès 50&nbsp;€</p>
          </div>
          <StockBadge
            statut={stockStatut}
            stock={product.stock}
            reapproDate={product.reappro_date}
          />
        </div>

        {/* Reappro notice */}
        {stockStatut === 'reappro' && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Icon name="ClockIcon" size={15} variant="outline" className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300 leading-snug">
              Ce produit est temporairement en rupture.
              {product.reappro_date
                ? ` Réapprovisionnement prévu le ${fmtDate(product.reappro_date)}.`
                : ' La date de réapprovisionnement sera communiquée prochainement.'}
              {' '}Vous pouvez l&apos;ajouter à vos alertes.
            </p>
          </div>
        )}

        {/* Rupture notice */}
        {stockStatut === 'rupture' && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <Icon name="ExclamationTriangleIcon" size={15} variant="outline" className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-snug">
              Ce produit est actuellement en rupture de stock. Consultez les alternatives en occasion ci-dessous ou activez une alerte.
            </p>
          </div>
        )}

        {/* Quantity + Add to cart */}
        <div className="flex gap-3">
          {canBuy && (
            <div className="flex items-center border border-border rounded-full overflow-hidden">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Diminuer la quantité"
              >
                <Icon name="MinusIcon" size={16} variant="outline" />
              </button>
              <span
                className="w-10 text-center font-mono text-sm font-semibold"
                style={{ fontFamily: 'var(--font-mono)' }}
                aria-live="polite"
                aria-label={`Quantité : ${quantity}`}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Augmenter la quantité"
              >
                <Icon name="PlusIcon" size={16} variant="outline" />
              </button>
            </div>
          )}
          <button
            onClick={handleAddToCart}
            disabled={!canBuy}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all min-h-[44px] ${
              added
                ? 'bg-green-600 text-white'
                : canBuy
                ? 'bg-primary hover:bg-primary/90 text-white' :'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
            aria-label={added ? 'Produit ajouté au panier' : 'Ajouter au panier'}
          >
            <Icon name={added ? 'CheckIcon' : 'ShoppingBagIcon'} size={18} variant="outline" />
            {added ? 'Ajouté au panier !' : canBuy ? 'Ajouter au panier' : stockStatut === 'reappro' ? 'Réapprovisionnement prévu' : 'Rupture de stock'}
          </button>
        </div>

        {canBuy && (
          <p className="text-xs text-muted-foreground text-center">
            <Icon name="ShieldCheckIcon" size={11} variant="outline" className="inline mr-1" />
            Paiement sécurisé · Retours sous 30 jours
          </p>
        )}
      </div>

      {/* ── Occasion Banner ── */}
      <OccasionBanner productId={product.id} productNom={product.nom} />

      {/* ── AI Panels ── */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="SparklesIcon" size={14} variant="outline" className="text-info" />
          <span className="text-xs font-mono text-info uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
            Intelligence artificielle
          </span>
        </div>
        <div className="space-y-3">
          <AIDescriptionPanel product={product} />
          <AIComparatorPanel product={product} />
          <AIReviewSummaryPanel product={product} />
          <AIFAQPanel product={product} />
        </div>
      </div>
    </div>
  );
}
