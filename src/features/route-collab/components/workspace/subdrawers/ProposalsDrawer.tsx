import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function proposalsDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Commentaires & Propositions',
    subtitle: `${ws.workspace.comments.length} commentaire(s) · ${ws.openProposalsCount} proposition(s) ouverte(s)`,
  };
}

export function ProposalsDrawer() {
  const {
    workspace,
    commentBody,
    setCommentBody,
    proposalTitle,
    setProposalTitle,
    proposalRationale,
    setProposalRationale,
    canComment,
    canPropose,
    canReview,
    selectedPoint,
    handleAddComment,
    handleRelocateComment,
    handleCreateProposal,
    handleVoteProposal,
    handleDecideProposal,
  } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="subdrawer-proposals">
      <Banners />
      <XpEyebrow>Commentaires ancrés ({workspace.comments.length})</XpEyebrow>
      {workspace.comments.length === 0 ? (
        <p className="rcw-sub-note">Aucun commentaire pour l’instant.</p>
      ) : (
        <XpRows>
          {workspace.comments.map((c) => (
            <div key={c.id} className="rcw-stack">
              <XpRow
                icon="msg"
                tone={c.status === 'needs_relocation' ? 'warn' : 'ink'}
                title={`${c.authorName} · ${c.body}`}
                sub={`Ancré sur ${c.anchor.anchorType} (${c.anchor.entityId})`}
                badge={{
                  label: c.status === 'needs_relocation' ? 'À repositionner' : 'Actif',
                  tone: c.status === 'needs_relocation' ? 'warn' : 'good',
                }}
              />
              {c.status === 'needs_relocation' && canComment ? (
                <button
                  type="button"
                  className="xp-secondary"
                  onClick={() => void handleRelocateComment(c.id)}
                >
                  Repositionner sur le point sélectionné
                </button>
              ) : null}
            </div>
          ))}
        </XpRows>
      )}

      {canComment ? (
        <div className="xp-form">
          <label>
            Commenter le point actif ({selectedPoint?.name ?? 'Départ'})
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Commentaire ancré au point…"
            />
          </label>
          <button type="button" className="xp-primary" onClick={() => void handleAddComment()}>
            Ajouter un commentaire
          </button>
        </div>
      ) : null}

      <XpEyebrow>Propositions de changement ({workspace.proposals.length})</XpEyebrow>
      {workspace.proposals.map((p) => {
        const upVotes = Object.values(p.votes).filter((v) => v === 'up').length;
        const downVotes = Object.values(p.votes).filter((v) => v === 'down').length;
        return (
          <div key={p.id} className="rcw-stack" data-testid={`proposal-${p.id}`}>
            <XpRow
              icon="spark"
              tone={p.status === 'accepted' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn'}
              title={`${p.title} (${p.authorName})`}
              sub={`Motif : ${p.rationale} · Base seq ${p.baseSeq} · Votes +${upVotes}/-${downVotes}`}
              badge={{
                label:
                  p.status === 'open'
                    ? 'Ouverte'
                    : p.status === 'accepted'
                      ? 'Acceptée'
                      : 'Refusée',
                tone: p.status === 'accepted' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn',
              }}
            />
            {p.status === 'open' ? (
              <div className="rcw-inline-actions">
                <button
                  type="button"
                  className="xp-secondary"
                  onClick={() => void handleVoteProposal(p.id, 'up')}
                >
                  Pour (+1)
                </button>
                {canReview ? (
                  <>
                    <button
                      type="button"
                      className="xp-primary"
                      onClick={() => void handleDecideProposal(p, 'accept')}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      className="xp-secondary"
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
            Motif (aperçu avant/après)
            <input
              type="text"
              value={proposalRationale}
              onChange={(e) => setProposalRationale(e.target.value)}
              placeholder="Moins boueux après pluie…"
            />
          </label>
          <button type="button" className="xp-primary" onClick={() => void handleCreateProposal()}>
            Proposer un changement
          </button>
        </div>
      ) : null}
    </div>
  );
}
