'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SessionParams {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  season: string;
  activity: string;
  level: string;
  maxWeightG: number;
  budgetEur: number;
  bodyWeightKg?: number;
  climate?: string;
}

interface SelectedItem {
  id: string;
  name: string;
  brand: string;
  slug: string;
  category: string;
  weight_g: number;
  price_eur: number;
  description: string;
  image: string;
  image_alt: string;
  justification?: string;
  sourceable?: boolean;
}

interface Alternative {
  name: string;
  brand: string;
  price_eur: number;
  reason: string;
}

interface Consumable {
  name: string;
  category: string;
  reason: string;
  estimated_price_eur: number;
}

interface BringYourself {
  item: string;
  guide: string;
  affiliate_hint: string;
}

interface DestinationContext {
  weather_summary: string;
  security_level: string;
  security_notes: string;
  country_page_code: string;
}

interface KitReport {
  reportId: string | null;
  sessionParams: SessionParams;
  selectedItems: SelectedItem[];
  alternatives: Record<string, { eco: Alternative; premium: Alternative }>;
  consumables: Consumable[];
  bring_yourself: BringYourself[];
  weightBreakdown: Record<string, number>;
  totalWeightG: number;
  totalPriceEur: number;
  carbonKgEstimate: number | null;
  destinationContext: DestinationContext | null;
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const SECURITY_COLORS: Record<string, string> = {
  faible: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  modéré: 'text-amber-600 bg-amber-50 border-amber-200',
  élevé: 'text-red-600 bg-red-50 border-red-200',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Sac': '🎒',
  'Abri': '⛺',
  'Couchage': '🛏️',
  'Vêtement': '🧥',
  'Chaussure': '👟',
  'Cuisine': '🍳',
  'Eau': '💧',
  'Navigation': '🧭',
  'Sécurité': '🛡️',
  'Électronique': '🔋',
  'Autre': '📦',
};

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g} g`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getDaysUntilDeparture(startDate: string): number {
  if (!startDate) return 0;
  const now = new Date();
  const dep = new Date(startDate);
  return Math.ceil((dep.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Section: En-tête ──────────────────────────────────────────────────────────
function ReportHeader({ report }: { report: KitReport }) {
  const { sessionParams, generatedAt } = report;
  const daysUntil = getDaysUntilDeparture(sessionParams.startDate);

  return (
    <div className="bg-[#1C2620] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" aria-hidden="true">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="topo-report" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M0,40 C20,20 60,60 80,40" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo-report)" />
        </svg>
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-[#17402C] animate-pulse" />
          <span className="text-[10px] font-mono text-[#17402C] uppercase tracking-widest">
            RAPPORT KIT PERSONNALISÉ
          </span>
        </div>
        <h1 className="font-display font-700 text-white text-2xl sm:text-3xl mb-2">
          {sessionParams.destination}
        </h1>
        <p className="text-white/50 text-sm mb-6">
          {sessionParams.country} · {sessionParams.activity} · {sessionParams.season}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'DÉPART', val: formatDate(sessionParams.startDate) },
            { label: 'RETOUR', val: formatDate(sessionParams.endDate) },
            { label: 'NIVEAU', val: sessionParams.level },
            { label: 'BUDGET', val: `${sessionParams.budgetEur} €` },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3">
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm font-600 text-white">{val}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/40">
          <span>Généré le {formatDate(generatedAt)}</span>
          {daysUntil > 0 && (
            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${daysUntil > 30 ? 'border-white/10 text-white/40' : 'border-amber-500/40 text-amber-400'}`}>
              {daysUntil > 30
                ? `Départ dans ${daysUntil} jours`
                : `⚠️ Départ dans ${daysUntil} jours — relancer si les prix ont changé`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section: Gabarit de poids ─────────────────────────────────────────────────
function WeightSection({ report }: { report: KitReport }) {
  const { totalWeightG, weightBreakdown, sessionParams } = report;
  const totalKg = totalWeightG / 1000;
  const bodyRatio = sessionParams.bodyWeightKg
    ? ((totalKg / sessionParams.bodyWeightKg) * 100).toFixed(1)
    : null;
  const isHeavy = totalWeightG > (sessionParams.maxWeightG * 1.1);

  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
          <Icon name="ScaleIcon" size={16} variant="outline" className="text-white" />
        </div>
        <h2 className="font-display font-700 text-[#1C2620] text-lg">Gabarit de poids</h2>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <div>
          <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1">POIDS TOTAL</p>
          <p className="font-mono font-700 text-3xl text-[#1C2620]">{totalKg.toFixed(2)} kg</p>
          {bodyRatio && (
            <p className="text-xs text-[#5C6B5E] mt-1">
              {bodyRatio}% du poids corporel ({sessionParams.bodyWeightKg} kg)
            </p>
          )}
        </div>
        {isHeavy && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Icon name="ExclamationTriangleIcon" size={16} variant="outline" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Poids supérieur à votre objectif de {formatWeight(sessionParams.maxWeightG)}. Envisagez de retirer des articles non essentiels.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {Object.entries(weightBreakdown)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, g]) => {
            const pct = totalWeightG > 0 ? (g / totalWeightG) * 100 : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[#1C2620] flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[cat] ?? '📦'}</span>
                    {cat}
                  </span>
                  <span className="font-mono text-xs text-[#5C6B5E]">{formatWeight(g)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#17402C]"
                    style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── Section: Détail budgétaire ────────────────────────────────────────────────
function BudgetSection({ report }: { report: KitReport }) {
  const { selectedItems, totalPriceEur, sessionParams } = report;

  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
          <Icon name="BanknotesIcon" size={16} variant="outline" className="text-white" />
        </div>
        <h2 className="font-display font-700 text-[#1C2620] text-lg">Détail budgétaire</h2>
      </div>

      <div className="flex items-center gap-6 mb-5">
        <div>
          <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1">TOTAL</p>
          <p className="font-mono font-700 text-3xl text-[#1C2620]">{totalPriceEur.toFixed(2)} €</p>
          <p className="text-xs text-[#5C6B5E] mt-1">
            Prix cumulé des articles achetés séparément — aucune remise fictive
          </p>
        </div>
        {totalPriceEur > sessionParams.budgetEur && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Icon name="ExclamationTriangleIcon" size={16} variant="outline" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Dépasse votre budget de {(totalPriceEur - sessionParams.budgetEur).toFixed(2)} €. Utilisez les alternatives économiques ci-dessous.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {selectedItems.map(item => (
          <div key={item.id} className="flex items-center justify-between py-2 border-b border-[#C8C3B0]/40 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm">{CATEGORY_ICONS[item.category] ?? '📦'}</span>
              <div className="min-w-0">
                <p className="text-sm text-[#1C2620] truncate">{item.name}</p>
                <p className="text-xs text-[#5C6B5E]">{item.brand} · {item.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0 ml-3">
              <span className="font-mono text-xs text-[#5C6B5E]">{formatWeight(item.weight_g)}</span>
              <span className="font-mono font-600 text-sm text-[#1C2620]">{Number(item.price_eur).toFixed(2)} €</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Liste produits ───────────────────────────────────────────────────
function ProductsSection({
  report,
  removedIds,
  onRemove,
}: {
  report: KitReport;
  removedIds: Set<string>;
  onRemove: (id: string) => void;
}) {
  const { selectedItems, alternatives } = report;
  const [expandedAlt, setExpandedAlt] = useState<string | null>(null);

  const activeItems = selectedItems.filter(i => !removedIds.has(i.id));

  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
            <Icon name="ListBulletIcon" size={16} variant="outline" className="text-white" />
          </div>
          <h2 className="font-display font-700 text-[#1C2620] text-lg">
            Articles sélectionnés
          </h2>
        </div>
        <span className="text-xs font-mono text-[#5C6B5E]">{activeItems.length} articles</span>
      </div>

      <div className="space-y-4">
        {activeItems.map(item => {
          const alt = alternatives[item.id];
          const isExpanded = expandedAlt === item.id;

          return (
            <div key={item.id} className="bg-white/60 border border-[#C8C3B0]/60 rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E7E3D6] flex items-center justify-center flex-shrink-0 text-lg">
                    {CATEGORY_ICONS[item.category] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/produit/${item.slug || item.id}`}
                          className="font-600 text-sm text-[#1C2620] hover:text-[#17402C] transition-colors"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-[#5C6B5E]">{item.brand} · {item.category}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono text-xs text-[#5C6B5E]">{formatWeight(item.weight_g)}</span>
                        <span className="font-mono font-700 text-sm text-[#17402C]">{Number(item.price_eur).toFixed(2)} €</span>
                        <button
                          onClick={() => onRemove(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#5C6B5E] hover:text-red-500 transition-colors"
                          title="Retirer cet article"
                        >
                          <Icon name="XMarkIcon" size={14} variant="outline" />
                        </button>
                      </div>
                    </div>
                    {item.justification && (
                      <p className="mt-2 text-xs text-[#5C6B5E] leading-relaxed italic border-l-2 border-[#17402C]/30 pl-2">
                        {item.justification}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {alt && (
                <div className="border-t border-[#C8C3B0]/40">
                  <button
                    onClick={() => setExpandedAlt(isExpanded ? null : item.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#5C6B5E] hover:bg-[#E7E3D6] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon name="ArrowsRightLeftIcon" size={12} variant="outline" />
                      Voir les alternatives
                    </span>
                    <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} variant="outline" />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {alt.eco && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          <p className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest mb-1">Option économique</p>
                          <p className="text-sm font-600 text-[#1C2620]">{alt.eco.name}</p>
                          <p className="text-xs text-[#5C6B5E]">{alt.eco.brand}</p>
                          <p className="font-mono font-700 text-emerald-700 text-sm mt-1">{alt.eco.price_eur} €</p>
                          <p className="text-xs text-[#5C6B5E] mt-1 leading-relaxed">{alt.eco.reason}</p>
                        </div>
                      )}
                      {alt.premium && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-[9px] font-mono text-amber-600 uppercase tracking-widest mb-1">Option premium</p>
                          <p className="text-sm font-600 text-[#1C2620]">{alt.premium.name}</p>
                          <p className="text-xs text-[#5C6B5E]">{alt.premium.brand}</p>
                          <p className="font-mono font-700 text-amber-700 text-sm mt-1">{alt.premium.price_eur} €</p>
                          <p className="text-xs text-[#5C6B5E] mt-1 leading-relaxed">{alt.premium.reason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {removedIds.size > 0 && (
          <p className="text-xs text-[#5C6B5E] text-center py-2">
            {removedIds.size} article{removedIds.size > 1 ? 's' : ''} retiré{removedIds.size > 1 ? 's' : ''} — non inclus dans le total
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section: Consommables ─────────────────────────────────────────────────────
function ConsumablesSection({ consumables }: { consumables: Consumable[] }) {
  if (!consumables.length) return null;
  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
          <Icon name="BeakerIcon" size={16} variant="outline" className="text-white" />
        </div>
        <div>
          <h2 className="font-display font-700 text-[#1C2620] text-lg">Consommables recommandés</h2>
          <p className="text-xs text-[#5C6B5E]">Séparés du matériel durable — à prévoir avant le départ</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {consumables.map((c, i) => (
          <div key={i} className="flex items-start gap-3 bg-white/60 border border-[#C8C3B0]/60 rounded-xl p-3">
            <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[c.category] ?? '🧴'}</span>
            <div>
              <p className="text-sm font-600 text-[#1C2620]">{c.name}</p>
              <p className="text-xs text-[#5C6B5E] mt-0.5">{c.reason}</p>
              {c.estimated_price_eur > 0 && (
                <p className="font-mono text-xs text-[#17402C] mt-1">~{c.estimated_price_eur} €</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: À apporter soi-même ──────────────────────────────────────────────
function BringYourselfSection({ items }: { items: BringYourself[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
          <Icon name="UserIcon" size={16} variant="outline" className="text-white" />
        </div>
        <div>
          <h2 className="font-display font-700 text-[#1C2620] text-lg">À apporter soi-même</h2>
          <p className="text-xs text-[#5C6B5E]">Articles à taille ou personnels — jamais inclus dans le stock proposé</p>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((b, i) => (
          <div key={i} className="flex items-start gap-3 bg-white/60 border border-[#C8C3B0]/60 rounded-xl p-4">
            <Icon name="CheckCircleIcon" size={18} variant="outline" className="text-[#5C6B5E] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-600 text-[#1C2620]">{b.item}</p>
              <p className="text-xs text-[#5C6B5E] mt-0.5 leading-relaxed">{b.guide}</p>
              {b.affiliate_hint && (
                <p className="text-xs text-[#17402C] mt-1">{b.affiliate_hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Contexte destination ─────────────────────────────────────────────
function DestinationSection({ ctx, country }: { ctx: DestinationContext; country: string }) {
  const secColor = SECURITY_COLORS[ctx.security_level] ?? SECURITY_COLORS['modéré'];
  const countryCode = ctx.country_page_code || country.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
            <Icon name="GlobeAltIcon" size={16} variant="outline" className="text-white" />
          </div>
          <h2 className="font-display font-700 text-[#1C2620] text-lg">Contexte destination</h2>
        </div>
        <Link
          href={`/pays/${countryCode}`}
          className="flex items-center gap-1.5 text-xs text-[#17402C] hover:underline"
        >
          Fiche pays complète
          <Icon name="ArrowTopRightOnSquareIcon" size={12} variant="outline" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/60 border border-[#C8C3B0]/60 rounded-xl p-4">
          <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-2">Météo prévue</p>
          <p className="text-sm text-[#1C2620] leading-relaxed">{ctx.weather_summary}</p>
        </div>
        <div className="bg-white/60 border border-[#C8C3B0]/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest">Niveau de sécurité</p>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${secColor}`}>
              {ctx.security_level}
            </span>
          </div>
          <p className="text-sm text-[#1C2620] leading-relaxed">{ctx.security_notes}</p>
        </div>
      </div>
    </div>
  );
}

// ── Section: Empreinte carbone ────────────────────────────────────────────────
function CarbonSection({ carbonKg }: { carbonKg: number }) {
  return (
    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#1C2620] flex items-center justify-center">
          <Icon name="CloudIcon" size={16} variant="outline" className="text-white" />
        </div>
        <div>
          <h2 className="font-display font-700 text-[#1C2620] text-lg">Empreinte carbone estimée</h2>
          <p className="text-xs text-[#5C6B5E]">Estimation — données indicatives, non certifiées</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <p className="font-mono font-700 text-2xl text-emerald-700">{carbonKg.toFixed(1)} kg CO₂</p>
          <p className="text-xs text-emerald-600 mt-1">équivalent estimé pour ce kit</p>
        </div>
        <p className="text-xs text-[#5C6B5E] leading-relaxed flex-1">
          Basé sur le poids total du matériel et les moyennes sectorielles. Cette estimation est fournie à titre indicatif uniquement.
        </p>
      </div>
    </div>
  );
}

// ── Section: Validité ─────────────────────────────────────────────────────────
function ValidityBanner({ generatedAt, startDate }: { generatedAt: string; startDate: string }) {
  const daysUntil = getDaysUntilDeparture(startDate);
  const isStale = daysUntil > 30;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${isStale ? 'bg-amber-50 border-amber-200' : 'bg-[#E7E3D6] border-[#C8C3B0]'}`}>
      <Icon name="ClockIcon" size={16} variant="outline" className={isStale ? 'text-amber-600 flex-shrink-0 mt-0.5' : 'text-[#5C6B5E] flex-shrink-0 mt-0.5'} />
      <p className={`text-xs leading-relaxed ${isStale ? 'text-amber-700' : 'text-[#5C6B5E]'}`}>
        <strong>Généré le {formatDate(generatedAt)}</strong> — les prix et disponibilités peuvent varier.
        {isStale && ` Votre départ est dans ${daysUntil} jours — `}
        {isStale && <Link href="/ai-configurator" className="underline font-medium">relancer le configurateur pour une mise à jour</Link>}
        {!isStale && ' Rapport à jour pour votre départ imminent.'}
      </p>
    </div>
  );
}

// ── Actions bar ───────────────────────────────────────────────────────────────
function ActionsBar({
  report,
  removedIds,
  onSave,
  onExport,
  onPurchase,
  saving,
  purchasing,
  saved,
  purchased,
}: {
  report: KitReport;
  removedIds: Set<string>;
  onSave: () => void;
  onExport: () => void;
  onPurchase: () => void;
  saving: boolean;
  purchasing: boolean;
  saved: boolean;
  purchased: boolean;
}) {
  const activeItems = report.selectedItems.filter(i => !removedIds.has(i.id));
  const totalEur = activeItems.reduce((s, i) => s + Number(i.price_eur), 0);

  return (
    <div className="sticky bottom-0 z-30 bg-[#EDEAE0]/95 backdrop-blur-sm border-t border-[#C8C3B0] px-4 py-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-4 flex-1">
          <div>
            <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest">Total actif</p>
            <p className="font-mono font-700 text-[#1C2620] text-lg">{totalEur.toFixed(2)} €</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest">Articles</p>
            <p className="font-mono font-700 text-[#1C2620] text-lg">{activeItems.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#C8C3B0] text-sm text-[#5C6B5E] hover:text-[#1C2620] hover:bg-[#E7E3D6] transition-all"
          >
            <Icon name="ArrowDownTrayIcon" size={14} variant="outline" />
            Exporter
          </button>
          {report.reportId && !saved && (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#C8C3B0] text-sm text-[#5C6B5E] hover:text-[#1C2620] hover:bg-[#E7E3D6] transition-all disabled:opacity-50"
            >
              <Icon name="BookmarkIcon" size={14} variant="outline" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <Icon name="CheckIcon" size={14} variant="outline" />
              Sauvegardé
            </span>
          )}
          {!purchased ? (
            <button
              onClick={onPurchase}
              disabled={purchasing || activeItems.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#17402C] text-white text-sm font-600 hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Icon name="ShoppingBagIcon" size={14} variant="outline" />
              {purchasing ? 'Traitement...' : `Acheter le kit — ${totalEur.toFixed(2)} €`}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-600">
              <Icon name="CheckCircleIcon" size={14} variant="outline" />
              Ajouté à l&apos;inventaire
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Configurator Form (inline, si pas de rapport) ─────────────────────────────
function ConfiguratorForm({ onGenerate }: { onGenerate: (params: SessionParams, items: { id: string; name: string; brand: string; slug: string; category: string; weight_g: number; price_eur: number; description: string; image: string; image_alt: string }[]) => void }) {
  const supabase = createClient();
  const [params, setParams] = useState<SessionParams>({
    destination: '',
    country: '',
    startDate: '',
    endDate: '',
    season: 'ete',
    activity: 'Randonnée',
    level: 'intermediaire',
    maxWeightG: 10000,
    budgetEur: 500,
    bodyWeightKg: undefined,
    climate: '',
  });
  const [products, setProducts] = useState<{ id: string; name: string; brand: string; slug: string; category: string; weight_g: number; price_eur: number; description: string; image: string; image_alt: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(1);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await supabase
      .from('products')
      .select('id, slug, name, brand, category, weight_g, price_eur, description, image, image_alt, stock')
      .gt('stock', 0)
      .order('category');
    setProducts(data ?? []);
    setSelected(new Set((data ?? []).slice(0, 8).map((p: { id: string }) => p.id)));
    setLoadingProducts(false);
  }, [supabase]);

  useEffect(() => {
    if (step === 2) loadProducts();
  }, [step, loadProducts]);

  const handleGenerate = async () => {
    setGenerating(true);
    const selectedItems = products.filter(p => selected.has(p.id));
    onGenerate(params, selectedItems);
  };

  const set = (k: keyof SessionParams, v: string | number | undefined) =>
    setParams(prev => ({ ...prev, [k]: v }));

  const SEASONS = [
    { id: 'printemps', label: 'Printemps', icon: '🌸' },
    { id: 'ete', label: 'Été', icon: '☀️' },
    { id: 'automne', label: 'Automne', icon: '🍂' },
    { id: 'hiver', label: 'Hiver', icon: '❄️' },
  ];
  const ACTIVITIES = ['Randonnée', 'Alpinisme', 'Camping', 'Trekking', 'Vanlife', 'Photo nature'];
  const LEVELS = [
    { id: 'debutant', label: 'Débutant' },
    { id: 'intermediaire', label: 'Intermédiaire' },
    { id: 'confirme', label: 'Confirmé' },
    { id: 'expert', label: 'Expert' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {step === 1 && (
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6 space-y-5">
          <h2 className="font-display font-700 text-[#1C2620] text-xl">Paramètres du voyage</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Destination *</label>
              <input
                type="text"
                value={params.destination}
                onChange={e => set('destination', e.target.value)}
                placeholder="Ex: Islande, GR20, Patagonie…"
                className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Pays</label>
              <input
                type="text"
                value={params.country}
                onChange={e => set('country', e.target.value)}
                placeholder="Ex: France, Népal…"
                className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Date de départ</label>
              <input type="date" value={params.startDate} onChange={e => set('startDate', e.target.value)} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]" />
            </div>
            <div>
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Date de retour</label>
              <input type="date" value={params.endDate} onChange={e => set('endDate', e.target.value)} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]" />
            </div>
          </div>

          <div>
            <p className="text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-2">Saison</p>
            <div className="grid grid-cols-4 gap-2">
              {SEASONS.map(s => (
                <button key={s.id} onClick={() => set('season', s.id)} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${params.season === s.id ? 'border-[#17402C] bg-[#17402C]/5' : 'border-[#C8C3B0] hover:border-[#5C6B5E]'}`}>
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-xs font-600 text-[#1C2620]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-2">Activité</p>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map(a => (
                <button key={a} onClick={() => set('activity', a)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${params.activity === a ? 'bg-[#17402C] border-[#17402C] text-white' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#5C6B5E]'}`}>{a}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-2">Niveau</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LEVELS.map(l => (
                <button key={l.id} onClick={() => set('level', l.id)} className={`py-2.5 rounded-xl border-2 text-xs font-600 transition-all ${params.level === l.id ? 'border-[#17402C] bg-[#17402C]/5 text-[#17402C]' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#5C6B5E]'}`}>{l.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Budget max (€)</label>
              <input type="number" min={0} value={params.budgetEur} onChange={e => set('budgetEur', Number(e.target.value))} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]" />
            </div>
            <div>
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Poids max (kg)</label>
              <input type="number" min={1} value={params.maxWeightG / 1000} onChange={e => set('maxWeightG', Number(e.target.value) * 1000)} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]" />
            </div>
            <div>
              <label className="block text-xs font-600 text-[#5C6B5E] uppercase tracking-wider mb-1.5">Poids corporel (kg)</label>
              <input type="number" min={0} value={params.bodyWeightKg ?? ''} onChange={e => set('bodyWeightKg', e.target.value ? Number(e.target.value) : undefined)} placeholder="Optionnel" className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#17402C]" />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!params.destination.trim()}
            className="w-full py-3 rounded-xl bg-[#17402C] text-white font-600 text-sm hover:opacity-90 transition-all disabled:opacity-40"
          >
            Choisir les articles →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-700 text-[#1C2620] text-xl">Articles du catalogue</h2>
            <button onClick={() => setStep(1)} className="text-xs text-[#5C6B5E] hover:text-[#1C2620]">← Retour</button>
          </div>
          <p className="text-xs text-[#5C6B5E]">Sélectionnez les articles à inclure dans votre rapport. Seuls les articles en stock sont affichés.</p>

          {loadingProducts ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-[#C8C3B0]/30 rounded-xl animate-pulse" />)}</div>
          ) : products.length === 0 ? (
            <p className="text-sm text-[#5C6B5E] text-center py-8">Aucun article disponible dans le catalogue.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {products.map(p => (
                <div
                  key={p.id}
                  onClick={() => setSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                    return next;
                  })}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selected.has(p.id) ? 'border-[#17402C] bg-[#17402C]/5' : 'border-[#C8C3B0] hover:border-[#5C6B5E]'}`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${selected.has(p.id) ? 'bg-[#17402C] border-[#17402C]' : 'border-[#C8C3B0]'}`}>
                    {selected.has(p.id) && <Icon name="CheckIcon" size={10} variant="outline" className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-600 text-[#1C2620] truncate">{p.name}</p>
                    <p className="text-xs text-[#5C6B5E]">{p.brand} · {p.category}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-xs text-[#5C6B5E]">{formatWeight(p.weight_g)}</span>
                    <span className="font-mono font-700 text-sm text-[#17402C]">{Number(p.price_eur).toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || selected.size === 0}
            className="w-full py-3 rounded-xl bg-[#17402C] text-white font-600 text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Génération du rapport IA…
              </>
            ) : (
              <>
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Générer le rapport ({selected.size} articles)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KitReportPage() {
  const router = useRouter();
  const { user: _user } = useAuth();
  const [report, setReport] = useState<KitReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async (
    params: SessionParams,
    items: { id: string; name: string; brand: string; slug: string; category: string; weight_g: number; price_eur: number; description: string; image: string; image_alt: string }[]
  ) => {
    setGenerating(true);
    setError(null);
    setRemovedIds(new Set());
    setSaved(false);
    setPurchased(false);

    try {
      const res = await fetch('/api/kit-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionParams: params, selectedItems: items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur de génération');
      setReport(data);
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!report?.reportId) return;
    setSaving(true);
    try {
      await fetch('/api/kit-report/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.reportId }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!report) return;
    const activeItems = report.selectedItems.filter(i => !removedIds.has(i.id));
    const lines = [
      `RAPPORT KIT PERSONNALISÉ — ${report.sessionParams.destination}`,
      `Généré le ${formatDate(report.generatedAt)}`,
      '',
      `Destination : ${report.sessionParams.destination} (${report.sessionParams.country})`,
      `Dates : ${formatDate(report.sessionParams.startDate)} → ${formatDate(report.sessionParams.endDate)}`,
      `Activité : ${report.sessionParams.activity} | Niveau : ${report.sessionParams.level}`,
      `Budget : ${report.sessionParams.budgetEur} € | Poids max : ${(report.sessionParams.maxWeightG / 1000).toFixed(1)} kg`,
      '',
      '── ARTICLES ──',
      ...activeItems.map(i => `• ${i.name} (${i.brand}) — ${formatWeight(i.weight_g)} — ${Number(i.price_eur).toFixed(2)} €`),
      '',
      `TOTAL : ${activeItems.reduce((s, i) => s + Number(i.price_eur), 0).toFixed(2)} € | ${formatWeight(activeItems.reduce((s, i) => s + i.weight_g, 0))}`,
      '',
      '── CONSOMMABLES ──',
      ...(report.consumables ?? []).map(c => `• ${c.name} — ${c.reason}`),
      '',
      '── À APPORTER SOI-MÊME ──',
      ...(report.bring_yourself ?? []).map(b => `• ${b.item} — ${b.guide}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kit-${report.sessionParams.destination.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurchase = async () => {
    if (!report?.reportId) {
      // No saved report — redirect to cart with items
      router.push('/panier');
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch('/api/kit-report/convert-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.reportId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPurchased(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <>
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
      <div className="pt-16 lg:pt-18">
        {/* Hero */}
        <div className="bg-[#1C2620] py-10 sm:py-14 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none" aria-hidden="true">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="topo-hero" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                  <path d="M0,40 C20,20 60,60 80,40" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
                  <path d="M0,60 C20,40 60,80 80,60" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#topo-hero)" />
            </svg>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="flex items-center gap-2 justify-center mb-4">
              <span className="w-2 h-2 rounded-full bg-[#17402C] animate-pulse" />
              <span className="text-[10px] font-mono text-[#17402C] uppercase tracking-widest">RAPPORT KIT IA</span>
            </div>
            <h1 className="font-display font-700 text-white text-2xl sm:text-3xl mb-3">
              Rapport de kit personnalisé
            </h1>
            <p className="text-white/60 text-sm max-w-lg mx-auto">
              Généré à la volée depuis votre session configurateur. Chaque article est justifié pour votre voyage précis.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Generating loader */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="w-12 h-12 border-4 border-[#C8C3B0] border-t-[#17402C] rounded-full animate-spin" />
              <div className="text-center">
                <p className="font-display font-700 text-[#1C2620] text-lg">Génération du rapport IA…</p>
                <p className="text-sm text-[#5C6B5E] mt-1">Analyse du profil, justifications, alternatives…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !generating && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3 mb-6">
              <Icon name="ExclamationCircleIcon" size={16} variant="outline" className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          {!report && !generating && (
            <ConfiguratorForm onGenerate={handleGenerate} />
          )}

          {/* Report */}
          {report && !generating && (
            <div ref={reportRef} className="space-y-6 pb-32">
              <ReportHeader report={report} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WeightSection report={report} />
                <BudgetSection report={report} />
              </div>

              <ProductsSection
                report={report}
                removedIds={removedIds}
                onRemove={id => setRemovedIds(prev => new Set([...prev, id]))}
              />

              {report.consumables?.length > 0 && (
                <ConsumablesSection consumables={report.consumables} />
              )}

              {report.bring_yourself?.length > 0 && (
                <BringYourselfSection items={report.bring_yourself} />
              )}

              {report.destinationContext && (
                <DestinationSection
                  ctx={report.destinationContext}
                  country={report.sessionParams.country}
                />
              )}

              {report.carbonKgEstimate != null && report.carbonKgEstimate > 0 && (
                <CarbonSection carbonKg={report.carbonKgEstimate} />
              )}

              <ValidityBanner
                generatedAt={report.generatedAt}
                startDate={report.sessionParams.startDate}
              />

              {purchased && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-start gap-3">
                  <Icon name="CheckCircleIcon" size={18} variant="outline" className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-600 text-emerald-800">Kit ajouté à votre inventaire personnel</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Retrouvez tous vos articles dans{' '}
                      <Link href="/mon-materiel" className="underline font-medium">Mon Inventaire</Link>
                      {' '}ou dans{' '}
                      <Link href="/compte" className="underline font-medium">Mon Compte</Link>.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <button
                  onClick={() => { setReport(null); setRemovedIds(new Set()); setSaved(false); setPurchased(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#C8C3B0] text-sm text-[#5C6B5E] hover:text-[#1C2620] hover:bg-[#E7E3D6] transition-all"
                >
                  <Icon name="ArrowPathIcon" size={14} variant="outline" />
                  Nouveau rapport
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {report && !generating && (
        <ActionsBar
          report={report}
          removedIds={removedIds}
          onSave={handleSave}
          onExport={handleExport}
          onPurchase={handlePurchase}
          saving={saving}
          purchasing={purchasing}
          saved={saved}
          purchased={purchased}
        />
      )}

        <Footer />
      </main>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {/* Mobile content */}
          {!report && !generating && (
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
                RAPPORT KIT IA
              </p>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0B1F17', margin: '0 0 4px 0' }}>
                Rapport de kit personnalis&eacute;
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7A72', margin: '0', lineHeight: 1.4 }}>
                G&eacute;n&eacute;r&eacute; depuis votre session configurateur.
              </p>
            </div>
          )}

          {/* Generating loader */}
          {generating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', gap: '16px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid rgba(11,31,23,0.06)', borderTopColor: '#17402C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#0B1F17', margin: '0 0 4px 0' }}>G&eacute;n&eacute;ration du rapport IA&hellip;</p>
                <p style={{ fontSize: '12px', color: '#6B7A72', margin: 0 }}>Analyse du profil, justifications, alternatives&hellip;</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !generating && (
            <div style={{ margin: '16px', padding: '12px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#EF4444', fontSize: '14px', flexShrink: 0 }}>!</span>
              <p style={{ fontSize: '13px', color: '#991B1B', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Report visible */}
          {report && !generating && (
            <>
              {/* Report Header */}
              <div style={{ margin: '16px', padding: '20px', background: '#0B1F17', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                    RAPPORT KIT PERSONNALIS&Eacute;
                  </p>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>
                    {report.sessionParams.destination}
                  </h2>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px 0' }}>
                    {report.sessionParams.country} &middot; {report.sessionParams.activity} &middot; {report.sessionParams.season}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                      <p style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px 0' }}>D&Eacute;PART</p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0 }}>{formatDate(report.sessionParams.startDate)}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                      <p style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px 0' }}>RETOUR</p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0 }}>{formatDate(report.sessionParams.endDate)}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                      <p style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px 0' }}>NIVEAU</p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0 }}>{report.sessionParams.level}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                      <p style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 2px 0' }}>BUDGET</p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0 }}>{report.sessionParams.budgetEur} &euro;</p>
                    </div>
                  </div>

                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', margin: '12px 0 0 0' }}>
                    G&eacute;n&eacute;r&eacute; le {formatDate(report.generatedAt)}
                  </p>
                </div>
              </div>

              {/* Weight Summary */}
              <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#fff' }}>
                    &#9878;
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#0B1F17', margin: 0 }}>Gabarit de poids</p>
                </div>
                <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>POIDS TOTAL</p>
                <p style={{ fontSize: '28px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0B1F17', margin: '0 0 12px 0' }}>
                  {(report.totalWeightG / 1000).toFixed(2)} <span style={{ fontSize: '14px', fontWeight: 400, color: '#6B7A72' }}>kg</span>
                </p>

                {/* Weight breakdown bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(report.weightBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([cat, g]) => {
                      const pct = report.totalWeightG > 0 ? (g / report.totalWeightG) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '12px', color: '#0B1F17', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{CATEGORY_ICONS[cat] ?? '📦'}</span>
                              {cat}
                            </span>
                            <span style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72' }}>
                              {formatWeight(g)} &middot; {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div style={{ background: 'rgba(11,31,23,0.06)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, background: '#17402C', height: '100%', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                </div>

                {report.totalWeightG > report.sessionParams.maxWeightG * 1.1 && (
                  <div style={{ marginTop: '12px', padding: '10px', background: '#FEF3C7', borderRadius: '10px', border: '1px solid #FDE68A', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '12px', color: '#D97706', flexShrink: 0 }}>&#9888;</span>
                    <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>
                      Poids sup&eacute;rieur &agrave; votre objectif de {formatWeight(report.sessionParams.maxWeightG)}.
                    </p>
                  </div>
                )}
              </div>

              {/* Budget Summary */}
              <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#fff' }}>
                    &#36;
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#0B1F17', margin: 0 }}>D&eacute;tail budg&eacute;taire</p>
                </div>
                <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>TOTAL</p>
                <p style={{ fontSize: '24px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0B1F17', margin: '0 0 8px 0' }}>
                  {report.totalPriceEur.toFixed(2)} <span style={{ fontSize: '13px', fontWeight: 400, color: '#6B7A72' }}>&euro;</span>
                </p>

                {/* Items list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {report.selectedItems.filter(i => !removedIds.has(i.id)).slice(0, 8).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(11,31,23,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '14px', flexShrink: 0 }}>{CATEGORY_ICONS[item.category] ?? '📦'}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 500, color: '#0B1F17', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </p>
                          <p style={{ fontSize: '10px', color: '#6B7A72', margin: '1px 0 0 0' }}>{item.brand}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', margin: 0 }}>{formatWeight(item.weight_g)}</p>
                        <p style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#17402C', margin: '1px 0 0 0' }}>
                          {Number(item.price_eur).toFixed(2)} &euro;
                        </p>
                      </div>
                    </div>
                  ))}
                  {report.selectedItems.filter(i => !removedIds.has(i.id)).length > 8 && (
                    <p style={{ fontSize: '11px', color: '#6B7A72', textAlign: 'center', margin: '4px 0 0 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                      +{report.selectedItems.filter(i => !removedIds.has(i.id)).length - 8} article(s) suppl&eacute;mentaire(s)
                    </p>
                  )}
                </div>

                {report.totalPriceEur > report.sessionParams.budgetEur && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#FEF3C7', borderRadius: '10px', border: '1px solid #FDE68A', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '12px', color: '#D97706', flexShrink: 0 }}>&#9888;</span>
                    <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>
                      D&eacute;passe votre budget de {(report.totalPriceEur - report.sessionParams.budgetEur).toFixed(2)} &euro;.
                    </p>
                  </div>
                )}
              </div>

              {/* Consumables */}
              {report.consumables?.length > 0 && (
                <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B1F17', margin: '0 0 10px 0' }}>Consommables recommand&eacute;s</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {report.consumables.slice(0, 4).map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', background: '#FBFAF6', borderRadius: '10px' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{CATEGORY_ICONS[c.category] ?? '🧴'}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#0B1F17', margin: 0 }}>{c.name}</p>
                          <p style={{ fontSize: '11px', color: '#6B7A72', margin: '2px 0 0 0' }}>{c.reason}</p>
                          {c.estimated_price_eur > 0 && (
                            <p style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#17402C', margin: '4px 0 0 0' }}>~{c.estimated_price_eur} &euro;</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {report.consumables.length > 4 && (
                      <p style={{ fontSize: '10px', color: '#6B7A72', textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', margin: 0 }}>
                        +{report.consumables.length - 4} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Bring Yourself */}
              {report.bring_yourself?.length > 0 && (
                <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B1F17', margin: '0 0 10px 0' }}>&Agrave; apporter soi-m&ecirc;me</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {report.bring_yourself.slice(0, 4).map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', background: '#FBFAF6', borderRadius: '10px' }}>
                        <span style={{ fontSize: '14px', color: '#17402C', flexShrink: 0, marginTop: '1px' }}>&#10003;</span>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#0B1F17', margin: 0 }}>{b.item}</p>
                          <p style={{ fontSize: '11px', color: '#6B7A72', margin: '2px 0 0 0', lineHeight: 1.4 }}>{b.guide}</p>
                        </div>
                      </div>
                    ))}
                    {report.bring_yourself.length > 4 && (
                      <p style={{ fontSize: '10px', color: '#6B7A72', textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', margin: 0 }}>
                        +{report.bring_yourself.length - 4} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Destination Context */}
              {report.destinationContext && (
                <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B1F17', margin: '0 0 10px 0' }}>Contexte destination</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ padding: '10px', background: '#FBFAF6', borderRadius: '10px' }}>
                      <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>M&Eacute;T&Eacute;O PR&Eacute;VUE</p>
                      <p style={{ fontSize: '12px', color: '#0B1F17', margin: 0, lineHeight: 1.4 }}>{report.destinationContext.weather_summary}</p>
                    </div>
                    <div style={{ padding: '10px', background: '#FBFAF6', borderRadius: '10px' }}>
                      <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
                        S&Eacute;CURIT&Eacute; : <span style={{ color: report.destinationContext.security_level === 'faible' ? '#059669' : report.destinationContext.security_level === 'élevé' ? '#DC2626' : '#D97706' }}>
                          {report.destinationContext.security_level}
                        </span>
                      </p>
                      <p style={{ fontSize: '12px', color: '#0B1F17', margin: 0, lineHeight: 1.4 }}>{report.destinationContext.security_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Carbon Estimate */}
              {report.carbonKgEstimate != null && report.carbonKgEstimate > 0 && (
                <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B1F17', margin: '0 0 8px 0' }}>Empreinte carbone</p>
                  <p style={{ fontSize: '22px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#059669', margin: 0 }}>
                    {report.carbonKgEstimate.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B7A72' }}>kg CO&#8322;</span>
                  </p>
                </div>
              )}

              {/* Purchase confirmation */}
              {purchased && (
                <div style={{ margin: '0 16px 16px', padding: '14px', background: '#ECFDF5', borderRadius: '12px', border: '1px solid #A7F3D0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px', color: '#059669', flexShrink: 0 }}>&#10003;</span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#065F46', margin: '0 0 2px 0' }}>Kit ajout&eacute; &agrave; votre inventaire</p>
                    <p style={{ fontSize: '11px', color: '#047857', margin: 0 }}>
                      Retrouvez tous vos articles dans <Link href="/mon-materiel" style={{ textDecoration: 'underline', fontWeight: 500, color: '#065F46' }}>Mon Inventaire</Link>.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || report.selectedItems.filter(i => !removedIds.has(i.id)).length === 0}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: purchased ? '#059669' : '#17402C',
                    color: '#fff',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: purchased ? 'default' : 'pointer',
                    opacity: purchasing ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {purchased ? 'Ajout\u00e9 \u00e0 l\u0027inventaire' : purchasing ? 'Traitement...' : `Acheter le kit \u2014 ${report.selectedItems.filter(i => !removedIds.has(i.id)).reduce((s, i) => s + Number(i.price_eur), 0).toFixed(2)} \u20ac`}
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleExport}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#F4F1EA',
                      color: '#0B1F17',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 500,
                      border: '1px solid rgba(11,31,23,0.06)',
                      cursor: 'pointer',
                    }}
                  >
                    Exporter
                  </button>
                  <button
                    onClick={() => { setReport(null); setRemovedIds(new Set()); setSaved(false); setPurchased(false); }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#F4F1EA',
                      color: '#0B1F17',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 500,
                      border: '1px solid rgba(11,31,23,0.06)',
                      cursor: 'pointer',
                    }}
                  >
                    Nouveau rapport
                  </button>
                </div>
              </div>

              {/* Footer spacer */}
              <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
            </>
          )}

          {/* Form (no report) */}
          {!report && !generating && (
            <div style={{ padding: '0 16px' }}>
              <div style={{ padding: '20px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0B1F17', margin: '0 0 16px 0' }}>Param&egrave;tres du voyage</h2>
                <p style={{ fontSize: '12px', color: '#6B7A72', margin: '0 0 16px 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                  Utilisez la version desktop pour configurer votre kit.
                </p>
                <a href="/ai-configurator" style={{ display: 'block', width: '100%', padding: '12px', textAlign: 'center', background: '#17402C', color: '#fff', borderRadius: '12px', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
                  Ouvrir le configurateur
                </a>
              </div>
            </div>
          )}

          {/* Footer spacer for form/error states */}
          {!report && (
            <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
          )}
        </MobilePageShell>
      </div>
    </>
  );
}
