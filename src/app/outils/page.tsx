import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import TopoSeparator from '@/components/TopoSeparator';

export const metadata: Metadata = {
  title: 'Boîte à Outils — Kit du Voyageur',
  description: 'Suite d\'outils gratuits pour voyageurs et randonneurs : calculateur de poids, budget, convertisseurs, checklist, boussole, chronomètre et plus.',
};

interface Tool {
  slug: string;
  nom: string;
  description: string;
  icon: string;
  categorie: string;
  offline: boolean;
  mobilePriority: boolean;
}

const tools: Tool[] = [
  {
    slug: 'poids-sac',
    nom: 'Calculateur de poids',
    description: 'Pesez votre sac par catégorie avec jauge visuelle. Identifiez les postes les plus lourds et optimisez.',
    icon: '⚖️',
    categorie: 'Préparation',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'budget-voyage',
    nom: 'Budget voyage',
    description: 'Planifiez votre budget par jour et par poste (hébergement, transport, nourriture, activités).',
    icon: '💰',
    categorie: 'Préparation',
    offline: true,
    mobilePriority: false,
  },
  {
    slug: 'convertisseur',
    nom: 'Convertisseur universel',
    description: 'Convertissez distances, poids, températures et devises. Fonctionne hors ligne.',
    icon: '🔄',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'checklist',
    nom: 'Checklist interactive',
    description: 'Créez et personnalisez vos listes de voyage. Sauvegardées dans votre compte.',
    icon: '✅',
    categorie: 'Préparation',
    offline: false,
    mobilePriority: true,
  },
  {
    slug: 'tailles',
    nom: 'Convertisseur de tailles',
    description: 'Vêtements et chaussures : convertissez entre les standards FR, UK, US, EU, JP et plus.',
    icon: '👟',
    categorie: 'Shopping',
    offline: true,
    mobilePriority: false,
  },
  {
    slug: 'fuseaux',
    nom: 'Fuseaux horaires',
    description: 'Comparez les heures entre votre pays et votre destination. Calculez le décalage horaire.',
    icon: '🕐',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'boussole',
    nom: 'Boussole & Niveau',
    description: 'Boussole et niveau à bulle utilisant les capteurs de votre appareil. Fallback visuel inclus.',
    icon: '🧭',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'chronometre',
    nom: 'Chronomètre rando',
    description: 'Minuteur et chronomètre pour vos sorties. Enregistrez vos temps d\'étape.',
    icon: '⏱️',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'rations',
    nom: 'Rations eau & nourriture',
    description: 'Calculez vos besoins en eau et nourriture par jour et par personne selon l\'effort et la météo.',
    icon: '💧',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'decompression',
    nom: 'Calculateur de décompression',
    description: 'Calculez vos paliers de décompression pour la plongée. Basé sur les tables PADI et NAUI.',
    icon: '🤿',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: false,
  },
  {
    slug: 'altimetre',
    nom: 'Altimètre & Pression',
    description: 'Mesurez l\'altitude et la pression atmosphérique en temps réel via les capteurs de votre appareil.',
    icon: '📊',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'meteo-montagne',
    nom: 'Météo montagne',
    description: 'Interprétez les bulletins météo montagne : nuages, vent, précipitations, risque orage.',
    icon: '⛅',
    categorie: 'Terrain',
    offline: false,
    mobilePriority: true,
  },
  {
    slug: 'carbone',
    nom: 'Calculateur carbone voyage',
    description: 'Estimez l\'empreinte carbone de vos voyages et calculez la compensation nécessaire.',
    icon: '🌿',
    categorie: 'Préparation',
    offline: true,
    mobilePriority: false,
  },
  {
    slug: 'debit-eau',
    nom: 'Calculateur débit rivière',
    description: 'Estimez le débit et la dangerosité d\'une rivière pour la traversée ou le kayak.',
    icon: '🌊',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'pharmacie',
    nom: 'Pharmacie de voyage',
    description: 'Composez votre pharmacie de voyage selon votre destination, durée et activités prévues.',
    icon: '🏥',
    categorie: 'Préparation',
    offline: true,
    mobilePriority: false,
  },
  {
    slug: 'visa',
    nom: 'Vérificateur de visa',
    description: 'Vérifiez les exigences de visa pour votre nationalité et votre destination.',
    icon: '🛂',
    categorie: 'Préparation',
    offline: false,
    mobilePriority: false,
  },
  {
    slug: 'vaccins',
    nom: 'Recommandations vaccins',
    description: 'Consultez les recommandations vaccinales par destination selon les données officielles.',
    icon: '💉',
    categorie: 'Préparation',
    offline: false,
    mobilePriority: false,
  },
  {
    slug: 'langue',
    nom: 'Phrases essentielles',
    description: 'Les phrases de survie dans 40 langues : urgences, nourriture, transport, hébergement.',
    icon: '🗣️',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'noeud',
    nom: 'Guide des nœuds',
    description: 'Apprenez les nœuds essentiels pour la randonnée, l\'escalade et le camping avec animations.',
    icon: '🪢',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
  {
    slug: 'soleil',
    nom: 'Calculateur lever/coucher soleil',
    description: 'Calculez les heures de lever et coucher du soleil pour n\'importe quelle date et localisation.',
    icon: '🌅',
    categorie: 'Terrain',
    offline: true,
    mobilePriority: true,
  },
];

const categories = ['Tous', 'Préparation', 'Terrain', 'Shopping'];

const categorieColor: Record<string, string> = {
  Préparation: 'bg-accent/10 text-accent border-accent/20',
  Terrain: 'bg-info/10 text-info border-info/20',
  Shopping: 'bg-primary/10 text-primary border-primary/20',
};

export default function OutilsPage() {
  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />

          {/* Hero */}
          <section className="pt-24 pb-0 bg-dark-bg relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23E7E3D6' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")" }} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-1 h-12 bg-info flex-shrink-0 mt-1" />
                <div>
                  <p className="font-mono text-xs text-info tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                    BOÎTE À OUTILS — {tools.length} OUTILS GRATUITS
                  </p>
                  <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                    OUTILS TERRAIN
                  </h1>
                  <p className="mt-3 text-white/60 text-lg max-w-2xl">
                    Des outils sobres et rapides, conçus pour le terrain. La plupart fonctionnent hors ligne — utiles même sans réseau.
                  </p>
                </div>
              </div>

              {/* Stats bar */}
              <div className="flex flex-wrap gap-6 mt-8">
                {[
                  { label: 'OUTILS DISPONIBLES', value: tools.length.toString() },
                  { label: 'OFFLINE', value: `${tools.filter((t) => t.offline).length}/${tools.length}` },
                  { label: 'MOBILE-FIRST', value: `${tools.filter((t) => t.mobilePriority).length}/${tools.length}` },
                  { label: 'GRATUITS', value: '100%' },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col">
                    <span className="font-mono text-[10px] text-white/40 tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{stat.label}</span>
                    <span className="font-mono text-2xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <TopoSeparator color="#E7E3D6" />
          </section>

          {/* Tools Grid */}
          <section className="py-12 bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Category filter — client-side not needed, use anchor links */}
              <div className="flex flex-wrap gap-2 mb-8">
                {categories.map((cat) => (
                  <span
                    key={cat}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      cat === 'Tous' ?'bg-foreground text-background border-foreground'
                        : categorieColor[cat] || 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {cat}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                  <Link key={tool.slug} href={`/outils/${tool.slug}`} className="group block">
                    <article className="h-full border border-border rounded-2xl bg-card hover:border-info/50 transition-all duration-300 hover:shadow-lg hover:shadow-info/10 p-6 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className="text-4xl" role="img" aria-label={tool.nom}>{tool.icon}</div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${categorieColor[tool.categorie]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                            {tool.categorie.toUpperCase()}
                          </span>
                          {tool.offline && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-emerald-400/30 text-emerald-400 bg-emerald-400/10" style={{ fontFamily: 'var(--font-mono)' }}>
                              OFFLINE
                            </span>
                          )}
                        </div>
                      </div>
                      <h2 className="font-display font-700 text-lg text-foreground tracking-tight mb-2 group-hover:text-info transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                        {tool.nom}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{tool.description}</p>
                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {tool.mobilePriority ? '📱 Mobile-first' : '💻 Desktop & mobile'}
                        </span>
                        <span className="text-xs text-info font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                          Ouvrir →
                        </span>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <TopoSeparator inverted color="#1C2620" />
          <section className="py-16 bg-dark-bg">
            <div className="max-w-3xl mx-auto px-4 text-center">
              <p className="font-mono text-xs text-info tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>CONFIGURATEUR IA</p>
              <h2 className="font-display font-800 text-3xl text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Préparez votre voyage avec l&apos;IA
              </h2>
              <p className="text-white/60 mb-8">Destination, saison, profil — notre IA génère votre liste d&apos;équipement complète en quelques secondes.</p>
              <Link href="/ai-configurator" className="btn-primary text-base px-8 py-3.5 inline-flex items-center gap-2">
                <span>✨</span>
                Lancer le configurateur
              </Link>
            </div>
          </section>
          <TopoSeparator color="#E7E3D6" />

          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Mobile Hero */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>
                BOÎTE À OUTILS — {tools.length} OUTILS
              </p>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1C2620', lineHeight: '1.1', marginBottom: '8px' }}>
                Outils terrain
              </h1>
              <p style={{ fontSize: '14px', color: '#6B7A72', lineHeight: '1.5' }}>
                Des outils sobres et rapides, conçus pour le terrain.
              </p>
            </div>

            {/* Tools List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/outils/${tool.slug}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    padding: '14px',
                    background: '#F4F1EA',
                    border: '1px solid rgba(11,31,23,0.06)',
                    borderRadius: '16px',
                  }}>
                    <span style={{ fontSize: '28px', flexShrink: 0 }} role="img" aria-label={tool.nom}>{tool.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#1C2620' }}>{tool.nom}</span>
                        <span style={{
                          fontSize: '9px',
                          fontFamily: 'ui-monospace, monospace',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(11,31,23,0.06)',
                          color: '#6B7A72',
                          background: '#FBFAF6',
                        }}>
                          {tool.categorie.toUpperCase()}
                        </span>
                        {tool.offline && (
                          <span style={{
                            fontSize: '9px',
                            fontFamily: 'ui-monospace, monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(0,168,107,0.2)',
                            color: '#00A86B',
                            background: 'rgba(0,168,107,0.05)',
                          }}>
                            OFFLINE
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: '#6B7A72', lineHeight: '1.4' }}>{tool.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
