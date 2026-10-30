'use client';

import React from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';

/**
 * État affiché quand le drawer est ouvert sans session valide.
 *
 * Les trois drawers lisent des données strictement personnelles : sans
 * session, aucune requête n'est lancée et l'écran propose une connexion au
 * lieu d'une erreur générique « Impossible de charger ».
 */
export function DrawerAuthRequired({
  title = 'Connecte-toi pour retrouver tes données',
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="lkdv-drawer-auth" role="status">
      <span className="lkdv-drawer-auth-ico" aria-hidden="true">
        <ShieldCheck size={22} />
      </span>
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      <a className="lkdv-drawer-auth-cta" href="/connexion?redirect=/compte">
        <LogIn size={15} aria-hidden="true" /> Se connecter
      </a>
    </div>
  );
}

export default DrawerAuthRequired;
