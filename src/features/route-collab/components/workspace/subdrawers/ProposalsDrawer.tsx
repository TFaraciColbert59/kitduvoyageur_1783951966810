import { useMemo, useState } from 'react';
import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import {
  COMMENT_TARGET_LABEL,
  PROPOSAL_STATUS_LABEL,
  commentAnchorLabel,
  commentNeedsRelocation,
  formatDuration,
  formatDurationDelta,
  formatKm,
  proposalImpactView,
  tallyVotes,
  type CommentTarget,
} from '../../../team';
import type { RouteProposal, RouteWorkspaceState } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function proposalsDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Commentaires & Propositions',
    subtitle: `${ws.workspace.comments.length} commentaire(s) · ${ws.openProposalsCount} proposition(s) ouverte(s)`,
  };
}

const TARGETS: readonly CommentTarget[] = ['point', 'section', 'stage'];
const TARGET_CHIP: Record<CommentTarget, string> = { point: 'Point', section: 'Tronçon', stage: 'Jour' };

/** 8.6 Avant / après : chiffres actuels, chiffres après application, km, heures et sac. */
function ProposalImpact({
  workspace,
  proposal,
  actor,
  expert,
}: {
  workspace: RouteWorkspaceState;
  proposal: Pick<RouteProposal, 'operations' | 'impactPreview'>;
  actor: { id: string; name: string };
  expert: boolean;
}) {
  const { operations, impactPreview } = proposal;
  const v = useMemo(
    () => proposalImpactView(workspace, { operations, impactPreview }, { id: actor.id, name: actor.name }),
    [workspace, operations, impactPreview, actor.id, actor.name]
  );
  const km = v.after ? formatKm(v.after.distanceKm) : 'inconnu';
  return (
    <div className="rcw-impact" data-testid="proposal-impact">
      <div className="rcw-impact-cols">
        <div className="rcw-impact-col" data-col="before">
          <span className="rcw-conflict-cap">Avant</span>
          <span className="rcw-conflict-val v5-num">{formatKm(v.before.distanceKm)}</span>
          <span className="rcw-impact-sub v5-num">{formatDuration(v.before.durationMin)}</span>
        </div>
        <div className="rcw-impact-col" data-col="after">
          <span className="rcw-conflict-cap">Après</span>
          <span className="rcw-conflict-val v5-num">{km}</span>
          <span className="rcw-impact-sub v5-num">
            {v.after ? formatDuration(v.after.durationMin) : 'durée inconnue'}
          </span>
        </div>
      </div>
      <p className="rcw-impact-line v5-num" data-testid="proposal-delta">
        {v.deltaKm == null ? 'Écart de distance inconnu' : formatKm(v.deltaKm, true)} ·{' '}
        {formatDurationDelta(v.deltaDurationMin)} · {v.kitText}
      </p>
      {expert && v.kitLines.length > 0 ? (
        <ul className="rcw-impact-kit">
          {v.kitLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {expert && v.impact && v.impact.unknowns.length > 0 ? (
        <p className="rcw-sub-note">Inconnu : {v.impact.unknowns.join(' · ')}</p>
      ) : null}
    </div>
  );
}

export function ProposalsDrawer() {
  const {
    workspace,
    currentUserId,
    currentUserName,
    commentBody,
    setCommentBody,
    proposalTitle,
    setProposalTitle,
    proposalRationale,
    setProposalRationale,
    proposalDraft,
    setProposalDraft,
    canComment,
    canPropose,
    canReview,
    selectedPoint,
    selectedSectionId,
    selectedStage,
    handleAddComment,
    handleRelocateComment,
    handleCreateProposal,
    handleVoteProposal,
    handleDecideProposal,
  } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const [target, setTarget] = useState<CommentTarget>('point');
  const actor = { id: currentUserId, name: currentUserName };
  const available: Record<CommentTarget, boolean> = {
    point: !!selectedPoint,
    section: !!selectedSectionId,
    stage: !!selectedStage,
  };
  const nameOf = (userId: string | null | undefined) =>
    workspace.members.find((m) => m.userId === userId)?.displayName ?? null;
  const targetName =
    target === 'point'
      ? (selectedPoint?.name ?? 'Départ')
      : target === 'stage'
        ? `jour ${selectedStage?.dayNumber ?? 1}`
        : 'tronçon actif';
  const ordered = [...workspace.proposals].sort(
    (a, b) => Number(b.status === 'open') - Number(a.status === 'open')
  );
  return (
    <div className="rcw-stack" data-testid="subdrawer-proposals">
      <Banners />
      <XpEyebrow>Commentaires ({workspace.comments.length})</XpEyebrow>
      {workspace.comments.length === 0 ? (
        <p className="rcw-sub-note">Aucun commentaire pour l’instant.</p>
      ) : (
        <XpRows>
          {workspace.comments.map((c) => {
            const lost = commentNeedsRelocation(c, workspace);
            return (
              <div key={c.id} className="rcw-stack" data-testid={`comment-${c.id}`} data-lost={lost ? 'true' : 'false'}>
                <XpRow
                  icon="msg"
                  tone={lost ? 'warn' : 'ink'}
                  title={`${c.authorName} · ${c.body}`}
                  sub={commentAnchorLabel(c, workspace)}
                  badge={{
                    label: lost ? 'À replacer' : c.status === 'resolved' ? 'Résolu' : 'Actif',
                    tone: lost ? 'warn' : 'good',
                  }}
                />
                {lost && canComment ? (
                  <div className="rcw-relocate" data-testid={`relocate-${c.id}`}>
                    <p className="rcw-sub-note">
                      Ce commentaire n’a plus de point d’accroche. Où voulez-vous le replacer ?
                    </p>
                    <div className="rcw-inline-actions">
                      {TARGETS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="xp-secondary rcw-tap"
                          disabled={!available[t]}
                          onClick={() => void handleRelocateComment(c.id, t)}
                        >
                          Sur {COMMENT_TARGET_LABEL[t]} actif
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </XpRows>
      )}

      {canComment ? (
        <div className="xp-form">
          <div className="rcw-inline-actions" role="group" aria-label="Où poser le commentaire">
            {TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                className={`rcw-mini-chip rcw-tap${target === t ? ' is-active' : ''}`}
                aria-pressed={target === t}
                onClick={() => setTarget(t)}
              >
                {TARGET_CHIP[t]}
              </button>
            ))}
          </div>
          <label>
            Commenter {COMMENT_TARGET_LABEL[target]} actif ({targetName})
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Commentaire posé sur le terrain…"
            />
          </label>
          <button
            type="button"
            className="xp-primary rcw-tap"
            disabled={!available[target]}
            onClick={() => void handleAddComment(undefined, target)}
          >
            Ajouter un commentaire
          </button>
        </div>
      ) : null}

      <XpEyebrow>Propositions de changement ({workspace.proposals.length})</XpEyebrow>
      {ordered.map((p) => {
        const votes = tallyVotes(p, currentUserId);
        const reviewer = nameOf(p.reviewedBy);
        return (
          <div key={p.id} className="rcw-stack rcw-proposal" data-testid={`proposal-${p.id}`} data-status={p.status}>
            <XpRow
              icon="spark"
              tone={p.status === 'accepted' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn'}
              title={`${p.title} (${p.authorName})`}
              sub={`Raison : ${p.rationale || 'non précisée'}${expert ? ` · Base seq ${p.baseSeq}` : ''}`}
              badge={{
                label: PROPOSAL_STATUS_LABEL[p.status],
                tone: p.status === 'accepted' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn',
              }}
            />
            {p.status === 'open' ? (
              <ProposalImpact workspace={workspace} proposal={p} actor={actor} expert={expert} />
            ) : p.impactPreview ? (
              <ProposalImpact workspace={workspace} proposal={p} actor={actor} expert={expert} />
            ) : null}
            <p className="rcw-sub-note" data-testid={`votes-${p.id}`}>
              Pour {votes.up} · Contre {votes.down}
              {votes.mine ? ` · Votre vote : ${votes.mine === 'up' ? 'pour' : 'contre'}` : ''}
              {p.status !== 'open' && reviewer ? ` · Décidé par ${reviewer}` : ''}
            </p>
            {p.status === 'open' ? (
              <div className="rcw-inline-actions">
                {canComment ? (
                  <>
                    <button
                      type="button"
                      className={`xp-secondary rcw-tap${votes.mine === 'up' ? ' is-active' : ''}`}
                      aria-pressed={votes.mine === 'up'}
                      onClick={() => void handleVoteProposal(p.id, 'up')}
                    >
                      Pour
                    </button>
                    <button
                      type="button"
                      className={`xp-secondary rcw-tap${votes.mine === 'down' ? ' is-active' : ''}`}
                      aria-pressed={votes.mine === 'down'}
                      onClick={() => void handleVoteProposal(p.id, 'down')}
                    >
                      Contre
                    </button>
                  </>
                ) : null}
                {canReview ? (
                  <>
                    <button
                      type="button"
                      className="xp-primary rcw-tap"
                      onClick={() => void handleDecideProposal(p, 'accept')}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      className="xp-secondary rcw-tap"
                      onClick={() => void handleDecideProposal(p, 'reject')}
                    >
                      Refuser
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {canPropose ? (
        <div className="xp-form">
          {proposalDraft ? (
            <div className="rcw-proposal-draft" data-testid="proposal-draft">
              <p className="rcw-sub-note">Changement à proposer : {proposalDraft.summary}.</p>
              <ProposalImpact
                workspace={workspace}
                proposal={{ operations: proposalDraft.operations, impactPreview: null }}
                actor={actor}
                expert={expert}
              />
              <button type="button" className="rcw-mini-chip rcw-tap" onClick={() => setProposalDraft(null)}>
                Abandonner ce changement
              </button>
            </div>
          ) : null}
          <label>
            Titre de proposition
            <input
              type="text"
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              placeholder="Ex : Passer par la crête"
            />
          </label>
          <label>
            Raison
            <input
              type="text"
              value={proposalRationale}
              onChange={(e) => setProposalRationale(e.target.value)}
              placeholder="Moins boueux après pluie…"
            />
          </label>
          <button type="button" className="xp-primary rcw-tap" onClick={() => void handleCreateProposal()}>
            Proposer un changement
          </button>
        </div>
      ) : null}
    </div>
  );
}
