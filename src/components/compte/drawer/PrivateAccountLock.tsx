'use client';

import React from 'react';
import './PrivateAccountLock.css';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface PrivateAccountLockProps {
  /** Nom réel fourni par le payload — jamais inventé. */
  name?: string | null;
  /** Avatar réel fourni par le payload — rendu flouté. */
  avatarUrl?: string | null;
}

const LOCK_GLYPH = (
  <LKDVIcon name="verrou" aria-hidden="true" />
);

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Extrait l'identité affichable du payload de bootstrap.
 *
 * Le payload propriétaire expose `profile.name` / `profile.avatarUrl` ; le
 * payload visiteur n'a aucune identité. Aucune valeur de remplacement n'est
 * fabriquée : un champ absent reste `null`.
 */
export function profileIdentityFromPayload(payload: unknown): {
  name: string | null;
  avatarUrl: string | null;
} {
  const root = record(payload);
  const profile = record(root?.profile) ?? root;
  return {
    name:
      text(profile?.name) ??
      text(profile?.full_name) ??
      text(profile?.fullName) ??
      text(profile?.handle),
    avatarUrl: text(profile?.avatarUrl) ?? text(profile?.avatar_url) ?? text(profile?.avatar),
  };
}

/**
 * Écran verrouillé d'un compte privé consulté sans invitation.
 *
 * Aucun slot, aucun `data-testid="slot-content"` : seul l'avatar (flouté) et
 * l'identité éventuellement connue restent visibles. La gestion des invitations
 * vit dans l'entrée propriétaire du host, jamais dans ce verrou.
 */
export function PrivateAccountLock({
  name = null,
  avatarUrl = null,
}: PrivateAccountLockProps) {
  return (
    <section className="lkdv-private-lock" aria-label="Compte privé" data-private-lock="true">
      <div className="lkdv-private-avatar" data-private-avatar="true" aria-hidden="true">
        {avatarUrl ? <img src={avatarUrl} alt="" decoding="async" /> : LOCK_GLYPH}
        <span className="lkdv-private-avatar-veil" />
      </div>
      {name ? <p className="lkdv-private-name">{name}</p> : null}
      <p className="lkdv-private-mention">Compte privé · accès sur invitation</p>
      <p className="lkdv-private-detail">
        Les slots de ce profil restent masqués tant que son propriétaire ne t’a pas invité.
      </p>
    </section>
  );
}
