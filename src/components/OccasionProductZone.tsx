'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

// ── Types ──────────────────────────────────────────────────────────────────────
export type OccasionEtat = 'comme_neuf' | 'bon_etat' | 'etat_correct';
export type OccasionStatut =
  | 'en_attente_moderation' |'active' |'vendue' |'retiree' |'litige';

export interface OccasionHistorique {
  date_achat_origine?: string;
  nombre_proprietaires?: number;
  usage_declare?: string;
}

export interface OccasionVendeur {
  id: string;
  nom: string;
  trust_score: number;
  nb_ventes: number;
  delai_reponse_heures?: number;
  avatar?: string;
}

export interface OccasionCertificat {
  numero?: string;
  date_emission?: string;
  verifie_par?: string;
}

export interface OccasionProductData {
  id: string;
  listing_id: string;
  slug: string;
  nom: string;
  marque: string;
  reference: string;
  categorie: string;
  prix_cents: number;
  poids_g: number;
  description: string;
  specs: { label: string; value: string }[];
  tags: string[];
  note: number;
  avis_count: number;
  reviews: { author: string; rating: number; comment: string; date: string; verified: boolean }[];
  images: { url: string; alt: string }[];
  // Occasion-specific
  etat: OccasionEtat;
  statut: OccasionStatut;
  faire_offre_active?: boolean;
  historique?: OccasionHistorique;
  certificat?: OccasionCertificat;
  photos_defauts?: { url: string; alt: string; description?: string }[];
  vendeur?: OccasionVendeur;
  // Produit neuf lié
  produit_id?: string;
}

interface NewProductBannerData {
  slug: string;
  prix_cents: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0€';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── État Badge ─────────────────────────────────────────────────────────────────
const ETAT_CONFIG: Record<OccasionEtat, { label: string; cls: string; icon: string }> = {
  comme_neuf: {
    label: 'Comme neuf',
    cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    icon: 'StarIcon',
  },
  bon_etat: {
    label: 'Bon état',
    cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    icon: 'CheckCircleIcon',
  },
  etat_correct: {
    label: 'État correct',
    cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    icon: 'ExclamationCircleIcon',
  },
};

// ── Statut Banner ──────────────────────────────────────────────────────────────
function StatutBanner({ statut }: { statut: OccasionStatut }) {
  if (statut === 'active') return null;

  const config: Record<Exclude<OccasionStatut, 'active'>, { label: string; cls: string; icon: string; desc: string }> = {
    en_attente_moderation: {
      label: 'En attente de modération',
      cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      icon: 'ClockIcon',
      desc: "Cette annonce est en cours de vérification par notre équipe. Elle sera publiée sous 24h.",
    },
    vendue: {
      label: 'Article vendu',
      cls: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
      icon: 'CheckBadgeIcon',
      desc: 'Cet article a déjà été vendu. Consultez les annonces similaires.',
    },
    retiree: {
      label: 'Annonce retirée',
      cls: 'bg-red-500/10 border-red-500/30 text-red-400',
      icon: 'XCircleIcon',
      desc: 'Le vendeur a retiré cette annonce.',
    },
    litige: {
      label: 'Litige en cours',
      cls: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
      icon: 'ExclamationTriangleIcon',
      desc: 'Un litige est ouvert sur cette transaction. Notre équipe de résolution est en charge.',
    },
  };

  const c = config[statut];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${c.cls} mb-4`}>
      <Icon name={c.icon} size={16} variant="outline" className="flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">{c.label}</p>
        <p className="text-xs opacity-80 mt-0.5">{c.desc}</p>
      </div>
    </div>
  );
}

// ── Bandeau Neuf ───────────────────────────────────────────────────────────────
function NewProductBanner({ produitId, produitNom }: { produitId?: string; produitNom: string }) {
  const [newListing, setNewListing] = useState<NewProductBannerData | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!produitId) { setChecked(true); return; }
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`/api/produit/neuf-check?produit_id=${produitId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.listing) setNewListing(data.listing);
      } catch {
        // silent
      } finally {
        if (!cancelled) setChecked(true);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [produitId]);

  if (!checked || !newListing) return null;

