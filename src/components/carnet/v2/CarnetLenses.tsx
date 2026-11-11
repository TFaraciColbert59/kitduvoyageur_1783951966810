'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bed, Package } from 'lucide-react';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetKitItemRow,
  CarnetMomentItem,
  CarnetNightItem,
  CarnetParticipant,
  KitVerdictType,
} from '@/features/carnet/detail/types';
import {
  MOMENT_TYPE_LABELS,
  resolveMomentType,
  type MomentType,
} from '@/features/carnet/detail/momentTypes';
import { NIGHT_TYPE_LABELS, VERDICT_LABELS } from '@/features/carnet/detail/editSchemas';
import { CarnetArt } from './CarnetArt';
import { CarnetVideoFeed } from './CarnetVideo';
import { MOMENT_TYPE_ICONS, waveHeights } from './CarnetMomentTile';

const NB = ' ';

export const roleLabelFr = (role: string): string =>
  role === 'author'
    ? 'Auteur'
    : role === 'collaborator'
      ? 'Contributeur'
      : role === 'participant'
        ? 'Participant'
        : role;

/** Pastille de verdict (`.v`) ; un verdict hors liste s'affiche tel quel. */
export function VerdictTag({ verdict }: { verdict: KitVerdictType | null | undefined }) {
  if (!verdict) return <span className="lkdv-v lkdv-v-jamais_servi">Sans verdict</span>;
  const label = (VERDICT_LABELS as Record<string, string>)[verdict] ?? verdict;
  return <span className={`lkdv-v lkdv-v-${verdict}`}>{label}</span>;
}

/** Catégorie d'un objet : le champ `detail` quand il est court, sinon « Matériel ». */
export function itemCategory(item: Pick<CarnetKitItemRow, 'detail'>): string {
  const text = item.detail?.trim();
  return text && text.length <= 24 ? text : 'Matériel';
}

const CATEGORY_COLORS = [
  'var(--tint)',
  'var(--sage-300)',
  'var(--star)',
  'var(--info)',
  'var(--accent)',
  'var(--bad)',
];

export function categoryColor(categories: string[], category: string): string {
  const index = categories.indexOf(category);
  return CATEGORY_COLORS[(index < 0 ? 0 : index) % CATEGORY_COLORS.length];
}

export const fmtGrams = (g: number | null | undefined): string =>
  g ? `${g.toLocaleString('fr-FR')}${NB}g` : '—';

export function EditPill({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="lkdv-edpill" aria-label={label} onClick={onClick}>
      Modifier
    </button>
  );
}

/** Lecteur unique des notes vocales : une seule lecture à la fois. */
export function useVoicePlayer(onUnavailable?: () => void) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (id: string, url: string | undefined) => {
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }
      audioRef.current?.pause();
      if (!url) {
        onUnavailable?.();
        return;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener('ended', () => setPlayingId((current) => (current === id ? null : current)));
      audio.addEventListener('error', () => {
        setPlayingId(null);
        onUnavailable?.();
      });
      setPlayingId(id);
      void audio.play().catch(() => {
        setPlayingId(null);
        onUnavailable?.();
      });
    },
    [onUnavailable, playingId]
  );

  return { playingId, toggle };
}

function seedOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash;
}

function initialOf(name: string | null | undefined): string {
  return (name?.trim()[0] ?? '·').toUpperCase();
}

// ── Fil de bord › Moments (jour) ─────────────────────────────────────────

export interface MomentCardProps {
  moment: CarnetMomentItem;
  showDay: boolean;
  kitItems: CarnetKitItemRow[];
  playing: boolean;
  canEdit: boolean;
  index: number;
  onOpen: (moment: CarnetMomentItem) => void;
  onPlay: (moment: CarnetMomentItem) => void;
  onEdit: (moment: CarnetMomentItem) => void;
  onOpenItem: (itemId: string) => void;
}

