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
      className="fixed inset-0 h-[100dvh] w-full max-w-full overflow-hidden font-sans text-[#17402C] select-none flex flex-col"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(66px + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Fond vidéo immersif b_fait_bouger_uniqueme.mp4 */}
      <BackgroundVideo />

      {/* Interface UI & Cartes par-dessus le fond vidéo */}
      <div className="relative z-10 w-full h-full flex-1 min-h-0 flex flex-col">
        <Header />
        <div className="flex-1 min-h-0 w-full h-full flex flex-col justify-center md:pt-16">{children}</div>
      </div>

      <GlassCommand />
    </div>
  );
}
