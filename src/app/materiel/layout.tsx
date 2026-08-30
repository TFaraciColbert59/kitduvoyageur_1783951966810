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
    <div
      data-lkv-material-theme="light"
      className="relative h-screen md:h-dvh overflow-hidden w-full max-w-full font-sans text-[#17402C] flex flex-col"
    >
      {/* Fond vidéo immersif b_fait_bouger_uniqueme.mp4 */}
      <BackgroundVideo />

      {/* Interface UI Fullscreen sur desktop — Aucun débordement possible */}
      <div className="relative z-10 w-full h-full flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 w-full h-full overflow-hidden pt-20 sm:pt-[84px] pb-2">
          {children}
        </main>
      </div>

      <GlassCommand />
    </div>
  );
}
