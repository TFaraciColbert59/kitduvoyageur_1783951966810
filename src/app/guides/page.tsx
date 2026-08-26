import { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { GlassCard } from '@/components/ui/GlassCard';
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
  return (
    <>
      {/* ── DESKTOP ── fullscreen, scroll interne */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-[#FAF8F5]" data-lkv-material-theme="light">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
            <div className="mb-8">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#5A7064] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                GUIDES &amp; CHECKLISTS
              </p>
              <h1 className="font-display font-bold text-3xl tracking-tight text-[#17402C]">
                Guides de voyage
              </h1>
              <p className="mt-1.5 text-sm text-[#5A7064] max-w-2xl">
                Découvrez nos guides complets pour préparer chaque aventure. Conseils d&apos;experts, checklists et équipement recommandé.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {GUIDES.map((guide) => (
                <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block h-full">
                  <GlassCard as="article" tone="sage" interactive className="p-6 flex flex-col justify-between gap-4 h-full">
                    <div>
                      <h2 className="font-display font-bold text-xl text-[#17402C] mb-2 group-hover:text-[#365233] transition-colors">
                        {guide.title}
                      </h2>
                      <p className="text-sm text-[#365233]">{guide.description}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A7064] transition-colors group-hover:text-[#17402C]">
                      Lire le guide →
                    </span>
                  </GlassCard>
                </Link>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: '#17402C', marginBottom: '8px' }}>
              Guides de voyage
            </h1>
            <p style={{ color: '#5A7064', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
              Decouvrez nos guides complets pour preparer chaque aventure.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {GUIDES.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  style={{ display: 'block', padding: '16px', background: '#F4F1EA', border: '1px solid rgba(23,64,44,0.08)', borderRadius: '12px', textDecoration: 'none' }}
                >
                  <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#17402C', marginBottom: '4px' }}>
                    {guide.title}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#5A7064' }}>{guide.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
