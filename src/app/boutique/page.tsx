import { Metadata } from 'next';
import Icon from '@/components/ui/Icon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
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
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden relative">
          <Header />
          <main className="h-full overflow-y-auto max-w-[var(--page-max-w)] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
            <header className="mb-8">
              <Eyebrow>Boutique</Eyebrow>
              <h1 className="font-display font-bold text-4xl text-[var(--lkv-primary)] mt-1 mb-3">
                La boutique
              </h1>
              <p className="text-[var(--lkv-text-muted)] max-w-2xl text-base">
                Chaque objet est testé en conditions réelles pendant six semaines minimum. Ceux qui
                restent trouvent leur place ici.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {RAYONS.map((rayon) => (
                <Card
                  key={rayon.href}
                  as="article"
                  variant="interactive"
                  tone="sage"
                  className="p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <rayon.icone size={22} className="text-[var(--lkv-primary)]" aria-hidden />
                    <h2 className="font-display font-bold text-xl text-[var(--lkv-primary)]">{rayon.nom}</h2>
                    <p className="text-sm text-[var(--lkv-forest-600)] leading-relaxed">{rayon.description}</p>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-white/20">
                    <Link href={rayon.href} className="glass-capsule-btn secondary">
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
          <div className="px-3 pt-3 pb-24 flex flex-col gap-4">
            <header>
              <Eyebrow>Boutique</Eyebrow>
              <h1 className="font-display font-bold text-[24px] tracking-tight text-[var(--lkv-primary)]">
                La boutique
              </h1>
            </header>

            <p className="text-xs text-[var(--lkv-text-muted)] leading-relaxed">
              Chaque objet est testé en conditions réelles pendant six semaines minimum. Ceux qui
              restent trouvent leur place ici.
            </p>

            <div className="flex flex-col gap-3">
              {RAYONS.map((rayon) => (
                <Card
                  key={rayon.href}
                  as="article"
                  variant="interactive"
                  tone="sage"
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <rayon.icone size={18} className="text-[var(--lkv-primary)]" aria-hidden />
                    <h2 className="font-display font-bold text-[17px] text-[var(--lkv-primary)]">
                      {rayon.nom}
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--lkv-forest-600)] leading-relaxed">{rayon.description}</p>

                  <div className="flex items-center justify-end pt-1">
                    <Link href={rayon.href} className="glass-capsule-btn primary">
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
