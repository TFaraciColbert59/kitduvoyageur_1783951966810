import { Metadata } from 'next';
import Icon from '@/components/ui/Icon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { Backpack, Recycle, KeyRound } from 'lucide-react';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Boutique — Le Kit du Voyageur',
  description:
    'Kits prêts à partir, occasion vérifiée et location : l’équipement testé en conditions réelles.',
  alternates: {
    canonical: `${siteUrl}/boutique`,
  },
  openGraph: {
    title: 'Boutique — Le Kit du Voyageur',
    description:
      'Kits prêts à partir, occasion vérifiée et location : l’équipement testé en conditions réelles.',
    url: `${siteUrl}/boutique`,
    type: 'website',
  },
};

const RAYONS = [
  {
    href: '/kits',
    icone: Backpack,
    nom: 'Kits prêts à partir',
    description:
      'Le sac, le bivouac, les vêtements : des kits complets, testés six semaines minimum en conditions réelles.',
  },
  {
    href: '/occasion',
    icone: Recycle,
    nom: 'Occasion vérifiée',
    description:
      'Du matériel de seconde main contrôlé par la communauté. Moins cher, moins de CO₂, même exigence.',
  },
  {
    href: '/location',
    icone: KeyRound,
    nom: 'Location',
    description: 'Un besoin ponctuel ? Louez l’équipement pour la durée exacte de votre aventure.',
  },
];

const CTA_CLASS =
  'inline-flex min-h-[var(--control-height-md)] items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-5)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)] transition-transform hover:brightness-[1.05] active:scale-[var(--motion-press-scale)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] motion-reduce:transition-none';

export default function BoutiquePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Boutique — Le Kit du Voyageur',
    description:
      'Kits prêts à partir, occasion vérifiée et location : l’équipement testé en conditions réelles.',
    url: `${siteUrl}/boutique`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Le Kit du Voyageur',
      url: siteUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />

      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div data-lkv-material-theme="light" className="relative h-dvh overflow-hidden">
          <Header />
          <main className="mx-auto h-full max-w-[var(--page-max-w)] overflow-y-auto px-4 pb-20 pt-24 sm:px-6 lg:px-8">
            <PageHeader variant="large" className="mb-[var(--space-3)]" title="La boutique" />
            <p className="mb-[var(--space-8)] max-w-2xl text-[length:var(--lkv-text-body)] text-[color:var(--lkv-text-primary)]">
              Chaque objet est testé en conditions réelles pendant six semaines minimum. Ceux qui
              restent trouvent leur place ici.
            </p>

            <div className="grid grid-cols-1 gap-[var(--space-6)] md:grid-cols-2 lg:grid-cols-3">
              {RAYONS.map((rayon) => (
                <Card
                  key={rayon.href}
                  as="article"
                  variant="interactive"
                  tone="sage"
                  className="flex flex-col justify-between gap-[var(--space-4)] p-[var(--space-6)]"
                >
                  <div className="space-y-[var(--space-2)]">
                    <rayon.icone size={22} className="text-[color:var(--lkv-primary)]" aria-hidden />
                    <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">{rayon.nom}</h2>
                    <p className="text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">{rayon.description}</p>
                  </div>

                  <div className="flex items-center justify-end border-t border-[color:var(--lkv-border)] pt-[var(--space-2)]">
                    <Link href={rayon.href} className={CTA_CLASS}>
                      <span>Explorer</span>
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
          <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-3)] pb-24 pt-[var(--space-3)]">
            <PageHeader variant="large" title="La boutique" />

            <p className="text-[length:var(--lkv-text-caption)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-primary)]">
              Chaque objet est testé en conditions réelles pendant six semaines minimum. Ceux qui
              restent trouvent leur place ici.
            </p>

            <div className="flex flex-col gap-[var(--space-3)]">
              {RAYONS.map((rayon) => (
                <Card
                  key={rayon.href}
                  as="article"
                  variant="interactive"
                  tone="sage"
                  className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
                >
                  <div className="flex items-center gap-[var(--space-2)]">
                    <rayon.icone size={18} className="text-[color:var(--lkv-primary)]" aria-hidden />
                    <h2 className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-primary)]">
                      {rayon.nom}
                    </h2>
                  </div>
                  <p className="text-[length:var(--lkv-text-caption)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">{rayon.description}</p>

                  <div className="flex items-center justify-end pt-[var(--space-1)]">
                    <Link href={rayon.href} className={CTA_CLASS}>
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
