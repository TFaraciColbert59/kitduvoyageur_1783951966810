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
      <span className="inline-flex items-center gap-2 text-[#5A7064]" role="status">
        <span className="w-5 h-5 border-2 border-[#17402C]/30 border-t-[#17402C] rounded-full animate-spin" />
        <span className="text-xs" aria-live="polite">…</span>
      </span>
    );
  }

  if (state.kind === 'empty') {
    return (
      <span className="inline-flex items-center gap-2 text-[#5A7064]">
        <FieldSeal userId={userId} size={Math.min(sealSize, 32)} />
        <span className="text-xs" style={{ fontStyle: 'italic' }}>{state.label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <FieldSeal userId={userId} signature={state.sig} size={sealSize} ariaLabel={ariaLabel} />
      <span className="text-sm text-[#365233]">{state.text}</span>
    </span>
  );
}