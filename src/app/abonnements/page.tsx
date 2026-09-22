'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { Badge, Button, Card, Chip, IconButton, Tabs } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  badge?: string;
  features: string[];
  box?: string;
  cta: string;
}

interface BoxContent {
  month: string;
  theme: string;
  profile: string;
  items: { name: string; value: number; category: string }[];
  totalValue: number;
  image: string;
  alt: string;
}

const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    price: 0,
    period: 'Gratuit',
    features: [
      'Configurateur IA (3 kits/mois)',
      'Catalogue complet',
      'Guides de destination',
      'Communauté de base',
      'Alertes prix',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    id: 'aventurier',
    name: 'Aventurier',
    price: 19,
    period: '/mois',
    badge: 'Populaire',
    features: [
      'Tout Explorer inclus',
      'Configurateur IA illimité',
      'Copilote IA avancé',
      'Accès communauté premium',
      'Recommandations ML personnalisées',
      'Rapport post-expédition',
      'Remise 10% catalogue',
    ],
    box: 'Box mensuelle en option +29€',
    cta: "Démarrer l'essai 14 jours",
  },
  {
    id: 'expedition',
    name: 'Expédition',
    price: 49,
    period: '/mois',
    badge: 'Tout inclus',
    features: [
      'Tout Aventurier inclus',
      'Box mensuelle incluse (valeur ~120€)',
      'Consultation expert mensuelle',
      'Accès bêta nouvelles fonctionnalités',
      'Remise 20% catalogue',
      'Gamification rang Légende',
      'Rapport IA détaillé post-expédition',
      'Priorité support 24h',
    ],
    cta: 'Rejoindre Expédition',
  },
];

const BOX_PREVIEWS: BoxContent[] = [
  {
    month: 'Juillet 2026',
    theme: 'Haute Montagne',
    profile: 'Alpiniste / Trekking altitude',
    items: [
      { name: 'Crème solaire SPF 50+ montagne', value: 18, category: 'Soin' },
      { name: 'Bâtons de randonnée pliables', value: 45, category: 'Équipement' },
      { name: 'Gants liner mérinos', value: 28, category: 'Textile' },
      { name: 'Gel énergie altitude x6', value: 14, category: 'Nutrition' },
      { name: 'Carte topo laminée Alpes', value: 12, category: 'Navigation' },
    ],
    totalValue: 117,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1f67eeed9-1783678939279.png',
    alt: 'Box équipement haute montagne avec matériel de trekking alpin posé sur neige',
  },
  {
    month: 'Août 2026',
    theme: 'Jungle & Tropiques',
    profile: 'Aventurier tropical / Randonnée forêt',
    items: [
      { name: 'Répulsif anti-moustiques DEET 50%', value: 16, category: 'Soin' },
      { name: 'Hamac ultraléger 400g', value: 38, category: 'Couchage' },
      { name: 'Purificateur eau UV SteriPen', value: 52, category: 'Eau' },
      { name: 'T-shirt anti-UV séchage rapide', value: 24, category: 'Textile' },
    ],
    totalValue: 130,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1833f7ac7-1768148643508.png',
    alt: 'Équipement jungle tropical avec hamac et matériel de survie en forêt dense',
  },
];

const PROFILES = [
  { id: 'montagne', label: 'Montagne & Alpinisme', icon: 'MapPinIcon' },
  { id: 'desert', label: 'Désert & Aride', icon: 'SunIcon' },
  { id: 'jungle', label: 'Jungle & Tropical', icon: 'GlobeAltIcon' },
  { id: 'mer', label: 'Mer & Côtier', icon: 'MapIcon' },
  { id: 'urbain', label: 'Nomade Urbain', icon: 'BuildingOfficeIcon' },
  { id: 'mixte', label: 'Multi-terrain', icon: 'AdjustmentsHorizontalIcon' },
];

const AI_LINK_CLASS =
  'inline-flex min-h-[var(--control-height-md)] items-center justify-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)] transition-colors hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

