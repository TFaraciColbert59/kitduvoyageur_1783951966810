import { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
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
  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
            <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Guides de voyage
            </h1>
            <p className="text-foreground/60 mb-12 max-w-2xl">
              Découvrez nos guides complets pour préparer chaque aventure. Conseils d&apos;experts, checklists et équipement recommandé.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {GUIDES.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="group p-6 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all"
                >
                  <h2 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">
                    {guide.title}
                  </h2>
                  <p className="text-sm text-foreground/60">{guide.description}</p>
                </Link>
              ))}
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: '#1C2620', marginBottom: '8px' }}>
              Guides de voyage
            </h1>
            <p style={{ color: '#6B7A72', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
              Decouvrez nos guides complets pour preparer chaque aventure.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {GUIDES.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  style={{ display: 'block', padding: '16px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.06)', borderRadius: '12px', textDecoration: 'none' }}
                >
                  <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#1C2620', marginBottom: '4px' }}>
                    {guide.title}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#6B7A72' }}>{guide.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}