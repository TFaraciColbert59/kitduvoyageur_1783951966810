import Link from 'next/link';

export const metadata = {
  title: 'Le Kit du Voyageur — Équipement outdoor & aventure',
  description:
    'Configurez votre kit de voyage parfait avec notre IA. Équipements outdoor vérifiés, kits prêts à partir, communauté de voyageurs passionnés.',
};

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const POPULAR_KITS = [
  {
    slug: 'nepal-trek-3-semaines',
    name: 'Népal — Trek 3 semaines',
    tag: 'Altitude',
    tagColor: '#3E6B7A',
    weight: '7.2 kg',
    price: '1 240 €',
    items: 34,
    rating: 4.9,
    reviews: 218,
    gradient: 'from-[#1C2620] to-[#3E6B7A]',
    emoji: '🏔️',
  },
  {
    slug: 'patagonie-autonomie',
    name: 'Patagonie — Autonomie totale',
    tag: 'Extrême',
    tagColor: '#E4501C',
    weight: '9.1 kg',
    price: '2 180 €',
    items: 47,
    rating: 4.8,
    reviews: 143,
    gradient: 'from-[#2C1810] to-[#B5652D]',
    emoji: '🌬️',
  },
  {
    slug: 'japon-urbain-minimaliste',
    name: 'Japon — Urbain minimaliste',
    tag: 'Léger',
    tagColor: '#33463C',
    weight: '4.3 kg',
    price: '680 €',
    items: 22,
    rating: 4.9,
    reviews: 312,
    gradient: 'from-[#1C2620] to-[#33463C]',
    emoji: '🗾',
  },
  {
    slug: 'sahara-desert-expedition',
    name: 'Sahara — Expédition désert',
    tag: 'Chaleur',
    tagColor: '#B5652D',
    weight: '8.4 kg',
    price: '1 560 €',
    items: 39,
    rating: 4.7,
    reviews: 89,
    gradient: 'from-[#2C1810] to-[#E4501C]',
    emoji: '🏜️',
  },
  {
    slug: 'islande-road-trip',
    name: 'Islande — Road trip nordique',
    tag: 'Froid',
    tagColor: '#3E6B7A',
    weight: '6.8 kg',
    price: '1 890 €',
    items: 41,
    rating: 4.8,
    reviews: 176,
    gradient: 'from-[#0D1F2D] to-[#3E6B7A]',
    emoji: '🌋',
  },
  {
    slug: 'amazonie-jungle-survival',
    name: 'Amazonie — Jungle survival',
    tag: 'Humidité',
    tagColor: '#33463C',
    weight: '10.2 kg',
    price: '2 340 €',
    items: 52,
    rating: 4.6,
    reviews: 67,
    gradient: 'from-[#0D2010] to-[#33463C]',
    emoji: '🌿',
  },
];

const TRUST_STATS = [
  { value: '48 200+', label: 'Voyageurs équipés', icon: '🧭' },
  { value: '4.91', label: 'Note moyenne vérifiée', icon: '⭐' },
  { value: '312', label: 'Destinations couvertes', icon: '🌍' },
  { value: '98%', label: 'Satisfaction terrain', icon: '✅' },
];

