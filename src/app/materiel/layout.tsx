import type { Metadata } from 'next';
import Header from '@/components/Header';
import { BackgroundVideo } from '@/components/materiel/BackgroundVideo';
import { GlassCommand } from '@/components/ui/GlassCommand';

export const metadata: Metadata = {
  title: 'Mon Matériel — Le Kit du Voyageur',
  description:
    'Pilotez votre équipement : kits, inventaire, alertes de fiabilité, disponibilité des prêts et préparation de départ.',
};

export default function MaterielLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-lkv-material-theme="light" className="min-h-screen relative">
      <BackgroundVideo />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[60vh]"
        style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(226,235,222,0.55), transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        <Header />
        <div className="pt-20">{children}</div>
      </div>
      <GlassCommand />
    </div>
  );
}
