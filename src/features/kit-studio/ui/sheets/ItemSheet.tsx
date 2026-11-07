'use client';
import { useState, type CSSProperties } from 'react';
import { ZONE_NAMES } from '../../domain/catalog';
import { formatEuro, formatLitres, formatWeight } from '../../domain/format';
import { unpack } from '../../domain/packing';
import { RAW_MATERIALS } from '../../domain/palette';
import { studioData } from '../../domain/studioData';
import { currentKit, getItem, zoneOf } from '../../domain/state';
import { addPlanned, altsFor, swapItem } from '../../domain/swap';
import { effG, toCents } from '../../domain/totals';
import type { AnyItemId, KitState } from '../../domain/types';
import { Capsule } from '../Drawer/Capsule';
import { Pager } from '../Drawer/Pager';
import { Strip } from '../Drawer/Strip';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { S } from '../strings';
import './bilan.css';

const NB = ' ';
const KNOWN: readonly IconName[] = ['bag', 'cube', 'bottle', 'jacket', 'aid', 'tent', 'compass', 'bolt', 'cart', 'weight', 'cal', 'clock', 'swap', 'link'];

/** Pictogramme d'un objet : le glyphe du catalogue s'il existe dans la bibliothèque d'icônes, sinon un cube. */
export const glyphOf = (gl: string): IconName => (KNOWN.includes(gl as IconName) ? (gl as IconName) : 'cube');

/** Texte lisible (encre ou blanc) sur une teinte de matière « #rrggbb ». */
export function onSwatch(color: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) return 'var(--ks-ink)';
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? 'var(--ks-ink)' : 'var(--ks-white)';
}

/** Intention que l'état seul ne peut exprimer (le coordinateur connaît la zone courante). */
export type ItemIntent = { type: 'pack'; id: AnyItemId };

interface ItemSheetProps {
  state: KitState;
  itemId: AnyItemId;
  page: number;
  onPage: (page: number) => void;
  onAction: (next: KitState | ItemIntent) => void;
  /** Bouton grille : retour à l'inventaire. */
  onBack: () => void;
}

const stateText = (it: NonNullable<ReturnType<typeof getItem>>): string => {
  const p = it as { planned?: string };
  return it.state === 'lent' ? S.item.lent : it.expired ? S.item.expired : it.care ? S.item.care : p.planned === 'shop' ? S.item.shop : p.planned === 'rent' ? S.item.rent : S.item.good;
};

