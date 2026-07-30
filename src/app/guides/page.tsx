import { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Guides de voyage — Le Kit du Voyageur',
  description: 'Guides complets pour préparer vos aventures : conseils d\'experts, checklists, équipement recommandé et fiches destinations.',
  alternates: {
    canonical: `${siteUrl}/guides`,
  },
  openGraph: {
    title: 'Guides de voyage — Le Kit du Voyageur',
    description: 'Guides complets pour préparer vos aventures : conseils d\'experts, checklists, équipement recommandé et fiches destinations.',
    url: `${siteUrl}/guides`,
    type: 'website',
  },
};

const GUIDES = [
  { slug: 'preparation-trek-montagne', title: 'Préparation Trek Montagne', description: 'Guide complet pour préparer un trek en montagne' },
  { slug: 'randonnee-jour', title: 'Randonnée d\'une Journée', description: 'Tout ce qu\'il faut savoir pour une randonnée d\'une journée' },
  { slug: 'camping-bivouac', title: 'Camping & Bivouac', description: 'Guide pratique du camping et du bivouac en nature' },
];

export default function GuidesPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Guides de voyage — Le Kit du Voyageur',
    description: 'Guides complets pour préparer vos aventures : conseils d\'experts, checklists, équipement recommandé et fiches destinations.',
    url: `${siteUrl}/guides`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Le Kit du Voyageur',
      url: siteUrl,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides',
        item: `${siteUrl}/guides`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        suppressHydrationWarning
      />

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