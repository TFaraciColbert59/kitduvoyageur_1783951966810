import Link from 'next/link';
import { PBtn } from '@/features/compas/v5/ui/primitives';
import { KitProgressVisual } from '../../RouteAnalysisVisuals';
import { ROLE_LABELS } from '../labels';
import { Banners } from '../Banners';
import { RouteRow, RouteRows, V5Scope, type RouteRowState } from '../ui';
import { useRouteWorkspace } from '../WorkspaceContext';

/** Recherche d'un membre LKDV à inviter (nom), avec ses résultats : partagée par « Inviter » et « Équipe ». */
function InviteSearch() {
  const {
    workspace,
    userSearchQuery,
    userSearchResults,
    userSearchLoading,
    canManageMembers,
    handleSearchLkdvUsers,
    handleMemberRoleAction,
  } = useRouteWorkspace();
  const activeMembers = workspace.members.filter((m) => !m.revokedAt);
  if (!canManageMembers) return <p className="rcw-sub-note">Seul l’organisateur peut inviter quelqu’un.</p>;
  return (
    <>
      <div className="rcw-search-row">
        <input
          type="search"
          className="rcw-input"
          placeholder="Inviter un membre LKDV (nom)…"
          aria-label="Inviter un membre LKDV par son nom"
          value={userSearchQuery}
          onChange={(e) => void handleSearchLkdvUsers(e.target.value)}
        />
      </div>
      {userSearchLoading ? (
        <p className="rcw-sub-note">Recherche en cours…</p>
      ) : userSearchResults.length > 0 ? (
        <RouteRows testId="invite-results">
          {userSearchResults.map((u) => {
            const already = activeMembers.some((m) => m.userId === u.id);
            return (
              <RouteRow
                key={u.id}
                icon="person"
                title={u.full_name || 'Voyageur LKDV'}
                subtitle={u.location || 'Communauté LKDV'}
                trailing={
                  <button
                    type="button"
                    className="rcw-rec-apply"
                    disabled={already}
                    onClick={() => void handleMemberRoleAction(u.id, 'editor', u.full_name || 'Voyageur LKDV')}
                  >
                    {already ? 'Membre' : '+ Éditeur'}
                  </button>
                }
              />
            );
          })}
        </RouteRows>
      ) : null}
    </>
  );
}

/** En solo (4.8) : rien d'inutile, seulement de quoi faire venir quelqu'un. */
function InviteView() {
  const { openSubDrawer } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="tab-panel-equipe" data-solo="true">
      <Banners />
      <p className="rcw-invite-lead">
        Vous êtes seul sur cet itinéraire. Invitez quelqu’un pour tracer à plusieurs, comparer des variantes et répartir le matériel.
      </p>
      <InviteSearch />
      <V5Scope>
        <PBtn onClick={() => openSubDrawer('sharing')} data-testid="invite-share-link">
          Partager par lien
        </PBtn>
      </V5Scope>
    </div>
  );
}