export default function AbonnementsPage() {
  const [selectedPlan, setSelectedPlan] = useState('aventurier');
  const [selectedProfile, setSelectedProfile] = useState('montagne');
  const [activeBox, setActiveBox] = useState(0);
  const [billingAnnual, setBillingAnnual] = useState(false);

  const content = (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-4)] py-[var(--space-16)] text-[color:var(--lkv-text-primary)]">
        <div className="relative z-[var(--z-sticky)] mx-auto max-w-4xl text-center">
          <Badge tone="sage" className="mb-[var(--space-6)] font-mono">
            <Icon name="SparklesIcon" size={12} variant="outline" />
            PHASE 5 — ABONNEMENTS & BOX
          </Badge>
          <h1 className="mb-[var(--space-4)] font-display text-[length:var(--lkv-text-title-xl)] font-extrabold tracking-[var(--lkv-tracking-title)]">
            L&apos;équipement parfait,<br />
            <span className="text-[color:var(--lkv-secondary)]">livré chaque mois</span>
          </h1>
          <p className="mx-auto max-w-2xl text-[length:var(--lkv-text-body)] text-[color:var(--lkv-text-inverted)] opacity-60">
            Une box mensuelle sélectionnée par notre IA selon votre profil voyageur. Chaque produit choisi pour votre prochaine expédition.
          </p>
        </div>
      </section>

      {/* Billing Toggle */}
      <section className="px-[var(--space-4)] pb-[var(--space-4)]">
        <div className="mx-auto flex max-w-5xl justify-center">
          <Tabs
            options={[
              { id: 'monthly', label: 'Mensuel' },
              { id: 'annual', label: 'Annuel', badge: '-20%' },
            ]}
            value={billingAnnual ? 'annual' : 'monthly'}
            onChange={(id) => setBillingAnnual(id === 'annual')}
            variant="segmented"
            ariaLabel="Facturation"
            className="max-w-xs"
          />
        </div>
      </section>

      {/* Plans */}
      <section className="px-[var(--space-4)] py-[var(--space-8)]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-[var(--space-6)] md:grid-cols-3">
          {PLANS.map((plan) => {
            const price = billingAnnual && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price;
            const isSelected = selectedPlan === plan.id;
            return (
              <Card
                key={plan.id}
                variant="interactive"
                selected={isSelected}
                onClick={() => setSelectedPlan(plan.id)}
                className="relative flex flex-col p-[var(--space-6)]"
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge tone={plan.id === 'expedition' ? 'warn' : 'sage'} className="font-bold">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <div className="mb-[var(--space-4)]">
                  <h3 className="mb-[var(--space-1)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">{plan.name}</h3>
                  <div className="flex items-baseline gap-[var(--space-1)]">
                    {plan.price > 0 ? (
                      <>
                        <span className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">{price}€</span>
                        <span className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">{plan.period}</span>
                      </>
                    ) : (
                      <span className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-muted)]">{plan.period}</span>
                    )}
                  </div>
                  {billingAnnual && plan.price > 0 && (
                    <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-success)]">Facturé {price * 12}€/an</p>
                  )}
                </div>

                <ul className="mb-[var(--space-6)] space-y-[var(--space-2)]">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
                      <Icon name="CheckIcon" size={14} variant="outline" className="mt-0.5 flex-shrink-0 text-[color:var(--lkv-primary)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.box && (
                  <Card variant="compact" tone="warn" className="mb-[var(--space-4)] p-[var(--space-3)]">
                    <p className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-warning-dark)]">
                      <Icon name="GiftIcon" size={12} variant="outline" />
                      {plan.box}
                    </p>
                  </Card>
                )}

                <Button variant={plan.id !== 'explorer' ? 'primary' : 'secondary'} fullWidth className="mt-auto">
                  {plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Box Preview */}
      <section className="px-[var(--space-4)] py-[var(--space-12)]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-[var(--space-8)] flex items-center justify-between">
            <div>
              <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                Aperçu des boxes à venir
              </h2>
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Sélectionnée par l&apos;IA selon votre profil</p>
            </div>
            <div className="flex gap-[var(--space-2)]">
              {BOX_PREVIEWS.map((_, i) => (
                <IconButton
                  key={i}
                  variant="ghost"
                  size="sm"
                  aria-label={`Afficher la box ${i + 1}`}
                  aria-pressed={activeBox === i}
                  onClick={() => setActiveBox(i)}
                  className="h-11 w-11"
                >
                  <span className={`h-2.5 w-2.5 rounded-full transition-colors ${activeBox === i ? 'bg-[color:var(--lkv-primary)]' : 'bg-[color:var(--lkv-border-strong)]'}`} />
                </IconButton>
              ))}
            </div>
          </div>

          {BOX_PREVIEWS[activeBox] && (
            <Card className="grid grid-cols-1 overflow-hidden p-0 lg:grid-cols-2">
              <div className="relative h-64 lg:h-auto">
                <Image
                  src={BOX_PREVIEWS[activeBox].image}
                  alt={BOX_PREVIEWS[activeBox].alt}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--lkv-overlay-scrim)] to-transparent" />
                <div className="absolute bottom-[var(--space-4)] left-[var(--space-4)]">
                  <Badge tone="sage" className="font-bold">{BOX_PREVIEWS[activeBox].month}</Badge>
                  <h3 className="mt-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-inverted)]">
                    {BOX_PREVIEWS[activeBox].theme}
                  </h3>
                </div>
              </div>
              <div className="p-[var(--space-6)]">
                <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)]">
                  <Icon name="UserIcon" size={14} variant="outline" className="text-[color:var(--lkv-text-muted)]" />
                  <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{BOX_PREVIEWS[activeBox].profile}</span>
                </div>
                <div className="mb-[var(--space-6)] space-y-[var(--space-3)]">
                  {BOX_PREVIEWS[activeBox].items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Badge tone="stone">{item.category}</Badge>
                        <span className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">{item.name}</span>
                      </div>
                      <span className="font-mono text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">{item.value}€</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-4)]">
                  <span className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Valeur totale estimée</span>
                  <span className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-primary)]">
                    ~{BOX_PREVIEWS[activeBox].totalValue}€
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Profile Selector */}
      <section className="bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-4)] py-[var(--space-12)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-[var(--space-2)] text-center font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            Personnalisez votre box
          </h2>
          <p className="mb-[var(--space-8)] text-center text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Votre profil voyageur détermine le contenu de chaque box</p>
          <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3">
            {PROFILES.map((p) => (
              <Chip
                key={p.id}
                selected={selectedProfile === p.id}
                onClick={() => setSelectedProfile(p.id)}
                icon={<Icon name={p.icon as string} size={16} variant="outline" />}
                className="justify-start px-[var(--space-4)] py-[var(--space-3)]"
              >
                <span className="text-[length:var(--lkv-text-body-sm)] font-medium">{p.label}</span>
              </Chip>
            ))}
          </div>
          <div className="mt-[var(--space-6)] text-center">
            <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">Profil sélectionné : <span className="text-[color:var(--lkv-text-secondary)]">{PROFILES.find((p) => p.id === selectedProfile)?.label}</span></p>
            <Link href="/ai-configurator" className={AI_LINK_CLASS}>
              <Icon name="SparklesIcon" size={16} variant="outline" />
              Affiner mon profil avec l&apos;IA
            </Link>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-transparent">
          <Header />
          <main className="pt-20">
            {content}
          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {content}
        </MobilePageShell>
      </div>
    </>
  );
}
