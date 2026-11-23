'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { provenanceOf } from '../../../entry';
import { loginHrefForRoute } from '../../../guestDraft';
import { useRouteWorkspace } from '../WorkspaceContext';
import { useRouteEntry } from '../start/RouteEntryContext';

/**
 * Pastilles d'entrée au-dessus de la carte : provenance du tracé (1.8), rattachement au voyage (1.1) et
 * connexion au dernier moment (1.7). Chacune dit un fait ; aucune ne bloque le tracé.
 */
export function EntryChips() {
  const { workspace, shareToken } = useRouteWorkspace();
  const entry = useRouteEntry();
  const prov = useMemo(() => provenanceOf(workspace), [workspace]);
  const attached = entry.trip != null;
  return (
    <div className="rcw-entry-stack" data-testid="entry-chips">
      {prov.kind !== 'empty' ? (
        <span className="rcw-chip" data-testid="provenance-badge" data-kind={prov.kind}>
          {prov.label}
          {prov.edited ? ' · retouché' : ''}
        </span>
      ) : null}
      {!attached && !shareToken ? (
        entry.authenticated && entry.requestAttach ? (
          <button
            type="button"
            className="rcw-chip rcw-chip--action"
            data-testid="attach-trip-banner"
            aria-label="Rattacher à un voyage"
            onClick={entry.requestAttach}
          >
            Rattacher<span className="rcw-chip-more"> à un voyage</span>
          </button>
        ) : (
          <Link
            href={entry.authenticated ? '/compas/itineraire' : loginHrefForRoute(null)}
            className="rcw-chip rcw-chip--action"
            data-testid="attach-trip-banner"
            aria-label="Rattacher à un voyage"
          >
            Rattacher<span className="rcw-chip-more"> à un voyage</span>
          </Link>
        )
      ) : null}
      {!entry.authenticated && !shareToken ? (
        <Link
          href={loginHrefForRoute(entry.trip?.tripId ?? null)}
          className="rcw-chip rcw-chip--action"
          data-testid="login-to-save"
          aria-label="Se connecter pour enregistrer"
        >
          Se connecter<span className="rcw-chip-more"> pour enregistrer</span>
        </Link>
      ) : null}
      {entry.saveNote && entry.authenticated ? (
        <span className="rcw-chip rcw-chip--warn" data-testid="save-note" role="status">
          {entry.saveNote}
        </span>
      ) : null}
    </div>
  );
}
