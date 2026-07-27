import React from 'react';
import Link from 'next/link';

const columns = [
  {
    title: 'LE CARNET',
    content: 'Le journal privé de vos voyages. Un carnet par traversée, alimenté par ce que vous avez préparé dans les groupes.',
    type: 'text' as const,
  },
  {
    title: 'EXPLORER',
    type: 'links' as const,
    links: [
      { label: 'Vue chronologique', href: '/carnets' },
      { label: 'Par massif', href: '/carnets?view=massif' },
      { label: 'Par saison', href: '/carnets?view=saison' },
      { label: 'Statistiques', href: '/carnets?view=stats' },
    ],
  },
  {
    title: 'DÉCOUVRIR',
    type: 'links' as const,
    links: [
      { label: 'Aventures', href: '/explorer' },
      { label: 'Boutique', href: '/boutique' },
      { label: 'Groupes', href: '/groupes' },
      { label: 'Communauté', href: '/communaute' },
    ],
  },
  {
    title: 'MAISON',
    type: 'links' as const,
    links: [
      { label: 'Notre méthode', href: '/a-propos' },
      { label: 'Export & sauvegarde', href: '/export' },
      { label: 'Archives', href: '/carnets' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

export default function CarnetFooter() {
  return (
    <footer className="bg-[#141E1A] text-[#E7E3D6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-20">
        {/* Title */}
        <div className="mb-14">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Ce que vous emportez,{' '}
            <em className="font-serif italic text-[#E7E3D6]/60">c&apos;est votre voyage.</em>
          </h2>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
          {columns.map((col, i) => (
            <div key={i}>
              <h3 className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#E7E3D6]/40 mb-4">{col.title}</h3>
              {col.type === 'text' ? (
                <p className="text-sm text-[#E7E3D6]/50 leading-relaxed font-sans">{col.content}</p>
              ) : (
                <ul className="space-y-2.5">
                  {col.links!.map((link, j) => (
                    <li key={j}>
                      <Link href={link.href} className="text-sm text-[#E7E3D6]/50 hover:text-[#E7E3D6] transition-colors font-sans">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Bottom line */}
        <div className="border-t border-[#E7E3D6]/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[10px] text-[#E7E3D6]/30 tracking-wider">© 2026 Le Kit du Voyageur — Grenoble, France</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="font-mono text-[10px] text-[#E7E3D6]/30 hover:text-[#E7E3D6]/60 transition-colors">Mentions</Link>
            <Link href="/politique-confidentialite" className="font-mono text-[10px] text-[#E7E3D6]/30 hover:text-[#E7E3D6]/60 transition-colors">Confidentialité</Link>
            <Link href="/cookies" className="font-mono text-[10px] text-[#E7E3D6]/30 hover:text-[#E7E3D6]/60 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