/** Carte d'un moment, une variante par type (maquette `momentCard`). */
export function MomentCard({
  moment,
  showDay,
  kitItems,
  playing,
  canEdit,
  index,
  onOpen,
  onPlay,
  onEdit,
  onOpenItem,
}: MomentCardProps) {
  const type: MomentType =
    resolveMomentType({ raw: moment.type, imageUrl: moment.imageUrl, caption: moment.caption }) ?? 'text';
  const place = moment.place?.trim() || moment.title?.trim() || `Jour ${moment.dayNumber}`;
  const text = moment.caption?.trim() || '';
  const meta = moment.meta ?? null;
  const rowStyle = { animationDelay: `${Math.min(index, 10) * 30}ms` };
  const head = (
    <div className="meta">
      <span className="k">
        {type === 'voice' && meta?.ambiance ? 'Son d’ambiance' : MOMENT_TYPE_LABELS[type]}
      </span>
      <span className="pl">{place}</span>
      {showDay ? <span className="lkdv-dtag">J{moment.dayNumber}</span> : null}
      <span className="lkdv-who" title={moment.authorName ?? undefined} aria-label={moment.authorName ?? 'Voyageur'}>
        {initialOf(moment.authorName)}
      </span>
      <span className="h">{moment.time ?? ''}</span>
    </div>
  );
  const editPill = canEdit ? <EditPill label="Modifier le moment" onClick={() => onEdit(moment)} /> : null;

  if (type === 'photo' || type === 'video') {
    /* Vidéo (proposition n° 31) : elle est réellement lue dans le fil (muette en
       boucle, son au toucher) au lieu d'être rendue comme une image figée. */
    if (type === 'video' && moment.imageUrl) {
      return (
        <article className="lkdv-mo media" data-carnet-row="" data-type={type} style={rowStyle}>
          <CarnetVideoFeed src={moment.imageUrl} place={place} onOpen={() => onOpen(moment)} />
          {head}
          {editPill}
        </article>
      );
    }
    return (
      <article className="lkdv-mo media" data-carnet-row="" data-type={type} style={rowStyle}>
        <button type="button" aria-label={`Ouvrir : ${place}`} onClick={() => onOpen(moment)}>
          {moment.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={moment.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <CarnetArt />
          )}
        </button>
        {head}
        {editPill}
      </article>
    );
  }

  let body: React.ReactNode = null;
  if (type === 'voice') {
    const bars = waveHeights(seedOf(moment.id) * 3, 34);
    body = (
      <>
        <div className="lkdv-wave">
          <button
            type="button"
            className="play"
            aria-pressed={playing}
            aria-label={`${playing ? 'Mettre en pause' : 'Écouter'} la note vocale`}
            onClick={() => onPlay(moment)}
          >
            <span>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                {playing ? <path d="M2 1h3v10H2zM7 1h3v10H7z" /> : <path d="M2 1l9 5-9 5z" />}
              </svg>
            </span>
          </button>
          <span className="bars" aria-hidden="true">
            {bars.map((h, i) => (
              <i key={i} className={playing && i < 14 ? 'p' : undefined} style={{ height: `${h}%` }} />
            ))}
          </span>
          <span className="dur">{meta?.durationLabel ?? ''}</span>
        </div>
        {text ? (
          <span className="lkdv-mute">{text}</span>
        ) : meta?.ambiance ? (
          <span className="lkdv-mute">Son d’ambiance, sans commentaire.</span>
        ) : null}
      </>
    );
  } else if (type === 'text') {
    body = <p className="lkdv-txt">{text || place}</p>;
  } else if (type === 'meet') {
    body = (
      <div className="lkdv-meet">
        <span className="face" aria-hidden="true" />
        <q>
          {text}
          {meta?.who ? <small>{meta.who}</small> : null}
        </q>
      </div>
    );
  } else if (type === 'spend') {
    const amount = meta?.amountEur;
    body = (
      <div className="lkdv-ticket">
        <div className="lkdv-row2">
          <span className="tot">{amount != null ? `${amount.toLocaleString('fr-FR')}${NB}€` : '—'}</span>
          {meta?.category ? <span className="lkdv-tg sp">{meta.category}</span> : null}
        </div>
        <div className="lkdv-tbar" aria-hidden="true">
          <i style={{ flex: 5, background: 'var(--accent)' }} />
          <i style={{ flex: 2, background: 'var(--sep)' }} />
        </div>
        {text ? <span className="lkdv-mute">{text}</span> : null}
      </div>
    );
  } else if (type === 'kit') {
    const item = kitItems.find((k) => k.id === meta?.itemId);
    body = (
      <button
        type="button"
        className="lkdv-chip-obj"
        disabled={!item}
        aria-label={item ? `Voir la fiche : ${item.name}` : 'Objet du kit'}
        onClick={() => item && onOpenItem(item.id)}
      >
        <span className="lkdv-obj" aria-hidden="true">
          <Package size={20} />
        </span>
        <span style={{ display: 'grid', gap: 3 }}>
          <b style={{ fontSize: 13 }}>{item?.name ?? text ?? 'Objet du kit'}</b>
          {item ? <VerdictTag verdict={item.verdict} /> : null}
        </span>
      </button>
    );
  } else if (type === 'species') {
    const Glyph = MOMENT_TYPE_ICONS.species;
    body = (
      <div className="lkdv-sp">
        <span className="gl" aria-hidden="true">
          <Glyph size={26} strokeWidth={1.5} />
        </span>
        <div>
          <b>{text || place}</b>
          {meta?.latin ? <i>{meta.latin}</i> : null}
        </div>
      </div>
    );
  } else {
    const Glyph = MOMENT_TYPE_ICONS.inc;
    return (
      <article className="lkdv-mo inc" data-carnet-row="" data-type="inc" style={rowStyle}>
        {head}
        <div className="body">
          <Glyph size={18} aria-hidden />
          <span>{text}</span>
        </div>
        {editPill}
      </article>
    );
  }

  return (
    <article className={`lkdv-mo ${type}`} data-carnet-row="" data-type={type} style={rowStyle}>
      {head}
      {body}
      {editPill}
    </article>
  );
}

