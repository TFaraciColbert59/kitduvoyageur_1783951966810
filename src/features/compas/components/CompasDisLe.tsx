'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { planApplication, type CompasProposal } from '../engine/intent';
import { compasClearStartSayAction, compasInterpretAction } from '../server/compasActions';
import { applyCurrent, inverseOps, runOps } from './compasApply';
import type { CompasCtl } from './compasTypes';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; proposals: CompasProposal[]; usedAi: boolean; note: string | null };

/**
 * « Dis-le » (maquette v8, en bas de chaque tiroir) : une phrase devient des
 * actions proposées. L'IA traduit, le moteur vérifie, l'utilisateur coche puis
 * applique. Rien n'est écrit sans ce dernier geste.
 *
 * `initial` : la phrase tapée dans le champ « Dis-le » de la carte Où. Le
 * tiroir s'ouvre avec elle et la fait comprendre une fois, sans rien appliquer.
 */
export function DisLe({
  ctl,
  initial,
  before,
  after,
  initialIsStart = false,
}: {
  ctl: CompasCtl;
  initial?: string;
  /** Maquette finale : « Retour » et « Suivant » encadrent le champ. */
  before?: ReactNode;
  after?: ReactNode;
  /** `initial` est la phrase du Compas vide, gardée sur le voyage jusqu'à son application. */
  initialIsStart?: boolean;
}) {
  const [text, setText] = useState(initial ?? '');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await interpret(text);
  };

  const interpret = async (raw: string, autoApply = false) => {
    const phrase = raw.trim();
    if (phrase.length < 2) return;
    setState({ status: 'loading' });
    try {
      const res = await compasInterpretAction({ tripId: ctl.data.model.tripId, text: phrase });
      if (!res.success) {
        setState({ status: 'error', error: res.error });
        return;
      }
      setState({ status: 'done', proposals: res.proposals, usedAi: res.usedAi, note: res.note });
      if (res.proposals.length) ctl.enlarge();
      setChecked(Object.fromEntries(res.proposals.map((p) => [p.id, p.ok])));
      // Phrase du départ : écrite directement (annulable), sans « Appliquer ».
      if (autoApply) {
        const ok = res.proposals.filter((p) => p.ok);
        const applied = ok.length ? await apply(ok) : true;
        // Gardée sur le voyage tant qu'elle n'est pas écrite : une coupure ou un
        // départ de la page la laisse en place, reprise à la prochaine ouverture.
        if (applied && initialIsStart)
          void compasClearStartSayAction({ tripId: ctl.data.model.tripId }).catch(() => undefined);
      }
    } catch {
      setState({ status: 'error', error: 'Connexion perdue : réessaie.' });
    }
  };

  // La phrase venue de la carte est comprise une seule fois, à l'ouverture.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !initial) return;
    asked.current = true;
    void interpret(initial, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const reset = () => {
    setState({ status: 'idle' });
    setChecked({});
  };

  const proposals = state.status === 'done' ? state.proposals : [];
  const chosen = proposals.filter((p) => p.ok && checked[p.id]);

  const apply = async (list: CompasProposal[] = chosen): Promise<boolean> => {
    const ops = planApplication(
      list.map((p) => p.action),
      applyCurrent(ctl)
    );
    const route = ops.find((o) => o.op === 'route');
    const writes = ops.filter((o) => o.op !== 'route');
    let ok = true;
    if (writes.length) {
      const n = list.filter((p) => p.action.type !== 'search_route').length;
      const undo = inverseOps(ctl, writes);
      ok = await ctl.run(
        `${n} changement${n > 1 ? 's' : ''} appliqué${n > 1 ? 's' : ''}`,
        () => runOps(ctl, writes),
        undo ? () => runOps(ctl, undo) : undefined
      );
    }
    if (!ok) return false;
    setText('');
    reset();
    if (route && route.op === 'route') {
      ctl.replace({ kind: 'step', step: 'ou', flow: 'parcours', hint: { query: route.query } });
    }
    return true;
  };

  return (
    <div className="cp-disle">
      {state.status === 'done' && (
        <div className="cp-disle__out" aria-live="polite">
          {proposals.length === 0 ? (
            <p className="cp-note">
              Rien de précis à appliquer dans cette phrase. Essaie : « 3 jours à 4, départ samedi,
              bivouac ».
            </p>
          ) : (
            <ul className="cp-props">
              {proposals.map((p) => (
                <li key={p.id}>
                  <label className="cp-prop" data-ok={p.ok ? '1' : undefined}>
                    <input
                      type="checkbox"
                      checked={Boolean(checked[p.id]) && p.ok}
                      disabled={!p.ok}
                      onChange={(e) => setChecked((c) => ({ ...c, [p.id]: e.target.checked }))}
                    />
                    <span className="cp-prop__t">{p.label}</span>
                    {p.source === 'ia' && (
                      <span className="cp-prop__ai" aria-label="Compris par l’IA">
                        <Icon name="sparkles" size={12} />
                      </span>
                    )}
                    {p.reason && <span className="cp-prop__why">{p.reason}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="cp-sub">
            {state.usedAi
              ? 'Compris par l’IA, vérifié par le Compas.'
              : (state.note ?? 'Lu par les règles du Compas.')}
          </p>
          <div className="cp-actions">
            <button type="button" className="cp-btn cp-btn--soft" onClick={reset}>
              Effacer
            </button>
            {chosen.length > 0 && (
              <button
                type="button"
                className="cp-btn cp-btn--pg cp-btn--block"
                disabled={ctl.busy}
                onClick={() => void apply()}
              >
                <Icon name="check" size={16} />
                Appliquer ({chosen.length})
              </button>
            )}
          </div>
        </div>
      )}
      {state.status === 'error' && (
        <p className="cp-note" role="alert">
          {state.error}
        </p>
      )}
      <div className="cp-disle__row">
        {before}
        <form className="cp-disle__in cp-glass" onSubmit={submit}>
          <Icon name="sparkles" size={15} />
          <label className="sr-only" htmlFor="cp-disle-input">
            Dis-le
          </label>
          <input
            id="cp-disle-input"
            value={text}
            maxLength={280}
            autoComplete="off"
            placeholder="Dis-le…"
            title="Par exemple : « 3 jours à 4, départ samedi »"
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="cp-ibtn cp-ibtn--sm cp-ibtn--pg"
            aria-label="Comprendre la phrase"
            disabled={state.status === 'loading' || text.trim().length < 2}
            aria-busy={state.status === 'loading'}
          >
            <Icon name={state.status === 'loading' ? 'clock' : 'send'} size={14} />
          </button>
        </form>
        {after}
      </div>
    </div>
  );
}