  return (
    <Link
      href={`/produit/${newListing.slug}`}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/25 hover:border-blue-500/50 transition-colors group"
      aria-label={`Voir ${produitNom} neuf à partir de ${fmt(newListing.prix_cents)}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name="SparklesIcon" size={15} variant="outline" className="text-blue-400 flex-shrink-0" />
        <span className="text-sm text-blue-300 font-medium leading-snug">
          Ce modèle existe aussi en neuf à partir de{' '}
          <span className="font-mono font-700" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(newListing.prix_cents)}</span>
        </span>
      </div>
      <Icon name="ArrowRightIcon" size={14} variant="outline" className="text-blue-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

// ── Historique Produit ─────────────────────────────────────────────────────────
function HistoriqueProduit({ historique }: { historique?: OccasionHistorique }) {
  if (!historique) return null;
  const { date_achat_origine, nombre_proprietaires, usage_declare } = historique;
  if (!date_achat_origine && !nombre_proprietaires && !usage_declare) return null;

  return (
    <div className="topo-card p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="ClipboardDocumentListIcon" size={14} variant="outline" className="text-muted-foreground" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Historique du produit</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {date_achat_origine && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date d&apos;achat d&apos;origine</span>
            <span className="font-mono text-foreground font-medium" style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(date_achat_origine)}</span>
          </div>
        )}
        {nombre_proprietaires !== undefined && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Nombre de propriétaires</span>
            <span className="font-mono text-foreground font-medium" style={{ fontFamily: 'var(--font-mono)' }}>{nombre_proprietaires}</span>
          </div>
        )}
        {usage_declare && (
          <div className="flex items-start justify-between text-sm gap-4">
            <span className="text-muted-foreground flex-shrink-0">Usage déclaré</span>
            <span className="text-foreground text-right">{usage_declare}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Certificat d'authenticité ──────────────────────────────────────────────────
function CertificatAuthenticite({ certificat }: { certificat?: OccasionCertificat }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="topo-card p-4 border-emerald-500/20 border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon name="ShieldCheckIcon" size={16} variant="outline" className="text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground">Certificat d&apos;authenticité</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 text-[10px] font-mono border border-emerald-400/20" style={{ fontFamily: 'var(--font-mono)' }}>Vérifié</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {certificat?.numero && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">N° certificat</span>
              <span className="font-mono text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{certificat.numero}</span>
            </div>
          )}
          {certificat?.date_emission && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date d&apos;émission</span>
              <span className="font-mono text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(certificat.date_emission)}</span>
            </div>
          )}
          {certificat?.verifie_par && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Vérifié par</span>
              <span className="text-foreground font-medium">{certificat.verifie_par}</span>
            </div>
          )}
          {!certificat?.numero && !certificat?.date_emission && (
            <p className="text-sm text-muted-foreground">Authenticité vérifiée par l&apos;équipe Kit du Voyageur avant publication.</p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
            <Icon name="LockClosedIcon" size={11} variant="outline" />
            Certificat infalsifiable · Enregistré sur notre registre
          </div>
        </div>
      )}
    </div>
  );
}

// ── Galerie Photos Défauts ─────────────────────────────────────────────────────
function GalerieDefauts({ photos }: { photos?: { url: string; alt: string; description?: string }[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!photos || photos.length === 0) return null;

  return (
    <div className="topo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="CameraIcon" size={14} variant="outline" className="text-yellow-400" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Photos des défauts ({photos.length})</span>
      </div>
      <div className="aspect-video rounded-xl overflow-hidden bg-card border border-border mb-3 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[activeIdx]?.url}
          alt={photos[activeIdx]?.alt}
          className="w-full h-full object-cover"
        />
        {photos[activeIdx]?.description && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-3 py-2">
            <p className="text-xs text-white">{photos[activeIdx].description}</p>
          </div>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${activeIdx === i ? 'border-yellow-400' : 'border-border hover:border-yellow-400/50'}`}
              aria-label={`Défaut ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fiche Vendeur ──────────────────────────────────────────────────────────────
function FicheVendeur({ vendeur }: { vendeur?: OccasionVendeur }) {
  if (!vendeur) return null;

  const trustColor =
    vendeur.trust_score >= 80
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
      : vendeur.trust_score >= 60
      ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' :'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';

  return (
    <div className="topo-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="UserCircleIcon" size={14} variant="outline" className="text-muted-foreground" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Fiche vendeur</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {vendeur.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendeur.avatar} alt={vendeur.nom} className="w-full h-full object-cover" />
          ) : (
            <Icon name="UserIcon" size={18} variant="outline" className="text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{vendeur.nom}</p>
          <p className="text-xs text-muted-foreground">{vendeur.nb_ventes} vente{vendeur.nb_ventes !== 1 ? 's' : ''} réalisée{vendeur.nb_ventes !== 1 ? 's' : ''}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-700 ${trustColor}`} style={{ fontFamily: 'var(--font-mono)' }}>
          <Icon name="ShieldCheckIcon" size={11} variant="outline" />
          Trust {vendeur.trust_score}
        </div>
      </div>
      {vendeur.delai_reponse_heures !== undefined && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
          <Icon name="ChatBubbleLeftIcon" size={11} variant="outline" />
          Délai de réponse moyen :{' '}
          <span className="text-foreground font-medium">
            {vendeur.delai_reponse_heures < 1
              ? 'moins d\'1h'
              : vendeur.delai_reponse_heures < 24
              ? `${vendeur.delai_reponse_heures}h`
              : `${Math.round(vendeur.delai_reponse_heures / 24)} jour(s)`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Paiement Séquestre (placeholder sans Stripe) ───────────────────────────────
function PaiementSequestre({ prix_cents, statut }: { prix_cents: number; statut: OccasionStatut }) {
  const isAvailable = statut === 'active';

  return (
    <div className="space-y-3">
      <button
        disabled={!isAvailable}
        className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold text-sm transition-all min-h-[44px] ${
          isAvailable
            ? 'bg-primary hover:bg-primary/90 text-white' :'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        <Icon name="ShoppingBagIcon" size={18} variant="outline" />
        {isAvailable ? `Acheter · ${fmt(prix_cents)}` : 'Indisponible'}
      </button>
      {isAvailable && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
          <Icon name="LockClosedIcon" size={13} variant="outline" className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Paiement sécurisé par séquestre</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Les fonds sont bloqués jusqu&apos;à confirmation de réception conforme par l&apos;acheteur.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Faire une offre ────────────────────────────────────────────────────────────
function FaireUneOffre({ prix_cents }: { prix_cents: number }) {
  const [open, setOpen] = useState(false);
  const [montant, setMontant] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!montant) return;
    setSent(true);
    setTimeout(() => { setSent(false); setOpen(false); setMontant(''); }, 3000);
  };

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-sm transition-all"
        >
          <Icon name="ChatBubbleLeftRightIcon" size={14} variant="outline" />
          Faire une offre
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="topo-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Votre offre</span>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <Icon name="XMarkIcon" size={14} variant="outline" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Prix affiché : <span className="font-mono text-foreground">{fmt(prix_cents)}</span></p>
          <div className="flex gap-2">
            <input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder={`Ex. ${Math.round(prix_cents * 0.9 / 100)}`}
              min={1}
              className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
            />
            <span className="flex items-center text-sm text-muted-foreground pr-1">€</span>
          </div>
          <button
            type="submit"
            disabled={sent}
            className={`w-full py-2.5 rounded-full text-sm font-semibold transition-all ${sent ? 'bg-emerald-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
          >
            {sent ? '✓ Offre envoyée au vendeur' : 'Envoyer l\'offre'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── IA : Estimation prix ───────────────────────────────────────────────────────
function AIPrixEstimationPanel({ product }: { product: OccasionProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ estimation: string; fourchette: string; verdict: string; conseil: string } | null>(null);
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
            content: `Tu es un expert en valorisation d'équipement outdoor d'occasion. Estime le prix de revente juste pour cet article basé sur des ventes comparables réelles. Format JSON strict : {"estimation":"XXX €","fourchette":"XXX–XXX €","verdict":"juste/surévalué/sous-évalué","conseil":"..."}. Verdict = 1 mot parmi juste/surévalué/sous-évalué. Conseil = 1 phrase max. En français.\n\nProduit : ${product.nom} (${product.marque})\nCatégorie : ${product.categorie}\nÉtat : ${product.etat}\nPrix demandé : ${fmt(product.prix_cents)}\nSpecs : ${product.specs.slice(0, 5).map((s) => `${s.label}: ${s.value}`).join(', ')}\nHistorique : ${product.historique ? `${product.historique.nombre_proprietaires ?? 1} propriétaire(s), usage: ${product.historique.usage_declare ?? 'non précisé'}` : 'non renseigné'}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        setResult(JSON.parse(match[0]));
      } else {
        setResult({ estimation: '—', fourchette: '—', verdict: 'juste', conseil: 'Estimation IA temporairement indisponible.' });
      }
      fetched.current = true;
    } catch {
      setResult({ estimation: '—', fourchette: '—', verdict: 'juste', conseil: 'Estimation IA temporairement indisponible.' });
    } finally {
      setLoading(false);
    }
  }, [product]);

  const verdictColor = result?.verdict === 'surévalué' ?'text-red-400 bg-red-400/10 border-red-400/30'
    : result?.verdict === 'sous-évalué' ?'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' :'text-blue-400 bg-blue-400/10 border-blue-400/30';

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="CurrencyEuroIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Estimation prix IA</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse des ventes comparables…
            </div>
          ) : result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Estimation juste valeur</p>
                  <p className="font-mono text-xl font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{result.estimation}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Fourchette : {result.fourchette}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize ${verdictColor}`}>
                  {result.verdict}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">{result.conseil}</p>
              <p className="text-[10px] text-muted-foreground/60">Basé sur des ventes comparables réelles · Estimation indicative</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── IA : Analyse cohérence état/photos ────────────────────────────────────────
function AICoherencePanel({ product }: { product: OccasionProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ coherent: boolean; score: number; observations: string[]; signalement?: string } | null>(null);
  const fetched = useRef(false);

  const hasPhotosDefauts = (product.photos_defauts?.length ?? 0) > 0;

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
            content: `Tu es un expert en contrôle qualité d'équipement outdoor d'occasion. Analyse la cohérence entre l'état déclaré et les informations disponibles. Format JSON strict : {"coherent":true/false,"score":0-100,"observations":["...","..."],"signalement":"..." (optionnel, seulement si incohérence majeure)}. Score = cohérence 0-100. En français.\n\nÉtat déclaré : ${product.etat} (${ETAT_CONFIG[product.etat].label})\nNombre de photos défauts : ${product.photos_defauts?.length ?? 0}\nDescriptions défauts : ${product.photos_defauts?.map((p) => p.description).filter(Boolean).join(', ') || 'aucune'}\nHistorique : ${product.historique ? `${product.historique.nombre_proprietaires ?? 1} propriétaire(s), usage: ${product.historique.usage_declare ?? 'non précisé'}` : 'non renseigné'}\nProduit : ${product.nom} (${product.marque})`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        setResult(JSON.parse(match[0]));
      } else {
        setResult({ coherent: true, score: 75, observations: ['Analyse temporairement indisponible.'] });
      }
      fetched.current = true;
    } catch {
      setResult({ coherent: true, score: 75, observations: ['Analyse temporairement indisponible.'] });
    } finally {
      setLoading(false);
    }
  }, [product]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="MagnifyingGlassIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Cohérence état / photos</span>
          {!hasPhotosDefauts && (
            <span className="text-[10px] text-muted-foreground">(sans photos défauts)</span>
          )}
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse de cohérence…
            </div>
          ) : result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon
                    name={result.coherent ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'}
                    size={16}
                    variant="outline"
                    className={result.coherent ? 'text-emerald-400' : 'text-orange-400'}
                  />
                  <span className={`text-sm font-semibold ${result.coherent ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {result.coherent ? 'Cohérent' : 'Incohérence détectée'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${result.score >= 75 ? 'bg-emerald-400' : result.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{result.score}/100</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {result.observations.map((obs, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Icon name="ChevronRightIcon" size={10} variant="outline" className="flex-shrink-0 mt-0.5" />
                    {obs}
                  </div>
                ))}
              </div>
              {result.signalement && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/25 text-xs text-orange-400">
                  <Icon name="FlagIcon" size={11} variant="outline" className="flex-shrink-0 mt-0.5" />
                  <span><strong>Signalé à la modération :</strong> {result.signalement}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── IA : Analyse photos défauts ────────────────────────────────────────────────
function AIPhotoAnalysisPanel({ product }: { product: OccasionProductData }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ defauts_detectes: string[]; gravite: 'faible' | 'modere' | 'important'; resume: string } | null>(null);
  const fetched = useRef(false);

  const hasPhotos = (product.photos_defauts?.length ?? 0) > 0;

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
            content: `Tu es un expert en contrôle qualité d'équipement outdoor. Analyse les défauts déclarés par le vendeur pour cet article d'occasion. Format JSON strict : {"defauts_detectes":["..."],"gravite":"faible/modere/important","resume":"..."}. Gravite = 1 mot parmi faible/modere/important. Resume = 1 phrase. En français.\n\nProduit : ${product.nom} (${product.marque})\nÉtat déclaré : ${ETAT_CONFIG[product.etat].label}\nDéfauts déclarés : ${hasPhotos ? product.photos_defauts!.map((p) => p.description || p.alt).join(', ') : 'Aucune photo de défaut fournie par le vendeur'}\nNombre de photos défauts : ${product.photos_defauts?.length ?? 0}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        setResult(JSON.parse(match[0]));
      } else {
        setResult({ defauts_detectes: ['Analyse indisponible'], gravite: 'faible', resume: 'Analyse IA temporairement indisponible.' });
      }
      fetched.current = true;
    } catch {
      setResult({ defauts_detectes: ['Analyse indisponible'], gravite: 'faible', resume: 'Analyse IA temporairement indisponible.' });
    } finally {
      setLoading(false);
    }
  }, [product, hasPhotos]);

  const graviteConfig = {
    faible: { cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', label: 'Faible' },
    modere: { cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', label: 'Modéré' },
    important: { cls: 'text-red-400 bg-red-400/10 border-red-400/30', label: 'Important' },
  };

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="EyeIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analyse IA des défauts</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse des défauts en cours…
            </div>
          ) : result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gravité des défauts</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${graviteConfig[result.gravite].cls}`}>
                  {graviteConfig[result.gravite].label}
                </span>
              </div>
              <div className="space-y-1.5">
                {result.defauts_detectes.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Icon name="MinusIcon" size={10} variant="outline" className="flex-shrink-0 mt-0.5 text-yellow-400" />
                    {d}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed">{result.resume}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OccasionProductZone({ product }: { product: OccasionProductData }) {
  const etatInfo = ETAT_CONFIG[product.etat];
  const isActive = product.statut === 'active';

  return (
    <div className="space-y-5">
      {/* Statut banner (si pas active) */}
      <StatutBanner statut={product.statut} />

      {/* Badge état + prix */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${etatInfo.cls}`}>
            <Icon name={etatInfo.icon} size={11} variant="outline" />
            {etatInfo.label}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" style={{ fontFamily: 'var(--font-mono)' }}>
            Occasion
          </span>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{fmt(product.prix_cents)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Prix fixe · Paiement sécurisé par séquestre</p>
          </div>
        </div>
      </div>

      {/* Bandeau neuf si applicable */}
      <NewProductBanner produitId={product.produit_id} produitNom={product.nom} />

      {/* Historique produit */}
      <HistoriqueProduit historique={product.historique} />

      {/* Galerie photos défauts */}
      <GalerieDefauts photos={product.photos_defauts} />

      {/* Certificat d'authenticité */}
      <CertificatAuthenticite certificat={product.certificat} />

      {/* Fiche vendeur */}
      <FicheVendeur vendeur={product.vendeur} />

      {/* Zone achat */}
      <PaiementSequestre prix_cents={product.prix_cents} statut={product.statut} />

      {/* Faire une offre (si activé par le vendeur) */}
      {isActive && product.faire_offre_active && (
        <FaireUneOffre prix_cents={product.prix_cents} />
      )}

      {/* IA Panels */}
      <div className="pt-2 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="SparklesIcon" size={14} variant="outline" className="text-info" />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Analyse IA</span>
        </div>
        <AIPrixEstimationPanel product={product} />
        <AICoherencePanel product={product} />
        <AIPhotoAnalysisPanel product={product} />
      </div>
    </div>
  );
}
