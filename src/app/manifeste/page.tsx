import { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ArrowRight, FlaskConical, Mountain, Users } from 'lucide-react';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Notre manifeste — Le Kit du Voyageur',
  description: 'Un sac. Une carte. Le reste vient de vous : notre méthode pour un équipement testé, durable et partagé.',
  alternates: {
    canonical: `${siteUrl}/manifeste`,
  },
  openGraph: {
    title: 'Notre manifeste — Le Kit du Voyageur',
    description: 'Un sac. Une carte. Le reste vient de vous : notre méthode pour un équipement testé, durable et partagé.',
    url: `${siteUrl}/manifeste`,
    type: 'website',
  },
};

const PRINCIPES = [
  {
    icone: FlaskConical,
    nom: 'Testé, pas promis',
    description: 'Nous testons chaque objet en conditions réelles pendant six semaines minimum. Ceux qui restent trouvent leur place dans le kit. Les autres retournent d’où ils viennent.',
  },
  {
    icone: Mountain,
    nom: 'Léger et sans réseau',
    description: 'Un sac de base à sec autour d’1,4 kg, pensé pour le sauvage et le hors-réseau. Le superflu ne part jamais.',
  },
  {
    icone: Users,
    nom: 'Partagé, pas possédé',
    description: 'Occasion vérifiée, location, entraide : l’équipement circule entre voyageurs au lieu de dormir dans un placard.',
  },
];

export default function ManifestePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Notre manifeste — Le Kit du Voyageur',
    description: 'Un sac. Une carte. Le reste vient de vous : notre méthode pour un équipement testé, durable et partagé.',
    url: `${siteUrl}/manifeste`,
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
              <Eyebrow>Notre promesse</Eyebrow>
              <h1 className="font-display font-bold text-4xl text-[#17402C] mt-1 mb-3">
                Un sac. Une carte. Le reste vient de vous.
              </h1>
              <p className="text-[#5A7064] max-w-2xl text-base">
                Le Kit du Voyageur est né à Grenoble, entre les massifs et les gares : aider chacun à partir mieux équipé, plus léger, et entouré.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PRINCIPES.map((principe) => (
                <GlassCard
                  key={principe.nom}
                  as="article"
                  interactive
                  tone="sage"
                  className="p-6 flex flex-col gap-4"
                >
                  <principe.icone size={22} className="text-[#17402C]" aria-hidden />
                  <h2 className="font-display font-bold text-xl text-[#17402C]">
                    {principe.nom}
                  </h2>
                  <p className="text-sm text-[#365233] leading-relaxed">{principe.description}</p>
                </GlassCard>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/boutique" className="glass-capsule-btn primary">
                <span>Voir la boutique</span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/explorer" className="glass-capsule-btn secondary">
                <span>Explorer les aventures</span>
                <ArrowRight size={14} />
              </Link>
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
              <Eyebrow>Notre promesse</Eyebrow>
              <h1 className="font-display font-bold text-[24px] tracking-tight text-[#17402C]">
                Un sac. Une carte. Le reste vient de vous.
              </h1>
            </header>

            <div className="flex flex-col gap-3">
              {PRINCIPES.map((principe) => (
                <GlassCard
                  key={principe.nom}
                  as="article"
                  interactive
                  tone="sage"
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <principe.icone size={18} className="text-[#17402C]" aria-hidden />
                    <h2 className="font-display font-bold text-[17px] text-[#17402C]">
                      {principe.nom}
                    </h2>
                  </div>
                  <p className="text-xs text-[#365233] leading-relaxed">{principe.description}</p>
                </GlassCard>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/boutique" className="glass-capsule-btn primary">
                <span>Voir la boutique</span>
                <ArrowRight size={13} />
              </Link>
              <Link href="/explorer" className="glass-capsule-btn secondary">
                <span>Explorer</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
