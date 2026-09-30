'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import type { CompasKitLine, CompasModel } from '../engine/compasModel';
import {
  RULER_TICKS,
  activityLabel,
  durationZone,
  formatHours,
  formatKg,
  formatKm,
  formatMeters,
  formatMoney,
  initials,
  rulerPosition,
} from '../engine/format';
import { Thumb, useLongPress, type Tone } from './CompasPrimitives';
import type { CompasCtl } from './compasTypes';

/* =============================================================================
   Cartes d'étape — un résumé par étape (maquette v8). Le détail et les actions
   vivent dans les tiroirs : ≡ ouvre celui de l'étape, chaque ligne ouvre le sien.
   ============================================================================= */

/* ---------- Statut d'un objet ---------- */

export const STATUS: Record<CompasKitLine['status'], { label: string; tone: Tone }> = {
  owned: { label: 'Prêt', tone: 'good' },
  missing: { label: 'À trouver', tone: 'bad' },
  lent: { label: 'Prêté · à récupérer', tone: 'warn' },
  replace: { label: 'À remplacer', tone: 'warn' },
};

export function lineStatus(line: CompasKitLine): { label: string; tone: Tone } {
  if (line.status !== 'owned' && line.purchaseState === 'in_cart') return { label: 'Dans le panier', tone: 'soft' };
  if (line.status !== 'owned' && line.purchaseState === 'shipping') return { label: 'En livraison', tone: 'soft' };
  return STATUS[line.status];
}

/** Ligne d'objet des tiroirs : toucher = fiche, appui long = fiche en grand. */
export function KitRow({ line, ctl }: { line: CompasKitLine; ctl: CompasCtl }) {
  const press = useLongPress(
    () => ctl.open({ kind: 'item', lineId: line.id }, 'large'),
    () => ctl.open({ kind: 'item', lineId: line.id }),
  );
  const product = ctl.product(line.shopProductId);
  const status = lineStatus(line);
  const carrier = line.ownerId ? ctl.memberName(line.ownerId) : line.shared ? 'sans porteur' : 'chacun';
  const weight = line.weightGrams == null ? 'à peser' : formatKg(line.weightGrams * line.quantity);
  return (
    <div className="cp-row" role="button" tabIndex={0} {...press} onKeyDown={(e) => e.key === 'Enter' && press.onClick()}>
      <Thumb image={product?.image} alt={product?.imageAlt} category={line.category} name={line.name} />
      <span className="cp-row__t">
        <b>
          {line.quantity > 1 ? `${line.quantity} × ` : ''}
          {line.name}
        </b>
        <span>
          {weight} · {carrier} · {status.label}
          {line.vital ? ' · vital' : ''}
        </span>
      </span>
      <span className="cp-row__end">
        <button
          type="button"
          className="cp-ibtn"
          aria-pressed={line.packed}
          aria-label={line.packed ? `Déballer ${line.name}` : `Emballer ${line.name}`}
          disabled={!ctl.data.canEdit}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            ctl.togglePacked(line);
          }}
        >
          <Icon name={line.packed ? 'check-circle' : 'circle'} size={22} />
        </button>
      </span>
    </div>
  );
}

export function MemberAvatar({ name, url, small = false }: { name: string; url: string | null; small?: boolean }) {
  return (
    <span className={`cp-avi${small ? ' cp-avi--sm' : ''}`} title={name} aria-hidden="true">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  onClick,
  href,
  dot,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  onClick?: () => void;
  href?: string;
  dot?: 'good' | 'warn' | 'bad';
}) {
  const inner = (
    <>
      <span className="cp-fr__i">
        <Icon name={icon} size={15} />
      </span>
      <span className="cp-fr__l">{label}</span>
      <span className="cp-fr__v">
        {dot && <i className="cp-qdot" data-tone={dot} aria-hidden="true" />}
        <span>{value}</span>
      </span>
      <Icon name="chevron-right" size={12} />
    </>
  );
  return href ? (
    <Link className="cp-fr" href={href}>
      {inner}
    </Link>
  ) : (
    <button type="button" className="cp-fr" onClick={onClick}>
      {inner}
    </button>
  );
}

