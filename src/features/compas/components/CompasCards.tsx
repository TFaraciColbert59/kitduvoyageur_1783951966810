'use client';

import { classifyScale } from '../engine/scale';
import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { deleteTripItemAction } from '@/app/voyages/kit-actions';
import Icon from '@/components/ui/Icon';
import type { CompasKitLine, CompasModel } from '../engine/compasModel';
import {
  activityLabel,
  formatHours,
  formatKg,
  formatKm,
  formatMoney,
  initials,
} from '../engine/format';
import { Thumb, useLongPress, type Tone } from './CompasPrimitives';
import { DurationRuler, tripHours } from './CompasRuler';
import type { CompasCtl } from './compasTypes';
import { RESA_CATS, bookingCat, offerCat } from '../engine/resaCats';
import { bestShopProduct } from '../engine/shopMatch';
import { teamCount, teamCountLabel } from '../engine/team';
import { compasUndoAutofillAction } from '../server/autofillActions';

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
  if (line.status !== 'owned' && line.purchaseState === 'in_cart')
    return { label: 'Dans le panier', tone: 'soft' };
  if (line.status !== 'owned' && line.purchaseState === 'shipping')
    return { label: 'En livraison', tone: 'soft' };
  return STATUS[line.status];
}

/**
 * Ligne d'objet des tiroirs : toucher = fiche, appui long = fiche en grand,
 * glisser à gauche = « Retirer » apparaît (maquette finale) ; le retrait
 * demande ce second geste, jamais le seul glissement.
 */
