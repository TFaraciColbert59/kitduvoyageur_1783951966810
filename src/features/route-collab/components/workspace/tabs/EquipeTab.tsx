import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PBtn } from '@/features/compas/v5/ui/primitives';
import {
  EXPERT_ASSIGNABLE_ROLES,
  SIMPLE_RIGHTS,
  TRIP_INVITE_FLOW_PATH,
  activeMembers as activeMembersOf,
  firstNameOf,
  initialsOf,
  isExpertAssignableRole,
  simpleRightOfRole,
  simpleRightLabel,
  stageAssignees,
  stageScopeRestrictsEditing,
  suggestedRightForTripRole,
  roleOfSimpleRight,
} from '../../../team';
import type { RouteRole } from '../../../types';
import { KitProgressVisual } from '../../RouteAnalysisVisuals';
import { useRouteViewMode } from '../expertMode';
import { ROLE_LABELS } from '../labels';
import { Banners } from '../Banners';
import { RouteRow, RouteRows, V5Scope, type RouteRowState } from '../ui';
import { useRouteWorkspace } from '../WorkspaceContext';

type AssignableRole = 'co_organizer' | 'editor' | 'contributor' | 'participant';

/** Libellé d'un droit : trois droits en vue simple (8.2), rôles détaillés en vue experte. */
function rightLabel(role: RouteRole, expert: boolean): string {
  if (expert) return ROLE_LABELS[role] ?? role;
  const simple = simpleRightOfRole(role);
  return simple ? simpleRightLabel(simple) : (ROLE_LABELS[role] ?? role);
}

/** Les droits proposés : « peut modifier / proposer / voir » en simple, les rôles détaillés en expert. */
function rightOptions(expert: boolean, current?: RouteRole): { value: AssignableRole; label: string }[] {
  const base: { value: AssignableRole; label: string }[] = expert
    ? EXPERT_ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))
    : SIMPLE_RIGHTS.map((r) => ({ value: r.role, label: r.label }));
  if (current && isExpertAssignableRole(current) && !base.some((o) => o.value === current)) {
    return [{ value: current, label: ROLE_LABELS[current] ?? current }, ...base];
  }
  return base;
}

/**
 * Invitation (8.1) : les personnes invitables sont les collaborateurs du voyage (`trip_collaborators`), pas une
 * recherche dans toute la communauté. Faire entrer quelqu'un dans le voyage renvoie vers le flux d'invitation du
 * Compas : l'itinéraire ne crée pas un second système de membres.
 */
