'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LifecycleHost } from '@/components/compte/lifecycle/LifecycleHost';

/**
 * Surface dédiée au cycle de vie des séances (lot A02).
 *
 * Elle réutilise le contrat livré dans `src/features/activity/lifecycle/` et
 * les routes `/api/activities/lifecycle/*`. Aucun drawer existant n'est
 * modifié : cette page est le point d'entrée autonome du lot.
 */
export default function CompteActivitesPage() {
  const { user, loading } = useAuth();

  return (
    <main className="lkv-life" style={{ minHeight: '100dvh', background: 'var(--lkv-surface)' }}>
      {loading ? (
        <div className="lkv-life__page" role="status" aria-live="polite">
          <p className="lkv-life__sub">Chargement de ton historique…</p>
        </div>
      ) : user ? (
        <LifecycleHost userId={user.id} />
      ) : (
        <div className="lkv-life__page">
          <div className="lkv-life__empty">
            <strong>Connexion requise</strong>
            <p>Connecte-toi pour consulter et gérer l’historique de tes séances.</p>
          </div>
        </div>
      )}
    </main>
  );
}
