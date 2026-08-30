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
      className="relative min-h-[100dvh] md:h-dvh md:overflow-hidden w-full max-w-full font-sans text-[#17402C] flex flex-col"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Fond vidéo immersif */}
      <BackgroundVideo />

      {/* Interface UI Fullscreen sur desktop */}
      <div className="relative z-10 w-full flex-1 flex flex-col overflow-hidden md:pt-14">
        <Header />
        <main className="flex-1 w-full flex flex-col overflow-hidden">{children}</main>
      </div>

      <GlassCommand />
    </div>
  );
}
