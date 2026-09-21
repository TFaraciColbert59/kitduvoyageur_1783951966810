import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { Badge, Button, Card } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import { ResumeActiveTripCard } from '@/features/trips/components/ResumeActiveTripCard';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export default function HomePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Le Kit du Voyageur \u2014 \u00c9quipement outdoor & Configurateur IA',
    description: "Configurateur IA, \u00e9quipement outdoor, fiches pays et outils terrain. La plateforme compl\u00e8te du voyageur et de l'aventurier.",
    url: siteUrl,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />
      
      {/* ── DESKTOP & DIRECT VIEW ── */}
      <div>
        <div className="min-h-screen bg-transparent font-sans text-[var(--lkv-primary)]">
          <Header />
          <ResumeActiveTripCard />
          
          {/* ── HERO ── */}
          <section className="relative min-h-[85vh] flex flex-col pt-24 sm:pt-32 lg:pt-40 px-4 pb-16 overflow-hidden">
            {/* Fond applicatif visible — voile radial sombre léger pour la profondeur */}
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(11,31,23,0.22),rgba(11,31,23,0.52))]" />
            </div>

            <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-20 flex-1">
              {/* Left Text */}
              <div className="flex-1 max-w-2xl pt-4 sm:pt-8">
                <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[var(--lkv-forest-50)] font-semibold mb-4">ÉDITION AUTOMNE - ET REFUGES PARTENAIRES</p>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-[var(--stone-50)] leading-[1.1] mb-6">
                  Là où la carte<br />
                  <span className="font-serif italic text-white drop-shadow-sm font-normal">se termine.</span>
                </h1>
                <p className="text-[var(--sage-50)] text-base lg:text-lg mb-10 max-w-md leading-relaxed font-normal">
                  Refuges bruts, sentiers oubliés, matériel choisi à la main. Le Kit du Voyageur assemble ce qu&apos;il faut, exactement, pour partir léger — sans rien laisser au hasard.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
                  <Link href="/ai-configurator" className="inline-flex w-full sm:w-auto">
                    <Button
                      variant="primary"
                      size="lg"
                      icon={<Icon name="arrow-right" size={14} aria-hidden="true" />}
                      iconPosition="trailing"
                      className="w-full sm:w-auto"
                    >
                      Composer mon sac
                    </Button>
                  </Link>
                  <Link href="/explorer" className="inline-flex w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full border-white/30 bg-white/10 text-[var(--stone-50)] hover:bg-white/20 sm:w-auto"
                    >
                      Voir les aventures
                    </Button>
                  </Link>
                </div>
                
                {/* Reviews */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-[var(--lkv-warm-500)]">
                    <Icon name="star" size={16} aria-hidden="true" />
                    <span className="text-3xl font-bold text-[var(--stone-50)] leading-none ml-1">4,9</span>
                  </div>
                  <p className="text-[11px] uppercase font-mono tracking-widest text-[var(--lkv-forest-50)] leading-tight font-medium">
                    1 350+ VOYAGEURS RECOMMANDENT<br/>LEUR SÉJOUR
                  </p>
                </div>
              </div>

              {/* Right Card */}
              <div className="w-full max-w-[340px] flex-shrink-0">
                <Card
                  variant="featured"
                  className="relative overflow-hidden p-6 shadow-2xl dark:border-white/20 dark:bg-[var(--lkv-surface-paper)]/80"
                >
                  <div className="relative z-10">
                    <p className="text-[10px] font-mono tracking-widest text-[var(--lkv-primary)] font-bold uppercase mb-1">ESPACE DE RÉSERVE</p>
                    <h3 className="text-xl font-bold text-[var(--lkv-primary)] mb-6">Cabane du Grand Vaneau</h3>
                    
                    <div className="flex items-center gap-4 mb-8">
                      <Card variant="compact" className="flex-1 border-white/60 shadow-xs dark:border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-[var(--lkv-text-muted)] font-semibold mb-0.5">Arrivée</p>
                        <p className="text-sm font-bold text-[var(--lkv-primary)]">Ven. 24 sept.</p>
                      </Card>
                      <Card variant="compact" className="flex-1 border-white/60 shadow-xs dark:border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-[var(--lkv-text-muted)] font-semibold mb-0.5">Départ</p>
                        <p className="text-sm font-bold text-[var(--lkv-primary)]">Lun. 27 sept.</p>
                      </Card>
                    </div>

                    <div className="flex items-end justify-between mb-6">
                      <div>
                        <span className="text-2xl font-bold text-[var(--lkv-primary)]">248 €</span>
                        <span className="text-[var(--lkv-text-muted)] text-xs font-medium"> / nuit</span>
                      </div>
                      <span className="text-xs text-[var(--lkv-text-muted)] font-medium">Taxes comprises</span>
                    </div>

                    <Link href="/explorer" className="block w-full">
                      <Button variant="primary" fullWidth>
                        Découvrir ce refuge
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </section>

          {/* ── 3 WAYS TO GET LOST ── */}
          <section className="py-24 px-4 bg-transparent">
            <div className="max-w-[1200px] mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                <h2 className="text-4xl md:text-5xl font-semibold text-[var(--stone-50)] leading-[1.1]">
                  Trois façons<br />
                  <span className="font-serif italic text-[var(--lkv-forest-200)] font-normal">de se perdre.</span>
                </h2>
                <p className="text-[var(--lkv-forest-100)] text-sm max-w-sm uppercase font-mono tracking-wide leading-relaxed">
                  Trois cartes qui suivent la même règle : moins d'équipement, plus de silence. Découvrez celle qui vous ressemble aujourd'hui.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1 */}
                <div className="relative h-[480px] rounded-[var(--lkv-radius-lg)] overflow-hidden group cursor-pointer">
                  <Image 
                    src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80" 
                    alt="Chartreuse sentier des balcons" 
                    fill 
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <Badge className="bg-[var(--lkv-surface)] py-1.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">3 Jours / 50 km</Badge>
                    <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-white text-2xl font-bold leading-tight mb-2">Chartreuse<br/>sentier des balcons</h3>
                    <div className="flex gap-3 text-white/80 text-[11px] uppercase tracking-wider font-mono">
                      <span>+ 4 250 m</span>
                      <span>Niveau expert</span>
                      <span>Dormir Dehors</span>
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="relative h-[480px] rounded-[var(--lkv-radius-lg)] overflow-hidden group cursor-pointer">
                  <Image 
                    src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80" 
                    alt="Bivouac étoilé Vercors" 
                    fill 
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <Badge className="bg-[var(--lkv-surface)] py-1.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">2 Jours</Badge>
                    <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-white text-2xl font-bold leading-tight mb-2">Bivouac étoilé<br/>Vercors</h3>
                    <div className="flex gap-3 text-white/80 text-[11px] uppercase tracking-wider font-mono">
                      <span>Plateau Nord</span>
                      <span>Tente incluse</span>
                    </div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="relative h-[480px] rounded-[var(--lkv-radius-lg)] overflow-hidden group cursor-pointer">
                  <Image 
                    src="https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80" 
                    alt="Kayak Sans-Rançon" 
                    fill 
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <Badge className="bg-[var(--lkv-surface)] py-1.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">1 Jour</Badge>
                    <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-white text-2xl font-bold leading-tight mb-2">Kayak<br/>Sans-Rançon</h3>
                    <div className="flex gap-3 text-white/80 text-[11px] uppercase tracking-wider font-mono">
                      <span>Eau paisible</span>
                      <span>Gilets par OK</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── MANIFESTO ── */}
          <section className="bg-[var(--lkv-primary)] py-24 px-4 text-white">
            <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 max-w-xl">
                <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--lkv-secondary)] mb-6">NOTRE PROMESSE</p>
                <h2 className="text-4xl md:text-5xl font-semibold leading-[1.1] mb-8">
                  Un sac. Une carte.<br/>
                  Le <span className="font-serif italic text-[var(--lkv-secondary)] font-normal">reste</span> vient de<br/>
                  vous.
                </h2>
                <p className="text-white/70 text-sm leading-relaxed mb-10 max-w-md">
                  Nous testons chaque objet en conditions réelles pendant six semaines minimum. Ceux qui restent trouvent leur place dans le kit. Les autres retournent d'où ils viennent.
                </p>
                <Link href="/manifeste" className="mb-16 inline-flex">
                  <Button
                    variant="secondary"
                    icon={<Icon name="arrow-right" size={14} aria-hidden="true" />}
                    iconPosition="trailing"
                  >
                    Lire notre manifeste
                  </Button>
                </Link>

                <div className="grid grid-cols-2 gap-x-8 gap-y-12">
                  <div>
                    <p className="text-3xl font-bold mb-1">47<span className="text-[var(--lkv-secondary)] font-normal">+</span></p>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">REFUGES PARTENAIRES</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold mb-1">1,<span className="text-2xl">4</span><span className="text-[var(--lkv-secondary)] font-normal text-xl ml-1">kg</span></p>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">SAC DE BASE À SEC</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold mb-1">6<span className="text-[var(--lkv-secondary)] font-normal text-xl ml-1">sem.</span></p>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">TESTS CONDITIONS EXTRÊMES</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold mb-1">100<span className="text-[var(--lkv-secondary)] font-normal text-xl ml-1">%</span></p>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">SAUVAGE ET SANS RÉSEAU</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 w-full">
                <div className="relative rounded-[var(--lkv-radius-lg)] overflow-hidden aspect-[4/5] lg:aspect-auto lg:h-[700px]">
                  <Image
                    src="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1000&q=80"
                    alt="Montagne"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--lkv-primary)] via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-8 left-8 right-8">
                    <p className="text-[9px] font-mono tracking-widest uppercase text-[var(--lkv-secondary)] mb-2">ALPES FRANÇAISES</p>
                    <p className="text-lg font-semibold text-white">Trois jours dans la Chartreuse</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── PRODUCT HIGHLIGHT ── */}
          <section className="py-24 px-4 bg-transparent">
            <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 w-full">
                <div className="relative rounded-[var(--lkv-radius-lg)] overflow-hidden aspect-square bg-[var(--stone-200)]">
                  <Image
                    src="https://images.unsplash.com/photo-1550ed4e1b-3b47bd21096a?w=1000&q=80"
                    alt="Sac à dos en toile cirée"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <div className="absolute top-6 left-6">
                    <Badge className="bg-[var(--lkv-surface)] py-1.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur">
                      Édition artisanale
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-md">
                <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--lkv-forest-100)] mb-6">LE SAC ESSENTIEL</p>
                <h2 className="text-4xl md:text-5xl font-semibold text-[var(--stone-50)] leading-[1.1] mb-6">
                  45 L, <span className="font-serif italic text-[var(--lkv-forest-200)] font-normal">toile cirée</span>,<br/>
                  rien de superflu.
                </h2>
                <p className="text-[var(--lkv-forest-100)] text-sm leading-relaxed mb-10">
                  Trois compartiments, une toile déperlante et un point d'accroche pour tapis de sol. Fabriqué dans les Alpes-de-Haute-Provence. Réparable à vie.
                </p>

                <div className="grid grid-cols-2 gap-y-6 mb-10">
                  <div>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-[var(--lkv-forest-100)] mb-1">VOLUME</p>
                    <p className="text-sm font-semibold text-[var(--stone-50)]">45 litres</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-[var(--lkv-forest-100)] mb-1">POIDS À SEC</p>
                    <p className="text-sm font-semibold text-[var(--stone-50)]">1,4 kg</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-[var(--lkv-forest-100)] mb-1">TISSU</p>
                    <p className="text-sm font-semibold text-[var(--stone-50)]">Coton huilé 22 oz</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono tracking-widest uppercase text-[var(--lkv-forest-100)] mb-1">GARANTIE</p>
                    <p className="text-sm font-semibold text-[var(--stone-50)]">À vie</p>
                  </div>
                </div>

                <p className="text-3xl font-bold text-[var(--stone-50)] mb-8">340 €</p>

                <div className="flex items-center gap-4">
                  <Button variant="primary">
                    Ajouter au sac
                  </Button>
                  <Link href="/boutique" className="text-sm font-semibold text-[var(--stone-50)] hover:text-white transition-colors">
                    Voir la fiche
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="bg-[var(--lkv-forest-950)] pt-20 pb-10 px-4">
            <div className="max-w-[1200px] mx-auto">
              <h2 className="text-3xl md:text-4xl font-semibold text-white mb-16">
                Ce que vous emportez, <span className="font-serif italic text-[var(--lkv-secondary)] font-normal">c'est votre<br/>voyage.</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-20">
                <div className="md:col-span-1">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/50 mb-4">RECEVEZ LE JOURNAL</p>
                  <p className="text-white/70 text-xs mb-4">Un email par saison. Refuges, matériel, récit d'abris.</p>
                  <div className="flex gap-2">
                    <input type="email" placeholder="votre@email.fr" aria-label="Votre adresse email" className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--lkv-secondary)] w-full" />
                    <Button variant="primary" size="sm">S'inscrire</Button>
                  </div>
                </div>

                <div className="md:col-start-3">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/50 mb-6">DÉCOUVRIR</p>
                  <ul className="space-y-3 text-xs text-white/70">
                    <li><Link href="/explorer" className="hover:text-white transition-colors">Explorer</Link></li>
                    <li><Link href="/guides" className="hover:text-white transition-colors">Guides</Link></li>
                    <li><Link href="/communaute" className="hover:text-white transition-colors">Communauté</Link></li>
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/50 mb-6">BOUTIQUE</p>
                  <ul className="space-y-3 text-xs text-white/70">
                    <li><Link href="/boutique" className="hover:text-white transition-colors">Le sac</Link></li>
                    <li><Link href="/boutique" className="hover:text-white transition-colors">Bivouac</Link></li>
                    <li><Link href="/boutique" className="hover:text-white transition-colors">Vêtements</Link></li>
                    <li><Link href="/boutique" className="hover:text-white transition-colors">Livres & cartes</Link></li>
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/50 mb-6">MAISON</p>
                  <ul className="space-y-3 text-xs text-white/70">
                    <li><Link href="/manifeste" className="hover:text-white transition-colors">Notre méthode</Link></li>
                    <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-white/40">
                <p>© 2026 Le Kit du Voyageur · Grenoble, France</p>
                <div className="flex gap-4">
                  <Link href="/mentions-legales" className="hover:text-white">Mentions</Link>
                  <Link href="/politique-confidentialite" className="hover:text-white">Confidentialité</Link>
                  <Link href="/cookies" className="hover:text-white">Cookies</Link>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
