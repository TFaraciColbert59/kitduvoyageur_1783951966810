'use client';

import Link from 'next/link';
import { Cap, PBtn } from '@/features/compas/v5/ui/primitives';
import { cockpitHref } from '../../../depart/activityHandoff';
import type { ParticipantRow } from '../../../depart/participants';
import { packAnnouncement } from '../../../depart/packInfo';
import type { PublishPreview } from '../../../depart/publishSummary';
import type { DepartFactState, DepartReading } from '../../../depart/readiness';
import type { DeparturePackManifest, RouteWorkspaceState } from '../../../types';
import { RouteRow, RouteRows, type RouteRowState } from '../ui/RouteRow';
import { V5Scope } from '../ui/V5Scope';
import type { DepartData } from './departClient';
import '../analyse/analyse.css';

const STATE_OF: Record<DepartFactState, RouteRowState> = { ok: 'confirmed', todo: 'to_check', unknown: 'unknown' };

/* ---------- 9.7 Prêt à partir ? ---------- */

export function ReadinessBlock({ reading, onOpen }: { reading: DepartReading; onOpen: (id: string) => void }) {
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="readiness-block">
        <Cap right={reading.scorePct != null ? `${reading.scorePct} %` : undefined}>{reading.label}</Cap>
        {reading.unknownCount > 0 ? (
          <p className="rcw-sub-note" data-testid="readiness-unknown">
            {reading.unknownCount} point{reading.unknownCount > 1 ? 's' : ''} non lu{reading.unknownCount > 1 ? 's' : ''} : ne compte{reading.unknownCount > 1 ? 'nt' : ''} ni pour ni contre.
          </p>
        ) : null}
        <RouteRows testId="readiness-facts">
          {reading.facts.map((f) => (
            <RouteRow
              key={f.id}
              icon={f.id === 'safety' ? 'shield' : f.id === 'kit' ? 'bag' : f.id === 'pack' ? 'download' : f.id === 'participants' ? 'people' : f.id === 'checklist' ? 'list' : 'route'}
              title={f.label}
              subtitle={f.detail}
              state={STATE_OF[f.state]}
              testId={`fact-${f.id}`}
              onClick={f.id === 'pack' || f.id === 'kit' ? () => onOpen(f.id) : undefined}
            />
          ))}
        </RouteRows>
      </div>
    </V5Scope>
  );
}

/* ---------- 9.7 La liste de départ est celle du HUB ---------- */

