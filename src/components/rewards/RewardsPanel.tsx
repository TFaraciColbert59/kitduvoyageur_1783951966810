'use client';

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronDown, Gift, Loader2, RefreshCw, Target, WifiOff } from 'lucide-react';
import {
  FULFILLMENT_LABEL,
  REDEEMABILITY_HINT,
  REDEEMABILITY_LABEL,
  canBeGoal,
  dedupeCatalog,
  goalProgress,
  redeemability,
  type CatalogItem,
} from '@/features/rewards/domain/catalog';
import {
  AWARD_REASON_LABEL,
  AWARD_STATUS_LABEL,
  REDEMPTION_STATUS_LABEL,
  formatDateTime,
  formatDay,
  formatPoints,
  formatSignedPoints,
  nextWeekStart,
  type Wallet,
  type WalletView,
} from '@/features/rewards/domain/wallet';
import { REDEEM_ERROR_MESSAGE, redeemReducer, type RedeemFlow } from '@/features/rewards/domain/redemption';
import type { RedeemOutcome } from '@/features/rewards/client/useRewardsWallet';
import { PILOT_C_RULES } from '@/features/rewards/domain/contract';
import './rewards.css';

/**
 * Récompenses : solde dépensable, objectif choisi, catalogue court et
 * historique, dans la grammaire du Compte. Aucune requête ici : les données et
 * les actions viennent du contrôleur `useRewardsWallet`.
 *
 * Doctrine d'affichage : inconnu ≠ 0, attente ≠ solde, gain célébré seulement
 * après confirmation serveur, hors ligne = dernier solde daté sans échange.
 */

export interface RewardsController {
  view: WalletView;
  isOnline: boolean;
  isFetching: boolean;
  refetch: () => void;
  setGoal: (rewardId: string | null) => Promise<unknown>;
  goalPending: boolean;
  goalError: string | null;
  redeem: (rewardId: string, idempotencyKey: string) => Promise<RedeemOutcome>;
}

function walletOf(view: WalletView): Wallet | null {
  return view.state === 'ready' || view.state === 'offline' ? view.wallet : null;
}

/** Annonce unique pour les technologies d'assistance (WCAG 4.1.3). */
function useAnnouncer() {
  const [message, setMessage] = useState('');
  const announce = (text: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(text), 30);
  };
  return { message, announce };
}

function Thumb({ item }: { item: Pick<CatalogItem, 'image' | 'alt'> | null }) {
  if (item?.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="lkdv-rw-thumb" src={item.image} alt="" loading="lazy" />;
  }
  return (
    <span className="lkdv-rw-thumb" aria-hidden="true">
      <Gift size={20} />
    </span>
  );
}

