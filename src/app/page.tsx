'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import MobileHomeRedirect from '@/components/mobile-nav/MobileHomeRedirect';

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
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
    <div className="min-h-screen bg-[#F7FAF8] font-sans text-[#1C2620]">
      <Header />
      
      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col pt-32 px-4 pb-12 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E4EFE8] via-[#F7FAF8] to-white" />
          <div className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_left,rgba(148,182,161,0.15),transparent_50%)]" />
        </div>

        <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-20 flex-1">
          {/* Left Text */}
          <div className="flex-1 max-w-2xl pt-10">
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#7A8A7D] mb-4">ÉDITION AUTOMNE - ET REFUGES PARTENAIRES</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-[#1C2620] leading-[1.1] mb-6">
              Là où la carte<br />
              <span className="font-serif italic text-[#8BAF7C] font-normal">se termine.</span>
            </h1>
            <p className="text-[#5A6A5D] text-base lg:text-lg mb-10 max-w-md leading-relaxed">
              Refuges bruts, sentiers oubliés, matériel choisi à la main. Le Kit du Voyageur assemble ce qu'il faut, exactement, pour partir léger — sans rien laisser au hasard.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
              <Link
                href="/ai-configurator"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-[#1C2620] font-semibold rounded-full hover:bg-gray-50 transition-all shadow-sm border border-[#E8E4D8] text-sm"
              >
                Composer mon sac 
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <Link
                href="/explorer"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-[#5A6A5D] font-medium rounded-full hover:bg-black/5 transition-all text-sm"
              >
                Voir les aventures
              </Link>
            </div>
            
            {/* Reviews */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[#D9B382]">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="text-3xl font-bold text-[#1C2620] leading-none ml-1">4,9</span>
              </div>
              <p className="text-[10px] uppercase font-mono tracking-widest text-[#7A8A7D] leading-tight">
                1 350+ VOYAGEURS RECOMMANDENT<br/>LEUR SÉJOUR
              </p>
            </div>
          </div>

          {/* Right Card */}
          <div className="w-full max-w-[340px] flex-shrink-0">
            <div className="bg-[#1C2620]/5 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl shadow-black/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10" />
              <div className="relative z-10">
                <p className="text-[9px] font-mono tracking-widest text-[#5A6A5D] uppercase mb-1">ESPACE DE RÉSERVE</p>
                <h3 className="text-xl font-bold text-[#1C2620] mb-6">Cabane du Grand Vaneau</h3>
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 bg-white/50 rounded-xl p-3 border border-white/40">
                    <p className="text-[9px] uppercase tracking-widest text-[#7A8A7D] mb-0.5">Arrivée</p>
                    <p className="text-sm font-semibold text-[#1C2620]">Ven. 24 sept.</p>
                  </div>
                  <div className="flex-1 bg-white/50 rounded-xl p-3 border border-white/40">
                    <p className="text-[9px] uppercase tracking-widest text-[#7A8A7D] mb-0.5">Départ</p>
                    <p className="text-sm font-semibold text-[#1C2620]">Lun. 27 sept.</p>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-6">
                  <div>
                    <span className="text-2xl font-bold text-[#1C2620]">248 €</span>
                    <span className="text-[#7A8A7D] text-xs"> / nuit</span>
                  </div>
                  <span className="text-[10px] text-[#5A6A5D]">Taxes comprises</span>
                </div>

                <Link href="/explorer" className="block w-full text-center py-3.5 bg-white text-[#1C2620] font-semibold rounded-full shadow-sm hover:shadow-md transition-all text-sm border border-[#E8E4D8]">
                  Réserver cet abri
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 WAYS TO GET LOST ── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-semibold text-[#1C2620] leading-[1.1]">
              Trois façons<br />
              <span className="font-serif italic text-[#2D5A3D] font-normal">de se perdre.</span>
            </h2>
            <p className="text-[#7A8A7D] text-sm max-w-sm uppercase font-mono tracking-wide leading-relaxed">
              Trois cartes qui suivent la même règle : moins d'équipement, plus de silence. Découvrez celle qui vous ressemble aujourd'hui.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 */}
            <div className="relative h-[480px] rounded-3xl overflow-hidden group cursor-pointer">
              <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80" alt="Chartreuse" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-[#1C2620] tracking-wide uppercase">3 Jours / 50 km</span>
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
            <div className="relative h-[480px] rounded-3xl overflow-hidden group cursor-pointer">
              <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80" alt="Vercors" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-[#1C2620] tracking-wide uppercase">2 Jours</span>
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
            <div className="relative h-[480px] rounded-3xl overflow-hidden group cursor-pointer">
              <img src="https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80" alt="Kayak" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-[#1C2620] tracking-wide uppercase">1 Jour</span>
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
      <section className="bg-[#1C2620] py-24 px-4 text-white">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 max-w-xl">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[#8BAF7C] mb-6">NOTRE PROMESSE</p>
            <h2 className="text-4xl md:text-5xl font-semibold leading-[1.1] mb-8">
              Un sac. Une carte.<br/>
              Le <span className="font-serif italic text-[#8BAF7C] font-normal">reste</span> vient de<br/>
              vous.
            </h2>
            <p className="text-white/70 text-sm leading-relaxed mb-10 max-w-md">
              Nous testons chaque objet en conditions réelles pendant six semaines minimum. Ceux qui restent trouvent leur place dans le kit. Les autres retournent d'où ils viennent.
            </p>
            <Link
              href="/manifeste"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1C2620] font-semibold rounded-full hover:bg-gray-200 transition-all text-sm mb-16"
            >
              Lire notre manifeste
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>

            <div className="grid grid-cols-2 gap-x-8 gap-y-12">
              <div>
                <p className="text-3xl font-bold mb-1">47<span className="text-[#8BAF7C] font-normal">+</span></p>
                <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">REFUGES PARTENAIRES</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">1,<span className="text-2xl">4</span><span className="text-[#8BAF7C] font-normal text-xl ml-1">kg</span></p>
                <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">SAC DE BASE À SEC</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">6<span className="text-[#8BAF7C] font-normal text-xl ml-1">sem.</span></p>
                <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">TESTS CONDITIONS EXTRÊMES</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">100<span className="text-[#8BAF7C] font-normal text-xl ml-1">%</span></p>
                <p className="text-[9px] font-mono tracking-widest uppercase text-white/50">SAUVAGE ET SANS RÉSEAU</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/5] lg:aspect-auto lg:h-[700px]">
              <img src="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1000&q=80" alt="Montagne" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C2620] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-8 left-8 right-8">
                <p className="text-[9px] font-mono tracking-widest uppercase text-[#8BAF7C] mb-2">ALPES FRANÇAISES</p>
                <p className="text-lg font-semibold text-white">Trois jours dans la Chartreuse</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT HIGHLIGHT ── */}
      <section className="py-24 px-4 bg-[#F7FAF8]">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 w-full">
            <div className="relative rounded-3xl overflow-hidden aspect-square bg-[#E8E4D8]">
              <img src="https://images.unsplash.com/photo-1550ed4e1b-3b47bd21096a?w=1000&q=80" alt="Sac à dos en toile cirée" className="w-full h-full object-cover" />
              <div className="absolute top-6 left-6">
                <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-bold text-[#1C2620] tracking-wide uppercase shadow-sm">
                  Édition artisanale
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-md">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[#7A8A7D] mb-6">LE SAC ESSENTIEL</p>
            <h2 className="text-4xl md:text-5xl font-semibold text-[#1C2620] leading-[1.1] mb-6">
              45 L, <span className="font-serif italic text-[#2D5A3D] font-normal">toile cirée</span>,<br/>
              rien de superflu.
            </h2>
            <p className="text-[#5A6A5D] text-sm leading-relaxed mb-10">
              Trois compartiments, une toile déperlante et un point d'accroche pour tapis de sol. Fabriqué dans les Alpes-de-Haute-Provence. Réparable à vie.
            </p>

            <div className="grid grid-cols-2 gap-y-6 mb-10">
              <div>
                <p className="text-[9px] font-mono tracking-widest uppercase text-[#7A8A7D] mb-1">VOLUME</p>
                <p className="text-sm font-semibold text-[#1C2620]">45 litres</p>
              </div>
              <div>
                <p className="text-[9px] font-mono tracking-widest uppercase text-[#7A8A7D] mb-1">POIDS À SEC</p>
                <p className="text-sm font-semibold text-[#1C2620]">1,4 kg</p>
              </div>
              <div>
                <p className="text-[9px] font-mono tracking-widest uppercase text-[#7A8A7D] mb-1">TISSU</p>
                <p className="text-sm font-semibold text-[#1C2620]">Coton huilé 22 oz</p>
              </div>
              <div>
                <p className="text-[9px] font-mono tracking-widest uppercase text-[#7A8A7D] mb-1">GARANTIE</p>
                <p className="text-sm font-semibold text-[#1C2620]">À vie</p>
              </div>
            </div>

            <p className="text-3xl font-bold text-[#1C2620] mb-8">340 €</p>

            <div className="flex items-center gap-4">
              <button className="px-8 py-3.5 bg-[#1C2620] text-white font-semibold rounded-full hover:bg-[#2D3F35] transition-all text-sm shadow-sm">
                Ajouter au sac
              </button>
              <Link href="/boutique" className="text-sm font-semibold text-[#1C2620] hover:text-[#2D5A3D] transition-colors">
                Voir la fiche
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#131B16] pt-20 pb-10 px-4">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-16">
            Ce que vous emportez, <span className="font-serif italic text-[#8BAF7C] font-normal">c'est votre<br/>voyage.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-20">
            <div className="md:col-span-1">
              <p className="text-[10px] font-mono tracking-widest uppercase text-white/50 mb-4">RECEVEZ LE JOURNAL</p>
              <p className="text-white/70 text-xs mb-4">Un email par saison. Refuges, matériel, récit d'abris.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="votre@email.fr" className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#8BAF7C] w-full" />
                <button className="bg-[#8BAF7C] text-[#131B16] px-4 py-2 rounded-full text-xs font-bold hover:bg-white transition-colors">S'inscrire</button>
              </div>
            </div>

            <div className="md:col-start-3">
              <p className="text-[10px] font-mono tracking-widest uppercase text-white/50 mb-6">DÉCOUVRIR</p>
              <ul className="space-y-3 text-xs text-white/70">
                <li><Link href="/explorer" className="hover:text-white transition-colors">Aventures</Link></li>
                <li><Link href="/pays" className="hover:text-white transition-colors">Earth</Link></li>
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
                <li><Link href="/ateliers" className="hover:text-white transition-colors">Ateliers</Link></li>
                <li><Link href="/presse" className="hover:text-white transition-colors">Presse</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-white/40">
            <p>© 2026 Le Kit du Voyageur · Grenoble, France</p>
            <div className="flex gap-4">
              <Link href="/mentions-legales" className="hover:text-white">Mentions</Link>
              <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
              <Link href="/cookies" className="hover:text-white">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobileHomeRedirect />
      </div>
    </>
  );
}