// ── Route › Étapes, Nuit ─────────────────────────────────────────────────

const EM = ' → ';

export function EtapeRows({
  etapes,
  activeDay,
  onOpen,
}: {
  etapes: CarnetEtapeDay[];
  activeDay: number;
  onOpen: (etape: CarnetEtapeDay) => void;
}) {
  return (
    <>
      {etapes.map((e, idx) => {
        const route = [e.from, e.to].filter(Boolean).join(EM) || e.label;
        const figures = [
          e.distanceKm != null ? `${e.distanceKm.toLocaleString('fr-FR')}${NB}km` : null,
          e.elevationM != null ? `+${e.elevationM.toLocaleString('fr-FR')}${NB}m` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <React.Fragment key={e.id}>
            {activeDay === 0 ? (
              <div className="lkdv-dsep" data-carnet-row="" style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}>
                <b>J{e.dayNumber}</b>
                <span className="lkdv-mute">{e.label.replace(/^JOUR \d+ · ?/, '') || ' '}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="lkdv-etape"
              data-carnet-row=""
              style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}
              aria-label={`${route}${e.durationText ? `, ${e.durationText}` : ''}`}
              onClick={() => onOpen(e)}
            >
              <span className="pin end" aria-hidden="true" />
              <b>{route}</b>
              <span className="t">{e.durationText ?? ''}</span>
              <small className="lkdv-mono">{figures || 'Chiffres non renseignés'}</small>
            </button>
          </React.Fragment>
        );
      })}
    </>
  );
}

export function NightCards({
  nights,
  activeDay,
  dateOf,
  onOpen,
}: {
  nights: CarnetNightItem[];
  activeDay: number;
  dateOf: (day: number) => string | null;
  onOpen: (night: CarnetNightItem) => void;
}) {
  return (
    <>
      {nights.map((n, idx) => {
        const tone = n.type === 'bivouac' ? 'o' : n.type === 'refuge' ? 'p' : 'i';
        return (
          <button
            key={n.id}
            type="button"
            className="lkdv-card2 lkdv-nuitcard"
            data-carnet-row=""
            style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}
            aria-label={`${n.name}, ${NIGHT_TYPE_LABELS[n.type]}, jour ${n.dayNumber}`}
            onClick={() => onOpen(n)}
          >
            <span className="lkdv-row2">
              <Bed size={18} aria-hidden />
              <b style={{ fontSize: 13.5 }}>{n.name}</b>
              <span className={`lkdv-tg ${tone}`} style={{ marginLeft: 'auto' }}>
                {NIGHT_TYPE_LABELS[n.type]}
              </span>
            </span>
            <span className="lkdv-row2 lkdv-mute">
              <span>
                {activeDay === 0 ? `J${n.dayNumber} · ` : ''}
                {dateOf(n.dayNumber) ?? ''}
              </span>
              <span className="lkdv-mono" style={{ marginLeft: 'auto' }}>
                {n.altitudeM != null ? `${n.altitudeM.toLocaleString('fr-FR')}${NB}m` : ''}
              </span>
            </span>
            {n.infos ? <span className="lkdv-mute">{n.infos}</span> : null}
          </button>
        );
      })}
    </>
  );
}

