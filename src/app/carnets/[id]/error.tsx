'use client';

import React from 'react';
import Link from 'next/link';

/** Erreur de la fiche : coquille de la page, deux actions réelles. */
export default function CarnetError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="lkdv-feed-shell lkdv-account-glass">
      <div className="lkdv-feed-column">
        <div className="ckp-main" style={{ paddingTop: 72 }}>
          <div className="ckp-empty">
            <b>Ce carnet n’a pas pu être chargé.</b>
            <p>La lecture a échoué. Réessayez, ou revenez à la liste de vos carnets.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="ckp-pill ckp-pill--primary" onClick={reset}>
                Réessayer
              </button>
              <Link className="ckp-pill" href="/carnets">
                Mes carnets
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
