'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useV5, type V5Api } from '../context';
import { compasSetCarriersAction, compasSetPartySizeAction } from '../../server/compasActions';
import { HUB_GROUP_PATH } from '../../engine/crewView';
import { balanceCarriers } from '../../engine/decisionApply';
import { decimalIn, kgIn, moneyIn } from '../../components/sheetsI18n';
import { Avi, Cap, Fi, Grp, Li, MBtn, PBtn, Stepper } from '../ui/primitives';
import { V5Icon } from '../ui/icons';
import {
  buildShare,
  cleanReturnTime,
  emergencyView,
  gearSummary,
  hasRoute,
  mailtoHref,
  memberFacts,
  paceHeld,
  partyBounds,
  pendingFacts,
  planSwitch,
  type MemberFacts,
  type NousMode,
} from '../model/nous';
import { nousText, type NousText } from '../model/text';
import type { V5DrawerDef } from './types';
import './nous-budget.css';

/** Tiroir « Nous » : solo ou avec d'autres. La capsule [Solo, Avec d'autres] reflète le voyage et le fait basculer. */

function memberLine(f: MemberFacts, text: NousText, locale: V5Api['locale']): string {
  const role = text(`role.${f.role}`);
  let level: string;
  if (!f.level) level = text('level.unknown');
  else {
    const label = f.level.key ? text(`level.${f.level.key}`) : f.level.raw;
    level = f.level.provenance === 'estimated' ? text('level.estimated', { level: label }) : text('level.value', { level: label });
  }
  let pace: string;
  if (!f.pace) pace = text('pace.unknown');
  else {
    const speed = decimalIn(locale, f.pace.kmh);
    pace =
      f.pace.provenance === 'learned'
        ? text('pace.learned', { speed })
        : f.pace.provenance === 'estimated'
          ? text('pace.estimated', { speed })
          : text('pace.value', { speed });
  }
  return [role, level, pace].join(' · ');
}

function MemberRow({ f, text, locale }: { f: MemberFacts; text: NousText; locale: V5Api['locale'] }) {
  return (
    <div className="v5-li">
      <Avi name={f.name} />
      <span className="t">
        <b>{f.isYou ? text('named', { name: f.name }) : f.name}</b>
        <small>{memberLine(f, text, locale)}</small>
      </span>
      {f.setsPace && <span className="v5-chip warn nb-tag">{text('group.givesPace')}</span>}
    </div>
  );
}

/**
 * La capsule choisit le mode : un clic sur l'autre onglet bascule le voyage. L'onglet suit toujours les données
 * (jamais l'inverse) : à l'ouverture, ou quand le voyage change ailleurs, on le remet sur le mode réel SANS écrire.
 * Seul un changement d'onglet venu du doigt (l'onglet bouge alors que le mode n'a pas bougé) écrit.
 */
function useModeCapsule(api: V5Api, onSwitch: (target: NousMode) => void) {
  const modeIndex = api.solo ? 0 : 1;
  const latest = useRef({ api, onSwitch });
  useEffect(() => {
    latest.current = { api, onSwitch };
  });
  useEffect(() => {
    if (latest.current.api.tab !== modeIndex) latest.current.api.setTab(modeIndex);
  }, [modeIndex]);
  const seen = useRef(api.tab);
  useEffect(() => {
    if (seen.current === api.tab) return;
    seen.current = api.tab;
    if (api.tab === modeIndex) return;
    latest.current.onSwitch(api.tab === 1 ? 'group' : 'solo');
  }, [api.tab, modeIndex]);
}