const plainButton = { border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' } as const;

/* ---------- Où ---------- */

function tripHours(model: CompasModel): number | null {
  if (model.dates.days) return model.dates.days * 24;
  if (model.route.durationMin) return model.route.durationMin / 60;
  return null;
}

export function OuCard({ ctl, onKit }: { ctl: CompasCtl; onKit: () => void }) {
  const m = ctl.data.model;
  const hours = tripHours(m);
  const pos = hours == null ? null : rulerPosition(hours);
  const act = activityLabel(m.activity);
  const worst = m.weather.worstPrecipPct;
  const light = m.daylight?.sunrise && m.daylight?.sunset ? `${m.daylight.sunrise} – ${m.daylight.sunset}` : 'Avec les dates';
  const toFind = ctl.lines.filter((l) => l.status !== 'owned').length;

  return (
    <>
      <div>
        <h2 className="cp-t2" id="cp-card-title">
          {m.title}
        </h2>
        <p className="cp-sub">{[act, hours != null ? formatHours(hours) : null, m.dates.label].filter(Boolean).join(' · ')}</p>
      </div>

      <div
        className="cp-ruler cp-glass"
        role="img"
        aria-label={hours == null ? 'Durée à définir' : `Durée ${formatHours(hours)}, ${durationZone(hours)}`}
      >
        <div className="cp-ruler__h">
          <span>Durée{hours != null && <span className="cp-zone">{durationZone(hours)}</span>}</span>
          <b>{hours == null ? 'À définir' : formatHours(hours)}</b>
        </div>
        <div className="cp-ruler__track">
          {pos != null && (
            <>
              <i className="cp-ruler__fill" style={{ width: `calc((100% - 30px) * ${pos})` }} />
              <i className="cp-ruler__thumb" style={{ left: `calc(15px + (100% - 30px) * ${pos})` }} />
            </>
          )}
        </div>
        <div className="cp-ticks cp-hide-sm" aria-hidden="true">
          {RULER_TICKS.map(([h, label]) => (
            <span key={label} style={{ left: `calc(15px + (100% - 30px) * ${rulerPosition(h)})` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="cp-fsum cp-glass">
        <SummaryRow icon="flag" label="Activité" value={act ?? 'À choisir'} href="/prepare" />
        <SummaryRow
          icon="route"
          label="Parcours"
          value={m.route.stepsCount ? `${formatKm(m.route.distanceKm)} · D+ ${formatMeters(m.route.elevationGainM)}` : 'À tracer'}
          onClick={() => ctl.open({ kind: 'step', step: 'ou', flow: 'etapes' })}
        />
        <SummaryRow
          icon="calendar"
          label="Quand"
          value={m.dates.label}
          dot={worst == null ? undefined : worst >= 70 ? 'bad' : worst >= 40 ? 'warn' : 'good'}
          onClick={() => ctl.open({ kind: 'step', step: 'ou', flow: 'meteo' })}
        />
        <SummaryRow icon="sun" label="Lumière" value={light} onClick={() => ctl.open({ kind: 'step', step: 'ou', flow: 'meteo' })} />
        <SummaryRow
          icon="backpack"
          label="Sac"
          value={`${toFind ? `${toFind} à trouver` : ctl.lines.length ? 'Complet' : 'À composer'}${m.kit.packedPct != null ? ` · ${m.kit.packedPct} %` : ''}`}
          onClick={onKit}
        />
      </div>
    </>
  );
}

/* ---------- Nous : équipe et budget ---------- */

export function NousCard({ ctl }: { ctl: CompasCtl }) {
  const { crew, budget, dates } = ctl.data.model;
  const engaged = budget.planned + budget.spent;
  const share = budget.target ? engaged / budget.target : null;
  const perDay = budget.perPerson != null && dates.days ? budget.perPerson / dates.days : null;
  const known = crew.loads.filter((l) => l.capacityKg != null).length;

  return (
    <>
      <div className="cp-between">
        <div className="cp-av">
          {crew.loads.slice(0, 6).map((m) => (
            <MemberAvatar key={m.userId} name={m.name} url={m.avatarUrl} />
          ))}
          <Link className="cp-avadd" href="/hub/groupe" aria-label="Inviter quelqu’un">
            <Icon name="plus" size={15} />
          </Link>
        </div>
        <span className="cp-sub">
          {crew.size} personne{crew.size > 1 ? 's' : ''}
        </span>
      </div>
      <p className="cp-sub">
        Capacité de portage renseignée : <b>{known} / {crew.loads.length}</b>
      </p>
      <button type="button" className="cp-bigsum" style={plainButton} onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'budget' })}>
        <b>{formatMoney(engaged, budget.currency)}</b>
        <span className="cp-sub">
          prévus et dépensés{budget.perPerson != null ? ` · ta part ${formatMoney(budget.perPerson, budget.currency)}` : ''}
        </span>
      </button>
      {share != null && (
        <div
          className="cp-bar"
          data-tone={budget.overTarget ? 'bad' : share > 0.9 ? 'warn' : undefined}
          role="img"
          aria-label={`Budget engagé ${Math.round(share * 100)} %`}
        >
          <i style={{ width: `${Math.min(100, share * 100)}%` }} />
        </div>
      )}
      <p className="cp-sub">
        {budget.target != null
          ? `Enveloppe ${formatMoney(budget.target, budget.currency)}${perDay != null ? ` · ${formatMoney(Math.round(perDay), budget.currency)} par jour et par personne` : ''}`
          : 'Aucune enveloppe fixée pour ce voyage.'}
      </p>
      {budget.overTarget && (
        <button type="button" className="cp-alertline" onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'budget' })}>
          <Icon name="alert-triangle" size={16} />
          <span className="cp-alertline__t">Dépenses au-dessus de l’enveloppe</span>
          <Icon name="chevron-right" size={14} />
        </button>
      )}
      <button type="button" className="cp-btn cp-btn--soft" onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'equipe' })}>
        <Icon name="users" size={16} />
        L’équipe et ses sacs
      </button>
    </>
  );
}

