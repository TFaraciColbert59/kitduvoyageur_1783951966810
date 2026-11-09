'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Banner } from '@/ui/states';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/chip';
import { Drawer } from '@/ui/drawer';
import { Field, Select, TextArea, TextInput } from '@/ui/field';
import { Kbd } from '@/ui/kbd';
import { useToast } from '@/ui/toast';
import { canRun } from '@/lib/rbac';
import type { StaffContext } from '@/lib/rpc';
import { errorMessage, runCommand, undoAudit } from '@/components/data/cmd';
import { loadReasonCodes } from '@/components/data/reason-codes-client';
import type { ReasonCode } from '@/components/data/reason-codes';
import { POLE_LABELS, type CatalogCommand } from './catalog';

/** Commandes sans cible : elles portent sur le système entier. */
const NO_TARGET = new Set([
  'errors_view',
  'daily_report_view',
  'audit_log_view',
  'ai_usage_view',
  'ai_kill_switch',
  'ai_cache_clear',
  'story_purge_expired',
  'cron_run_now',
  'agent_stop_all',
  'affiliate_clicks_view',
  'delivery_failures_view',
  'checkpoints_overdue',
  'sos_board',
  'kit_scores_refresh',
  'progression_rules_publish',
  'season_open_close',
  'badge_create',
  'challenge_create',
  'settings_edit',
  'feature_flag_toggle'
]);

const AMOUNT_RE = /refund|price|credit|balance|payout|withdraw|promo|grant|quota|trust|amount|revenue/;
const DATE_RE = /suspend|until|expire|freeze/;
const CONFIRM_RE = /ban|delete_gdpr|staff_manage|dissolve|royalty_config|refund|cancel|withdraw|price|transfer/;

function needsAmount(command: string): boolean {
  return AMOUNT_RE.test(command);
}
function needsDate(command: string): boolean {
  return DATE_RE.test(command);
}
function needsConfirmation(command: CatalogCommand): boolean {
  return command.needsValidation || CONFIRM_RE.test(command.command);
}
function needsTarget(command: string): boolean {
  return !NO_TARGET.has(command);
}

export type CommandTarget = { kind: string; id: string; label?: string };

/**
 * Formulaire générique piloté par le registre : une seule implémentation pour les
 * 144 actions. Champs selon la commande (cible, motif, montant, date, confirmation),
 * erreurs à côté du champ, saisie conservée en cas d'échec.
 */