function BalanceCard({
  controller,
  wallet,
  goalItem,
  onChooseGoal,
  onRedeemGoal,
  gain,
}: {
  controller: RewardsController;
  wallet: Wallet | null;
  goalItem: CatalogItem | null;
  onChooseGoal: () => void;
  onRedeemGoal: (item: CatalogItem) => void;
  gain: number | null;
}) {
  const { view } = controller;

  if (view.state === 'loading') {
    return (
      <div className="lkdv-rw-card" aria-busy="true">
        <p className="lkdv-rw-eyebrow">Points disponibles</p>
        <span className="lkdv-rw-skel" aria-hidden="true" />
        <p className="lkdv-rw-sub">Chargement du solde…</p>
      </div>
    );
  }

  if (view.state === 'unavailable' || view.state === 'offline_empty') {
    const offline = view.state === 'offline_empty';
    return (
      <div className="lkdv-rw-card">
        <p className="lkdv-rw-eyebrow">Points disponibles</p>
        <div className="lkdv-rw-alert warn" role="alert" style={{ marginTop: 8 }}>
          {offline ? <WifiOff size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
          <p>
            {offline
              ? 'Hors ligne : aucun solde enregistré sur cet appareil. Il s’affichera au retour du réseau.'
              : 'Solde indisponible pour le moment. Vos points ne sont pas perdus.'}
          </p>
        </div>
        {!offline ? (
          <div className="lkdv-rw-actions">
            <button type="button" className="lkdv-rw-btn" onClick={controller.refetch} disabled={controller.isFetching}>
              <RefreshCw size={15} aria-hidden="true" /> Réessayer
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!wallet) return null;
  const progress = goalItem ? goalProgress(wallet.balance, goalItem) : null;
  const goalState = goalItem ? redeemability(goalItem, wallet.balance) : null;
  const offline = view.state === 'offline';

  return (
    <div className="lkdv-rw-card">
      {gain && gain > 0 ? <span className="lkdv-rw-gain" aria-hidden="true">+{formatPoints(gain)}</span> : null}
      <p className="lkdv-rw-eyebrow">Points disponibles</p>
      <p className="lkdv-rw-balance">
        <b>{formatPoints(wallet.balance)}</b>
        <span>point{Math.abs(wallet.balance) > 1 ? 's' : ''}</span>
      </p>
      {offline ? (
        <p className="lkdv-rw-sub">
          <WifiOff size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Dernier solde connu · {formatDateTime(view.savedAt)} · synchronisation en attente
        </p>
      ) : null}
      {wallet.pendingPoints > 0 ? (
        <span className="lkdv-rw-pending">
          {formatPoints(wallet.pendingPoints)} points en vérification · non utilisables pour l’instant
        </span>
      ) : null}

      {goalItem && progress ? (
        <div className="lkdv-rw-goal">
          <Thumb item={goalItem} />
          <div>
            <p className="lkdv-rw-goal-t">Objectif : {goalItem.title}</p>
            <p className="lkdv-rw-goal-n">
              {formatPoints(progress.acquired)} / {formatPoints(progress.required)} points
              {progress.reached ? '' : ` · encore ${formatPoints(progress.missing)}`}
            </p>
            <div
              className="lkdv-rw-bar"
              role="progressbar"
              aria-label={`Progression vers ${goalItem.title}`}
              aria-valuemin={0}
              aria-valuemax={progress.required}
              aria-valuenow={Math.min(progress.acquired, progress.required)}
            >
              <i style={{ transform: `scaleX(${progress.ratio})` }} />
            </div>
          </div>
        </div>
      ) : null}

      {goalItem && goalState === 'redeemable' && !offline ? (
        <div className="lkdv-rw-alert ok" style={{ marginTop: 10 }}>
          <Check size={16} aria-hidden="true" />
          <p>Votre objectif « {goalItem.title} » est disponible.</p>
        </div>
      ) : null}
      {goalItem && progress?.reached && goalState !== 'redeemable' ? (
        <p className="lkdv-rw-sub">Points suffisants · {REDEEMABILITY_LABEL[goalState ?? 'unavailable'].toLowerCase()}.</p>
      ) : null}

      <div className="lkdv-rw-actions">
        {goalItem && goalState === 'redeemable' && !offline ? (
          <button type="button" className="lkdv-rw-btn primary" onClick={() => onRedeemGoal(goalItem)}>
            Utiliser {formatPoints(goalItem.pointsCost)} points
          </button>
        ) : null}
        {!goalItem ? (
          <button type="button" className="lkdv-rw-btn" onClick={onChooseGoal}>
            <Target size={15} aria-hidden="true" /> Choisir ma récompense
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProgramNote({ wallet }: { wallet: Wallet }) {
  const { program } = wallet;
  const openRules = program.emissionOpen ? program.rules.filter((rule) => rule.producerOpen) : [];
  const capReached = program.emissionOpen && wallet.weekUsed >= program.weeklyCap;

  return (
    <div className="lkdv-rw-card">
      <p className="lkdv-rw-eyebrow">Gagner des points</p>
      {openRules.length === 0 ? (
        <p className="lkdv-rw-note" style={{ marginTop: 6 }}>
          Les nouveaux gains ne sont pas encore ouverts. Vos points acquis restent valables et utilisables dès qu’un objet est
          disponible.
        </p>
      ) : (
        <>
          <ul className="lkdv-rw-rules">
            {openRules.map((rule) => (
              <li key={rule.key}>
                <span>{rule.label}{rule.requiresReview ? ' (après vérification)' : ''}</span>
                <b>
                  +{formatPoints(rule.points)}
                  {rule.weeklyLimit !== null ? ` · ${rule.weeklyLimit}/semaine` : ''}
                </b>
              </li>
            ))}
          </ul>
          <p className="lkdv-rw-note" style={{ marginTop: 8 }}>
            {capReached
              ? `Plafond de cette période atteint. Il se renouvelle ${nextWeekStart(wallet.weekStart)}.`
              : `Cette semaine : ${formatPoints(wallet.weekUsed)} / ${formatPoints(program.weeklyCap)} points, renouvelés ${nextWeekStart(wallet.weekStart)}.`}
          </p>
        </>
      )}
      <p className="lkdv-rw-note" style={{ marginTop: 6 }}>
        Les likes, la connexion, le temps passé, le partage de position et les alertes de sécurité ne rapportent jamais de points.
        Vos XP et niveaux restent dans{' '}
        <Link className="lkdv-rw-link" href="/progression">
          Progression
        </Link>
        .
      </p>
    </div>
  );
}

function CatalogRow({
  item,
  wallet,
  isGoal,
  canAct,
  flow,
  goalBusy,
  onGoal,
  onOpenRedeem,
  onConfirm,
  onCancel,
  onRetry,
}: {
  item: CatalogItem;
  wallet: Wallet;
  isGoal: boolean;
  canAct: boolean;
  flow: RedeemFlow;
  goalBusy: boolean;
  onGoal: (item: CatalogItem) => void;
  onOpenRedeem: (item: CatalogItem) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const state = redeemability(item, wallet.balance);
  const detailsId = `rw-details-${item.id}`;
  const mine = 'rewardId' in flow && flow.rewardId === item.id;

  return (
    <li className="lkdv-rw-item" data-goal={isGoal ? 'true' : 'false'}>
      <div className="lkdv-rw-row">
        <Thumb item={item} />
        <div>
          <h4>{item.title}</h4>
          <p>{[item.value, item.fulfillment ? FULFILLMENT_LABEL[item.fulfillment] : null].filter(Boolean).join(' · ')}</p>
          <span className="lkdv-rw-tag" data-state={state}>
            {isGoal ? 'Objectif · ' : ''}
            {REDEEMABILITY_LABEL[state]}
          </span>
        </div>
        <div className="lkdv-rw-cost">{formatPoints(item.pointsCost)} pts</div>
      </div>

      <div className="lkdv-rw-actions" style={{ marginTop: 6 }}>
        {state === 'redeemable' && canAct && !mine ? (
          <button type="button" className="lkdv-rw-btn primary sm" onClick={() => onOpenRedeem(item)}>
            Utiliser {formatPoints(item.pointsCost)} points
          </button>
        ) : null}
        {canBeGoal(item) ? (
          <button
            type="button"
            className="lkdv-rw-btn sm"
            aria-pressed={isGoal}
            disabled={goalBusy || !canAct}
            onClick={() => onGoal(item)}
          >
            <Target size={14} aria-hidden="true" /> {isGoal ? 'Objectif choisi' : 'Choisir comme objectif'}
          </button>
        ) : null}
        <button
          type="button"
          className="lkdv-rw-more"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
        >
          Détails <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div className="lkdv-rw-details" id={detailsId}>
          {item.description ? <p style={{ margin: '0 0 6px' }}>{item.description}</p> : null}
          <dl>
            <dt>Statut</dt>
            <dd>{REDEEMABILITY_HINT[state]}</dd>
            <dt>Points</dt>
            <dd>{formatPoints(item.pointsCost)}</dd>
            {item.cashComplementCents > 0 ? (
              <>
                <dt>Reste à payer</dt>
                <dd>{(item.cashComplementCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</dd>
              </>
            ) : null}
            {item.fundingStatus === 'funded' && item.stockRemaining !== null ? (
              <>
                <dt>Stock</dt>
                <dd>{item.stockRemaining > 0 ? `${formatPoints(item.stockRemaining)} disponible(s)` : 'Épuisé'}</dd>
              </>
            ) : null}
            {item.terms ? (
              <>
                <dt>Conditions</dt>
                <dd>
                  {item.terms}
                  {item.termsVersion ? ` (version ${item.termsVersion})` : ''}
                </dd>
              </>
            ) : null}
            {item.partnerDisclosure ? (
              <>
                <dt>Partenaire</dt>
                <dd>{item.partnerDisclosure}</dd>
              </>
            ) : null}
          </dl>
          <p className="lkdv-rw-note" style={{ marginTop: 6 }}>Choisir un objectif ne dépense aucun point.</p>
        </div>
      ) : null}

      {mine && (flow.step === 'confirming' || flow.step === 'submitting') ? (
        <div className="lkdv-rw-confirm" role="group" aria-label={`Confirmer l’échange : ${item.title}`}>
          <p>
            <b>Utiliser {formatPoints(item.pointsCost)} points</b> pour « {item.title} ».
          </p>
          <p className="lkdv-rw-note">
            Solde après réservation : {formatPoints(wallet.balance - item.pointsCost)} points.
            {item.terms ? ` ${item.terms}` : ''} Le débit n’a lieu qu’une fois la réservation confirmée.
          </p>
          <div className="lkdv-rw-actions">
            <button
              type="button"
              className="lkdv-rw-btn primary"
              onClick={onConfirm}
              disabled={flow.step === 'submitting'}
              aria-busy={flow.step === 'submitting'}
            >
              {flow.step === 'submitting' ? (
                <>
                  <Loader2 size={15} aria-hidden="true" /> Réservation en cours…
                </>
              ) : (
                'Confirmer l’échange'
              )}
            </button>
            <button type="button" className="lkdv-rw-btn" onClick={onCancel} disabled={flow.step === 'submitting'}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {mine && flow.step === 'reserved' ? (
        <div className="lkdv-rw-alert ok" style={{ marginTop: 10 }}>
          <Check size={16} aria-hidden="true" />
          <p>
            Récompense réservée{flow.reference ? ` · référence ${flow.reference}` : ''}. Son suivi apparaît dans l’historique.
          </p>
        </div>
      ) : null}

      {mine && flow.step === 'failed' ? (
        <div className="lkdv-rw-alert bad" role="alert" style={{ marginTop: 10 }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <p>{REDEEM_ERROR_MESSAGE[flow.code]}</p>
            <div className="lkdv-rw-actions">
              <button type="button" className="lkdv-rw-btn sm" onClick={onRetry}>
                Réessayer
              </button>
              <button type="button" className="lkdv-rw-btn sm" onClick={onCancel}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function RewardsOverview({ controller }: { controller: RewardsController }) {
  const wallet = walletOf(controller.view);
  const { message, announce } = useAnnouncer();
  const catalogRef = useRef<HTMLHeadingElement>(null);
  const [flow, dispatch] = useReducer(
    (state: RedeemFlow, event: Parameters<typeof redeemReducer>[1]) => redeemReducer(state, event),
    { step: 'idle' } as RedeemFlow
  );
  const submittingRef = useRef(false);

  // Gain confirmé entre deux lectures : un repère discret + une annonce.
  const previousBalance = useRef<number | null>(null);
  const [gain, setGain] = useState<number | null>(null);
  useEffect(() => {
    if (!wallet || controller.view.state !== 'ready') return;
    const before = previousBalance.current;
    previousBalance.current = wallet.balance;
    if (before !== null && wallet.balance > before && flow.step !== 'reserved') {
      const diff = wallet.balance - before;
      setGain(diff);
      announce(`${formatPoints(diff)} points validés, total ${formatPoints(wallet.balance)}`);
      const timer = window.setTimeout(() => setGain(null), 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.balance, controller.view.state]);

  const catalog = useMemo(() => {
    if (!wallet) return [];
    return dedupeCatalog(
      wallet.catalog.filter((item) => canBeGoal(item) || item.id === wallet.goalRewardId),
      wallet.goalRewardId
    );
  }, [wallet]);

  const goalItem = useMemo(
    () => (wallet?.goalRewardId ? wallet.catalog.find((item) => item.id === wallet.goalRewardId) ?? null : null),
    [wallet]
  );

  const canAct = controller.view.state === 'ready' && controller.isOnline;

  const submit = async () => {
    if (flow.step !== 'confirming' || submittingRef.current) return;
    submittingRef.current = true;
    const { rewardId, key } = flow;
    dispatch({ type: 'confirm' });
    const outcome = await controller.redeem(rewardId, key);
    submittingRef.current = false;
    if (outcome.ok) {
      dispatch({ type: 'success', reference: outcome.data.reference, balance: outcome.data.balance });
      announce(`Récompense réservée${outcome.data.reference ? `, référence ${outcome.data.reference}` : ''}. Solde ${formatPoints(outcome.data.balance)} points.`);
    } else {
      dispatch({ type: 'failure', code: outcome.code });
      announce(REDEEM_ERROR_MESSAGE[outcome.code]);
    }
  };

  const chooseGoal = async (item: CatalogItem) => {
    const next = wallet?.goalRewardId === item.id ? null : item.id;
    try {
      await controller.setGoal(next);
      announce(next ? `Objectif choisi : ${item.title}. Aucun point dépensé.` : 'Objectif retiré.');
    } catch {
      announce('L’objectif n’a pas pu être enregistré. Réessayez.');
    }
  };

  return (
    <div className="lkdv-rw">
      <div className="lkdv-rw-sr" role="status" aria-live="polite">
        {message}
      </div>
      <BalanceCard
        controller={controller}
        wallet={wallet}
        goalItem={goalItem}
        gain={gain}
        onChooseGoal={() => catalogRef.current?.focus()}
        onRedeemGoal={(item) => dispatch({ type: 'open', rewardId: item.id })}
      />

      {controller.goalError ? (
        <div className="lkdv-rw-alert bad" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>
            {controller.goalError === 'reward_unavailable'
              ? 'Cet objet n’est plus proposé comme objectif.'
              : 'L’objectif n’a pas pu être enregistré. Réessayez.'}
          </p>
        </div>
      ) : null}

      {wallet ? <ProgramNote wallet={wallet} /> : null}

      {wallet ? (
        <>
          <h3 className="lkdv-rw-h" ref={catalogRef} tabIndex={-1}>
            Récompenses
          </h3>
          {catalog.length === 0 ? (
            <div className="lkdv-rw-empty">
              <b>Aucune récompense proposée</b>
              Le catalogue s’affichera ici dès qu’un objet sera disponible.
            </div>
          ) : (
            <ul className="lkdv-rw-list">
              {catalog.map((item) => (
                <CatalogRow
                  key={item.id}
                  item={item}
                  wallet={wallet}
                  isGoal={wallet.goalRewardId === item.id}
                  canAct={canAct}
                  flow={flow}
                  goalBusy={controller.goalPending}
                  onGoal={chooseGoal}
                  onOpenRedeem={(target) => dispatch({ type: 'open', rewardId: target.id })}
                  onConfirm={() => void submit()}
                  onCancel={() => dispatch({ type: 'cancel' })}
                  onRetry={() => dispatch({ type: 'retry' })}
                />
              ))}
            </ul>
          )}
          {!controller.isOnline ? (
            <p className="lkdv-rw-note">Hors ligne : les échanges et le choix d’objectif reprendront au retour du réseau.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type HistoryLine = { id: string; title: string; detail: string; amount: number | null; at: string };

export function RewardsHistory({ controller }: { controller: RewardsController }) {
  const wallet = walletOf(controller.view);

  if (controller.view.state === 'loading') {
    return (
      <div className="lkdv-rw" aria-busy="true">
        <span className="lkdv-rw-skel" aria-hidden="true" />
        <p className="lkdv-rw-sub">Chargement de l’historique…</p>
      </div>
    );
  }
  if (!wallet) {
    return (
      <div className="lkdv-rw">
        <div className="lkdv-rw-alert warn" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>Historique indisponible pour le moment.</p>
        </div>
        {controller.view.state === 'unavailable' ? (
          <div className="lkdv-rw-actions">
            <button type="button" className="lkdv-rw-btn" onClick={controller.refetch}>
              <RefreshCw size={15} aria-hidden="true" /> Réessayer
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const pending = wallet.awards.filter((award) => award.status === 'pending');
  const closedAwards = wallet.awards.filter((award) => award.status !== 'pending');
  // Programme fermé : la configuration lue n'a pas de règles ouvertes, mais une
  // décision passée garde son libellé (barème pilote) plutôt qu'un terme vague.
  const ruleLabel = (key: string) =>
    wallet.program.rules.find((rule) => rule.key === key)?.label
    ?? PILOT_C_RULES.find((rule) => rule.key === key)?.label
    ?? 'Contribution';

  const lines: HistoryLine[] = wallet.history.map((entry) => ({
    id: entry.id,
    title: entry.label,
    detail: formatDay(entry.createdAt),
    amount: entry.points,
    at: entry.createdAt,
  }));

  return (
    <div className="lkdv-rw">
      {controller.view.state === 'offline' ? (
        <p className="lkdv-rw-sub">Dernier historique connu · {formatDateTime(controller.view.savedAt)}</p>
      ) : null}

      {pending.length > 0 ? (
        <section className="lkdv-rw-card" aria-labelledby="rw-h-pending">
          <h3 className="lkdv-rw-h" id="rw-h-pending" style={{ marginTop: 0 }}>En vérification</h3>
          <ul className="lkdv-rw-hist">
            {pending.map((award) => (
              <li key={award.id}>
                <b>{ruleLabel(award.ruleKey)}</b>
                <span className="lkdv-rw-amt" data-sign="plus">{formatPoints(award.points)} en attente</span>
                <small>{AWARD_STATUS_LABEL.pending} · {formatDay(award.createdAt)} · non utilisable avant validation</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {wallet.redemptions.length > 0 ? (
        <section className="lkdv-rw-card" aria-labelledby="rw-h-redemptions">
          <h3 className="lkdv-rw-h" id="rw-h-redemptions" style={{ marginTop: 0 }}>Échanges</h3>
          <ul className="lkdv-rw-hist">
            {wallet.redemptions.map((r) => (
              <li key={r.id}>
                <b>{r.rewardTitle}</b>
                <span className="lkdv-rw-amt" data-sign="minus">{formatPoints(r.pointsSpent)} pts</span>
                <small>
                  {REDEMPTION_STATUS_LABEL[r.status] ?? r.status}
                  {r.reference ? ` · ${r.reference}` : ''} · {formatDay(r.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="lkdv-rw-card" aria-labelledby="rw-h-moves">
        <h3 className="lkdv-rw-h" id="rw-h-moves" style={{ marginTop: 0 }}>Mouvements de points</h3>
        {lines.length === 0 ? (
          <div className="lkdv-rw-empty">
            <b>Aucun mouvement</b>
            Vos gains, échanges et corrections apparaîtront ici avec leur date.
          </div>
        ) : (
          <ul className="lkdv-rw-hist">
            {lines.map((line) => (
              <li key={line.id}>
                <b>{line.title}</b>
                {line.amount !== null ? (
                  <span className="lkdv-rw-amt" data-sign={line.amount >= 0 ? 'plus' : 'minus'}>
                    {formatSignedPoints(line.amount)}
                  </span>
                ) : null}
                <small>{line.detail}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closedAwards.length > 0 ? (
        <section className="lkdv-rw-card" aria-labelledby="rw-h-closed">
          <h3 className="lkdv-rw-h" id="rw-h-closed" style={{ marginTop: 0 }}>Non attribués ou corrigés</h3>
          <ul className="lkdv-rw-hist">
            {closedAwards.map((award) => (
              <li key={award.id}>
                <b>{ruleLabel(award.ruleKey)}</b>
                <span className="lkdv-rw-amt" data-sign="minus">{AWARD_STATUS_LABEL[award.status]}</span>
                <small>
                  {award.reason ? AWARD_REASON_LABEL[award.reason] ?? award.reason : AWARD_STATUS_LABEL[award.status]} · {formatDay(award.createdAt)}
                  {award.reversalShortfall > 0 ? ` · ${formatPoints(award.reversalShortfall)} points déjà dépensés non repris` : ''}
                </small>
              </li>
            ))}
          </ul>
          <p className="lkdv-rw-note" style={{ marginTop: 6 }}>
            Une décision vous semble erronée ? Écrivez-nous depuis{' '}
            <Link className="lkdv-rw-link" href="/contact">
              le formulaire de contact
            </Link>{' '}
            en citant la date.
          </p>
        </section>
      ) : null}
    </div>
  );
}