function NousBody() {
  const api = useV5();
  const text = nousText(api.t, api.locale);
  const switching = useRef(false);
  const latest = useRef(api);
  useEffect(() => {
    latest.current = api;
  });

  const switchTo = async (target: NousMode) => {
    const a = latest.current;
    if (switching.current) return;
    const back = () => a.setTab(a.solo ? 0 : 1);
    const t = nousText(a.t, a.locale);
    if (!a.canEdit) {
      a.announce(t('readOnly'), undefined, 'bad');
      back();
      return;
    }
    const plan = planSwitch(target, a.data.model.crew.loads.length, (a.data.pendingInvites ?? []).length);
    if (!plan.ok) {
      a.announce(t('switch.blocked'), undefined, 'bad');
      back();
      return;
    }
    const { tripId, slug } = a.data.model;
    const before = a.people;
    switching.current = true;
    try {
      const ok = await a.ctl.run(
        target === 'group' ? t('switch.toGroup', { count: plan.partySize }) : t('switch.toSolo'),
        () => compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: plan.partySize }),
        () => compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: before })
      );
      if (!ok) back();
    } finally {
      switching.current = false;
    }
  };

  useModeCapsule(api, (target) => void switchTo(target));
  return api.solo ? <SoloBody text={text} onSwitch={switchTo} /> : <GroupBody text={text} onSwitch={switchTo} />;
}

/* ---------- Solo ---------- */

function SoloBody({ text, onSwitch }: { text: NousText; onSwitch: (target: NousMode) => Promise<void> }) {
  const api = useV5();
  const { model } = api.data;
  const facts = useMemo(() => memberFacts(model, api.data.viewerId), [model, api.data.viewerId]);
  return (
    <>
      <Grp>
        {facts.map((f) => (
          <MemberRow key={f.userId} f={f} text={text} locale={api.locale} />
        ))}
      </Grp>
      {facts.length > 1 && (
        <p className="v5-note" role="status">
          {text('solo.mismatch', { count: facts.length })}
        </p>
      )}
      <Cap>{text('safety.title')}</Cap>
      <SafetyCard text={text} />
      <EmergencyCard text={text} />
      <p className="v5-note">{text('solo.note')}</p>
      {!api.canEdit && <p className="v5-note">{text('readOnly')}</p>}
      <PBtn onClick={() => void onSwitch('group')} disabled={!api.canEdit}>
        <V5Icon name="people" size="s" />
        {text('solo.toGroup')}
      </PBtn>
    </>
  );
}

/** Prévenir un proche : le texte est fabriqué ici, envoyé par l'application de messages de la personne. */
function SafetyCard({ text }: { text: NousText }) {
  const api = useV5();
  const { model, countryCode } = api.data;
  const [time, setTime] = useState('');
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  const route = hasRoute(model);
  const draft = useMemo(
    () => buildShare({ model, countryCode, returnTime: cleanReturnTime(time), t: api.t, locale: api.locale }),
    [model, countryCode, time, api.t, api.locale]
  );
  const mailto = mailtoHref(draft);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.body);
      api.announce(text('safety.copied'));
    } catch {
      api.announce(text('safety.copyFailed'), undefined, 'bad');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: draft.subject, text: draft.body });
      api.announce(text('safety.shared'));
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      await copy();
    }
  };

  return (
    <Grp>
      <Li icon="bell" title={text('safety.tellTitle')} detail={text('safety.tellSub')} />
      {route ? (
        <div className="nb-form">
          <label className="nb-field">
            <span>{text('safety.returnLabel')}</span>
            <input className="v5-inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="nb-field">
            <span>{text('safety.preview')}</span>
            <textarea className="v5-inp nb-preview" readOnly rows={7} value={draft.body} />
          </label>
          <div className="nb-actions nb-actions--flush">
            {canShare && (
              <button type="button" className="v5-mbtn p nb-btn" onClick={() => void share()}>
                <V5Icon name="share" size="xs" />
                {text('safety.send')}
              </button>
            )}
            {mailto && (
              <a className={`v5-mbtn nb-btn${canShare ? '' : ' p'}`} href={mailto}>
                <V5Icon name="chat" size="xs" />
                {text('safety.mail')}
              </a>
            )}
            <button type="button" className="v5-mbtn nb-btn" onClick={() => void copy()}>
              <V5Icon name="link" size="xs" />
              {text('safety.copy')}
            </button>
          </div>
          {!mailto && <p className="v5-note">{text('safety.tooLong')}</p>}
          <p className="v5-src">{text('safety.privacy')}</p>
        </div>
      ) : (
        <p className="v5-note nb-pad">{text('safety.noRoute')}</p>
      )}
    </Grp>
  );
}

