'use client';
import { useState, type CSSProperties } from 'react';
import { COLORWAYS, MODULE_IDS, ONE, ZONE_NAMES } from '../../domain/catalog';
import type { CapacityZoneId, ModuleId } from '../../domain/catalog';
import { canAddModule, ptsCap, ptsUsed, toggleModule } from '../../domain/attach';
import type { AttachHost } from '../../domain/attach';
import { formatEuro, formatLitres, formatWeight } from '../../domain/format';
import { colorwaySwatch } from '../../domain/palette';
import { modOn, pieceCw, pieceInfo, pieceState } from '../../domain/parts';
import { bagWeight, capOf, totalCap, totals } from '../../domain/totals';
import { currentBag, currentKit } from '../../domain/state';
import type { KitState, PieceKey } from '../../domain/types';
import { Pager } from '../Drawer/Pager';
import { Icon } from '../icons';
import './sheets.css';

const ZONES: readonly CapacityZoneId[] = ['lid', 'main', 'front', 'sides', 'hip', 'back'];

const TXT = {
  label: 'Sac',
  pages: ['Sac', 'Configuration', 'Lignée'],
  configTitle: 'Configuration ONE',
  chassis: 'Châssis ONE',
  emptyBag: 'à vide',
  onBody: 'points sur le corps',
  own: 'À toi',
  preordered: 'Précommandé',
  toOrder: 'À commander',
  noRoom: 'Plus de place sur l’attache',
  host: { chassis: 'le châssis', corps: 'le corps' },
  refusal: 'Plus de points d’attache libres sur',
  refusalHint: 'Retire un module pour en clipser un autre.',
  customise: 'Personnaliser',
  order: 'Voir la commande',
  lineageTitle: 'Lignée du kit',
  origin: 'Kit d’origine, créé par toi.',
  from: 'Repris de',
  adaptedBy: 'adapté par toi.',
  generation: 'Génération',
  proven: 'Éprouvé sur le terrain',
  times: 'fois.',
  shared: 'Partagé, il pourra être repris par d’autres : chaque version garde la trace de la précédente.',
} as const;

export const BAG_PAGE_LABELS: readonly string[] = TXT.pages;

const NB = ' ';
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

interface BagSheetProps {
  state: KitState;
  onChange: (next: KitState) => void;
  /** Ouvre la feuille Commande (bouton de la page Configuration). */
  onOpenOrder?: () => void;
  /** Ouvre le mode Apparence (bouton « Personnaliser »). */
  onCustomise?: () => void;
  page?: number;
  onPageChange?: (page: number) => void;
}

function stateText(state: KitState, key: PieceKey): string {
  const s = pieceState(state, key);
  return s === 'own' ? TXT.own : s === 'order' ? TXT.preordered : `${TXT.toOrder} · ${formatEuro(pieceInfo(key).eur * 100)}`;
}

function Pts({ state, host }: { state: KitState; host: AttachHost }) {
  const cap = ptsCap(state, host);
  const used = ptsUsed(state, host);
  return (
    <span className="ks-sh-pts" role="img" aria-label={`${used} points d’attache utilisés sur ${cap}`}>
      {Array.from({ length: cap }, (_, i) => (
        <i key={i} data-on={i < used} />
      ))}
    </span>
  );
}