// ── Sac › Kit, Verdicts, Poids ───────────────────────────────────────────

export function categoriesOf(items: CarnetKitItemRow[]): string[] {
  return [...new Set(items.map(itemCategory))];
}

const carriedItems = (items: CarnetKitItemRow[]) => items.filter((i) => i.verdict !== 'manquait');

export function KitTiles({
  items,
  onOpen,
}: {
  items: CarnetKitItemRow[];
  onOpen: (item: CarnetKitItemRow) => void;
}) {
  const categories = categoriesOf(items);
  const carried = carriedItems(items);
  const total = carried.reduce((sum, i) => sum + (i.weightG ?? 0), 0);
  return (
    <>
      <div className="lkdv-sac-total">
        <div>
          <div className="lkdv-h5">Poids du kit</div>
          <span className="lkdv-big">
            {total > 0 ? (total / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            {total > 0 ? <small style={{ fontSize: 13, marginLeft: 3 }}>kg</small> : null}
          </span>
        </div>
        <span className="lkdv-mute sp">{items.length} objets</span>
      </div>
      {categories.map((category) => {
        const inCategory = items.filter((i) => itemCategory(i) === category);
        const grams = carriedItems(inCategory).reduce((sum, i) => sum + (i.weightG ?? 0), 0);
        return (
          <section className="lkdv-cat" key={category}>
            <header>
              <span className="lkdv-cdot" style={{ background: categoryColor(categories, category) }} />
              <b>{category}</b>
              <span>{grams.toLocaleString('fr-FR')}{NB}g</span>
            </header>
            <div className="lkdv-tiles">
              {inCategory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="lkdv-tile"
                  aria-label={`Fiche : ${item.name}`}
                  onClick={() => onOpen(item)}
                >
                  <span className="lkdv-pic" aria-hidden="true">
                    <Package size={20} />
                  </span>
                  {item.name}
                  <small>{fmtGrams(item.weightG)}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export const VERDICT_ORDER = ['essentiel', 'utile', 'jamais_servi', 'defaillant', 'manquait'] as const;

export function VerdictList({
  items,
  filter,
  onFilter,
  onOpen,
}: {
  items: CarnetKitItemRow[];
  filter: 'all' | KitVerdictType;
  onFilter: (next: 'all' | KitVerdictType) => void;
  onOpen: (item: CarnetKitItemRow) => void;
}) {
  const known = VERDICT_ORDER as readonly string[];
  /* Un verdict hors liste (donnée ancienne) reste visible, sous son libellé brut. */
  const extra = [...new Set(items.map((x) => x.verdict).filter((v): v is KitVerdictType => Boolean(v) && !known.includes(v as string)))];
  const shown: string[] =
    filter === 'all' ? [...VERDICT_ORDER, ...extra] : [...VERDICT_ORDER, ...extra].filter((k) => k === filter);
  return (
    <>
      <div className="lkdv-vpills" role="group" aria-label="Filtrer par verdict">
        {VERDICT_ORDER.map((k) => {
          const n = items.filter((x) => x.verdict === k).length;
          return (
            <button
              key={k}
              type="button"
              className={`lkdv-v lkdv-v-${k}`}
              aria-pressed={filter === k}
              aria-label={`${VERDICT_LABELS[k]}, ${n}`}
              data-verdict-filter={k}
              onClick={() => onFilter(filter === k ? 'all' : k)}
            >
              {VERDICT_LABELS[k]} <b>{n}</b>
            </button>
          );
        })}
      </div>
      {shown.map((k) => {
        const list = items.filter((x) => x.verdict === k);
        if (list.length === 0) return null;
        return (
          <section className="lkdv-cat" key={k}>
            <header>
              <span className={`lkdv-v lkdv-v-${k}`}>
                {(VERDICT_LABELS as Record<string, string>)[k] ?? k}
              </span>
            </header>
            {list.map((x) => (
              <button key={x.id} type="button" className="lkdv-litem" onClick={() => onOpen(x)}>
                <span className="lkdv-pic" style={{ width: 30, height: 30, flexBasis: 30, borderRadius: 10 }} aria-hidden="true">
                  <Package size={18} />
                </span>
                <span>
                  {x.name}
                  {x.verdictNote ? (
                    <>
                      <br />
                      <span className="lkdv-mute">{x.verdictNote}</span>
                    </>
                  ) : null}
                </span>
                <span className="g">{fmtGrams(x.weightG)}</span>
              </button>
            ))}
          </section>
        );
      })}
    </>
  );
}

/** Anneau de répartition du poids par catégorie (maquette `donut`). */
export function WeightDonut({ items }: { items: CarnetKitItemRow[] }) {
  const categories = categoriesOf(items);
  const carried = carriedItems(items);
  const total = carried.reduce((sum, i) => sum + (i.weightG ?? 0), 0);
  const parts = categories
    .map((c) => ({
      c,
      g: carried.filter((x) => itemCategory(x) === c).reduce((s, x) => s + (x.weightG ?? 0), 0),
    }))
    .filter((p) => p.g > 0);
  if (total <= 0) return null;
  const R = 46;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="lkdv-card2">
      <div className="lkdv-donut">
        <svg viewBox="0 0 132 132" role="img" aria-label="Répartition du poids par catégorie">
          <circle cx="66" cy="66" r={R} fill="none" stroke="var(--fill)" strokeWidth="16" />
          {parts.map(({ c, g }) => {
            const len = (g / total) * C;
            const circle = (
              <circle
                key={c}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke={categoryColor(categories, c)}
                strokeWidth="16"
                strokeDasharray={`${Math.max(0, len - 2).toFixed(1)} ${C.toFixed(1)}`}
                strokeDashoffset={(-offset).toFixed(1)}
                transform="rotate(-90 66 66)"
              />
            );
            offset += len;
            return circle;
          })}
          <text x="66" y="66" textAnchor="middle" fontWeight="700" fontSize="17" fill="var(--tint)" fontFamily="var(--font-mono, ui-monospace, monospace)">
            {(total / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
          </text>
          <text x="66" y="82" textAnchor="middle" fontSize="10" fill="var(--label2)">
            kg
          </text>
        </svg>
        <div className="lkdv-legend">
          {parts.map(({ c, g }) => (
            <div key={c}>
              <span className="lkdv-cdot" style={{ background: categoryColor(categories, c) }} />
              {c}
              <span className="g">{g.toLocaleString('fr-FR')}{NB}g</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Équipage › Participants ──────────────────────────────────────────────

export function CrewCard({
  participant,
  momentCount,
  isAuthor,
  onOpen,
  index,
}: {
  participant: CarnetParticipant;
  momentCount: number;
  isAuthor: boolean;
  onOpen: () => void;
  index: number;
}) {
  const name = participant.name || participant.handle || 'Voyageur';
  return (
    <button
      type="button"
      className="lkdv-crew"
      data-carnet-row=""
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      aria-label={`Fiche de ${name}`}
      onClick={onOpen}
    >
      {participant.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="lkdv-av" src={participant.avatarUrl} alt="" />
      ) : (
        <span className="lkdv-av" aria-hidden="true">
          {initialOf(name)}
        </span>
      )}
      <div className="t">
        <b>
          {name}
          {isAuthor ? <span className="lkdv-tg p">propriétaire</span> : null}
        </b>
        <span className="lkdv-mute">{roleLabelFr(participant.role)}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <b className="lkdv-mono" style={{ fontSize: 18 }}>
          {momentCount}
        </b>
        <div className="lkdv-mute" style={{ fontSize: 10.5 }}>
          moments
        </div>
      </div>
    </button>
  );
}

/** Résumé de rendu partagé : nombre de moments d'un voyageur. */
export function momentsOfParticipant(detail: CarnetDetail, participant: CarnetParticipant): number {
  return detail.moments.filter(
    (m) => m.authorId === participant.userId || (!m.authorId && m.authorName === participant.name)
  ).length;
}