const USE_KEY = { all: 'emergency.all', police: 'emergency.police', fireRescue: 'emergency.fireRescue' } as const;
const SOURCE_KEY = { eu: 'emergency.sourceEu', national: 'emergency.sourceNational', fallback: 'emergency.sourceFallback' } as const;

function EmergencyCard({ text }: { text: NousText }) {
  const api = useV5();
  const view = emergencyView(api.data.countryCode);
  return (
    <Grp>
      <Li icon="cross" title={text('emergency.title')} detail={text(SOURCE_KEY[view.source])} />
      {view.numbers.map((n) => (
        <div key={`${n.number}-${n.use}`} className="v5-li">
          <span className="t">
            <b className="v5-num">{n.number}</b>
            <small>{text(USE_KEY[n.use])}</small>
          </span>
          <a className="v5-mbtn p nb-btn" href={`tel:${n.number}`} aria-label={text('emergency.call', { number: n.number })}>
            <V5Icon name="cross" size="xs" />
            {n.number}
          </a>
        </div>
      ))}
    </Grp>
  );
}

/* ---------- Avec d'autres ---------- */

function GroupBody({ text, onSwitch }: { text: NousText; onSwitch: (target: NousMode) => Promise<void> }) {
  const api = useV5();
  const { ctl, canEdit, locale } = api;
  const { model } = api.data;
  const { tripId, slug, crew, budget } = model;
  const facts = useMemo(() => memberFacts(model, api.data.viewerId), [model, api.data.viewerId]);
  const pending = pendingFacts(api.data.pendingInvites ?? []);
  const members = crew.loads.length;
  const held = paceHeld(crew.pace);
  const gear = useMemo(() => gearSummary(model), [model]);
  const bounds = partyBounds(members);
  const money = (n: number | null | undefined) => moneyIn(locale, n, budget.currency);

  const setSize = (next: number) => {
    const before = api.people;
    void ctl.run(
      text('group.sizeSaved', { count: next }),
      () => compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: next }),
      () => compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: before })
    );
  };

  const distribute = () => {
    const assignments = balanceCarriers(gear.unassigned, crew.loads);
    if (!assignments.length) return;
    const send = (list: ReadonlyArray<{ itemId: string; carrierId: string | null }>) =>
      compasSetCarriersAction({ tripId, tripSlug: slug, assignments: list.map(({ itemId, carrierId }) => ({ itemId, carrierId })), shared: true });
    void ctl.run(
      text.count(assignments.length, 'group.gearDistributed'),
      () => send(assignments),
      () => send(assignments.map((a) => ({ itemId: a.itemId, carrierId: null })))
    );
  };

  const canDistribute = canEdit && members >= 2 && gear.unassigned.length > 0;
  const gearTitle = gear.unassigned.length ? text('group.gearTitleTodo') : gear.sharedCount ? text('group.gearTitleDone') : text('group.gearNoneTitle');
  const gearDetail = gear.unassigned.length
    ? text.count(gear.unassigned.length, 'group.gearTodo')
    : gear.sharedCount
      ? text.count(gear.sharedCount, 'group.gearDone')
      : text('group.gearNoneSub');

  return (
    <>
      <Grp>
        <div className="v5-li">
          <Fi icon="people" />
          <span className="t">
            <b id="nb-people-label">{text('group.peopleLabel')}</b>
            <small>
              {text.count(api.people, 'people')}
              {crew.guests > 0 ? ` · ${text('group.guests', { count: crew.guests })}` : ''}
            </small>
          </span>
          {canEdit && (
            <span className="nb-stp">
              <Stepper
                value={api.people}
                min={bounds.min}
                max={bounds.max}
                onChange={setSize}
                lessLabel={text('group.less')}
                moreLabel={text('group.more')}
                disabled={ctl.busy}
              />
            </span>
          )}
        </div>
      </Grp>
      {!canEdit && <p className="v5-note">{text('readOnly')}</p>}

      <Cap right={text('group.membersOf', { members, total: Math.max(api.people, members) })}>{text('group.membersCap')}</Cap>
      <Grp>
        {facts.map((f) => (
          <MemberRow key={f.userId} f={f} text={text} locale={locale} />
        ))}
        <div className="v5-li">
          <span className="v5-avadd" aria-hidden="true">
            <V5Icon name="plus" size="s" />
          </span>
          <span className="t">
            <b>{text('group.inviteTitle')}</b>
            <small>{text('group.inviteSub')}</small>
          </span>
          <Link className="v5-mbtn p nb-btn" href={HUB_GROUP_PATH}>
            <V5Icon name="link" size="xs" />
            {text('group.inviteLink')}
          </Link>
        </div>
      </Grp>

      {pending.length > 0 && (
        <>
          <Cap>{text('group.pendingCap')}</Cap>
          <Grp>
            {pending.map((p) => (
              <div key={p.id} className="v5-li">
                <Avi name={p.name} />
                <span className="t">
                  <b>{p.name}</b>
                  <small>{p.role === 'editor' ? text('group.pendingEditor') : text('group.pendingViewer')}</small>
                </span>
              </div>
            ))}
          </Grp>
        </>
      )}

      <Cap>{text('group.groupCap')}</Cap>
      <Grp>
        <Li
          icon="hike"
          title={held.kind === 'held' ? text('group.paceTitle', { name: held.name }) : text('group.paceNone')}
          detail={
            held.kind === 'held'
              ? text('group.paceSub', { speed: decimalIn(locale, held.kmh), known: held.known, total: held.total })
              : text('group.paceNoneSub')
          }
        />
        <div className="v5-li">
          <Fi icon="bag" />
          <span className="t">
            <b>{gearTitle}</b>
            <small>{gearDetail}</small>
          </span>
          <span className="nb-end">
            {canDistribute && (
              <button type="button" className="v5-mbtn p nb-btn" onClick={distribute} disabled={ctl.busy}>
                {text('group.gearDistribute')}
              </button>
            )}
            {gear.sharedCount > 0 && (
              <MBtn className="nb-btn" onClick={() => api.openSpace('sac', { tab: 2 })}>
                {text('group.see')}
              </MBtn>
            )}
          </span>
        </div>
        <div className="v5-li">
          <Fi icon="euro" />
          <span className="t">
            <b>{text('group.budgetTitle')}</b>
            <small>{budget.perPerson != null && budget.perPerson > 0 ? text('group.budgetSub', { amount: money(budget.perPerson) }) : text('group.budgetNone')}</small>
          </span>
          <MBtn className="nb-btn" onClick={() => api.openSpace('budget')}>
            {text('group.see')}
          </MBtn>
        </div>
      </Grp>

      {gear.sharedCount > 0 && (
        <>
          <Cap>{text('group.carriesCap')}</Cap>
          <Grp>
            {gear.shares.map((s) => (
              <div key={s.userId} className="v5-li">
                <Avi name={s.name} />
                <span className="t">
                  <b>{s.name}</b>
                  <small>{s.items.length ? s.items.join(', ') : text('group.carriesNone')}</small>
                </span>
                {s.items.length > 0 && (
                  <span className="v v5-num">
                    {s.grams > 0 ? `+${kgIn(locale, s.grams)}` : ''}
                    {s.partial ? ` (${text('group.partial')})` : ''}
                  </span>
                )}
              </div>
            ))}
          </Grp>
        </>
      )}

      {members > 1 && <p className="v5-note">{text('switch.blocked')}</p>}
      <PBtn onClick={() => void onSwitch('solo')} disabled={!canEdit || members > 1}>
        <V5Icon name="person" size="s" />
        {text('group.backSolo')}
      </PBtn>
    </>
  );
}

export const nousDrawer: V5DrawerDef = {
  space: 'nous',
  tabs: (api) => {
    const text = nousText(api.t, api.locale);
    return [
      { icon: 'person', label: text('tabSolo') },
      { icon: 'people', label: text('tabGroup') },
    ];
  },
  title: (api) => {
    const text = nousText(api.t, api.locale);
    return api.solo ? text('tabSolo') : text('tabGroup');
  },
  subtitle: (api) => {
    if (api.solo) return null;
    return nousText(api.t, api.locale).count(api.people, 'people');
  },
  Body: NousBody,
};
