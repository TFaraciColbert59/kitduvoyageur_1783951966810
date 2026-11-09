'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Banner } from '../../ui/states';
import { Button } from '../../ui/button';
import { CardSoft } from '../../ui/card';
import { Field, Select, TextInput } from '../../ui/field';
import { Kbd } from '../../ui/kbd';
import { useToast } from '../../ui/toast';
import { useHotkeys } from '../../ui/use-hotkeys';
import type { CaseDetail } from '../../lib/rpc';
import type { ReasonCode } from '../data/reason-codes';
import { errorMessage, runCommand, undoAudit } from '../data/cmd';
import { LOCAL_CATALOG, type CatalogCommand } from '../command/catalog';
import { CommandDrawer } from '../command/command-drawer';

type Action = CaseDetail['actions'][number];

function asCatalogCommand(action: Action, detail: CaseDetail): CatalogCommand {
  const known = LOCAL_CATALOG.find((candidate) => candidate.command === action.command);
  if (known) return known;
  return {
    id: action.command,
    command: action.command,
    label: action.label,
    pole: detail.pole,
    roleMin: 'membre',
    needsValidation: false,
    reasonRequired: true,
    undoable: false,
    agent: 'never',
    realtime: 'P2',
    domain: ''
  };
}

const PRIMARY_SHORTCUTS: { pattern: RegExp; key: string }[] = [
  { pattern: /masquer/i, key: 'M' },
  { pattern: /laisser|visible|approuver/i, key: 'L' },
  { pattern: /sanction/i, key: 'S' }
];

function shortcutFor(action: Action): string | null {
  return PRIMARY_SHORTCUTS.find((entry) => entry.pattern.test(action.label))?.key ?? null;
}

/**
 * Carte de décision (maquette `Moderation.dc.html`) :
 * actions principales + « … », motif obligatoire, aperçu du message au membre,
 * annulation 10 s. L'IA propose, elle n'applique jamais.
 */
const ACTION_TONE: Record<string, 'pg' | 'soft' | 'bad'> = {
  comment_hide: 'pg',
  post_hide: 'pg',
  story_remove: 'pg',
  comment_report_resolve: 'soft',
  post_report_resolve: 'soft',
  post_restore: 'soft',
  member_suspend: 'bad',
  member_ban: 'bad',
  comment_remove: 'bad',
  post_remove: 'bad'
};

function actionLabel(command: string, fallback: string, kind: string): string {
  const noun = kind.includes('comment') ? 'le commentaire' : kind.includes('publication') || kind.includes('post') ? 'la publication' : 'le contenu';
  switch (command) {
    case 'comment_hide':
    case 'post_hide':
      return `Masquer ${noun}`;
    case 'comment_report_resolve':
    case 'post_report_resolve':
      return 'Laisser visible';
    case 'post_restore':
      return 'Restaurer';
    case 'member_suspend':
      return 'Sanctionner l’auteur';
    default:
      return fallback;
  }
}

