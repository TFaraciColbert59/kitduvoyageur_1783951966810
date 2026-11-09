'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Banner } from '../../ui/states';
import { Button } from '../../ui/button';
import { CardSoft, Label } from '../../ui/card';
import { Chip } from '../../ui/chip';
import { Field, TextInput } from '../../ui/field';
import { Kbd } from '../../ui/kbd';
import { useToast } from '../../ui/toast';
import { useHotkeys } from '../../ui/use-hotkeys';
import { euros, relativeFr } from '../../lib/format';
import type { RequestDetail } from '../../lib/rpc';
import { approveRequest, errorMessage, runCommand } from '../data/cmd';

const PARAM_LABEL: Record<string, string> = {
  amount_cents: 'Montant',
  reason: 'Motif',
  reason_text: 'Précision',
  target: 'Cible',
  until: 'Jusqu’au',
  confirmation: 'Confirmation'
};

function paramValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'non renseigné';
  if (key === 'amount_cents' && typeof value === 'number') return euros(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Validation d'une demande (maquette `Remboursement.dc.html`) :
 * étapes, récapitulatif, empreinte, saisie de confirmation, mode solo affiché.
 */
export function ApprovalPanel({ request }: { request: RequestDetail }) {
  const router = useRouter();
  const { push } = useToast();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const amount = request.amount_cents;
  const validateLabel = amount ? `Valider et rembourser ${euros(amount)}` : 'Valider la demande';
  const hint = request.confirmation_hint || (amount ? `Tapez le montant : ${euros(amount)}` : 'Tapez le pseudo ou la référence');

  const params = useMemo(() => Object.entries(request.params ?? {}), [request.params]);

  const approve = async () => {
    if (!confirmation.trim()) {
      setError('Recopiez la valeur demandée : la validation est liée à ces valeurs exactes.');
      return;
    }
    setBusy('approve');
    setError(null);
    const result = await approveRequest(request.id, confirmation.trim());
    setBusy(null);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    setDone(result.message ?? 'Demande validée.');
    push({ message: 'Demande validée. L’exécution est lancée et journalisée.', ttlMs: 8000 });
    router.refresh();
  };

  const reject = async () => {
    setBusy('reject');
    setError(null);
    const result = await runCommand('reject_request', { target: `request:${request.id}`, reason: 'refus_manuel' });
    setBusy(null);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    setDone('Demande refusée. L’auteur est prévenu, avec le motif.');
    push({ message: 'Demande refusée.', ttlMs: 6000 });
    router.refresh();
  };

  useHotkeys({
    a: () => {
      if (!done) void approve();
    }
  });

  return (
    <>
      <ol aria-label="Étapes" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <li style={stepStyle}>
          <span style={{ ...bubbleStyle, background: 'var(--sage-100)', color: 'var(--sage-800)' }}>✓</span>Préparé
        </li>
        <li aria-hidden="true" style={{ width: 32, height: 1, background: 'var(--lkv-border)' }} />
        <li style={stepStyle} aria-current="step">
          <span style={{ ...bubbleStyle, background: 'var(--lkv-primary)', color: 'var(--lkv-surface-card)' }}>2</span>À valider
        </li>
        <li aria-hidden="true" style={{ width: 32, height: 1, background: 'var(--lkv-border)' }} />
        <li style={{ ...stepStyle, color: 'var(--lkv-text-secondary)' }}>
          <span style={{ ...bubbleStyle, background: 'var(--lkv-surface-muted)', color: 'var(--lkv-text-muted)' }}>3</span>
          Exécuté
        </li>
      </ol>

      {request.solo ? (
        <Banner tone="warn" title="Mode solo">
          Vous êtes seul dans l’équipe, vous validez donc vous-même. Le journal marquera cette ligne « validé seul ». Dès
          qu’un deuxième compte sera actif, une autre personne devra valider.
        </Banner>
      ) : (
        <Banner tone="info" title="Deux personnes">
          Une autre personne que l’auteur de la demande doit valider. Un agent ne valide jamais.
        </Banner>
      )}

      {request.self_authored ? (
        <Banner tone="danger" title="Demande que vous avez préparée">
          Vous êtes l’auteur de cette demande. Hors mode solo, une autre personne doit la valider.
        </Banner>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {done ? <Banner tone="info">{done}</Banner> : null}

      <section className={`${s.card} ${s.padLg}`} aria-label="Récapitulatif">
        <div className={s.colGapSm}>
          <div className={s.kv}>
            <span className={s.muted}>Cible</span>
            <strong className={s.mono}>{request.target_label || 'non renseigné'}</strong>
          </div>
          <div className={s.kv}>
            <span className={s.muted}>Commande liée</span>
            <span className={s.mono}>{request.command}</span>
          </div>
          <div className={s.kv}>
            <span className={s.muted}>Demandé par</span>
            <span>
              <Chip tone="stone">{request.author}</Chip> · {relativeFr(request.created_at)}
            </span>
          </div>
          <div className={s.kv}>
            <span className={s.muted}>Expire</span>
            <span>{relativeFr(request.expires_at)}</span>
          </div>
          {amount !== null ? (
            <div className={s.kv} style={{ background: 'var(--lkv-sage-50)', margin: '0 -20px', padding: '14px 20px' }}>
              <span>
                <strong>Montant demandé</strong>
              </span>
              <strong style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'var(--lkv-primary)' }}>{euros(amount)}</strong>
            </div>
          ) : null}
          {params
            .filter(([key]) => !['amount_cents'].includes(key))
            .map(([key, value]) => (
              <div key={key} className={s.kv}>
                <span className={s.muted}>{PARAM_LABEL[key] ?? key}</span>
                <span>{paramValue(key, value)}</span>
              </div>
            ))}
          <div className={`${s.kv} ${s.kvLast}`}>
            <span className={s.muted}>Empreinte</span>
            <span className={s.mono} style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{request.fingerprint || 'non renseignée'}</span>
          </div>
        </div>
      </section>

      <section className={`${s.card} ${s.padLg}`} aria-label="Validation">
        <div className={s.colGap}>
          <Field
            label={request.confirmation_hint || 'Confirmer la valeur exacte'}
            htmlFor="approval-confirmation"
            required
            error={error && !confirmation ? 'La confirmation est obligatoire.' : null}
            hint="La validation est liée à ces valeurs exactes. Si le montant ou le paiement change, elle est annulée et une nouvelle demande est nécessaire."
          >
            <TextInput
              id="approval-confirmation"
              value={confirmation}
              invalid={Boolean(error && !confirmation)}
              onChange={(event) => setConfirmation(event.target.value)}
              inputMode={amount ? 'decimal' : 'text'}
              placeholder={amount ? euros(amount) : 'Pseudo ou référence'}
              style={{ minHeight: 48, fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
            />
          </Field>

          <span className={s.muted} style={{ fontSize: 12.5 }}>{hint}</span>

          <div className={s.rowFlexWrap}>
            <Button tone="pg" shortcut="A" onClick={() => void approve()} disabled={busy !== null || Boolean(done)}>
              {busy === 'approve' ? 'Validation…' : validateLabel}
            </Button>
            <Button tone="soft" onClick={() => void reject()} disabled={busy !== null || Boolean(done)}>
              Refuser
            </Button>
            <Button tone="soft" onClick={() => router.back()}>
              Renvoyer à l’agent avec une question
            </Button>
          </div>

          <span className={s.muted} style={{ fontSize: 12.5 }}>
            L’action est irréversible une fois exécutée. <Kbd>A</Kbd> valide au clavier.
          </span>
        </div>
      </section>

      <CardSoft style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label>Ce qui se passera</Label>
        <span style={{ fontSize: 13 }}>1. L’action préparée est exécutée (Stripe, Auth ou base selon la commande).</span>
        <span style={{ fontSize: 13 }}>2. Le membre reçoit un message, avec le lien de recours.</span>
        <span style={{ fontSize: 13 }}>3. Une ligne est écrite au journal d’audit, avec l’empreinte validée.</span>
      </CardSoft>
    </>
  );
}

const stepStyle = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 } as const;
const bubbleStyle = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12
} as const;
