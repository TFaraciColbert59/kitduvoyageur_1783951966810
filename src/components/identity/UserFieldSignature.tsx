'use client';

/**
 * USER FIELD SIGNATURE — affichage réutilisable de l'empreinte (ADR-010, Lot C.4)
 * ===============================================================================
 * Rendu = sceau + texte descriptif. À poser UNIQUEMENT là où une identité a du
 * sens (en-tête /compte, auteur de lignée dans KitSheet, feed, fiche membre) —
 * JAMAIS dans une liste triée, JAMAIS à côté d'un chiffre comparatif.
 *
 * Respecte le consentement via /api/identity/signature : si non autorisé ou
 * sous le plancher → rien d'embarrassant (label neutre), aucune coordonnée.
 */

import React, { useEffect, useState } from 'react';
import FieldSeal from './FieldSeal';
import { Spinner } from '@/components/ui';
import type { FieldSignatureRow } from '@/features/identity/fieldSignature';

interface UserFieldSignatureProps {
  userId: string;
  /** taille de l'avatar */
  sealSize?: number;
  ariaLabel?: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'empty'; label: string }
  | { kind: 'ok'; sig: FieldSignatureRow; text: string };

export default function UserFieldSignature({ userId, sealSize = 40, ariaLabel }: UserFieldSignatureProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/identity/signature?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.signature) {
          setState({ kind: 'ok', sig: data.signature, text: data.text ?? '' });
        } else {
          setState({ kind: 'empty', label: data?.label ?? 'pas encore d’empreinte' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'empty', label: 'pas encore d’empreinte' });
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (state.kind === 'loading') {
    return (
      <span className="inline-flex items-center gap-[var(--space-2)] text-[color:var(--lkv-text-muted)]" role="status">
        <Spinner size="sm" label="" />
        <span className="text-[length:var(--lkv-text-caption)]" aria-live="polite">…</span>
      </span>
    );
  }

  if (state.kind === 'empty') {
    return (
      <span className="inline-flex items-center gap-[var(--space-2)] text-[color:var(--lkv-text-muted)]">
        <FieldSeal userId={userId} size={Math.min(sealSize, 32)} />
        <span className="text-[length:var(--lkv-text-caption)] italic">{state.label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-[var(--space-2)]">
      <FieldSeal userId={userId} signature={state.sig} size={sealSize} ariaLabel={ariaLabel} />
      <span className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-forest-600)]">{state.text}</span>
    </span>
  );
}