export function EquipeTab() {
  const {
    currentUserId,
    workspace,
    presence,
    commentBody,
    setCommentBody,
    canManageMembers,
    openProposalsCount,
    hubSummary,
    openSubDrawer,
    handleAddComment,
    handleAssignKitItem,
    handleRevalidateKitItem,
    handleMemberRoleAction,
    handleRevokeMember,
  } = useRouteWorkspace();
  const activeMembers = workspace.members.filter((m) => !m.revokedAt);
  const solo = !activeMembers.some((m) => m.userId !== currentUserId);
  if (solo) return <InviteView />;
  const sharedKit = workspace.kitItems;
  return (
    <div className="rcw-stack" data-testid="tab-panel-equipe">
      <Banners />

      {/* Présence en direct */}
      <div className="rcw-visual-card">
        <div className="rcw-visual-head">
          <span className="rcw-visual-title">
            Coédition (
            {presence.length > 0
              ? `${presence.length} en ligne`
              : `${activeMembers.length} membre(s)`}
            )
          </span>
          <span className="rcw-mini-pill">Seq {workspace.headSeq}</span>
        </div>
        <div className="rcw-avatar-strip">
          {(presence.length > 0 ? presence : activeMembers).map((entry) => {
            const name = 'displayName' in entry ? entry.displayName : 'Membre';
            const initials = name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? '')
              .join('');
            const isLive = presence.some((p) => p.userId === entry.userId);
            return (
              <div key={entry.userId} className="rcw-avatar-pill" title={name}>
                <span className="rcw-avatar-circle">
                  {initials || 'M'}
                  <i className={`rcw-dot ${isLive ? 'is-live' : ''}`} />
                </span>
                <span className="rcw-avatar-name">{name.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Membres & Droits + Recherche LKDV */}
      <div className="rcw-visual-card">
        <div className="rcw-visual-head">
          <span className="rcw-visual-title">Membres & Droits ({activeMembers.length})</span>
          <button type="button" className="rcw-mini-chip" onClick={() => openSubDrawer('sharing')}>
            Partage & Lien
          </button>
        </div>

        <InviteSearch />

        <RouteRows testId="member-rows">
          {activeMembers.map((m) => (
            <RouteRow
              key={m.userId}
              icon="person"
              title={m.displayName}
              subtitle={ROLE_LABELS[m.role] ?? m.role}
              trailing={
                canManageMembers && m.role !== 'owner' && m.userId !== currentUserId ? (
                  <div className="rcw-member-actions">
                    <select
                      aria-label={`Rôle de ${m.displayName}`}
                      className="rcw-select-sm"
                      value={m.role}
                      onChange={(e) =>
                        void handleMemberRoleAction(
                          m.userId,
                          e.target.value as 'co_organizer' | 'editor' | 'contributor' | 'participant',
                          m.displayName
                        )
                      }
                    >
                      <option value="co_organizer">Coorganisateur</option>
                      <option value="editor">Éditeur</option>
                      <option value="contributor">Contributeur</option>
                      <option value="participant">Participant</option>
                    </select>
                    <button
                      type="button"
                      className="rcw-split-pill"
                      aria-label={`Révoquer ${m.displayName}`}
                      onClick={() => void handleRevokeMember(m.userId)}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <span className="xp-badge" data-tone={m.role === 'owner' ? 'good' : 'muted'}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                )
              }
            />
          ))}
        </RouteRows>
      </div>

      {/* Matériel commun & Attribution */}
      <div className="rcw-visual-card">
        <div className="rcw-visual-head">
          <span className="rcw-visual-title">Matériel commun ({sharedKit.length})</span>
          <button type="button" className="rcw-mini-chip" onClick={() => openSubDrawer('kit')}>
            Gérer tout
          </button>
        </div>
        {sharedKit.length === 0 ? (
          <p className="rcw-sub-note">Aucun article partagé pour l’instant.</p>
        ) : (
          <>
            <KitProgressVisual
              confirmed={sharedKit.filter((i) => i.status === 'confirmed').length}
              reval={sharedKit.filter((i) => i.status === 'needs_revalidation').length}
              unassigned={
                sharedKit.filter((i) => !i.assigneeUserId && i.status !== 'needs_revalidation')
                  .length
              }
            />
            <RouteRows testId="kit-rows">
              {sharedKit.slice(0, 4).map((item) => {
                const state: RouteRowState =
                  item.status === 'needs_revalidation' ? 'to_check' : item.assigneeUserId ? 'confirmed' : 'unknown';
                return (
                  <RouteRow
                    key={item.id}
                    icon="bag"
                    title={item.name}
                    subtitle={item.assigneeName ? `Porté par ${item.assigneeName}` : 'Non attribué'}
                    state={state}
                    trailing={
                      item.status === 'needs_revalidation' ? (
                        <button type="button" className="rcw-rec-apply" onClick={() => void handleRevalidateKitItem(item.id)}>
                          Revalider
                        </button>
                      ) : !item.assigneeUserId ? (
                        <button type="button" className="rcw-mini-chip" onClick={() => void handleAssignKitItem(item.id, currentUserId)}>
                          Je prends
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </RouteRows>
          </>
        )}
      </div>

      {/* Commentaire rapide + Propositions + Hub */}
      <div className="rcw-visual-card">
        <div className="rcw-visual-head">
          <span className="rcw-visual-title">
            Discussion ({workspace.comments.length}) · Propositions ({openProposalsCount})
          </span>
          <button
            type="button"
            className="rcw-mini-chip"
            onClick={() => openSubDrawer('proposals')}
          >
            Voir tout
          </button>
        </div>
        <div className="rcw-search-row">
          <input
            type="text"
            className="rcw-input"
            placeholder="Note rapide pour le groupe…"
            aria-label="Note rapide pour le groupe"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
          />
          <button
            type="button"
            className="rcw-rec-apply"
            disabled={!commentBody.trim()}
            onClick={() => void handleAddComment()}
          >
            Envoyer
          </button>
        </div>
        <div className="rcw-sub-note">
          Hub : <Link href={hubSummary.href}>{hubSummary.title}</Link> (
          {workspace.sections.length > 0 ? `${hubSummary.totalDistanceKm} km` : 'distance inconnue'})
        </div>
      </div>
    </div>
  );
}