export function KitRow({ line, ctl }: { line: CompasKitLine; ctl: CompasCtl }) {
  const [swiped, setSwiped] = useState(false);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /** Le clic qui suit un glissement ne doit ni ouvrir la fiche ni refermer. */
  const afterSwipe = useRef(false);
  const press = useLongPress(
    () => ctl.open({ kind: 'item', lineId: line.id }, 'large'),
    () => {
      if (afterSwipe.current) {
        afterSwipe.current = false;
        return;
      }
      if (swiped) setSwiped(false);
      else ctl.open({ kind: 'item', lineId: line.id });
    }
  );
  const canRemove = ctl.data.canEdit;
  const chosen = ctl.product(line.shopProductId);
  // Objet à trouver : le produit réel de la boutique qui lui correspond le mieux.
  const suggested = useMemo(
    () =>
      !chosen && (line.status === 'missing' || line.status === 'replace')
        ? bestShopProduct(line, ctl.data.shop)
        : null,
    [chosen, line, ctl.data.shop]
  );
  const product = chosen ?? suggested ?? undefined;
  const status = lineStatus(line);
  const carrier = line.ownerId
    ? ctl.memberName(line.ownerId)
    : line.shared
      ? 'sans porteur'
      : 'chacun';
  const weight = line.weightGrams == null ? 'à peser' : formatKg(line.weightGrams * line.quantity);
  return (
    <div
      className="cp-row"
      role="button"
      tabIndex={0}
      data-swiped={swiped ? '' : undefined}
      {...press}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY, moved: false };
        afterSwipe.current = false;
        press.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        press.onPointerMove(e);
        const s0 = swipe.current;
        if (!s0 || !canRemove) return;
        const dx = e.clientX - s0.x;
        if (Math.abs(e.clientY - s0.y) > 24) return;
        if (dx < -48) {
          s0.moved = true;
          setSwiped(true);
        } else if (dx > 24) {
          s0.moved = true;
          setSwiped(false);
        }
      }}
      onPointerUp={() => {
        afterSwipe.current = swipe.current?.moved ?? false;
        swipe.current = null;
        press.onPointerUp();
      }}
      onKeyDown={(e) => e.key === 'Enter' && press.onClick()}
    >
      <Thumb
        image={product?.image}
        alt={product?.imageAlt}
        category={line.category}
        name={line.name}
      />
      <span className="cp-row__t">
        <b>
          {line.quantity > 1 ? `${line.quantity} × ` : ''}
          {line.name}
        </b>
        <span>
          {weight} · {carrier} · {status.label}
          {line.vital ? ' · vital' : ''}
          {suggested && suggested.priceEur != null
            ? ` · boutique ${formatMoney(suggested.priceEur)}`
            : ''}
        </span>
      </span>
      <span className="cp-row__end">
        {swiped && (
          <button
            type="button"
            className="cp-btn cp-btn--bad cp-row__swipe"
            disabled={ctl.busy}
            aria-label={`Retirer du kit : ${line.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void ctl
                .run(`${line.name} retiré du kit`, () =>
                  deleteTripItemAction(line.id, ctl.data.model.slug)
                )
                .then(() => setSwiped(false));
            }}
          >
            Retirer
          </button>
        )}
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

export function MemberAvatar({
  name,
  url,
  small = false,
}: {
  name: string;
  url: string | null;
  small?: boolean;
}) {
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

const plainButton = {
  border: 0,
  background: 'none',
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
} as const;

/* ---------- Où ---------- */

const PACE_SHORT = {
  tranquille: 'tranquille',
  normal: 'rythme normal',
  soutenu: 'soutenu',
} as const;
const NIGHTS_SHORT = {
  bivouac: 'bivouac',
  refuge: 'refuges',
  hebergement: 'hébergements',
  mixte: 'nuits mixtes',
} as const;

/**
 * « Dis-le » sur la carte Où (maquette finale) : la phrase ouvre le tiroir Où,
 * dont le « Dis-le » la comprend aussitôt. Rien n'est appliqué sans coche.
 * L'exemple est une phrase que le Compas sait réellement lire (un « petit
 * budget » sans montant ne donnerait rien : aucun montant n'est inventé).
 */
function CardSay({ ctl }: { ctl: CompasCtl }) {
  const [text, setText] = useState('');
  return (
    <form
      className="cp-intent"
      aria-label="Dis-le : décris ton aventure ou une modification"
      onSubmit={(e) => {
        e.preventDefault();
        const say = text.trim();
        if (say.length < 2) return;
        ctl.open({ kind: 'step', step: 'ou', flow: 'activite', hint: { say } });
        setText('');
      }}
    >
      <Icon name="search" size={15} aria-hidden="true" />
      <label className="sr-only" htmlFor="cp-intent-input">
        Dis-le
      </label>
      <input
        id="cp-intent-input"
        value={text}
        maxLength={280}
        autoComplete="off"
        enterKeyHint="go"
        placeholder="Dis-le : « 3 jours à 4, départ samedi »"
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  );
}

export function OuCard({ ctl, onKit }: { ctl: CompasCtl; onKit: () => void }) {
  const m = ctl.data.model;
  const hours = tripHours(m, ctl.data.plannedDays);
  const act = activityLabel(m.activity);
  const worst = m.weather.worstPrecipPct;
  const toFind = ctl.lines.filter((l) => l.status !== 'owned').length;
  const prefs = [
    PACE_SHORT[m.preferences.pace],
    m.preferences.nights ? NIGHTS_SHORT[m.preferences.nights] : null,
    m.preferences.avoid.length ? `sans ${m.preferences.avoid[0].toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const route = m.route.stepsCount
    ? `${ctl.data.route.name ? `${ctl.data.route.name} · ` : ''}${formatKm(m.route.distanceKm)}`
    : 'À choisir';
  const open = (flow: 'activite' | 'parcours' | 'quand' | 'preferences') =>
    ctl.open({ kind: 'step', step: 'ou', flow });

  return (
    <>
      <div>
        <h2 className="cp-t2" id="cp-card-title">
          {m.title}
        </h2>
        <p className="cp-sub">
          {[
            act,
            classifyScale(hours)?.label ?? null,
            hours != null ? formatHours(hours) : null,
            m.dates.label,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {ctl.data.canEdit && <CardSay ctl={ctl} />}

      <DurationRuler ctl={ctl} />

      <div className="cp-fsum cp-glass">
        <SummaryRow
          icon="flag"
          label="Activité"
          value={act ?? 'À choisir'}
          onClick={() => open('activite')}
        />
        <SummaryRow icon="route" label="Parcours" value={route} onClick={() => open('parcours')} />
        <SummaryRow
          icon="calendar"
          label="Quand"
          value={m.dates.start ? m.dates.label : 'À choisir'}
          dot={worst == null ? undefined : worst >= 70 ? 'bad' : worst >= 40 ? 'warn' : 'good'}
          onClick={() => open('quand')}
        />
        <SummaryRow
          icon="heart"
          label="Préférences"
          value={prefs}
          onClick={() => open('preferences')}
        />
        <SummaryRow
          icon="backpack"
          label="Sac"
          // Jamais « Complet » : rien ne dit qu'un sac est complet, seulement
          // ce qu'il contient et ce qui est emballé.
          value={`${
            toFind
              ? `${toFind} à trouver`
              : ctl.lines.length
                ? `${ctl.lines.length} objet${ctl.lines.length > 1 ? 's' : ''}`
                : 'À composer'
          }${m.kit.packedPct != null ? ` · ${m.kit.packedPct} % emballé` : ''}`}
          onClick={onKit}
        />
      </div>

      {ctl.data.canEdit && <AutofillLine ctl={ctl} />}
    </>
  );
}

/**
 * Trace du préremplissage, toujours visible : ce qu'il a écrit peut être
 * annulé à tout moment, et relancé après une annulation.
 */
function AutofillLine({ ctl }: { ctl: CompasCtl }) {
  const { autofill, autofillNotes, model } = ctl.data;
  if (autofill === 'done')
    return (
      <div className="cp-autofill">
        <p className="cp-sub">
          <b>Prérempli par le Compas</b> · nuits, trajet, kit et budget écrits pour toi, à ajuster
        </p>
        {autofillNotes && autofillNotes.length > 0 && (
          <ul className="cp-props">
            {autofillNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="cp-btn"
          disabled={ctl.busy}
          onClick={() =>
            void ctl.run('Préparation annulée', () =>
              compasUndoAutofillAction({ tripId: model.tripId, tripSlug: model.slug })
            )
          }
        >
          Annuler la préparation
        </button>
      </div>
    );
  if (autofill === 'undone' && ctl.autofill && (model.dates.start || ctl.data.plannedDays))
    return (
      <button type="button" className="cp-btn cp-btn--pg" disabled={ctl.busy} onClick={ctl.autofill}>
        Tout préparer pour moi
      </button>
    );
  return null;
}

/* ---------- Nous : équipe et budget ---------- */

export function NousCard({ ctl }: { ctl: CompasCtl }) {
  const { crew, budget, dates } = ctl.data.model;
  const engaged = budget.planned + budget.spent;
  const share = budget.target ? engaged / budget.target : null;
  // L'enveloppe ramenée à une journée et une personne : c'est un repère de
  // préparation. Les dépenses engagées sont déjà affichées juste au-dessus.
  const envelopePerDay =
    budget.target != null && dates.days && crew.size > 0
      ? budget.target / crew.size / dates.days
      : null;
  const known = crew.loads.filter((l) => l.capacityKg != null).length;

  return (
    <>
      <div className="cp-between">
        <div className="cp-av">
          {crew.loads.slice(0, 6).map((m) => (
            <MemberAvatar key={m.userId} name={m.name} url={m.avatarUrl} />
          ))}
          <button
            type="button"
            className="cp-avadd"
            aria-label="Ajouter quelqu’un"
            onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'qui' })}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
        <span className="cp-sub">
          {teamCountLabel(
            teamCount(crew.size, crew.loads.length, ctl.data.pendingInvites?.length ?? 0)
          )}
        </span>
      </div>
      <p className="cp-sub">
        Capacité de portage renseignée :{' '}
        <b>
          {known} / {crew.loads.length}
        </b>
        {crew.pace.slowest ? ` · rythme de ${crew.pace.slowest.name}` : ' · allure non renseignée'}
      </p>
      <button
        type="button"
        className="cp-bigsum"
        style={plainButton}
        onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'budget' })}
      >
        <b>{formatMoney(engaged, budget.currency)}</b>
        <span className="cp-sub">
          prévus et dépensés
          {budget.perPerson != null
            ? ` · ta part ${formatMoney(budget.perPerson, budget.currency)}`
            : ''}
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
          ? `Enveloppe ${formatMoney(budget.target, budget.currency)}${envelopePerDay != null ? ` · soit ${formatMoney(Math.round(envelopePerDay), budget.currency)} par jour et par personne` : ''}`
          : 'Aucune enveloppe fixée pour ce voyage.'}
      </p>
      {budget.overTarget && (
        <button
          type="button"
          className="cp-alertline"
          onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'budget' })}
        >
          <Icon name="alert-triangle" size={16} />
          <span className="cp-alertline__t">Dépenses au-dessus de l’enveloppe</span>
          <Icon name="chevron-right" size={14} />
        </button>
      )}
      <button
        type="button"
        className="cp-btn cp-btn--soft"
        onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'equipe' })}
      >
        <Icon name="users" size={16} />
        L’équipe et ses sacs
      </button>
    </>
  );
}