export function DecisionCard({
  detail,
  reasonCodes
}: {
  detail: CaseDetail;
  reasonCodes: ReasonCode[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [reason, setReason] = useState(detail.rule?.code ?? '');
  const [precision, setPrecision] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [decided, setDecided] = useState(detail.already_decided);
  const [drawer, setDrawer] = useState<CatalogCommand | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const actions = detail.actions ?? [];
  const primary = actions.slice(0, 3);
  const more = actions.slice(3);

  const selectedReason = useMemo(() => reasonCodes.find((code) => code.code === reason) ?? null, [reasonCodes, reason]);

  const memberMessage = useMemo(() => {
    if (!selectedReason) return null;
    const base = selectedReason.member_text;
    const extra = precision.trim();
    return extra ? `${base} Précision : ${extra}` : base;
  }, [selectedReason, precision]);

  const run = async (action: Action) => {
    if (decided) return;
    if (!reason) {
      setError('Choisissez un motif avant d’agir : il est inscrit au journal et repris dans le message au membre.');
      document.getElementById('decision-reason')?.focus();
      return;
    }
    setError(null);
    setBusy(action.command);
    const result = await runCommand(action.command, {
      target: `${detail.source}:${detail.id}`,
      source: detail.source,
      id: detail.id,
      reason,
      reason_text: precision.trim() || null
    });
    setBusy(null);

    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }

    setDecided(true);

    if (result.request_id) {
      push({
        message: 'Demande créée : elle attend une validation avant d’être exécutée.',
        actionLabel: 'Voir',
        ttlMs: 10_000,
        onAction: () => router.push(`/valider/${result.request_id}`)
      });
    } else if (result.audit_id) {
      const auditId = result.audit_id;
      push({
        message: `${action.label} · message envoyé au membre.`,
        actionLabel: 'Annuler',
        ttlMs: 10_000,
        onAction: () => {
          void undoAudit(auditId);
        }
      });
    } else {
      push({ message: `${action.label} : fait.`, ttlMs: 6000 });
    }

    router.refresh();
  };

  useHotkeys({
    m: () => {
      const action = primary.find((entry) => shortcutFor(entry) === 'M');
      if (action) void run(action);
    },
    l: () => {
      const action = primary.find((entry) => shortcutFor(entry) === 'L');
      if (action) void run(action);
    },
    s: () => {
      const action = primary.find((entry) => shortcutFor(entry) === 'S');
      if (action) void run(action);
    }
  }, { enabled: drawer === null && !menuOpen });

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    // Différé d'un tick : sinon le clic qui vient d'ouvrir le menu le referme aussitôt.
    const timer = window.setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [menuOpen]);

  return (
    <section className={`${s.card} ${s.padLg}`} aria-label="Votre décision">
      <div className={s.colGap}>
        <span className={s.label}>Votre décision</span>

        {decided ? (
          <Banner tone="info" title="Cas déjà décidé">
            Une décision a déjà été prise sur ce contenu. Le détail et le motif sont dans le journal d’audit.
          </Banner>
        ) : null}

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <div className={s.rowFlexWrap}>
          {primary.map((action) => {
            const key = shortcutFor(action);
            const tone = ACTION_TONE[action.command] ?? (action.tone === 'danger' ? 'bad' : action.primary ? 'pg' : 'soft');
            const label = actionLabel(action.command, action.label, detail.target.kind);
            return (
              <Button
                key={action.command}
                tone={tone}
                shortcut={key ?? undefined}
                disabled={decided || busy !== null}
                onClick={() => void run(action)}
              >
                {busy === action.command ? 'Envoi…' : label}
              </Button>
            );
          })}

          {more.length > 0 || actions.length === 0 ? (
            <div style={{ position: 'relative' }}>
              <Button
                tone="soft"
                aria-label="Plus d’actions"
                aria-expanded={menuOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((value) => !value);
                }}
              >
                …
              </Button>
              {menuOpen ? (
                <div
                  className={`${s.card} ${s.pad}`}
                  style={{ position: 'absolute', zIndex: 'var(--z-popover)', top: 52, left: 0, width: 320, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  <span className={s.label}>Autres actions</span>
                  {more.length === 0 ? (
                    <span className={s.muted} style={{ fontSize: 12.5 }}>
                      Aucune action supplémentaire proposée pour ce cas. Ouvrez la barre de commande pour agir autrement.
                    </span>
                  ) : (
                    more.map((action) => (
                      <Button
                        key={action.command}
                        tone="soft"
                        size="sm"
                        onClick={() => {
                          setMenuOpen(false);
                          setDrawer(asCatalogCommand(action, detail));
                        }}
                      >
                        {action.label}
                      </Button>
                    ))
                  )}
                  <Button
                    tone="soft"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(`/catalogue?cas=${detail.source}:${detail.id}`);
                    }}
                  >
                    Toutes les actions du catalogue
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={s.facts} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <Field
            label="Motif (obligatoire)"
            htmlFor="decision-reason"
            required
            error={error && !reason ? 'Choisissez un motif.' : null}
            hint="Il part dans le journal et dans le message au membre."
          >
            <Select
              id="decision-reason"
              value={reason}
              invalid={Boolean(error && !reason)}
              onChange={(event) => {
                setReason(event.target.value);
                setError(null);
              }}
            >
              <option value="">Choisir un motif…</option>
              {reasonCodes.map((code) => (
                <option key={code.code} value={code.code}>
                  {code.label}
                  {code.zero_tolerance ? ' · tolérance zéro' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Précision pour le membre (facultatif)" htmlFor="decision-precision" hint="Une phrase simple, sans jargon.">
            <TextInput
              id="decision-precision"
              value={precision}
              onChange={(event) => setPrecision(event.target.value)}
              placeholder="Ex. : propos dénigrants envers un autre membre"
            />
          </Field>
        </div>

        <CardSoft style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className={s.label}>Message qui partira au membre</span>
          <span style={{ fontSize: 13.5 }}>
            {memberMessage ??
              'Choisissez un motif : le message au membre s’affiche ici, avec le lien de recours. Il ne révèle jamais qui a décidé.'}
          </span>
        </CardSoft>

        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Les actions marquées <Kbd>M</Kbd> <Kbd>L</Kbd> <Kbd>S</Kbd> s’exécutent au clavier. Une annulation reste
          possible 10 secondes.
        </span>
      </div>

      <CommandDrawer
        open={drawer !== null}
        command={drawer}
        ctx={null}
        target={{ kind: detail.source, id: detail.id }}
        onClose={() => setDrawer(null)}
        onDone={() => router.refresh()}
      />
    </section>
  );
}
