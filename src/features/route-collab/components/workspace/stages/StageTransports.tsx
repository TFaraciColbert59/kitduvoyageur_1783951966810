'use client';

import { useState } from 'react';
import type { CollaborativeStage, RouteOperationInput, StageTransport, StageTransportMode } from '../../../types';
import { Block, Btn, Note } from '../track/atoms';

/**
 * 10.6 Transports de la journée : aller ou retour, type, montant. Un montant vide veut dire « à estimer » : rien n'est
 * inventé et rien n'est écrit au budget du voyage tant qu'aucun montant n'est saisi (total pour le groupe).
 */
const MODES: ReadonlyArray<{ value: StageTransportMode; label: string }> = [
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'avion', label: 'Avion' },
  { value: 'voiture', label: 'Voiture' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'bateau', label: 'Bateau' },
  { value: 'autre', label: 'Autre' },
];
const MAX = 6;

type RunOperation = (op: RouteOperationInput, expectedVersions?: Record<string, number>) => unknown;

interface Row {
  readonly id: string;
  readonly direction: 'aller' | 'retour';
  readonly mode: StageTransportMode;
  /** Texte saisi ; vide = « à estimer ». */
  readonly amount: string;
  readonly currency: string;
}

const toRow = (t: StageTransport): Row => ({ id: t.id, direction: t.direction, mode: t.mode, amount: t.amount == null ? '' : String(t.amount), currency: t.currency });

export function parseAmount(text: string): number | null | 'invalid' {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return 'invalid';
  return Number(clean);
}

export function StageTransports({ stage, canEdit, runOperation }: { stage: CollaborativeStage; canEdit: boolean; runOperation: RunOperation }) {
  const [rows, setRows] = useState<Row[]>(() => (stage.transports ?? []).map(toRow));
  const [seed, setSeed] = useState(0);
  const parsed = rows.map((r) => parseAmount(r.amount));
  const invalid = parsed.includes('invalid');
  const patch = (id: string, over: Partial<Row>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...over } : r)));

  if (!canEdit && rows.length === 0) return null;
  return (
    <Block title="Transports" testId="stage-transports">
      {rows.length === 0 ? <Note>Aucun transport saisi pour cette journée.</Note> : null}
      {rows.map((r, i) => (
        <div key={r.id} className="rcw-inline-actions" data-testid={`transport-row-${i}`}>
          <select aria-label="Aller ou retour" value={r.direction} disabled={!canEdit} onChange={(e) => patch(r.id, { direction: e.target.value as Row['direction'] })}>
            <option value="aller">Aller</option>
            <option value="retour">Retour</option>
          </select>
          <select aria-label="Type de transport" value={r.mode} disabled={!canEdit} onChange={(e) => patch(r.id, { mode: e.target.value as StageTransportMode })}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Montant total pour le groupe (vide : à estimer)"
            inputMode="decimal"
            placeholder="À estimer"
            value={r.amount}
            disabled={!canEdit}
            onChange={(e) => patch(r.id, { amount: e.target.value })}
          />
          <span aria-hidden="true">€</span>
          {canEdit ? (
            <Btn ariaLabel="Retirer ce transport" onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))}>
              Retirer
            </Btn>
          ) : null}
        </div>
      ))}
      {invalid ? <Note tone="warn">Montant invalide : un nombre positif, deux décimales au plus.</Note> : null}
      <Note>Montant total pour le groupe. Laissé vide, il reste « à estimer » : rien n’est écrit au budget.</Note>
      {canEdit ? (
        <>
          <Btn
            disabled={rows.length >= MAX}
            onClick={() => {
              setRows((list) => [...list, { id: `tr-${stage.id.slice(-6)}-${seed}-${list.length}`.slice(0, 60), direction: 'aller', mode: 'train', amount: '', currency: 'EUR' }]);
              setSeed((n) => n + 1);
            }}
          >
            Ajouter un transport
          </Btn>
          <Btn
            disabled={invalid}
            testId="save-transports"
            onClick={() =>
              void runOperation(
                {
                  type: 'set_stage_transports',
                  stageId: stage.id,
                  transports: rows.map((r, i) => ({ id: r.id, direction: r.direction, mode: r.mode, amount: parsed[i] === 'invalid' ? null : (parsed[i] as number | null), currency: r.currency })),
                },
                { [stage.id]: stage.entityVersion },
              )
            }
          >
            Enregistrer les transports
          </Btn>
        </>
      ) : null}
    </Block>
  );
}
