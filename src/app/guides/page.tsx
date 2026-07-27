import { Metadata } from 'next';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Guides de voyage — Le Kit du Voyageur',
  description: 'Guides complets pour préparer vos aventures : conseils d\'experts, checklists, équipement recommandé et fiches destinations.',
  alternates: { canonical: `${siteUrl}/guides` },
  openGraph: {
    title: 'Guides de voyage — Le Kit du Voyageur',
    description: 'Guides complets pour préparer vos aventures : conseils d\'experts, checklists, équipement recommandé et fiches destinations.',
    url: `${siteUrl}/guides`,
    type: 'website',
  },
};

const GUIDES = [
  {
    slug: 'preparation-trek-montagne',
    title: 'Préparation Trek Montagne',
    description: 'Guide complet pour préparer un trek en montagne : équipement, acclimatation, sécurité.',
    category: 'Montagne',
    readTime: '12 min',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    alt: 'Randonneur avec sac à dos sur un sentier de montagne enneigé au coucher du soleil',
    featured: true,
  },
  {
    slug: 'randonnee-jour',
    title: 'Randonnée d\'une Journée',
    description: 'Tout ce qu\'il faut savoir pour une randonnée d\'une journée réussie et en sécurité.',
    category: 'Randonnée',
    readTime: '8 min',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    alt: 'Sentier de randonnée en forêt avec lumière dorée filtrant à travers les arbres',
    featured: false,
  },
  {
    slug: 'camping-bivouac',
    title: 'Camping & Bivouac',
    description: 'Guide pratique du camping et du bivouac en nature : choix du site, matériel, réglementation.',
    category: 'Bivouac',
    readTime: '10 min',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    alt: 'Tente de bivouac installée sur un plateau herbeux avec vue sur les montagnes au crépuscule',
    featured: false,
  },
  {
    slug: 'voyager-leger',
    title: 'Voyager Ultraléger',
    description: 'Réduire son sac à moins de 7 kg sans sacrifier le confort. Techniques et sélection.',
    category: 'Ultralight',
    readTime: '15 min',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    alt: 'Sac à dos ultraléger posé sur un rocher avec panorama montagneux en arrière-plan',
    featured: true,
  },
  {
    slug: 'trek-nepal',
    title: 'Trek au Népal',
    description: 'La liste d\'équipement complète pour l\'Everest Base Camp, Annapurna et Langtang.',
    category: 'Destinations',
    readTime: '18 min',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80',
    alt: 'Randonneurs avec sacs à dos sur un sentier de montagne au Népal avec vue sur l\'Himalaya',
    featured: false,
  },
  {
    slug: 'filtration-eau',
    title: 'Filtration d\'Eau en Randonnée',
    description: 'Sawyer vs Katadyn vs LifeStraw : comparatif des solutions de filtration d\'eau.',
    category: 'Équipement',
    readTime: '9 min',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
    alt: 'Filtre à eau Katadyn utilisé dans un ruisseau de montagne cristallin',
    featured: false,
  },
];

export default function GuidesPage() {
  const featured = GUIDES.filter((g) => g.featured);
  const rest = GUIDES.filter((g) => !g.featured);

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Guides de voyage — Le Kit du Voyageur',
    url: `${siteUrl}/guides`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Guides de voyage
          </h1>
          <p className="text-foreground/60 mb-12 max-w-2xl">
            Découvrez nos guides complets pour préparer chaque aventure. Conseils d&apos;experts, checklists et équipement recommandé.
          </p>

        {/* Hero */}
        <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
          <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80')" }} />
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <a href="/" className="hover:text-white transition-colors">Accueil</a>
              <span>/</span>
              <span style={{ color: '#E4501C' }}>Guides</span>
            </nav>
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Bibliothèque de guides</p>
            <h1 className="font-display text-5xl md:text-6xl text-white mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
              Guides de<br /><em>voyage.</em>
            </h1>
            <p className="text-white/60 text-lg max-w-xl mb-10">
              Conseils d&apos;experts, checklists et équipement recommandé pour chaque aventure.
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-8 pt-8 border-t border-white/10">
              {[{ v: `${GUIDES.length}`, l: 'Guides disponibles' }, { v: '3', l: 'Catégories' }, { v: 'Gratuit', l: 'Accès libre' }].map((s) => (
                <div key={s.l}>
                  <p className="font-mono text-2xl font-700 text-white">{s.v}</p>
                  <p className="text-xs text-white/40 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Featured guides */}
          {featured.length > 0 && (
            <section className="mb-16">
              <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>À la une</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featured.map((guide) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block">
                    <article className="relative overflow-hidden rounded-2xl" style={{ height: 320 }}>
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url('${guide.image}')` }}
                      />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.9) 0%, rgba(28,38,32,0.2) 60%, transparent 100%)' }} />
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-700 text-white" style={{ background: '#E4501C' }}>
                          {guide.category}
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <h2 className="font-display text-xl text-white mb-2 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
                          {guide.title}
                        </h2>
                        <p className="text-white/70 text-sm line-clamp-2 mb-3">{guide.description}</p>
                        <div className="flex items-center gap-3 text-white/50 text-xs font-mono">
                          <span>{guide.readTime} de lecture</span>
                          <span className="flex items-center gap-1 text-white/70 group-hover:text-white transition-colors">
                            Lire le guide →
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* All guides grid */}
          <section>
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>Tous les guides</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((guide) => (
                <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block">
                  <article className="rounded-2xl overflow-hidden transition-all duration-300 group-hover:shadow-xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                    <div className="relative overflow-hidden" style={{ height: 180 }}>
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url('${guide.image}')` }}
                      />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.5) 0%, transparent 60%)' }} />
                      <div className="absolute top-3 left-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-white" style={{ background: 'rgba(28,38,32,0.7)' }}>
                          {guide.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h2 className="font-display font-700 text-lg mb-2 transition-colors group-hover:text-[#4A6741]" style={{ fontFamily: 'var(--font-display)', color: '#1C2620' }}>
                        {guide.title}
                      </h2>
                      <p className="text-sm mb-4 line-clamp-2" style={{ color: '#5C6B5E' }}>{guide.description}</p>
                      <div className="flex items-center justify-between text-xs font-mono" style={{ color: '#7A7A6E' }}>
                        <span>{guide.readTime} de lecture</span>
                        <span className="transition-colors group-hover:text-[#4A6741]">Lire →</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mt-16 rounded-2xl p-10 text-center" style={{ background: '#1C2620' }}>
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: '#4A6741' }}>Configurateur IA</p>
            <h2 className="font-display text-3xl text-white mb-3" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
              Votre kit personnalisé<br />en 3 minutes.
            </h2>
            <p className="text-white/60 mb-6 max-w-md mx-auto">Notre IA analyse votre destination et génère une liste d&apos;équipement optimisée pour votre profil.</p>
            <Link
              href="/configurateur"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: '#4A6741' }}
            >
              Configurer mon kit →
            </Link>
          </section>
        </main>

        <NewFooterSection />
      </div>
    </>
  );
}