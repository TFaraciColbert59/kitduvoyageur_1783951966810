'use client';

import React from 'react';

export interface CommunityShellProps {
  /** Capsule d'identité (rendue par `AppShell` dans son slot `header`). */
  header?: React.ReactNode;
  /** Carte héro en verre. */
  hero?: React.ReactNode;
  /** Capsule 48 px des espaces (ou tout autre sélecteur de même grammaire). */
  tabs?: React.ReactNode;
  children: React.ReactNode;
  /** Capsule secondaire 30 px, positionnée en bas à droite du contenu. */
  floating?: React.ReactNode;
  className?: string;
}

/**
 * Coquille visuelle de la Communauté.
 *
 * Elle ne crée **aucun** conteneur de scroll : `AppShell` reste le seul
 * (`DESIGN_SYSTEM.md:108`). Elle ne fait que peindre la couche immersive
 * (fond + voile) et la colonne de contenu, avec les mêmes rayons et les mêmes
 * surfaces que le Compte.
 *
 * Aucune couleur littérale : le fond et le voile sont définis dans
 * `src/styles/community-social.css` sous `.lkdv-immersive`, à partir des
 * tokens `--lkv-*` et `--glass-*`.
 */
export function CommunityShell({
  header,
  hero,
  tabs,
  children,
  floating,
  className = '',
}: CommunityShellProps) {
  return (
    <div className={`lkdv-immersive ${className}`.trim()}>
      <div className="lkdv-immersive-veil" aria-hidden="true" />

      <div className="lkdv-immersive-column">
        {header ? <div className="lkdv-immersive-identity">{header}</div> : null}
        {hero ? <div className="lkdv-immersive-hero">{hero}</div> : null}
        {tabs ? <div className="lkdv-immersive-tabs">{tabs}</div> : null}
        <div className="lkdv-immersive-stage">{children}</div>
        {floating ?? null}
      </div>
    </div>
  );
}

export default CommunityShell;
