'use client';

import { useState } from 'react';
import { describeRevertEffect } from '../../../versionTimeline';
import { fmtKm } from '../../../fmt';
import { useTrackTools } from '../useTrackTools';
import { useRouteWorkspace } from '../WorkspaceContext';
import { Block, Btn, Note, Pill } from './atoms';

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};

/**
 * 5.10 : frise des versions. « Revenir à cette version » ne supprime rien : le moteur restaure son contenu dans
 * une nouvelle séquence du brouillon ; on dit d'abord ce que le retour change.
 */
export function VersionTimeline() {
  const { workspace } = useRouteWorkspace();
  const tools = useTrackTools();
  const [confirm, setConfirm] = useState<string | null>(null);
  if (tools.versions.length <= 1) {
    return (
      <Block title="Versions" testId="version-timeline">
        <Note>Aucune version publiée. Chaque publication figera le tracé ici et vous pourrez y revenir.</Note>
      </Block>
    );
  }
  return (
    <Block title="Versions" right={`${tools.versions.length - 1} publiée${tools.versions.length > 2 ? 's' : ''}`} testId="version-timeline">
      <ol className="rts-timeline">
        {tools.versions.map((v) => {
          const rev = workspace.revisions.find((r) => r.id === v.id);
          return (
            <li key={v.id} data-kind={v.kind} data-published={v.isPublished ? 'true' : 'false'}>
              <div className="head">
                <b>{v.title}</b>
                {v.isPublished ? <Pill tone="good">En vigueur</Pill> : null}
                {v.kind === 'draft' ? <Pill tone="warn">Brouillon</Pill> : null}
                {v.matchesDraft ? <Pill>Identique au brouillon</Pill> : null}
              </div>
              <Note>
                {[date(v.at), v.authorName, fmtKm(v.distanceKm), `${v.pointCount} points`, `${v.dayCount} jour${v.dayCount > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
              </Note>
              {v.kind === 'published' ? <Note>{v.summary}</Note> : null}
              {v.revertible && rev ? (
                confirm === v.id ? (
                  <>
                    <Note tone="warn">{describeRevertEffect(workspace, rev)} Le brouillon actuel reste dans l’historique.</Note>
                    <div className="rts-actions">
                      <Btn
                        tone="primary"
                        disabled={tools.busy != null}
                        onClick={() => {
                          setConfirm(null);
                          void tools.revertTo(rev);
                        }}
                        testId={`revert-${v.revisionNo}`}
                      >
                        Confirmer le retour
                      </Btn>
                      <Btn onClick={() => setConfirm(null)}>Annuler</Btn>
                    </div>
                  </>
                ) : (
                  <Btn onClick={() => setConfirm(v.id)} disabled={tools.busy != null} testId={`revert-ask-${v.revisionNo}`}>
                    Revenir à cette version
                  </Btn>
                )
              ) : null}
            </li>
          );
        })}
      </ol>
      {!tools.canPublish ? <Note>Seules les personnes qui peuvent publier reviennent à une version.</Note> : null}
    </Block>
  );
}
