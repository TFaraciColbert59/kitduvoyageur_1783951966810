'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import s from '../../ui/crm.module.css';
import { Banner } from '../../ui/states';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { Field, Select, TextArea, TextInput } from '../../ui/field';
import { IconClose } from '../../ui/icons';
import { Kbd } from '../../ui/kbd';
import { useToast } from '../../ui/toast';
import { canRun } from '../../lib/rbac';
import type { StaffContext } from '../../lib/rpc';
import { errorMessage, runCommand, undoAudit } from '../data/cmd';
import { loadReasonCodes } from '../data/reason-codes-client';
import type { ReasonCode } from '../data/reason-codes';
import { displayLabel, POLE_LABELS, type CatalogCommand } from './catalog';

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

const FIELD_IDS: Record<string, string> = {
  target: 'cmd-target',
  reason: 'cmd-reason',
  amount: 'cmd-amount',
  confirmation: 'cmd-confirm'
};

export type CommandTarget = { kind: string; id: string; label?: string };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className={s.label}>{title}</span>
      {children}
    </div>
  );
}

/**
 * Formulaire générique piloté par le registre : une seule implémentation pour les
 * 144 actions. Champs selon la commande (cible, motif, montant, date, confirmation),
 * aperçu du message au membre, erreurs à côté du champ, saisie conservée en cas d'échec.
 * Rendu dans un portail : le `backdrop-filter` de la coque piégerait un `fixed`.
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
  const [mounted, setMounted] = useState(false);
  const [codes, setCodes] = useState<ReasonCode[]>([]);
  const [values, setValues] = useState({ target: '', reason: '', precision: '', amount: '', date: '', confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'danger' | 'warn'; text: string } | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const commandKey = command?.command ?? '';
  const targetKind = target?.kind ?? '';
  const targetId = target?.id ?? '';

  useEffect(() => {
    if (!open) return;
    setValues({
      target: targetKind && targetId ? `${targetKind}:${targetId}` : '',
      reason: '',
      precision: '',
      amount: '',
      date: '',
      confirmation: ''
    });
    setErrors({});
    setNotice(null);
    setRequestId(null);
  }, [open, commandKey, targetKind, targetId]);

  useEffect(() => {
    if (!open || !command?.reasonRequired) return;
    let cancelled = false;
    void loadReasonCodes().then((result) => {
      if (!cancelled) setCodes(result.codes);
    });
    return () => {
      cancelled = true;
    };
  }, [open, command?.reasonRequired]);

  // Échap ferme, le focus est piégé, le défilement de la page est bloqué.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((element) => element.offsetParent !== null)
        : [];

    const firstField = panel?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    const closeButton = panel?.querySelector<HTMLElement>('button[aria-label]');
    window.setTimeout(() => (firstField ?? closeButton ?? panel)?.focus(), 0);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        list[list.length - 1]?.focus();
      } else if (!event.shiftKey && (index === -1 || index === list.length - 1)) {
        event.preventDefault();
        list[0]?.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  const allowed = useMemo(() => {
    // `ctx` absent : les droits sont vérifiés côté serveur (jamais dans le navigateur).
    if (!command || !ctx) return Boolean(command);
    return canRun(
      { role: ctx.role, poles: ctx.poles.map((pole) => ({ code: pole.code, role: pole.role })) },
      command
    );
  }, [command, ctx]);

  if (!command) return null;

  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

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
    const firstInvalid = Object.keys(nextErrors).find((key) => key !== 'form');
    const firstInvalidId = firstInvalid ? FIELD_IDS[firstInvalid] : undefined;
    if (firstInvalidId) {
      window.requestAnimationFrame(() => document.getElementById(firstInvalidId)?.focus());
    }
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
        message: `${displayLabel(command.label)} : fait.`,
        actionLabel: 'Annuler',
        ttlMs: 10_000,
        onAction: () => {
          void undoAudit(auditId);
        }
      });
    } else {
      push({ message: `${displayLabel(command.label)} : fait.`, ttlMs: 6000 });
    }

    onDone?.(command);
    onClose();
  };

  const reason = codes.find((code) => code.code === values.reason);
  const showPreview = !readOnly && needsTarget(command.command);
  const previewText =
    reason?.member_text ??
    (values.precision.trim()
      ? `« ${values.precision.trim()} »`
      : 'Choisissez un motif : le message au membre s’affiche ici, avec le lien de recours. Il ne révèle jamais qui a décidé.');

  const amount = needsAmount(command.command);
  const date = needsDate(command.command);
  const confirmation = needsConfirmation(command);

  return (
    <>
      {mounted && open
        ? createPortal(
            <div className={s.drawerScrim} role="presentation" onClick={onClose}>
              <div
                ref={panelRef}
                className={s.drawer}
                role="dialog"
                aria-modal="true"
                aria-labelledby="lkdv-command-drawer-title"
                style={{ width: 'min(520px, 100%)' }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={s.drawerHead}>
                  <div className={s.grow}>
                    <h2
                      id="lkdv-command-drawer-title"
                      className={s.titleSm}
                      style={{ fontSize: 20, lineHeight: 1.25 }}
                    >
                      {displayLabel(command.label)}
                    </h2>
                    <span className={s.rowFlexWrap} style={{ marginTop: 8 }}>
                      <Chip tone="stone">{POLE_LABELS[command.pole] ?? command.pole}</Chip>
                      <Chip tone="stone">{command.id}</Chip>
                      {command.needsValidation ? <Chip tone="info">2 personnes</Chip> : null}
                      {command.reasonRequired ? <Chip tone="warn">Motif obligatoire</Chip> : null}
                      {command.undoable ? <Chip tone="sage">Annul. 10 s</Chip> : null}
                    </span>
                  </div>
                  <Button
                    tone="soft"
                    aria-label="Fermer le formulaire"
                    onClick={onClose}
                    style={{ width: 44, height: 44, minWidth: 44, padding: 0, flex: 'none' }}
                  >
                    <IconClose />
                  </Button>
                </div>

                <div className={s.drawerBody}>
                  {readOnly ? (
                    <Banner tone="info" title="Ouverture sans agir">
                      Rien n’est exécuté depuis cet aperçu. Rouvrez la commande avec <Kbd>↵</Kbd> pour la lancer.
                    </Banner>
                  ) : null}

                  {!allowed ? (
                    <Banner tone="danger" title="Rôle insuffisant">
                      Votre rôle ne permet pas cette action. Demandez un droit temporaire (motif obligatoire, 1 h) ou
                      passez par un responsable du pôle.
                    </Banner>
                  ) : null}

                  {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}

                  {notice ? (
                    <Banner tone={notice.tone === 'danger' ? 'danger' : notice.tone === 'info' ? 'info' : 'warn'}>
                      {notice.text}
                    </Banner>
                  ) : null}

                  {requestId ? (
                    <Link href={`/valider/${requestId}`} className={s.btn} style={{ minHeight: 44 }}>
                      Ouvrir la demande à valider
                    </Link>
                  ) : null}

                  {readOnly ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className={s.label}>Ce que la commande fait</span>
                      <span style={{ fontSize: 13.5 }}>
                        {command.agent === 'read'
                          ? 'Lecture seule : un agent peut la consulter, personne ne modifie rien.'
                          : command.agent === 'propose'
                            ? 'Un agent peut la préparer ; un humain décide.'
                            : 'Aucun agent ne peut la déclencher.'}
                      </span>
                    </div>
                  ) : (
                    <>
                      {needsTarget(command.command) ? (
                        <Field
                            label="Cible de l’action"
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

                      <Group title="Motif et message">
                        {command.reasonRequired ? (
                          <Field
                            label="Motif"
                            htmlFor="cmd-reason"
                            required
                            error={errors.reason}
                            hint="Il est inscrit au journal et repris dans le message au membre."
                          >
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

                        <Field
                          label="Précision pour le membre (facultatif)"
                          htmlFor="cmd-precision"
                          hint="Une phrase simple, sans jargon."
                        >
                          <TextInput
                            id="cmd-precision"
                            value={values.precision}
                            onChange={(event) => set('precision', event.target.value)}
                            placeholder="Ex. : propos dénigrants envers un autre membre"
                          />
                        </Field>
                      </Group>

                      {amount || date ? (
                        <Group title="Montant et date">
                          {amount ? (
                            <Field
                              label="Montant (€)"
                              htmlFor="cmd-amount"
                              required
                              error={errors.amount}
                              hint="Deux décimales, virgule acceptée."
                            >
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
                          {date ? (
                            <Field
                              label="Jusqu’au (facultatif)"
                              htmlFor="cmd-date"
                              hint="Laissez vide pour une durée par défaut du barème."
                            >
                              <TextInput
                                id="cmd-date"
                                type="date"
                                value={values.date}
                                onChange={(event) => set('date', event.target.value)}
                              />
                            </Field>
                          ) : null}
                        </Group>
                      ) : null}

                      {confirmation ? (
                        <Group title="Confirmation">
                          <Field
                            label="Recopiez pour confirmer"
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
                        </Group>
                      ) : null}

                      {showPreview ? (
                        <Group title="Message au membre">
                          <div
                            className={s.cardSoft}
                            style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}
                          >
                            {target?.label ? (
                              <span style={{ fontSize: 13, fontWeight: 600 }}>À l’attention de {target.label}</span>
                            ) : null}
                            <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{previewText}</span>
                            <span className={s.muted} style={{ fontSize: 12 }}>
                              Un lien de recours est joint : la personne peut demander une relecture sous 6 mois,
                              gratuitement.
                            </span>
                          </div>
                        </Group>
                      ) : null}

                      <Field label="Note interne (facultatif)" htmlFor="cmd-note" hint="Visible seulement par l’équipe.">
                        <TextArea
                          id="cmd-note"
                          rows={2}
                          placeholder="Ce que vous voulez garder en mémoire sur ce cas."
                        />
                      </Field>
                    </>
                  )}
                </div>

                <div className={s.drawerFoot} style={{ justifyContent: 'flex-end' }}>
                  {readOnly ? (
                    <Button tone="soft" onClick={onClose}>
                      Fermer
                    </Button>
                  ) : (
                    <>
                      <span className={s.muted} style={{ fontSize: 12, marginRight: 'auto' }}>
                        <Kbd>Échap</Kbd> ferme
                      </span>
                      <Button tone="soft" onClick={onClose}>
                        Annuler
                      </Button>
                      <Button
                        tone="pg"
                        onClick={submit}
                        disabled={submitting || !allowed}
                        style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {submitting ? 'Envoi…' : command.needsValidation ? 'Créer la demande' : displayLabel(command.label)}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