/** Fiche objet : mesures, notes, Retirer/Mettre, Échanger, Histoire. Contrôlée, sans requête. */
export function ItemSheet({ state, itemId, page, onPage, onAction, onBack }: ItemSheetProps) {
  const [menu, setMenu] = useState(false);
  const it = getItem(state, itemId);
  if (!it) return null;
  const k = currentKit(state);
  const z = zoneOf(state, itemId);
  const ex = it as { planned?: 'shop' | 'rent'; eur?: number; day?: number };
  const fam = studioData().families.find((f) => f.id === it.fam)?.n ?? '';
  const color = RAW_MATERIALS[it.color];
  const fg = onSwatch(color);
  const alts = z ? altsFor(state, itemId) : [];
  const goto = (i: number) => {
    setMenu(false);
    onPage(i);
  };
  const remove = () => {
    setMenu(false);
    onAction(unpack(state, itemId));
  };
  const put = () => {
    setMenu(false);
    onAction({ type: 'pack', id: itemId });
  };
  const noPackBtn = it.state === 'lent';

  const notes = [
    it.temp,
    it.state === 'lent' ? `Chez ${it.lentTo}, retour le ${it.until}.` : '',
    it.expired ? `Périmée depuis ${it.expired}.` : '',
    it.care ?? '',
    it.loc && it.loc !== 'Lille' && !ex.planned ? `${S.item.location}${NB}: ${it.loc}${k.start === it.loc ? ', ton point de départ.' : '.'}` : '',
    ex.planned === 'shop' ? `Boutique LKDV · ${formatEuro(toCents(ex.eur ?? 0))}` : '',
    ex.planned === 'rent' ? `Location entre membres · ${formatEuro(toCents(ex.day ?? 0))} par jour` : '',
    (it.g as number | null | undefined) == null ? S.item.unknownWeight : '',
  ].filter(Boolean);

  const measures: readonly [string, string][] = [
    [(it.g as number | null | undefined) == null ? '—' : formatWeight(effG(state, it)), S.item.weight],
    [formatLitres(it.L || 0), S.item.volume],
    [z ? ZONE_NAMES[z] : '—', S.item.storage],
    [stateText(it), S.item.condition],
    [it.trips ? String(it.trips) : '—', S.item.trips],
    [it.loc || '—', S.item.location],
  ];

  const menuItems: { t: string; neg?: boolean; run: () => void }[] = [];
  if (z) menuItems.push({ t: S.item.swap, run: () => goto(1) });
  menuItems.push({ t: S.item.history, run: () => goto(z ? 2 : 1) });
  if (z) menuItems.push({ t: S.item.removeFromBag, neg: true, run: remove });
  else if (!noPackBtn) menuItems.push({ t: S.item.addToBag, run: put });

  const fiche = (
    <>
      <div className="ks-bl-head">
        <span className="ks-bl-ig" style={{ background: color, color: fg }}>
          <Icon name={glyphOf(it.gl)} />
        </span>
        <div>
          <span className="ks-bl-t17">{it.n}</span>
          <span className="ks-bl-t13">{`${fam}${fam ? ' · ' : ''}${z ? ZONE_NAMES[z] : 'pas dans ce sac'}`}</span>
        </div>
        <button type="button" className="ks-bl-more" aria-label={S.bilan.more} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          …
        </button>
        {menu && (
          <div className="ks-bl-menu" role="menu">
            {menuItems.map((m) => (
              <button key={m.t} type="button" role="menuitem" data-neg={m.neg ? 'true' : undefined} onClick={m.run}>
                {m.t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ks-bl-metrics" role="list">
        {measures.map(([v, l]) => (
          <div className="ks-bl-m" role="listitem" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      {notes.length > 0 && <p className="ks-bl-t13">{notes.join(' ')}</p>}
      {z ? (
        <button type="button" className="ks-bl-btn" data-neg="true" onClick={remove}>
          {S.item.removeFromBag}
        </button>
      ) : (
        !noPackBtn && (
          <button type="button" className="ks-bl-btn" onClick={put}>
            {S.item.addToBag}
          </button>
        )
      )}
    </>
  );

  const doSwap = (a: (typeof alts)[number]) => {
    if (a.kind === 'own') {
      onAction(swapItem(state, itemId, a.e.id));
      return;
    }
    const added = addPlanned(state, a.e, it);
    onAction(swapItem(added.state, itemId, added.id));
  };

  const delta = (d: number | null) => (d == null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${formatWeight(Math.abs(d))}`);

  const swap = (
    <>
      <span className="ks-bl-t17">{S.item.swap}</span>
      {alts.length ? (
        <>
          <div className="ks-bl-altgrid">
            {alts.slice(0, 6).map((a) => {
              const c = RAW_MATERIALS[a.e.color];
              const tag = a.kind === 'own' ? (a.e.state === 'lent' ? S.item.lent : 'À toi') : a.e.src === 'rent' ? S.item.rent : S.item.shop;
              return (
                <button key={a.e.id} type="button" className="ks-bl-alt" data-kind={a.kind} onClick={() => doSwap(a)}>
                  <span className="gl" style={{ background: c, color: onSwatch(c) }}>
                    <Icon name={glyphOf(a.e.gl)} />
                  </span>
                  <span className="an">{a.e.n}</span>
                  <span className="ad" data-down={a.d != null && a.d < 0}>
                    {delta(a.d)}
                  </span>
                  <span className="at">{tag}</span>
                </button>
              );
            })}
          </div>
          <p className="ks-bl-t13">{S.item.swapHint}</p>
        </>
      ) : (
        <p className="ks-bl-t13">{S.item.noEquivalent}</p>
      )}
    </>
  );

  const price = (it as { price?: number }).price;
  const row = (tone: string, icon: IconName, title: string, sub: string) => (
    <div className="ks-bl-row">
      <span className="ks-bl-rg" data-tone={tone}>
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </div>
  );
  const history = (
    <>
      <span className="ks-bl-t17">{S.item.history}</span>
      <div className="ks-bl-rows">
        {row('ok', 'compass', it.trips ? `${it.trips} sorties avec toi` : S.item.notRecorded, it.trips ? 'Chaque sortie enregistrée ajoute une ligne ici.' : 'Il prendra vie à ta première sortie.')}
        {row(
          'info',
          'cube',
          it.bought ? `Acheté en ${it.bought}` : ex.planned ? 'Pas encore à toi' : 'Date d’achat inconnue',
          price ? `${formatEuro(toCents(price))}${it.trips ? ` · ${formatEuro(toCents(price / it.trips))} par sortie` : ''}` : 'Ajoute le ticket pour suivre la garantie.',
        )}
        {row(it.care || it.expired ? 'warn' : 'ok', it.expired ? 'aid' : 'jacket', it.expired ? 'À renouveler' : it.care ? 'Entretien conseillé' : 'Rien à prévoir', it.expired ? `Périmée depuis ${it.expired}.` : (it.care ?? 'Aucune date d’entretien ni de péremption proche.'))}
      </div>
    </>
  );

  const pages = z ? [fiche, swap, history] : [fiche, history];
  const caps = z
    ? [
        { id: '0', label: S.item.title, icon: <Icon name="info" /> },
        { id: '1', label: S.item.swap, icon: <Icon name="swap" /> },
        { id: '2', label: S.item.history, icon: <Icon name="clock" /> },
      ]
    : [
        { id: '0', label: S.item.title, icon: <Icon name="info" /> },
        { id: '1', label: S.item.history, icon: <Icon name="clock" /> },
      ];
  const cur = Math.min(page, pages.length - 1);

  return (
    <>
      <Pager pages={pages} page={cur} onPageChange={onPage} label={it.n} />
      <Strip>
        <button type="button" className="ks-bl-back-btn" aria-label={S.item.back} onClick={onBack} style={{ '--x': 0 } as CSSProperties}>
          <Icon name="grid" />
        </button>
        <Capsule kind="tablist" label={S.a11y.pages} items={caps} value={String(cur)} onChange={(id) => onPage(Number(id))} />
      </Strip>
    </>
  );
}
