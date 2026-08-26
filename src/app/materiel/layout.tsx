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
    <div data-lkv-material-theme="light" className="min-h-screen relative font-sans text-[#17402C]">
      {/* Fond vidéo immersif b_fait_bouger_uniqueme.mp4 */}
      <BackgroundVideo />

      {/* Interface UI & Cartes par-dessus le fond vidéo */}
      <div className="relative z-10">
        <Header />
        <div className="pt-2 md:pt-20">{children}</div>
      </div>

      <GlassCommand />
    </div>
  );
}
