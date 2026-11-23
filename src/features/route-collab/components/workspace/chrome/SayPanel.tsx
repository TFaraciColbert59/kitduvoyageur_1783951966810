'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Grp, PBtn, Cap } from '@/features/compas/v5/ui/primitives';
import { parseSayCommand, planSayCommands, sectionsToRecalc, type SayParse, type SayPlan } from '../../../sayCommands';
import { useRouteWorkspace } from '../WorkspaceContext';
import { V5Scope } from '../ui/V5Scope';

/**
 * « Dis-le » de l'itinéraire (3.9) : « coupe en 3 jours », « inverse le sens », « évite les routes »…
 * La phrase est lue par des règles (aucune IA), ce qui est compris est montré AVANT d'appliquer, ce qui ne l'est
 * pas est dit. « Appliquer » soumet les opérations comme un seul geste : un « Annuler » défait tout.
 */
export function SayPanel({ onClose }: { onClose: () => void }) {
  const { workspace, canEditGeo, online, currentUserId, currentUserName, runOperation, handleRealRouteSection, setStatusMessage } =
    useRouteWorkspace();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ parse: SayParse; plan: SayPlan | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  const read = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim()) return;
    const parse = parseSayCommand(text);
    if (parse.commands.length === 0) {
      setPreview({ parse, plan: null });
      return;
    }
    counter.current += 1;
    const plan = planSayCommands(parse.commands, workspace, {
      actorId: currentUserId,
      actorName: currentUserName,
      stamp: `${Date.now().toString(36)}${counter.current}`,
    });
    setPreview({ parse, plan });
  };

  const apply = async () => {
    const plan = preview?.plan;
    if (!plan || !plan.ok || busy) return;
    setBusy(true);
    const gesture = `say-${Date.now().toString(36)}`;
    try {
      for (const step of plan.steps) {
        const ok = await runOperation(step.operation, { ...step.expectedVersions }, { gesture });
        if (!ok) {
          setStatusMessage('Une des modifications n’est pas passée : le reste n’a pas été appliqué. Relisez le tracé.');
          return;
        }
      }
      try {
        for (const id of sectionsToRecalc(plan)) await handleRealRouteSection(id, true);
      } catch {
        setStatusMessage('Modifications appliquées ; le recalcul des tronçons n’a pas abouti (réseau). Relancez le calcul depuis le tracé.');
      }
      setText('');
      setPreview(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const plan = preview?.plan ?? null;
  return (
    <V5Scope>
      <div onKeyDown={onKeyDown}>
        <Grp className="rcw-say" data-testid="say-panel" role="group" aria-label="Dis-le">
          <form className="rcw-say-form" onSubmit={read}>
            <input
              className="v5-inp"
              type="text"
              value={text}
              autoFocus
              aria-label="Dis-le : une modification de l’itinéraire"
              placeholder="« coupe en 3 jours », « inverse le sens »…"
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
              }}
            />
            <PBtn type="submit" disabled={!text.trim() || !canEditGeo} data-testid="say-read">
              Aperçu
            </PBtn>
          </form>
          {!canEditGeo ? <p className="v5-note">Vous n’avez pas le droit de modifier le tracé.</p> : null}

          {preview && !plan ? (
            <ul className="rcw-say-list" data-tone="warn" data-testid="say-unknown">
              {preview.parse.clarify.map((q) => (
                <li key={q}>{q}</li>
              ))}
              {preview.parse.clarify.length === 0 ? (
                <li>Je n’ai pas compris « {preview.parse.unknown.join(' ; ') || text.trim()} ». Essayez « coupe en 3 jours » ou « inverse le sens ».</li>
              ) : null}
            </ul>
          ) : null}

          {plan ? (
            <>
              <Cap>Ce qui va changer</Cap>
              <ul className="rcw-say-list" data-testid="say-preview">
                {plan.preview.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {plan.ok ? (
                <p className="rcw-say-diff" data-testid="say-diff">
                  {plan.summary.before} → {plan.summary.after}
                </p>
              ) : null}
              {plan.blocked.length > 0 || (preview?.parse.unknown.length ?? 0) > 0 || (preview?.parse.clarify.length ?? 0) > 0 ? (
                <ul className="rcw-say-list" data-tone="warn" data-testid="say-blocked">
                  {plan.blocked.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                  {preview?.parse.clarify.map((q) => <li key={q}>{q}</li>)}
                  {preview?.parse.unknown.map((u) => (
                    <li key={u}>Non compris : « {u} »</li>
                  ))}
                </ul>
              ) : null}
              <div className="rcw-say-actions">
                <PBtn tone="dark" disabled={!plan.ok || busy || !canEditGeo || !online} onClick={() => void apply()} data-testid="say-apply">
                  {busy ? 'Application…' : 'Appliquer'}
                </PBtn>
                <PBtn onClick={() => setPreview(null)} disabled={busy}>
                  Modifier
                </PBtn>
              </div>
              {!online ? <p className="v5-note">Hors ligne : « Dis-le » attend le retour du réseau pour recalculer les tronçons.</p> : null}
            </>
          ) : null}
        </Grp>
      </div>
    </V5Scope>
  );
}
