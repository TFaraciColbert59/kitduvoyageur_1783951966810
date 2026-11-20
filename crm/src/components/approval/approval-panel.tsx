'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Banner } from '../../ui/states';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { Field, TextInput } from '../../ui/field';
import { IconAlert } from '../../ui/icons';
import { useToast } from '../../ui/toast';
import { useHotkeys } from '../../ui/use-hotkeys';
import { euros } from '../../lib/format';
import type { RequestDetail } from '../../lib/rpc';
import { approveRequest, errorMessage, runCommand } from '../data/cmd';
import { fingerprintCode, parseAmountInput, reasonLabel, requestedCents, stampFr } from './format';

const PREVIEW = process.env.NEXT_PUBLIC_CRM_DESIGN_PREVIEW === '1';

const PREVIEW_NOTICE = 'Le journal, Stripe et le membre ne sont pas touchés.';

/** Valeur courte d'un paramètre libre, sans JSON brut à l'écran. */
function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function cents(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function authorLine(author: string): { agent: boolean; name: string } {
  const match = author.match(/^agent\s+(.*)$/i);
  return match ? { agent: true, name: match[1] } : { agent: false, name: author };
}

/**
 * Validation d'une demande (maquette `Remboursement.dc.html`) :
 * étapes, récapitulatif, empreinte, saisie de confirmation, mode solo affiché.
 */
export function ApprovalPanel({ request }: { request: RequestDetail }) {
  const router = useRouter();
  const { push } = useToast();
  const [confirmation, setConfirmation] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const params = useMemo(() => request.params ?? {}, [request.params]);
  const amount = requestedCents(request);
  const code = fingerprintCode(request.fingerprint);
  const display = amount !== null ? euros(amount) : null;
  const validateLabel = amount !== null ? `Valider et rembourser ${display}` : 'Valider la demande';
  const author = authorLine(request.author);
  const target = request.target_label?.trim() ?? '';
  const member = target.includes('—') ? target.split('—').slice(1).join('—').trim() : '';

  const rows = useMemo(() => {
    const orderId = text(params.order_id);
    const intent = text(params.payment_intent);
    const attachment = text(params.attachments);
    return {
      order: orderId ?? (target || 'non renseigné'),
      member,
      orders: typeof request.member_orders === 'number' ? request.member_orders : null,
      intent,
      card: request.card_brand && request.card_last4 ? `${request.card_brand} •• ${request.card_last4}` : null,
      paid: request.paid_cents ?? cents(params.paid_cents) ?? cents(params.order_total_cents),
      refunded: request.refunded_cents ?? cents(params.refunded_cents),
      refundable: request.refundable_cents ?? cents(params.refundable_cents),
      evidence: request.evidence?.filter((line) => Boolean(line?.trim())) ?? (attachment ? [attachment] : [])
    };
  }, [params, target, member, request]);

  const reject = async () => {
    setError(null);
    setFieldError(null);
    if (PREVIEW) {
      setDone('Aperçu : refus simulé. L’auteur serait prévenu, avec le motif.');
      push({ message: 'Aperçu : rien n’a été envoyé.', ttlMs: 6000 });
      return;
    }
    setBusy('reject');
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

  const approve = async () => {
    const raw = confirmation.trim();
    if (!raw) {
      setFieldError('La confirmation est obligatoire.');
      return;
    }
    const typed = parseAmountInput(raw);
    const matchesAmount = typed !== null && (typed === amount || typed === request.amount_cents);
    const matchesCode = code !== null && raw.replace(/\s/g, '').toLowerCase() === code;
    if (!matchesAmount && !matchesCode) {
      setFieldError(
        amount !== null
          ? `Le montant ne correspond pas. Tapez exactement ${display}.`
          : 'La valeur ne correspond pas à la demande.'
      );
      return;
    }
    setFieldError(null);
    setError(null);
    if (PREVIEW) {
      setDone(`Aperçu : validation simulée. ${PREVIEW_NOTICE}`);
      push({ message: 'Aperçu : rien n’a été envoyé.', ttlMs: 6000 });
      return;
    }
    setBusy('approve');
    const result = await approveRequest(request.id, raw);
    setBusy(null);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    setDone(result.message ?? 'Demande validée.');
    push({ message: 'Demande validée. L’exécution est lancée et journalisée.', ttlMs: 8000 });
    router.refresh();
  };

  useHotkeys({
    a: () => {
      if (!done) void approve();
    }
  });

  return (
    <div className={s.colGap} style={{ gap: 18 }} data-testid="approval-panel">
      <ol
        aria-label="Étapes"
        data-testid="approval-steps"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}
      >
        <li style={stepStyle}>
          <span style={{ ...bubbleStyle, background: 'var(--lkv-sage-100)', color: 'var(--lkv-primary)' }}>
            <svg width="12" height="12" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3.5 9.5l4 4 7-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Préparé
        </li>
        <li aria-hidden="true" style={connectorStyle} />
        <li style={stepStyle} aria-current="step">
          <span style={{ ...bubbleStyle, background: 'var(--lkv-primary)', color: 'var(--lkv-surface-card)' }}>2</span>
          À valider
        </li>
        <li aria-hidden="true" style={connectorStyle} />
        <li style={{ ...stepStyle, color: 'var(--lkv-text-secondary)' }}>
          <span style={{ ...bubbleStyle, background: 'var(--lkv-sage-50)', color: 'var(--lkv-secondary)' }}>3</span>
          {request.command.startsWith('order_') ? 'Exécuté sur Stripe' : 'Exécuté'}
        </li>
      </ol>

      {request.solo ? (
        <div className={s.banner} role="note" data-testid="solo-notice" style={{ gap: 10, alignItems: 'flex-start' }}>
          <IconAlert size={16} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            <strong>Mode solo :</strong> vous êtes seul dans l’équipe, vous validez donc vous-même. Le journal marquera
            cette ligne « validé seul ». Dès qu’un deuxième compte sera actif, une autre personne devra valider.
          </span>
        </div>
      ) : (
        <Banner tone="info" title="Deux personnes">
          Une autre personne que l’auteur de la demande doit valider. Un agent ne valide jamais.
        </Banner>
      )}

      {request.self_authored && !request.solo ? (
        <Banner tone="danger" title="Demande que vous avez préparée">
          Vous êtes l’auteur de cette demande. Une autre personne doit la valider.
        </Banner>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {done ? <Banner tone="info">{done}</Banner> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <section className={s.card} aria-label="Récapitulatif de la demande" style={{ overflow: 'hidden' }}>
          <Row label="Commande">
            <strong>{rows.order}</strong>
          </Row>
          {rows.member ? (
            <Row label="Membre">
              {rows.member}
              {rows.orders !== null ? (
                <span className={s.muted}> · {rows.orders} commande{rows.orders > 1 ? 's' : ''}</span>
              ) : null}
            </Row>
          ) : target ? (
            <Row label="Cible">{target}</Row>
          ) : (
            <Row label="Membre">
              <Empty />
            </Row>
          )}
          <Row label="Paiement d’origine">
            {rows.intent || rows.card ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {rows.intent ? <span className={s.mono} style={{ fontSize: 13.5 }}>{rows.intent}</span> : null}
                {rows.intent && rows.card ? <span aria-hidden="true">·</span> : null}
                {rows.card ? <span>carte {rows.card}</span> : null}
              </span>
            ) : (
              <Empty />
            )}
          </Row>
          <Row label="Payé">{rows.paid !== null ? <strong>{euros(rows.paid)}</strong> : <Empty />}</Row>
          <Row label="Déjà remboursé">{rows.refunded !== null ? <strong>{euros(rows.refunded)}</strong> : <Empty />}</Row>
          <Row label="Encore remboursable">
            {rows.refundable !== null ? <strong>{euros(rows.refundable)}</strong> : <Empty />}
          </Row>

          <div style={amountRowStyle}>
            <strong style={{ fontSize: 15 }}>Montant demandé</strong>
            <strong style={amountValueStyle}>{amount !== null ? euros(amount) : 'non renseigné'}</strong>
          </div>

          <Row label="Motif">{text(params.reason_code) ? reasonLabel(text(params.reason_code)) : <Empty />}{text(params.reason_note) ? ` · ${text(params.reason_note)}` : ''}</Row>
          <Row label="Pièces">{rows.evidence.length > 0 ? rows.evidence.join(' · ') : <Empty />}</Row>
          <Row label="Préparé par" last>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {author.agent ? <Chip tone="sage">Agent IA</Chip> : null}
              <span>
                {author.name} · {stampFr(request.created_at)}
              </span>
            </span>
          </Row>
        </section>

        <section className={`${s.card} ${s.padLg}`} aria-label="Confirmation">
          <div className={s.colGap} style={{ gap: 10 }}>
            <Field
              label="Tapez le montant pour confirmer"
              htmlFor="approval-confirmation"
              error={fieldError}
              hint="La validation est liée à ces valeurs exactes. Si le montant ou le paiement change, elle est annulée et une nouvelle demande est nécessaire. Le remboursement est irréversible."
            >
              <TextInput
                id="approval-confirmation"
                data-testid="confirmation-input"
                value={confirmation}
                invalid={Boolean(fieldError)}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  if (fieldError) setFieldError(null);
                }}
                inputMode="decimal"
                autoComplete="off"
                aria-required="true"
                placeholder={display ?? 'Référence de la demande'}
                style={{
                  maxWidth: 320,
                  minHeight: 52,
                  fontSize: 22,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  borderRadius: 'var(--lkv-radius-xs)'
                }}
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <Button
                tone="pg"
                data-testid="approve-button"
                style={buttonStyle}
                onClick={() => void approve()}
                disabled={busy !== null || Boolean(done)}
              >
                {busy === 'approve' ? 'Validation…' : validateLabel}
              </Button>
              <Button tone="soft" style={buttonStyle} onClick={() => router.back()} disabled={busy !== null || Boolean(done)}>
                Renvoyer à l’agent avec une question
              </Button>
              <Button
                tone="bad"
                data-testid="reject-button"
                style={buttonStyle}
                onClick={() => void reject()}
                disabled={busy !== null || Boolean(done)}
              >
                Refuser
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div style={{ ...rowStyle, borderBottom: last ? '0' : '1px solid var(--lkv-border-subtle)' }}>
      <span style={{ color: 'var(--lkv-text-secondary)' }}>{label}</span>
      <span style={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

function Empty() {
  return <span className={s.muted}>non renseigné</span>;
}

const stepStyle = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 } as const;
const connectorStyle = { width: 40, height: 1, background: 'var(--lkv-border)' } as const;
const bubbleStyle = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700
} as const;
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  minHeight: 45,
  padding: '13px 20px',
  fontSize: 14,
  lineHeight: 1.4
} as const;
const buttonStyle = { fontSize: 15, fontWeight: 700 } as const;
const amountRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '15px 20px',
  background: 'var(--lkv-sage-50)'
} as const;
const amountValueStyle = {
  fontFamily: 'var(--font-brand)',
  fontSize: 24,
  fontWeight: 800,
  color: 'var(--lkv-primary)',
  letterSpacing: 'var(--lkv-tracking-title)'
} as const;
