import { Metadata } from 'next';
import Icon from '@/components/ui/Icon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Kits de voyage prêts à partir — Le Kit du Voyageur',
  description:
    'Découvrez nos kits de voyage complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.',
  alternates: {
    canonical: `${siteUrl}/kits`,
  },
  openGraph: {
    title: 'Kits de voyage prêts à partir — Le Kit du Voyageur',
    description:
      'Découvrez nos kits de voyage complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.',
    url: `${siteUrl}/kits`,
    type: 'website',
  },
};

const KITS = [
  {
    slug: 'islande-trek',
    nom: 'Kit Islande — Trek & Volcans',
    description: 'Équipement complet pour affronter les conditions extrêmes islandaises',
    weight: '14.2 kg',
    itemsCount: 18,
  },
  {
    slug: 'gr20-corse',
    nom: 'Kit GR20 — Corse Intégrale',
    description: "Le kit optimisé pour le GR20, l'un des sentiers les plus exigeants d'Europe",
    weight: '11.8 kg',
    itemsCount: 15,
  },
  {
    slug: 'vanlife-europe',
    nom: 'Kit Vanlife — Europe',
    description: "Tout ce qu'il faut pour vivre et dormir dans son van à travers l'Europe",
    weight: '22.5 kg',
    itemsCount: 24,
  },
];

export default function KitsPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Kits de voyage prêts à partir — Le Kit du Voyageur',
    description:
      'Découvrez nos kits de voyage complets et optimisés pour chaque destination. Équipement sélectionné, testé et prêt à partir.',
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
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden relative">
          <Header />
          <main className="h-full overflow-y-auto max-w-[var(--page-max-w)] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
            <PageHeader variant="large" className="mb-3" title="Kits de voyage" />
            <p className="mb-8 max-w-2xl text-base text-[#CCE0D4]">
              Découvrez nos kits complets et optimisés pour chaque destination. Équipement
              sélectionné, testé et prêt à partir.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {KITS.map((kit) => (
                <Card
                  key={kit.slug}
                  as="article"
                  variant="interactive"
                  tone="sage"
                  className="p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <h2 className="font-display font-bold text-xl text-[var(--lkv-primary)]">{kit.nom}</h2>
                    <p className="text-sm text-[var(--lkv-forest-600)] leading-relaxed">{kit.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/20">
                    <span className="text-xs font-mono font-medium text-[var(--lkv-text-muted)]">
                      {kit.weight} · {kit.itemsCount} articles
                    </span>
                    <Link href={`/kits/${kit.slug}`} className="glass-capsule-btn secondary">
                      <span>Voir le kit</span>
                      <Icon name="arrow-right" size={14} />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE (COCKPIT LIQUID GLASS) ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="px-3 pt-3 pb-24 flex flex-col gap-4">
            <PageHeader
              variant="large"
              title="Kits de voyage"
              back={
                <Link
                  href="/hub"
                  className="glass interactive h-7.5 px-3 rounded-full flex items-center text-xs font-semibold text-[var(--lkv-primary)] border border-white/40 shadow-inner"
                >
                  ← Matériel
                </Link>
              }
            />

            <p className="text-xs text-[#CCE0D4] leading-relaxed">
              Kits complets et optimisés pour chaque destination. Équipement sélectionné, testé et
              prêt à partir.
            </p>

            <div className="flex flex-col gap-3">
              {KITS.map((kit) => (
                <Card
                  key={kit.slug}
                  as="article"
                  variant="interactive"
                  tone="sage"
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display font-bold text-[17px] text-[var(--lkv-primary)]">{kit.nom}</h2>
                  </div>
                  <p className="text-xs text-[var(--lkv-forest-600)] leading-relaxed">{kit.description}</p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-mono text-[var(--lkv-text-muted)]">
                      {kit.weight} · {kit.itemsCount} articles
                    </span>
                    <Link href={`/kits/${kit.slug}`} className="glass-capsule-btn primary">
                      <span>Explorer</span>
                      <Icon name="arrow-right" size={13} />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