export function ChecklistBlock({
  linked,
  data,
  onToggle,
}: {
  linked: boolean;
  data: DepartData;
  onToggle: (id: string, done: boolean) => void;
}) {
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="checklist-block">
        <Cap right={<Link href="/hub/checklist" className="rcw-link" data-testid="checklist-hub-link">Ouvrir dans Préparer</Link>}>Liste de départ</Cap>
        <p className="rcw-sub-note">C’est la liste de « Préparer » du HUB : la cocher ici la coche là-bas.</p>
        {!linked ? (
          <p className="rcw-sub-note" data-testid="checklist-unlinked">Itinéraire non rattaché à un voyage : la liste du HUB n’est pas lisible.</p>
        ) : data.status === 'loading' && data.checklist == null ? (
          <p className="rcw-sub-note">Lecture de la liste…</p>
        ) : data.checklist == null ? (
          <p className="rcw-sub-note" data-testid="checklist-unread">Liste du HUB non lue (droit de lecture ou réseau).</p>
        ) : data.checklist.length === 0 ? (
          <p className="rcw-sub-note" data-testid="checklist-empty">Aucun élément dans la liste du HUB.</p>
        ) : (
          <ul className="rcw-checks" data-testid="checklist-items">
            {data.checklist.map((c) => (
              <li key={c.id}>
                <label className="rcw-check-row">
                  <input type="checkbox" checked={c.done} onChange={(e) => onToggle(c.id, e.target.checked)} data-testid={`check-${c.id}`} />
                  <span>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </V5Scope>
  );
}

/* ---------- 9.4 Publier avec le résumé des changements ---------- */

export function PublishPanel({ preview, onPublish }: { preview: PublishPreview; onPublish: (summary: string) => void }) {
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="publish-panel" data-based-on-seq={preview.basedOnSeq}>
        <Cap>{preview.first ? 'Première publication' : `Changements depuis la v${preview.nextNo - 1}`}</Cap>
        <p className="rcw-publish-sentence" data-testid="publish-summary">{preview.sentence}</p>
        <p className="rcw-sub-note">Ce résumé est calculé sur la séquence {preview.basedOnSeq}, celle qui sera publiée, et il est écrit sur la version.</p>
        <PBtn tone="dark" onClick={() => onPublish(preview.summary)}>
          Publier v{preview.nextNo}
        </PBtn>
      </div>
    </V5Scope>
  );
}

/* ---------- 9.6 Pack hors ligne ---------- */

export function PackBlock({
  workspace,
  latest,
  deviceRevisionNo,
  onDownload,
}: {
  workspace: RouteWorkspaceState;
  latest: DeparturePackManifest | null;
  deviceRevisionNo: number | null;
  onDownload: () => void;
}) {
  const a = packAnnouncement(workspace, latest);
  const updating = deviceRevisionNo != null && latest != null && latest.revisionNo > deviceRevisionNo;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="pack-block">
        <Cap>Copie hors ligne</Cap>
        <p className="rcw-publish-sentence" data-testid="pack-size">{a.text}</p>
        <p className="rcw-sub-note">{a.mapNote}</p>
        {updating ? (
          <p className="rcw-sub-note" data-testid="pack-update-note">
            La v{deviceRevisionNo} reste utilisable pendant la mise à jour vers la v{latest.revisionNo} : elle n’est remplacée qu’après vérification.
          </p>
        ) : null}
        <PBtn onClick={onDownload} disabled={!latest}>
          {updating ? `Mettre à jour vers la v${latest.revisionNo}` : 'Télécharger le pack'}
        </PBtn>
      </div>
    </V5Scope>
  );
}

/* ---------- 9.5 Participants ---------- */

export function ParticipantsBlock({ rows }: { rows: readonly ParticipantRow[] }) {
  if (rows.length < 2) return null;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="participants-block">
        <Cap>Participants</Cap>
        <RouteRows testId="participants-rows">
          {rows.map((r) => (
            <RouteRow
              key={r.userId}
              icon="person"
              title={r.displayName}
              subtitle={r.label}
              state={r.kind === 'ready' ? 'confirmed' : r.kind === 'not_opened' || r.kind === 'no_version' ? 'unknown' : 'to_check'}
              testId={`participant-${r.userId}`}
            />
          ))}
        </RouteRows>
      </div>
    </V5Scope>
  );
}

/* ---------- 9.8 Démarrer l'activité depuis la version ---------- */

export function ActivityBlock({
  tripId,
  linked,
  revisionNo,
  contacts,
  active,
  onStart,
}: {
  tripId: string;
  linked: boolean;
  revisionNo: number | null;
  contacts: number | null;
  active: { revisionNo: number; kitCount: number } | null;
  onStart: () => void;
}) {
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="activity-block">
        <Cap>Sortie</Cap>
        <RouteRows testId="activity-rows">
          <RouteRow
            icon="shield"
            title="Contact de sécurité"
            subtitle={contacts == null ? 'Non lu' : contacts > 0 ? `${contacts} contact${contacts > 1 ? 's' : ''} prévenu${contacts > 1 ? 's' : ''} par le suivi en direct` : 'Aucun contact : à ajouter dans le centre de sécurité de la sortie'}
            state={contacts == null ? 'unknown' : contacts > 0 ? 'confirmed' : 'to_check'}
            testId="safety-contact-row"
          />
        </RouteRows>
        {active ? (
          <p className="rcw-sub-note" data-testid="activity-active">Activité suivie : v{active.revisionNo}, {active.kitCount} objet{active.kitCount > 1 ? 's' : ''} au sac.</p>
        ) : null}
        <div className="rcw-inline-actions">
          <PBtn tone="dark" onClick={onStart} disabled={revisionNo == null} data-testid="start-activity">
            {revisionNo == null ? 'Publiez d’abord une version' : `Démarrer avec la v${revisionNo}`}
          </PBtn>
          {linked && active ? (
            <Link href={cockpitHref(tripId)} className="rcw-link" data-testid="cockpit-link">
              Ouvrir le suivi en direct
            </Link>
          ) : null}
        </div>
        {!linked ? <p className="rcw-sub-note">Itinéraire non rattaché à un voyage : la sortie ne gardera pas le lien avec cette version.</p> : null}
      </div>
    </V5Scope>
  );
}
