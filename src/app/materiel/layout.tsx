import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mon Matériel — Le Kit du Voyageur',
  description:
    'Pilotez votre équipement : kits, inventaire, alertes de fiabilité, disponibilité des prêts et préparation de départ.',
};

export default function MaterielLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-lkv-material-theme="light" className="min-h-screen bg-[color:var(--bg-primary)]">
      {children}
    </div>
  );
}
