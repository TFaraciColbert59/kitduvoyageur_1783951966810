import { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Kits de voyage prêts à partir — Le Kit du Voyageur',
  description: 'Découvrez nos kits de voyage complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.',
  alternates: {
    canonical: `${siteUrl}/kits`,
  },
  openGraph: {
    title: 'Kits de voyage prêts à partir — Le Kit du Voyageur',
    description: 'Découvrez nos kits de voyage complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.',
    url: `${siteUrl}/kits`,
    type: 'website',
  },
};

const KITS = [
  {
    slug: 'islande-trek',
    nom: 'Kit Islande — Trek & Volcans',
    description: 'Équipement complet pour affronter les conditions extrêmes islandaises',
  },
  {
    slug: 'gr20-corse',
    nom: 'Kit GR20 — Corse Intégrale',
    description: 'Le kit optimisé pour le GR20, l\'un des sentiers les plus exigeants d\'Europe',
  },
  {
    slug: 'vanlife-europe',
    nom: 'Kit Vanlife — Europe',
    description: 'Tout ce qu\'il faut pour vivre et dormir dans son van à travers l\'Europe',
  },
];

export default function KitsPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Kits de voyage prêts à partir — Le Kit du Voyageur',
    description: 'Découvrez nos kits de voyage complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.',
    url: `${siteUrl}/kits`,
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
        name: 'Kits',
        item: `${siteUrl}/kits`,
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
              Kits de voyage
            </h1>
            <p className="text-foreground/60 mb-12 max-w-2xl">
              Découvrez nos kits complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {KITS.map((kit) => (
                <Link
                  key={kit.slug}
                  href={`/kits/${kit.slug}`}
                  className="group p-6 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all"
                >
                  <h2 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">
                    {kit.nom}
                  </h2>
                  <p className="text-sm text-foreground/60">{kit.description}</p>
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
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              Kits de voyage
            </h1>
            <p style={{ fontSize: '14px', color: '#6B7A72', marginBottom: '24px', lineHeight: '1.5' }}>
              Découvrez nos kits complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {KITS.map((kit) => (
                <Link
                  key={kit.slug}
                  href={`/kits/${kit.slug}`}
                  style={{
                    display: 'block',
                    padding: '16px',
                    background: '#F4F1EA',
                    border: '1px solid rgba(11,31,23,0.06)',
                    borderRadius: '16px',
                    textDecoration: 'none',
                  }}
                >
                  <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#1C2620', marginBottom: '6px' }}>
                    {kit.nom}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#6B7A72', lineHeight: '1.4' }}>{kit.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
