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
      <div className="relative z-10">
        <Header />
        <div className="pt-20">{children}</div>
      </div>
      <GlassCommand />
    </div>
  );
}