/** Feuille Sac / Pièce : capacités, configuration et modules avec points d’attache, lignée. Contrôlée. */
export function BagSheet({ state, onChange, onOpenOrder, onCustomise, page, onPageChange }: BagSheetProps) {
  const [own, setOwn] = useState(0);
  const [refusal, setRefusal] = useState<string | null>(null);
  const p = page ?? own;
  const setPage = (n: number) => {
    setOwn(n);
    onPageChange?.(n);
  };

  const kit = currentKit(state);
  const bag = currentBag(state);
  const t = totals(state);
  const sw = (cw: keyof typeof COLORWAYS) => colorwaySwatch(COLORWAYS[cw]);

  const onToggle = (m: ModuleId, on: boolean) => {
    if (on && !modOn(state, m) && !canAddModule(state, m)) {
      setRefusal(`${ONE.mods[m].n} : ${TXT.refusal} ${TXT.host[ONE.mods[m].host]}. ${TXT.refusalHint}`);
      return;
    }
    setRefusal(null);
    onChange(toggleModule(state, m, on));
  };

  const modRow = (m: ModuleId) => {
    const M = ONE.mods[m];
    const on = modOn(state, m);
    const blocked = !on && !canAddModule(state, m);
    const key: PieceKey = `mod:${m}`;
    const ps = pieceState(state, key);
    const price = ps === 'own' ? TXT.own.toLowerCase() : ps === 'order' ? TXT.preordered.toLowerCase() : formatEuro(M.eur * 100);
    return (
      <li className="ks-sh-row" key={m}>
        <span className="ks-sh-rg" data-on={on}>
          <Icon name="cube" />
        </span>
        <span className="ks-sh-txt">
          <b>{M.n}</b>
          <small>{blocked ? TXT.noRoom : `${plural(M.pts, 'point')} · ${price}`}</small>
        </span>
        <label className="ks-sw">
          <input
            type="checkbox"
            role="switch"
            checked={on}
            aria-disabled={blocked}
            aria-label={M.n}
            onChange={(e) => onToggle(m, e.target.checked)}
          />
          <i />
          <b />
        </label>
      </li>
    );
  };

  const capacity = (
    <>
      <div className="ks-sh-hero">
        <span className="ks-sh-big">{formatLitres(totalCap(state))}</span>
        <span className="ks-sh-t13">{`${bag.n} · ${formatWeight(bagWeight(state))} ${TXT.emptyBag}`}</span>
      </div>
      <div className="ks-sh-cap">
        {ZONES.map((z) => {
          const v = t.volumeByZone[z] ?? 0;
          const c = capOf(state, z);
          const pct = c ? Math.min(100, (v / c) * 100) : v ? 100 : 0;
          return (
            <div key={z}>
              <span>{ZONE_NAMES[z]}</span>
              <i style={{ '--p': `${pct.toFixed(0)}%`, '--c': v > c ? 'var(--ks-warn)' : 'var(--ks-green)' } as CSSProperties} />
              <b>{`${formatLitresPlain(v)} / ${formatLitresPlain(c)}${NB}L`}</b>
            </div>
          );
        })}
      </div>
    </>
  );

  const config = (
    <>
      <div className="ks-sh-ph">
        <span className="ks-sh-t17">{TXT.configTitle}</span>
        <span className="ks-sh-t13">{`${ptsUsed(state, 'corps')}/${ptsCap(state, 'corps')} ${TXT.onBody}`}</span>
      </div>
      <div className="ks-sh-plist">
        <div>
          <i style={{ background: sw(pieceCw(state, 'chassis')).trim }} />
          <span>
            <b>{TXT.chassis}</b>
            <small>{stateText(state, 'chassis')}</small>
          </span>
        </div>
        <div>
          <i style={{ background: sw(pieceCw(state, `corps:${kit.bag}`)).body }} />
          <span>
            <b>{bag.n}</b>
            <small>{stateText(state, `corps:${kit.bag}`)}</small>
          </span>
        </div>
      </div>
      <ul className="ks-sh-rows" aria-label={TXT.configTitle} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {MODULE_IDS.map(modRow)}
      </ul>
      {refusal && (
        <p className="ks-sh-msg" role="alert">
          {refusal}
        </p>
      )}
      <div className="ks-sh-acts">
        {onCustomise && (
          <button type="button" className="ks-quiet" onClick={onCustomise}>
            {TXT.customise}
          </button>
        )}
        {onOpenOrder && (
          <button type="button" className="ks-gbtn" onClick={onOpenOrder}>
            {TXT.order}
          </button>
        )}
      </div>
      <div className="ks-sh-row">
        <span className="ks-sh-txt">
          <b>{`${ptsUsed(state, 'chassis')}/${ptsCap(state, 'chassis')} · ${TXT.host.chassis}`}</b>
        </span>
        <Pts state={state} host="chassis" />
      </div>
      <div className="ks-sh-row">
        <span className="ks-sh-txt">
          <b>{`${ptsUsed(state, 'corps')}/${ptsCap(state, 'corps')} · ${TXT.host.corps}`}</b>
        </span>
        <Pts state={state} host="corps" />
      </div>
    </>
  );

  const L = kit.lineage;
  const lineage = (
    <>
      <span className="ks-sh-t17">{TXT.lineageTitle}</span>
      <div className="ks-sh-lin">
        <div className="ks-sh-chain" aria-hidden="true">
          {Array.from({ length: L.gen }, (_, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <em />}
              <span data-me={i === L.gen - 1}>{i + 1}</span>
            </span>
          ))}
        </div>
        <p className="ks-sh-t13">
          {L.from ? `${TXT.from}${NB}« ${L.from} », ${TXT.adaptedBy}` : TXT.origin}
          {` ${TXT.generation} ${L.gen}. ${TXT.proven} ${L.proven}${NB}${TXT.times}`}
        </p>
        <p className="ks-sh-t13">{TXT.shared}</p>
      </div>
    </>
  );

  return <Pager pages={[capacity, config, lineage]} page={p} onPageChange={setPage} label={TXT.label} />;
}

function formatLitresPlain(l: number): string {
  return l.toLocaleString('fr-FR', { minimumFractionDigits: l < 10 ? 1 : 0, maximumFractionDigits: l < 10 ? 1 : 0 });
}