/* ---------- Réserver ---------- */

export type VerticalId = 'hotel' | 'trajet' | 'activity';

export const VERTICALS: ReadonlyArray<{ id: VerticalId | 'offres'; label: string; icon: string }> = [
  { id: 'hotel', label: 'Nuits', icon: 'bed-double' },
  { id: 'trajet', label: 'Trajets', icon: 'car' },
  { id: 'activity', label: 'Activités', icon: 'ticket' },
  { id: 'offres', label: 'Offres', icon: 'tag' },
];

export function verticalOf(v: string): VerticalId {
  if (v === 'hotel') return 'hotel';
  if (v === 'activity') return 'activity';
  return 'trajet';
}

export const LIVE_BOOKING = (s: string) => s !== 'cancelled' && s !== 'expired' && s !== 'failed' && s !== 'refunded';

export function ResaCard({ ctl }: { ctl: CompasCtl }) {
  const { bookings } = ctl.data.model;
  const list = ctl.data.bookings.filter((b) => LIVE_BOOKING(b.status));
  const byDay = new Map<number, string | null>();
  for (const s of ctl.data.itinerary) byDay.set(s.day, byDay.get(s.day) ?? s.accommodation);
  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  const lastDay = days.length ? days[days.length - 1][0] : 0;
  const live = ctl.data.providers.routestack !== 'disabled';

  return (
    <>
      <div className="cp-tchips">
        {VERTICALS.map((v) => {
          const count = v.id === 'offres' ? ctl.data.affiliateLinks.length : list.filter((b) => verticalOf(b.vertical) === v.id).length;
          return (
            <button
              key={v.id}
              type="button"
              className="cp-tchip"
              data-on={count ? '1' : undefined}
              onClick={() => ctl.open({ kind: 'step', step: 'resa', flow: v.id === 'offres' ? 'offres' : 'reservations' })}
            >
              <Icon name={v.icon} size={17} />
              <span>{v.label}</span>
              {count > 0 && <span className="cp-tchip__bd">{count}</span>}
            </button>
          );
        })}
      </div>
      {days.length > 0 && (
        <div className="cp-days">
          {days.slice(0, 5).map(([day, stay]) => {
            const needNight = days.length > 1 && day < lastDay && !stay;
            return (
              <button key={day} type="button" className="cp-day" onClick={() => ctl.open({ kind: 'step', step: 'ou', flow: 'etapes' })}>
                <b>Jour {day}</b>
                <small>{stay ?? (needNight ? 'nuit à trouver' : 'libre')}</small>
                <span className="cp-slots">
                  {stay && (
                    <span className="cp-slot" data-s="confirmed" title={stay}>
                      H
                    </span>
                  )}
                  {needNight && (
                    <span className="cp-slot" data-s="need" title="Nuit sans hébergement">
                      H
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="cp-sumline">
        <span>
          <b>{bookings.total}</b> réservation{bookings.total > 1 ? 's' : ''} · {bookings.confirmed} confirmée
          {bookings.confirmed > 1 ? 's' : ''} · {bookings.pending} en attente
        </span>
        <span className="cp-num cp-sub">{formatMoney(bookings.amountEur)}</span>
      </div>
      <p className="cp-disc cp-hide-sm">
        Partenaires affiliés : le classement n’est jamais influencé par la commission.{' '}
        {live
          ? 'Hôtels, vols et voitures en direct : tarif revalidé avant tout paiement.'
          : 'Recherche en direct (hôtels, vols, voitures) : active dès que les clés partenaires sont posées.'}
      </p>
    </>
  );
}

/* ---------- Verdict (sans score) ---------- */

const VERDICT: Record<CompasModel['verdict']['level'], { label: string; tone: Tone; icon: string; color: string }> = {
  go: { label: 'Prêt à partir', tone: 'good', icon: 'check-circle', color: 'var(--cp-good)' },
  vigilance: { label: 'Vigilance', tone: 'warn', icon: 'alert-triangle', color: 'var(--lkv-warning)' },
  bloque: { label: 'Bloqué', tone: 'bad', icon: 'shield-alert', color: 'var(--cp-bad)' },
  incomplet: { label: 'À compléter', tone: 'soft', icon: 'clipboard-list', color: 'var(--cp-ink3)' },
};

export function verdictMeta(level: CompasModel['verdict']['level']) {
  return VERDICT[level];
}

export function VerdictCard({ ctl }: { ctl: CompasCtl }) {
  const { verdict } = ctl.data.model;
  const v = VERDICT[verdict.level];
  const shown = verdict.reasons.slice(0, 4);
  const more = verdict.reasons.length - shown.length;
  return (
    <>
      <div className="cp-between">
        <span className="cp-vl" style={{ ['--c' as string]: v.color }}>
          <i />
          {v.label}
        </span>
        <span className="cp-sub">Signaux vérifiables · sans score</span>
      </div>
      {shown.length ? (
        <ul className="cp-why">
          {shown.map((r) => (
            <li key={`${r.source}-${r.label}`}>
              <i data-tone={r.severity} aria-hidden="true" />
              <span>
                {r.label}
                <small>Source : {r.source}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cp-sub">Aucun signal bloquant ni point de vigilance sur les données disponibles.</p>
      )}
      <button type="button" className="cp-btn cp-btn--soft" onClick={() => ctl.open({ kind: 'step', step: 'verdict', flow: more > 0 ? 'raisons' : 'sources' })}>
        <Icon name="info" size={16} />
        {more > 0 ? `${more} autre${more > 1 ? 's' : ''} signal${more > 1 ? 'aux' : ''}` : 'Sources et détails'}
      </button>
    </>
  );
}

/* ---------- Kit ---------- */

export function KitCard({ ctl }: { ctl: CompasCtl }) {
  const { kit, crew, inventory } = ctl.data.model;
  const lines = ctl.lines;
  const packed = lines.filter((l) => l.packed).length;
  const weightTotal = lines.reduce((t, l) => t + (l.vital ? 2 : 1), 0);
  const pct = lines.length ? Math.round((lines.reduce((t, l) => t + (l.packed ? (l.vital ? 2 : 1) : 0), 0) / weightTotal) * 100) : null;
  const total = kit.baseGrams + kit.consumableGrams + kit.wornGrams;
  const missing = kit.vitalMissing.length;

  return (
    <>
      <div>
        <div className="cp-weights" aria-hidden="true">
          {total > 0 && (
            <>
              <i style={{ flex: kit.baseGrams, background: 'var(--lkv-primary)' }} />
              <i style={{ flex: kit.consumableGrams, background: 'var(--lkv-secondary-subtle)' }} />
              <i style={{ flex: kit.wornGrams, background: 'var(--lkv-info)' }} />
            </>
          )}
        </div>
        <div className="cp-wl">
          <span style={{ ['--c' as string]: 'var(--lkv-primary)' }}>Base {formatKg(kit.baseGrams)}</span>
          <span style={{ ['--c' as string]: 'var(--lkv-secondary-subtle)' }}>Conso. {formatKg(kit.consumableGrams)}</span>
          <span style={{ ['--c' as string]: 'var(--lkv-info)' }}>Porté {formatKg(kit.wornGrams)}</span>
        </div>
      </div>
      <button
        type="button"
        className="cp-ready"
        style={plainButton}
        onClick={() => ctl.open({ kind: 'step', step: 'kit', flow: kit.toAcquire.length ? 'trouver' : 'emballer' })}
      >
        <div>
          <div className="cp-hl">Prêt sur les points vérifiés</div>
          <div className="cp-sub">
            {packed} / {lines.length} emballés ·{' '}
            {missing ? `${missing} vital${missing > 1 ? 's' : ''} à trouver` : 'rien de vital ne manque'}
          </div>
        </div>
        <b>{pct == null ? '—' : `${pct} %`}</b>
      </button>
      <p className="cp-sub cp-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="package" size={13} />
        <span>
          Inventaire · {inventory.total} objet{inventory.total > 1 ? 's' : ''}
          {inventory.lent ? ` · ${inventory.lent} prêté${inventory.lent > 1 ? 's' : ''}` : ''}
          {kit.unknownWeightCount ? ` · ${kit.unknownWeightCount} à peser` : ''}
        </span>
      </p>
      <div className="cp-mbs">
        {crew.loads.map((m) => {
          const r = m.ratio;
          return (
            <button
              key={m.userId}
              type="button"
              className="cp-mb"
              onClick={() => ctl.open({ kind: 'bag', userId: m.userId })}
              aria-label={`Voir le sac de ${m.name}`}
            >
              <MemberAvatar name={m.name} url={m.avatarUrl} small />
              <span className="cp-bar" data-tone={r == null ? undefined : r > 1 ? 'bad' : r > 0.9 ? 'warn' : undefined}>
                <i style={{ width: r == null ? '0%' : `${Math.min(100, r * 100)}%` }} />
              </span>
              <b>
                {formatKg(m.carriedGrams)}
                {m.capacityKg != null ? ` / ${m.capacityKg} kg` : ''}
              </b>
            </button>
          );
        })}
      </div>
      {crew.unassignedShared.length > 0 && (
        <button type="button" className="cp-alertline" onClick={() => ctl.open({ kind: 'step', step: 'kit', flow: 'sacs' })}>
          <Icon name="users" size={16} />
          <span className="cp-alertline__t">
            {crew.unassignedShared.length} objet{crew.unassignedShared.length > 1 ? 's' : ''} commun
            {crew.unassignedShared.length > 1 ? 's' : ''} sans porteur
          </span>
          <Icon name="chevron-right" size={14} />
        </button>
      )}
    </>
  );
}