function InvitePanel() {
  const {
    workspace,
    canManageMembers,
    invitable,
    invitableLoading,
    loadInvitable,
    handleMemberRoleAction,
  } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const [picked, setPicked] = useState<Record<string, AssignableRole>>({});
  const memberCount = workspace.members.length;
  useEffect(() => {
    if (canManageMembers) void loadInvitable();
  }, [canManageMembers, loadInvitable, memberCount]);
  if (!canManageMembers) return <p className="rcw-sub-note">Seul l’organisateur peut inviter quelqu’un.</p>;
  const options = rightOptions(expert);
  return (
    <div className="rcw-stack" data-testid="invite-panel">
      {invitableLoading ? (
        <p className="rcw-sub-note">Lecture des personnes du voyage…</p>
      ) : invitable.length > 0 ? (
        <RouteRows testId="invite-results">
          {invitable.map((c) => {
            const role = picked[c.userId] ?? roleOfSimpleRight(suggestedRightForTripRole(c.tripRole));
            return (
              <RouteRow
                key={c.userId}
                icon="person"
                title={c.displayName}
                subtitle="Dans le voyage, pas encore sur l’itinéraire"
                trailing={
                  <div className="rcw-member-actions">
                    <select
                      aria-label={`Droit de ${c.displayName}`}
                      className="rcw-select-sm rcw-select-tap"
                      value={role}
                      onChange={(e) => setPicked((prev) => ({ ...prev, [c.userId]: e.target.value as AssignableRole }))}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rcw-rec-apply rcw-tap"
                      onClick={() => void handleMemberRoleAction(c.userId, role, c.displayName)}
                    >
                      Ajouter
                    </button>
                  </div>
                }
              />
            );
          })}
        </RouteRows>
      ) : (
        <p className="rcw-sub-note" data-testid="invite-empty">
          Tous les voyageurs de ce voyage sont déjà sur l’itinéraire.
        </p>
      )}
      <Link href={TRIP_INVITE_FLOW_PATH} className="xp-secondary rcw-tap rcw-link-btn" data-testid="invite-to-trip">
        Inviter au voyage
      </Link>
      <p className="rcw-sub-note">
        Les invitations se font au niveau du voyage : la personne arrive ici dès qu’elle l’a rejoint.
      </p>
    </div>
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
      <InvitePanel />
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
    handleAssignStage,
    realtimeStatus,
  } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const activeMembers = activeMembersOf(workspace.members);
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
          {expert ? (
            <span className="rcw-mini-pill" data-testid="realtime-status" data-status={realtimeStatus}>
              {realtimeStatus === 'live' ? 'Temps réel' : 'Lecture périodique'} · Seq {workspace.headSeq}
            </span>
          ) : null}
        </div>
        <div className="rcw-avatar-strip">
          {(presence.length > 0 ? presence : activeMembers).map((entry) => {
            const name = 'displayName' in entry ? entry.displayName : 'Membre';
            const initials = initialsOf(name);
            const isLive = presence.some((p) => p.userId === entry.userId);
            return (
              <div key={entry.userId} className="rcw-avatar-pill" title={name}>
                <span className="rcw-avatar-circle">
                  {initials}
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

        <InvitePanel />

        <RouteRows testId="member-rows">
          {activeMembers.map((m) => {
            const days = workspace.stages
              .filter((st) => m.stageScopeIds?.includes(st.id))
              .map((st) => `J${st.dayNumber}`);
            const base = rightLabel(m.role, expert);
            return (
              <RouteRow
                key={m.userId}
                icon="person"
                title={m.displayName}
                subtitle={days.length > 0 ? `${base} · ${days.join(', ')}` : base}
                trailing={
                  canManageMembers && m.role !== 'owner' && m.userId !== currentUserId ? (
                    <div className="rcw-member-actions">
                      <select
                        aria-label={`Droit de ${m.displayName}`}
                        className="rcw-select-sm rcw-select-tap"
                        value={m.role}
                        onChange={(e) =>
                          void handleMemberRoleAction(m.userId, e.target.value as AssignableRole, m.displayName)
                        }
                      >
                        {rightOptions(expert, m.role).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rcw-split-pill rcw-tap"
                        aria-label={`Révoquer ${m.displayName}`}
                        onClick={() => void handleRevokeMember(m.userId)}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className="xp-badge" data-tone={m.role === 'owner' ? 'good' : 'muted'}>
                      {rightLabel(m.role, expert)}
                    </span>
                  )
                }
              />
            );
          })}
        </RouteRows>
      </div>

      {/* 8.3 Jours confiés */}
      {canManageMembers && workspace.stages.length > 0 ? (
        <div className="rcw-visual-card" data-testid="stage-assignments">
          <div className="rcw-visual-head">
            <span className="rcw-visual-title">Jours confiés</span>
          </div>
          <p className="rcw-sub-note">
            Confier un jour, c’est dire qui s’en occupe. Un éditeur à qui l’on confie des jours ne modifie plus que ces
            jours-là.
          </p>
          {workspace.stages
            .slice()
            .sort((a, b) => a.dayNumber - b.dayNumber)
            .map((st) => {
              const mine = stageAssignees(workspace.members, st.id);
              const candidates = activeMembers.filter((m) => m.role !== 'owner');
              return (
                <label key={st.id} className="rcw-assign-row">
                  <span className="rcw-assign-day">Jour {st.dayNumber}</span>
                  <select
                    className="rcw-select-sm rcw-select-tap"
                    aria-label={`Qui s’occupe du jour ${st.dayNumber}`}
                    value={mine[0]?.userId ?? ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      for (const prev of mine) {
                        if (prev.userId !== next) void handleAssignStage(prev.userId, st.id, false);
                      }
                      if (next) void handleAssignStage(next, st.id, true);
                    }}
                  >
                    <option value="">Personne</option>
                    {candidates.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {firstNameOf(m.displayName)}
                        {stageScopeRestrictsEditing(m.role) ? ' (limité à ses jours)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
        </div>
      ) : null}

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