const MARKETPLACE_FEATURES = [
  {
    title: 'Occasion certifiée',
    desc: 'Matériel inspecté par nos experts, garanti 6 mois',
    icon: '🔍',
    href: '/occasion',
    accent: '#E4501C',
  },
  {
    title: 'Location entre voyageurs',
    desc: 'Louez ou prêtez votre équipement inutilisé',
    icon: '🔑',
    href: '/location',
    accent: '#3E6B7A',
  },
  {
    title: 'Enchères flash',
    desc: 'Équipements premium à prix réduit, 48h chrono',
    icon: '⚡',
    href: '/encheres',
    accent: '#B5652D',
  },
];

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* ══════════════════════════════════════
          1. HERO — Plein écran immersif
      ══════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex flex-col justify-end overflow-hidden"
        style={{ background: 'var(--dark-bg)' }}
      >
        {/* Topographic SVG background */}
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="topo" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                <path d="M0 60 Q30 20 60 60 Q90 100 120 60" fill="none" stroke="white" strokeWidth="1"/>
                <path d="M0 80 Q30 40 60 80 Q90 120 120 80" fill="none" stroke="white" strokeWidth="0.5"/>
                <path d="M0 40 Q30 0 60 40 Q90 80 120 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo)"/>
          </svg>
        </div>

        {/* Gradient orbs */}
        <div
          className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #E4501C 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/3 left-1/5 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3E6B7A 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pb-20 pt-32">
          <div className="max-w-4xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-8">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase"
                style={{ background: 'rgba(228,80,28,0.15)', color: '#E4501C', border: '1px solid rgba(228,80,28,0.3)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-pulse" />
                Configurateur IA actif
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-hero text-white mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              Votre kit de voyage,<br />
              <span style={{ color: '#E4501C' }}>pensé par l&apos;IA.</span><br />
              <span className="text-white/50">Validé sur le terrain.</span>
            </h1>

            <p className="text-lg md:text-xl mb-10 max-w-xl leading-relaxed" style={{ color: 'rgba(231,227,214,0.7)' }}>
              Décrivez votre aventure. Notre IA analyse 48 000+ retours d&apos;expédition
              pour composer votre kit optimal — au gramme près.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Link href="/ai-configurator" className="btn-primary text-base">
                <span>Configurer mon kit</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link
                href="/kits"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-base transition-all duration-200"
                style={{ border: '1.5px solid rgba(231,227,214,0.25)', color: 'rgba(231,227,214,0.85)' }}
              >
                Explorer les kits
              </Link>
            </div>

            {/* Social proof strip */}
            <div className="flex flex-wrap items-center gap-6">
              {TRUST_STATS?.slice(0, 3)?.map((s) => (
                <div key={s?.label} className="flex items-center gap-2">
                  <span className="text-xl">{s?.icon}</span>
                  <div>
                    <div className="font-mono text-sm font-bold" style={{ color: '#E4501C', fontFamily: 'var(--font-mono)' }}>{s?.value}</div>
                    <div className="text-xs" style={{ color: 'rgba(231,227,214,0.5)' }}>{s?.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40" aria-hidden="true">
          <span className="text-xs font-mono tracking-widest text-white/60 uppercase">Défiler</span>
          <div className="scroll-line-track">
            <div className="scroll-line-fill h-1/2" />
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          2. CONFIGURATEUR IA — Interactif teaser
      ══════════════════════════════════════ */}
      <section className="py-24 px-6 lg:px-8 overflow-hidden" style={{ background: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — copy */}
            <div>
              <p className="mono-data mb-4 uppercase tracking-widest">— Configurateur IA</p>
              <h2 className="text-section-title mb-6" style={{ color: 'var(--foreground)' }}>
                Votre destination.<br />
                <span style={{ color: 'var(--primary)' }}>Votre kit exact.</span>
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--muted-foreground)' }}>
                Renseignez votre destination, la durée, la saison et votre niveau.
                Notre IA croise 312 destinations, les conditions météo réelles et
                48 000 retours terrain pour générer votre liste d&apos;équipement optimale.
              </p>

              <div className="space-y-4 mb-10">
                {[
                  { step: '01', text: 'Décrivez votre aventure en 30 secondes' },
                  { step: '02', text: 'L\'IA analyse les conditions réelles de votre destination' },
                  { step: '03', text: 'Recevez votre kit personnalisé au gramme près' },
                ]?.map((item) => (
                  <div key={item?.step} className="flex items-start gap-4">
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                      style={{ background: 'rgba(228,80,28,0.1)', color: 'var(--primary)', border: '1px solid rgba(228,80,28,0.2)' }}
                    >
                      {item?.step}
                    </span>
                    <p className="text-sm leading-relaxed pt-1.5" style={{ color: 'var(--foreground)' }}>{item?.text}</p>
                  </div>
                ))}
              </div>

              <Link href="/ai-configurator" className="btn-primary">
                Lancer le configurateur
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>

            {/* Right — mock UI card */}
            <div className="relative">
              <div
                className="rounded-2xl p-6 shadow-2xl"
                style={{ background: 'var(--dark-bg)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(228,80,28,0.2)' }}>
                    <span className="text-sm">🤖</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Configurateur IA</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>Analyse en cours…</div>
                  </div>
                  <div className="ml-auto flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#E4501C] animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-[#E4501C] animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-[#E4501C] animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>

                {/* Destination input mock */}
                <div className="mb-4">
                  <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>DESTINATION</div>
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span>🏔️</span>
                    <span className="text-white text-sm">Népal — Circuit Annapurna</span>
                    <span className="ml-auto text-xs" style={{ color: '#E4501C', fontFamily: 'var(--font-mono)' }}>5 400m alt.</span>
                  </div>
                </div>

                {/* Kit preview */}
                <div className="space-y-2 mb-5">
                  {[
                    { cat: 'Couches de base', items: 4, weight: '620g', done: true },
                    { cat: 'Isolation thermique', items: 2, weight: '1.1kg', done: true },
                    { cat: 'Protection pluie', items: 3, weight: '480g', done: true },
                    { cat: 'Navigation & sécurité', items: 6, weight: '340g', done: false },
                  ]?.map((row) => (
                    <div
                      key={row?.cat}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                      style={{ background: row?.done ? 'rgba(228,80,28,0.08)' : 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: row?.done ? '#E4501C' : 'rgba(255,255,255,0.1)' }}
                        >
                          {row?.done && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                              <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-white/80">{row?.cat}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{row?.items} articles</span>
                        <span className="text-xs font-mono" style={{ color: '#3E6B7A', fontFamily: 'var(--font-mono)' }}>{row?.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Weight total */}
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(228,80,28,0.12)', border: '1px solid rgba(228,80,28,0.2)' }}
                >
                  <span className="text-sm font-semibold text-white">Poids total estimé</span>
                  <span className="font-mono font-bold" style={{ color: '#E4501C', fontFamily: 'var(--font-mono)' }}>7.2 kg</span>
                </div>
              </div>

              {/* Floating badge */}
              <div
                className="absolute -top-4 -right-4 px-3 py-2 rounded-xl text-xs font-mono shadow-lg"
                style={{ background: '#E4501C', color: 'white', fontFamily: 'var(--font-mono)' }}
              >
                IA · 2 min
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          3. AVANT / APRÈS
      ══════════════════════════════════════ */}
      <section className="py-24 px-6 lg:px-8" style={{ background: 'var(--dark-bg)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="mono-data mb-4 uppercase tracking-widest" style={{ color: 'rgba(231,227,214,0.4)' }}>— Transformation</p>
            <h2 className="text-section-title text-white mb-4">
              Avant le Kit du Voyageur.<br />
              <span style={{ color: '#E4501C' }}>Après le Kit du Voyageur.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* AVANT */}
            <div
              className="rounded-2xl p-8"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  ✗
                </div>
                <span className="font-mono text-sm uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>Avant</span>
              </div>
              <ul className="space-y-4">
                {[
                  'Sac de 22 kg pour 10 jours de trek',
                  'Matériel inadapté à l\'altitude',
                  '3h de recherche sur 12 sites différents',
                  'Doublons et oublis critiques',
                  'Budget dépassé de 40%',
                  'Stress la veille du départ',
                ]?.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span className="flex-shrink-0 mt-0.5 text-red-400">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* APRÈS */}
            <div
              className="rounded-2xl p-8 relative overflow-hidden"
              style={{ background: 'rgba(228,80,28,0.08)', border: '1px solid rgba(228,80,28,0.2)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: 'linear-gradient(90deg, #E4501C, #B5652D)' }}
                aria-hidden="true"
              />
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: 'rgba(228,80,28,0.2)', color: '#E4501C' }}
                >
                  ✓
                </div>
                <span className="font-mono text-sm uppercase tracking-widest" style={{ color: '#E4501C', fontFamily: 'var(--font-mono)' }}>Après</span>
              </div>
              <ul className="space-y-4">
                {[
                  'Kit de 7.2 kg, optimisé au gramme',
                  'Chaque article validé pour votre destination',
                  'Kit complet généré en 2 minutes',
                  'Liste exhaustive, zéro doublon',
                  'Budget optimisé, meilleur rapport qualité/prix',
                  'Départ serein, équipement parfait',
                ]?.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white">
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#E4501C' }}>+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/ai-configurator" className="btn-primary">
              Transformer mon prochain voyage
            </Link>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          4. 6 KITS POPULAIRES
      ══════════════════════════════════════ */}
      <section className="py-24 px-6 lg:px-8" style={{ background: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <p className="mono-data mb-3 uppercase tracking-widest">— Kits populaires</p>
              <h2 className="text-section-title" style={{ color: 'var(--foreground)' }}>
                Les destinations<br />
                <span style={{ color: 'var(--primary)' }}>les plus équipées.</span>
              </h2>
            </div>
            <Link
              href="/kits"
              className="inline-flex items-center gap-2 text-sm font-semibold self-start md:self-auto"
              style={{ color: 'var(--primary)' }}
            >
              Voir tous les kits
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          {/* Bento grid — asymmetric */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {POPULAR_KITS?.map((kit, i) => (
              <Link
                key={kit?.slug}
                href={`/kits/${kit?.slug}`}
                className={`group relative rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1 ${i === 0 ? 'md:col-span-2 lg:col-span-1' : ''}`}
                style={{ minHeight: i === 0 ? '280px' : '240px' }}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${kit?.gradient}`} aria-hidden="true" />
                <div className="absolute inset-0 opacity-[0.06]" aria-hidden="true">
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id={`topo-kit-${i}`} x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                        <path d="M0 40 Q20 10 40 40 Q60 70 80 40" fill="none" stroke="white" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#topo-kit-${i})`}/>
                  </svg>
                </div>

                {/* Content */}
                <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-4xl">{kit?.emoji}</span>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold"
                        style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontFamily: 'var(--font-mono)' }}
                      >
                        {kit?.tag}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-white text-lg leading-tight mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                      {kit?.name}
                    </h3>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-yellow-400 text-xs">{'★'?.repeat(Math.floor(kit?.rating))}</span>
                      <span className="text-xs font-mono text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>{kit?.rating} ({kit?.reviews})</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mt-4">
                    <div>
                      <div className="text-xs text-white/50 mb-0.5">{kit?.items} articles</div>
                      <div className="font-mono text-xs text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>{kit?.weight}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/50 mb-0.5">À partir de</div>
                      <div className="font-display font-bold text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>{kit?.price}</div>
                    </div>
                  </div>
                </div>

                {/* Hover arrow */}
                <div
                  className="absolute bottom-4 right-4 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          5. MARKETPLACE INTELLIGENTE
      ══════════════════════════════════════ */}
      <section className="py-24 px-6 lg:px-8" style={{ background: 'var(--card)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="mono-data mb-4 uppercase tracking-widest">— Marketplace</p>
            <h2 className="text-section-title mb-4" style={{ color: 'var(--foreground)' }}>
              Achetez, louez, échangez.<br />
              <span style={{ color: 'var(--primary)' }}>Intelligemment.</span>
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--muted-foreground)' }}>
              Une marketplace pensée pour les voyageurs sérieux — pas pour les touristes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {MARKETPLACE_FEATURES?.map((feat) => (
              <Link
                key={feat?.title}
                href={feat?.href}
                className="group topo-card p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-6"
                  style={{ background: `${feat?.accent}15`, border: `1px solid ${feat?.accent}30` }}
                >
                  {feat?.icon}
                </div>
                <h3 className="font-display font-bold text-lg mb-3" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
                  {feat?.title}
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--muted-foreground)' }}>
                  {feat?.desc}
                </p>
                <div
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 group-hover:gap-3"
                  style={{ color: feat?.accent }}
                >
                  Explorer
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* Marketplace stats strip */}
          <div
            className="rounded-2xl px-8 py-6 flex flex-wrap justify-around gap-6"
            style={{ background: 'var(--dark-bg)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { val: '2 400+', label: 'Articles en occasion' },
              { val: '180', label: 'Enchères actives' },
              { val: '94%', label: 'Vendeurs notés 5★' },
              { val: '48h', label: 'Délai moyen livraison' },
            ]?.map((s) => (
              <div key={s?.label} className="text-center">
                <div className="font-display font-bold text-2xl text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>{s?.val}</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>{s?.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          6. TRUST SCORE
      ══════════════════════════════════════ */}
      <section className="py-24 px-6 lg:px-8" style={{ background: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — stats */}
            <div>
              <p className="mono-data mb-4 uppercase tracking-widest">— Trust Score</p>
              <h2 className="text-section-title mb-6" style={{ color: 'var(--foreground)' }}>
                La confiance,<br />
                <span style={{ color: 'var(--primary)' }}>mesurée sur le terrain.</span>
              </h2>
              <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--muted-foreground)' }}>
                Chaque avis est vérifié par achat prouvé. Chaque kit est testé
                par au moins 3 expéditions réelles avant d&apos;être référencé.
              </p>

              <div className="grid grid-cols-2 gap-5">
                {TRUST_STATS?.map((s) => (
                  <div
                    key={s?.label}
                    className="topo-card p-5"
                  >
                    <div className="text-3xl mb-3">{s?.icon}</div>
                    <div className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
                      {s?.value}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{s?.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — review cards */}
            <div className="space-y-4">
              {[
                {
                  name: 'Marie-Claire D.',
                  dest: 'Kirghizistan · 3 semaines',
                  text: 'Le kit Asie Centrale m\'a sauvé la mise. Chaque article était justifié, rien de superflu. 7.8 kg pour 21 jours, incroyable.',
                  rating: 5,
                  badge: 'Achat vérifié',
                },
                {
                  name: 'Thomas R.',
                  dest: 'Patagonie · 2 semaines',
                  text: 'J\'avais peur que le configurateur IA soit trop générique. Résultat : il a détecté que je partais en novembre et a ajouté des couches que je n\'aurais jamais pensé à prendre.',
                  rating: 5,
                  badge: 'Expédition vérifiée',
                },
                {
                  name: 'Léa M.',
                  dest: 'Japon · 10 jours',
                  text: 'Interface claire, recommandations précises. Le kit urbain minimaliste était parfait pour Tokyo et Kyoto.',
                  rating: 5,
                  badge: 'Achat vérifié',
                },
              ]?.map((review) => (
                <div
                  key={review?.name}
                  className="topo-card p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{review?.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{review?.dest}</div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-mono"
                      style={{ background: 'rgba(228,80,28,0.1)', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
                    >
                      {review?.badge}
                    </span>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: review?.rating })?.map((_, i) => (
                      <span key={i} className="text-yellow-500 text-xs">★</span>
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    &ldquo;{review?.text}&rdquo;
                  </p>
                </div>
              ))}

              <Link
                href="/avis"
                className="inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--primary)' }}
              >
                Lire tous les avis vérifiés
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════
          7. VISION ÉMOTIONNELLE
      ══════════════════════════════════════ */}
      <section
        className="relative py-32 px-6 lg:px-8 overflow-hidden"
        style={{ background: 'var(--dark-bg)' }}
      >
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="topo-vision" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
                <circle cx="80" cy="80" r="60" fill="none" stroke="white" strokeWidth="1"/>
                <circle cx="80" cy="80" r="40" fill="none" stroke="white" strokeWidth="0.5"/>
                <circle cx="80" cy="80" r="20" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-vision)"/>
          </svg>
        </div>

        {/* Gradient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(228,80,28,0.12) 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="mono-data mb-6 uppercase tracking-widest" style={{ color: 'rgba(231,227,214,0.4)' }}>— Notre vision</p>

          <h2 className="text-hero text-white mb-8">
            L&apos;équipement parfait<br />
            <span style={{ color: '#E4501C' }}>n&apos;existe pas.</span><br />
            <span className="text-white/40">Le vôtre, si.</span>
          </h2>

          <p className="text-lg leading-relaxed mb-6 max-w-2xl mx-auto" style={{ color: 'rgba(231,227,214,0.6)' }}>
            Nous ne vendons pas du matériel. Nous construisons la confiance
            qui vous permet de partir — vraiment partir — sans vous demander
            si vous avez oublié quelque chose.
          </p>

          <p className="text-base leading-relaxed mb-14 max-w-xl mx-auto" style={{ color: 'rgba(231,227,214,0.4)' }}>
            Chaque kit, chaque avis, chaque recommandation IA est conçu
            pour une seule chose : que vous reveniez avec des histoires à raconter.
          </p>

          {/* Destination pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-14">
            {['🏔️ Himalaya', '🌋 Islande', '🏜️ Sahara', '🌿 Amazonie', '🗾 Japon', '🧊 Antarctique', '🌊 Polynésie']?.map((dest) => (
              <span
                key={dest}
                className="px-4 py-2 rounded-full text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(231,227,214,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {dest}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inscription" className="btn-primary text-base">
              Rejoindre la communauté
            </Link>
            <Link
              href="/communaute"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-base transition-all duration-200"
              style={{ border: '1.5px solid rgba(231,227,214,0.2)', color: 'rgba(231,227,214,0.7)' }}
            >
              Voir les carnets d&apos;expédition
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
