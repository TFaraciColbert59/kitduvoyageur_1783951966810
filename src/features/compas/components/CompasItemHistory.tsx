'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { CompasKitLine } from '../engine/compasModel';
import { dayText, inventoryFacts, type HistoryEntry, type HistoryKind } from '../engine/itemHistory';
import { compasItemHistoryAction, type CompasHistorySource } from '../server/itemHistoryActions';
import type { CompasData } from '../server/getCompasData';

const KIND_ICON: Record<HistoryKind, string> = {
  pret: 'handshake',
  voyage: 'route',
  commande: 'shopping-bag',
};

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ok'; entries: HistoryEntry[]; unavailable: CompasHistorySource[] };

/**
 * Fiche d'un objet · « Historique » : l'état de l'objet dans l'inventaire, ses prêts, les autres
 * voyages où il est parti, les commandes du produit choisi. Lecture seule, rien de reconstitué.
 */
export function ItemHistory({
  tripId,
  line,
  data,
}: {
  tripId: string;
  line: CompasKitLine;
  data: CompasData;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const inv = line.inventoryItemId ? data.inventory.find((i) => i.id === line.inventoryItemId) : undefined;
  const facts = useMemo(() => (inv ? inventoryFacts(inv) : []), [inv]);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    compasItemHistoryAction({ tripId, itemId: line.id })
      .then((res) => {
        if (!alive) return;
        setState(
          res.success
            ? { status: 'ok', entries: res.entries, unavailable: res.unavailable }
            : { status: 'error', error: res.error }
        );
      })
      .catch(() => alive && setState({ status: 'error', error: 'Connexion perdue : réessaie.' }));
    return () => {
      alive = false;
    };
  }, [tripId, line.id, attempt]);

  return (
    <div className="cp-hist" aria-busy={state.status === 'loading'}>
      {facts.length > 0 && (
        <dl className="cp-kv">
          {facts.map((f) => (
            <FactRow key={f.label} label={f.label} value={f.value} />
          ))}
        </dl>
      )}
      {!line.inventoryItemId && (
        <p className="cp-note">
          Cet objet n’est pas relié à ton inventaire : ses prêts et ses autres voyages ne sont pas
          suivis.
        </p>
      )}
      {state.status === 'loading' && (
        <p className="cp-note" role="status">
          Lecture de l’historique…
        </p>
      )}
      {state.status === 'error' && (
        <div className="cp-note" role="alert">
          {state.error}{' '}
          <button type="button" className="cp-linkbtn" onClick={() => setAttempt((n) => n + 1)}>
            Réessayer
          </button>
        </div>
      )}
      {state.status === 'ok' && (
        <>
          {state.unavailable.length > 0 && (
            <p className="cp-note cp-note--warn" role="status">
              <Icon name="alert-triangle" size={14} aria-hidden="true" />
              <span>Lecture impossible pour : {state.unavailable.join(', ')}.</span>
            </p>
          )}
          {state.entries.length === 0 ? (
            <p className="cp-note">
              {state.unavailable.length
                ? 'Rien à montrer pour les sources lisibles.'
                : 'Aucun événement enregistré pour cet objet : ni prêt, ni autre voyage, ni commande.'}
            </p>
          ) : (
            <ul className="cp-hist__list" aria-label="Événements de l’objet">
              {state.entries.map((e) => (
                <li key={e.id} className="cp-row cp-row--tall cp-row--wrap" style={{ cursor: 'default' }}>
                  <span className="cp-hist__ic" aria-hidden="true">
                    <Icon name={KIND_ICON[e.kind]} size={16} />
                  </span>
                  <span className="cp-row__t">
                    <b>{e.title}</b>
                    {(e.date || e.detail) && (
                      <span>{[dayText(e.date), e.detail].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {line.shopProductId && (
            <Link className="cp-btn cp-btn--soft cp-btn--tap" href="/compte?tab=commandes">
              <Icon name="external-link" size={16} aria-hidden="true" />
              Voir mes commandes
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