/* ---------- Réserver ---------- */

export type VerticalId = 'hotel' | 'trajet' | 'activity';

export function verticalOf(v: string): VerticalId {
  if (v === 'hotel') return 'hotel';
  if (v === 'activity') return 'activity';
  return 'trajet';
}

export const LIVE_BOOKING = (s: string) =>
  s !== 'cancelled' && s !== 'expired' && s !== 'failed' && s !== 'refunded';

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
      {/* Maquette finale : six catégories. Le badge compte les réservations
          réelles ; Extras sans offre partenaire est grisé. */}
      <div className="cp-tchips cp-tchips--six">
        {RESA_CATS.map((c) => {
          const booked =
            c.id === 'randos'
              ? ctl.data.route.id != null
                ? 1
                : 0
              : list.filter((b) => bookingCat(b.vertical) === c.id).length;
          const offers = ctl.data.affiliateLinks.filter(
            (l) => offerCat(l.category) === c.id
          ).length;
          // Activités, Vols, Trajets se cherchent en direct ; Extras liste les offres.
          const usable = c.id !== 'extras' || booked + offers > 0;
          return (
            <button
              key={c.id}
              type="button"
              className="cp-tchip"
              data-on={booked ? '1' : undefined}
              disabled={!usable}
              aria-label={usable ? c.title : `${c.title} : aucune offre pour cette destination`}
              onClick={() =>
                c.id === 'randos'
                  ? ctl.open({ kind: 'step', step: 'ou', flow: 'parcours' })
                  : c.id === 'nuits'
                    ? ctl.open({ kind: 'step', step: 'resa', flow: 'nuits' })
                    : ctl.open({ kind: 'step', step: 'resa', flow: 'offres', hint: { resa: c.id } })
              }
            >
              <Icon name={c.icon} size={17} />
              <span>{c.label}</span>
              {booked > 0 && <span className="cp-tchip__bd">{booked}</span>}
            </button>
          );
        })}
      </div>
      {days.length > 0 && (
        <div className="cp-days">
          {days.slice(0, 5).map(([day, stay]) => {
            const needNight = days.length > 1 && day < lastDay && !stay;
            return (
              <button
                key={day}
                type="button"
                className="cp-day"
                onClick={() =>
                  ctl.open({ kind: 'step', step: 'resa', flow: 'nuits', hint: { day } })
                }
              >
                <b>Jour {day}</b>
                <small>{stay ?? (needNight ? 'nuit à trouver' : 'libre')}</small>
                <span className="cp-slots">
                  {stay && (
                    // Noté n'est pas réservé : pastille neutre, jamais la
                    // teinte « confirmée » d'une réservation réelle.
                    <span className="cp-slot" data-s="noted" title={`Noté : ${stay} (non réservé)`}>
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
          <b>{bookings.total}</b> réservation{bookings.total > 1 ? 's' : ''} · {bookings.confirmed}{' '}
          confirmée
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

const VERDICT: Record<
  CompasModel['verdict']['level'],
  { label: string; tone: Tone; icon: string; color: string }
> = {
  go: { label: 'Prêt à partir', tone: 'good', icon: 'check-circle', color: 'var(--cp-good)' },
  vigilance: {
    label: 'Vigilance',
    tone: 'warn',
    icon: 'alert-triangle',
    color: 'var(--lkv-warning)',
  },
  bloque: { label: 'Bloqué', tone: 'bad', icon: 'shield-alert', color: 'var(--cp-bad)' },
  incomplet: {
    label: 'À compléter',
    tone: 'soft',
    icon: 'clipboard-list',
    color: 'var(--cp-ink3)',
  },
};

export function verdictMeta(level: CompasModel['verdict']['level']) {
  return VERDICT[level];
}

const AXIS_LABEL = {
  physique: 'Physique',
  technique: 'Technique',
  conjoncturel: 'Conjoncturel',
} as const;
const AXIS_LEVEL = {
  ok: 'RAS',
  vigilance: 'Vigilance',
  bloque: 'Bloquant',
  non_evalue: 'Non évalué',
} as const;

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
      <div className="cp-tchips" aria-label="Danger par axe">
        {(['physique', 'technique', 'conjoncturel'] as const).map((axis) => {
          const a = ctl.data.danger.axes[axis];
          return (
            <span
              key={axis}
              className="cp-tchip cp-tchip--axis"
              data-on={a.level === 'vigilance' || a.level === 'bloque' ? '1' : undefined}
              title={a.note || a.partial || undefined}
            >
              <span>{AXIS_LABEL[axis]}</span>
              <span className="cp-tchip__bd">
                {a.level === 'ok' && a.partial ? 'RAS partiel' : AXIS_LEVEL[a.level]}
              </span>
            </span>
          );
        })}
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
        <p className="cp-sub">
          Aucun signal bloquant ni point de vigilance sur les données disponibles.
        </p>
      )}
      <button
        type="button"
        className="cp-btn cp-btn--soft"
        onClick={() =>
          ctl.open({ kind: 'step', step: 'verdict', flow: more > 0 ? 'raisons' : 'sources' })
        }
      >
        <Icon name="info" size={16} />
        {more > 0
          ? `${more} autre${more > 1 ? 's' : ''} signal${more > 1 ? 'aux' : ''}`
          : 'Sources et détails'}
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
  const pct = lines.length
    ? Math.round(
        (lines.reduce((t, l) => t + (l.packed ? (l.vital ? 2 : 1) : 0), 0) / weightTotal) * 100
      )
    : null;
  const total = kit.baseGrams + kit.consumableGrams + kit.wornGrams;
  const missing = kit.vitalMissing.length;
  // L'état se lit sur le sac réel : un sac vide n'est ni prêt ni complet, et
  // « rien de vital ne manque » ne se dit que s'il y a quelque chose à vérifier.
  const empty = lines.length === 0;
  const readiness = empty
    ? { title: 'Sac à composer', detail: 'aucun objet prévu pour ce voyage' }
    : missing
      ? {
          title: 'Pas encore prêt',
          detail: `${packed} / ${lines.length} emballés · ${missing} vital${missing > 1 ? 's' : ''} à trouver`,
        }
      : packed < lines.length
        ? {
            title: 'En préparation',
            detail: `${packed} / ${lines.length} emballés · aucun vital manquant parmi ces objets`,
          }
        : {
            title: 'Prêt sur les points vérifiés',
            detail: `${packed} / ${lines.length} emballés · aucun vital manquant parmi ces objets`,
          };

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
          <span style={{ ['--c' as string]: 'var(--lkv-primary)' }}>
            Base {formatKg(kit.baseGrams)}
          </span>
          <span style={{ ['--c' as string]: 'var(--lkv-secondary-subtle)' }}>
            Conso. {formatKg(kit.consumableGrams)}
          </span>
          <span style={{ ['--c' as string]: 'var(--lkv-info)' }}>
            Porté {formatKg(kit.wornGrams)}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="cp-ready"
        style={plainButton}
        onClick={() =>
          ctl.open({
            kind: 'step',
            step: 'kit',
            flow: empty ? 'mes-kits' : kit.toAcquire.length ? 'trouver' : 'emballer',
          })
        }
      >
        <div>
          <div className="cp-hl">{readiness.title}</div>
          <div className="cp-sub">{readiness.detail}</div>
        </div>
        <b>{pct == null ? '—' : `${pct} %`}</b>
      </button>
      {ctl.data.kitAdvice.length > 0 && (
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          onClick={() => ctl.open({ kind: 'step', step: 'kit', flow: 'conseils' })}
        >
          <Icon name="sparkles" size={16} />
          {(() => {
            const open = ctl.data.kitAdvice.filter((a) => !a.covered).length;
            return open
              ? `${open} conseil${open > 1 ? 's' : ''} météo à regarder`
              : 'Conseils météo : tout est couvert';
          })()}
        </button>
      )}
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
              <span
                className="cp-bar"
                data-tone={r == null ? undefined : r > 1 ? 'bad' : r > 0.9 ? 'warn' : undefined}
              >
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
        <button
          type="button"
          className="cp-alertline"
          onClick={() => ctl.open({ kind: 'step', step: 'kit', flow: 'sacs' })}
        >
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
