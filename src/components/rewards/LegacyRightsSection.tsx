'use client';

import React, { useMemo, useState } from 'react';
import { WITHDRAWAL_STATUS_LABEL, formatDay, formatPoints, type LegacyRights } from '@/features/rewards/domain/wallet';
import { newIdempotencyKey } from '@/features/rewards/domain/redemption';
import './rewards.css';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Droits acquis de l'ancien programme de partage (parts économiques, cash,
 * crédit boutique créateur). Affichés séparément des points, jamais
 * additionnés : ce ne sont pas les mêmes droits. N'apparaît que si un montant
 * existe (`hasLegacyRights`). Le retrait cash reste possible pour les droits
 * déjà acquis ; le serveur vérifie solde, seuil et conditions.
 */

const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function LegacyRightsSection({ legacy, onWithdrawn }: { legacy: LegacyRights; onWithdrawn?: () => void }) {
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState<'bank_transfer' | 'paypal'>('bank_transfer');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [attemptKey, setAttemptKey] = useState(() => newIdempotencyKey());

  const threshold = legacy.cashoutMinThresholdEur;
  const canWithdraw = legacy.cashoutActive && legacy.availableCashEur > 0 && (threshold === null || legacy.availableCashEur >= threshold);
  const hint = useMemo(() => {
    if (!legacy.cashoutActive) return 'Les retraits sont suspendus pour le moment. Votre solde reste acquis.';
    if (threshold !== null && legacy.availableCashEur < threshold) {
      return `Le retrait est possible à partir de ${EUR.format(threshold)}.`;
    }
    return null;
  }, [legacy.cashoutActive, legacy.availableCashEur, threshold]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100) {
      setResult({ ok: false, message: 'Indiquez un montant en euros, deux décimales au plus.' });
      return;
    }
    if (value > legacy.availableCashEur) {
      setResult({ ok: false, message: 'Ce montant dépasse votre solde disponible.' });
      return;
    }
    const metadata =
      provider === 'bank_transfer'
        ? { iban: iban.replace(/\s+/g, '').toUpperCase(), bic: bic.replace(/\s+/g, '').toUpperCase() }
        : { paypal_email: paypalEmail.trim() };
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch('/api/rewards/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ amount: value, payment_provider: provider, idempotency_key: attemptKey, metadata }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setResult({ ok: false, message: typeof payload?.error === 'string' ? payload.error : 'Demande non enregistrée. Réessayez.' });
        return;
      }
      setResult({ ok: true, message: `Demande de retrait de ${EUR.format(value)} enregistrée. Elle est examinée avant tout virement.` });
      setAmount('');
      setIban('');
      setBic('');
      setPaypalEmail('');
      setAttemptKey(newIdempotencyKey());
      onWithdrawn?.();
    } catch {
      // Issue inconnue : la même clé sera renvoyée, le serveur ne crée pas de doublon.
      setResult({ ok: false, message: 'Connexion interrompue. Réessayez : la demande ne sera pas doublée.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="lkdv-rw" aria-labelledby="rw-legacy-h">
      <h2 className="lkdv-rw-h" id="rw-legacy-h">Droits de l’ancien programme</h2>
      <div className="lkdv-rw-card">
        <p className="lkdv-rw-note" style={{ marginBottom: 8 }}>
          Ces montants viennent de l’ancien programme de partage. Ils restent acquis et sont indépendants de vos points : ils ne
          s’additionnent pas et ne se convertissent pas.
        </p>
        <div className="lkdv-rw-details" style={{ background: 'transparent', padding: 0 }}>
          <dl>
            {legacy.economicPoints > 0 || legacy.economicPendingPoints > 0 ? (
              <>
                <dt>Points d’activité (ancien barème)</dt>
                <dd>
                  {formatPoints(legacy.economicPoints)}
                  {legacy.economicPendingPoints > 0 ? ` · ${formatPoints(legacy.economicPendingPoints)} en vérification` : ''}
                </dd>
              </>
            ) : null}
            {legacy.availableCashEur > 0 || legacy.pendingCashEur > 0 ? (
              <>
                <dt>Cash disponible</dt>
                <dd>
                  {EUR.format(legacy.availableCashEur)}
                  {legacy.pendingCashEur > 0 ? ` · ${EUR.format(legacy.pendingCashEur)} en cours` : ''}
                </dd>
              </>
            ) : null}
            {legacy.storeCreditCents > 0 ? (
              <>
                <dt>Crédit boutique créateur</dt>
                <dd>{EUR.format(legacy.storeCreditCents / 100)} · utilisable en boutique</dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>

      {legacy.availableCashEur > 0 ? (
        <form className="lkdv-rw-card" onSubmit={submit} aria-labelledby="rw-withdraw-h" noValidate>
          <h3 className="lkdv-rw-h" id="rw-withdraw-h" style={{ marginTop: 0 }}>Demander un retrait</h3>
          {hint ? <p className="lkdv-rw-note">{hint}</p> : null}
          {canWithdraw ? (
            <>
              <label className="lkdv-rw-note" htmlFor="rw-amount" style={{ display: 'block', marginTop: 8 }}>
                Montant (€)
              </label>
              <input
                id="rw-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="lkdv-rw-btn"
                style={{ width: '100%', justifyContent: 'flex-start', cursor: 'text' }}
                required
              />
              <div className="lkdv-rw-actions" role="radiogroup" aria-label="Moyen de versement">
                <button type="button" role="radio" aria-checked={provider === 'bank_transfer'} className={`lkdv-rw-btn sm${provider === 'bank_transfer' ? ' primary' : ''}`} onClick={() => setProvider('bank_transfer')}>
                  Virement SEPA
                </button>
                <button type="button" role="radio" aria-checked={provider === 'paypal'} className={`lkdv-rw-btn sm${provider === 'paypal' ? ' primary' : ''}`} onClick={() => setProvider('paypal')}>
                  PayPal
                </button>
              </div>
              {provider === 'bank_transfer' ? (
                <>
                  <label className="lkdv-rw-note" htmlFor="rw-iban" style={{ display: 'block', marginTop: 8 }}>IBAN</label>
                  <input id="rw-iban" autoComplete="off" value={iban} onChange={(e) => setIban(e.target.value)} className="lkdv-rw-btn" style={{ width: '100%', justifyContent: 'flex-start', cursor: 'text' }} />
                  <label className="lkdv-rw-note" htmlFor="rw-bic" style={{ display: 'block', marginTop: 8 }}>BIC</label>
                  <input id="rw-bic" autoComplete="off" value={bic} onChange={(e) => setBic(e.target.value)} className="lkdv-rw-btn" style={{ width: '100%', justifyContent: 'flex-start', cursor: 'text' }} />
                </>
              ) : (
                <>
                  <label className="lkdv-rw-note" htmlFor="rw-paypal" style={{ display: 'block', marginTop: 8 }}>Adresse e-mail PayPal</label>
                  <input id="rw-paypal" type="email" autoComplete="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className="lkdv-rw-btn" style={{ width: '100%', justifyContent: 'flex-start', cursor: 'text' }} />
                </>
              )}
              <div className="lkdv-rw-actions">
                <button type="submit" className="lkdv-rw-btn primary" disabled={submitting} aria-busy={submitting}>
                  {submitting ? 'Envoi en cours…' : 'Demander le virement'}
                </button>
              </div>
            </>
          ) : null}
          {result ? (
            <div className={`lkdv-rw-alert ${result.ok ? 'ok' : 'bad'}`} role={result.ok ? 'status' : 'alert'} style={{ marginTop: 8 }}>
              {result.ok ? <LKDVIcon name="valider" size={16} aria-hidden="true" /> : <LKDVIcon name="alerte" size={16} aria-hidden="true" />}
              <p>{result.message}</p>
            </div>
          ) : null}
        </form>
      ) : null}

      {legacy.withdrawals.length > 0 ? (
        <div className="lkdv-rw-card">
          <h3 className="lkdv-rw-h" style={{ marginTop: 0 }}>Demandes de retrait</h3>
          <ul className="lkdv-rw-hist">
            {legacy.withdrawals.map((w) => (
              <li key={w.id}>
                <b>{EUR.format(w.amountEur)}</b>
                <span className="lkdv-rw-amt" data-sign="minus">{WITHDRAWAL_STATUS_LABEL[w.status] ?? w.status}</span>
                <small>
                  {w.provider === 'paypal' ? 'PayPal' : 'Virement'} · {formatDay(w.requestedAt)}
                  {w.status === 'rejected' && w.rejectionReason ? ` · ${w.rejectionReason}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