export function CommandDrawer({
  open,
  command,
  readOnly = false,
  ctx,
  target,
  onClose,
  onDone
}: {
  open: boolean;
  command: CatalogCommand | null;
  readOnly?: boolean;
  ctx: StaffContext | null;
  target?: CommandTarget;
  onClose: () => void;
  onDone?: (command: CatalogCommand) => void;
}) {
  const { push } = useToast();
  const [codes, setCodes] = useState<ReasonCode[]>([]);
  const [values, setValues] = useState({ target: '', reason: '', precision: '', amount: '', date: '', confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'danger' | 'warn'; text: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues({
      target: target ? `${target.kind}:${target.id}` : '',
      reason: '',
      precision: '',
      amount: '',
      date: '',
      confirmation: ''
    });
    setErrors({});
    setNotice(null);
    setRequestId(null);
    if (command?.reasonRequired) {
      void loadReasonCodes().then((result) => setCodes(result.codes));
    }
  }, [open, command, target]);

  const allowed = useMemo(() => {
    // `ctx` absent : les droits sont vérifiés côté serveur (jamais dans le navigateur).
    if (!command || !ctx) return Boolean(command);
    return canRun(
      { role: ctx.role, poles: ctx.poles.map((pole) => ({ code: pole.code, role: pole.role })) },
      command
    );
  }, [command, ctx]);

  if (!command) return null;

  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (needsTarget(command.command) && !values.target.trim()) {
      nextErrors.target = 'Indiquez la cible de l’action (identifiant ou membre).';
    }
    if (command.reasonRequired && !values.reason) {
      nextErrors.reason = 'Choisissez un motif : il part dans le journal et dans le message au membre.';
    }
    if (needsAmount(command.command) && !values.amount.trim()) {
      nextErrors.amount = 'Indiquez un montant (en euros, virgule acceptée).';
    }
    if (needsConfirmation(command) && !values.confirmation.trim()) {
      nextErrors.confirmation = 'Recopiez la valeur demandée pour confirmer : cette action est difficile à défaire.';
    }
    if (!allowed) {
      nextErrors.form = 'Votre rôle ne permet pas cette action.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const params: Record<string, unknown> = {};
    if (values.target.trim()) params.target = values.target.trim();
    if (values.reason) params.reason = values.reason;
    if (values.precision.trim()) params.reason_text = values.precision.trim();
    if (values.amount.trim()) params.amount_cents = Math.round(Number(values.amount.replace(',', '.')) * 100);
    if (values.date) params.until = values.date;
    if (values.confirmation.trim()) params.confirmation = values.confirmation.trim();

    setSubmitting(true);
    setNotice(null);
    const result = await runCommand(command.command, params);
    setSubmitting(false);

    if (!result.ok) {
      setNotice({ tone: 'danger', text: errorMessage(result) });
      return;
    }

    if (result.request_id) {
      setRequestId(result.request_id);
      setNotice({
        tone: 'info',
        text: 'Demande créée. Elle attend une validation (deux personnes, ou vous seul en mode solo) avant d’être exécutée.'
      });
      return;
    }

    if (command.undoable && result.audit_id) {
      const auditId = result.audit_id;
      push({
        message: `${command.label} : fait.`,
        actionLabel: 'Annuler',
        ttlMs: 10_000,
        onAction: () => {
          void undoAudit(auditId);
        }
      });
    } else {
      push({ message: `${command.label} : fait.`, ttlMs: 6000 });
    }

    onDone?.(command);
    onClose();
  };

  return (
    <Drawer
      open={open}
      title={command.label}
      subtitle={
        <span className={s.rowFlexWrap}>
          <Chip tone="stone">{command.id}</Chip>
          <Chip tone="stone">{POLE_LABELS[command.pole] ?? command.pole}</Chip>
          {command.needsValidation ? <Chip tone="info">2 personnes</Chip> : null}
          {command.reasonRequired ? <Chip tone="warn">Motif obligatoire</Chip> : null}
          {command.undoable ? <Chip tone="sage">Annul. 10 s</Chip> : null}
        </span>
      }
      onClose={onClose}
      footer={
        readOnly ? (
          <Button tone="soft" onClick={onClose}>
            Fermer
          </Button>
        ) : (
          <>
            <Button tone="pg" onClick={submit} disabled={submitting || !allowed}>
              {submitting ? 'Envoi…' : command.needsValidation ? 'Créer la demande' : command.label}
            </Button>
            <Button tone="soft" onClick={onClose}>
              Annuler
            </Button>
            <span className={s.muted} style={{ fontSize: 12, marginLeft: 'auto' }}>
              <Kbd>Échap</Kbd> ferme
            </span>
          </>
        )
      }
    >
      <div className={s.colGapSm}>
        <span className={s.label}>Commande</span>
        <span className={s.mono} style={{ fontSize: 13 }}>{command.command}</span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          {command.agent === 'read'
            ? 'Lecture seule : un agent peut la consulter, personne ne modifie rien.'
            : command.agent === 'propose'
              ? 'Un agent peut la préparer ; un humain décide.'
              : 'Aucun agent ne peut la déclencher.'}
        </span>
      </div>

      {readOnly ? (
        <Banner tone="info" title="Ouverture sans agir">
          Rien n’est exécuté depuis cet aperçu. Rouvrez la commande avec <Kbd>↵</Kbd> pour la lancer.
        </Banner>
      ) : null}

      {!allowed ? (
        <Banner tone="danger" title="Rôle insuffisant">
          Votre rôle ne permet pas cette action. Demandez un droit temporaire (motif obligatoire, 1 h) ou passez par un
          responsable du pôle.
        </Banner>
      ) : null}

      {notice ? (
        <Banner tone={notice.tone === 'danger' ? 'danger' : notice.tone === 'info' ? 'info' : 'warn'}>{notice.text}</Banner>
      ) : null}

      {requestId ? (
        <Link href={`/valider/${requestId}`} className={s.btn} style={{ minHeight: 44 }}>
          Ouvrir la demande à valider
        </Link>
      ) : null}

      {readOnly ? null : (
        <>
          {needsTarget(command.command) ? (
            <Field
              label="Cible"
              htmlFor="cmd-target"
              required
              error={errors.target}
              hint="Identifiant, pseudo ou référence (ex. LKDV-10482)."
            >
              <TextInput
                id="cmd-target"
                value={values.target}
                invalid={Boolean(errors.target)}
                onChange={(event) => set('target', event.target.value)}
                placeholder={target ? `${target.kind}:${target.id}` : 'Ex. membre:@claire.vercors'}
              />
            </Field>
          ) : null}

          {command.reasonRequired ? (
            <Field label="Motif" htmlFor="cmd-reason" required error={errors.reason} hint="Il est inscrit au journal et repris dans le message au membre.">
              <Select
                id="cmd-reason"
                value={values.reason}
                invalid={Boolean(errors.reason)}
                onChange={(event) => set('reason', event.target.value)}
              >
                <option value="">Choisir un motif…</option>
                {codes.map((code) => (
                  <option key={code.code} value={code.code}>
                    {code.label}
                    {code.zero_tolerance ? ' · tolérance zéro' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label="Précision pour le membre (facultatif)" htmlFor="cmd-precision" hint="Une phrase simple, sans jargon.">
            <TextInput
              id="cmd-precision"
              value={values.precision}
              onChange={(event) => set('precision', event.target.value)}
              placeholder="Ex. : propos dénigrants envers un autre membre"
            />
          </Field>

          {needsAmount(command.command) ? (
            <Field label="Montant (€)" htmlFor="cmd-amount" required error={errors.amount} hint="Deux décimales, virgule acceptée.">
              <TextInput
                id="cmd-amount"
                inputMode="decimal"
                value={values.amount}
                invalid={Boolean(errors.amount)}
                onChange={(event) => set('amount', event.target.value)}
                placeholder="89,90"
              />
            </Field>
          ) : null}

          {needsDate(command.command) ? (
            <Field label="Jusqu’au (facultatif)" htmlFor="cmd-date" hint="Laissez vide pour une durée par défaut du barème.">
              <TextInput id="cmd-date" type="date" value={values.date} onChange={(event) => set('date', event.target.value)} />
            </Field>
          ) : null}

          {needsConfirmation(command) ? (
            <Field
              label="Confirmation"
              htmlFor="cmd-confirm"
              required
              error={errors.confirmation}
              hint="Recopiez le pseudo de la personne ou le montant exact : la validation est liée à ces valeurs."
            >
              <TextInput
                id="cmd-confirm"
                value={values.confirmation}
                invalid={Boolean(errors.confirmation)}
                onChange={(event) => set('confirmation', event.target.value)}
                placeholder="Pseudo ou montant"
              />
            </Field>
          ) : null}

          <Field label="Note interne (facultatif)" htmlFor="cmd-note" hint="Visible seulement par l’équipe.">
            <TextArea id="cmd-note" rows={2} placeholder="Ce que vous voulez garder en mémoire sur ce cas." />
          </Field>
        </>
      )}
    </Drawer>
  );
}
