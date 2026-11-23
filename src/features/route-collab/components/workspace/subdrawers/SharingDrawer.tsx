import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import {
  DEFAULT_SHARE_LINK_HOURS,
  formatShareExpiry,
  shareLinkState,
  shareUrlPath,
  simpleRightLabel,
  simpleRightOfRole,
} from '../../../team';
import type { RouteRole } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import { ROLE_LABELS } from '../labels';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';
import { CommunityPublish } from './CommunityPublish';

export function sharingDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Membres, Droits & Partage',
    subtitle: `${ws.workspace.members.length} membre(s) · ${ws.presence.length} en ligne`,
  };
}

/** Trois droits en vue simple (8.2) ; les rôles détaillés seulement en vue experte. */
function rightText(role: RouteRole, expert: boolean): string {
  if (expert) return ROLE_LABELS[role] ?? role;
  const simple = simpleRightOfRole(role);
  return simple ? simpleRightLabel(simple) : (ROLE_LABELS[role] ?? role);
}

export function SharingDrawer() {
  const { workspace, presence, setStatusMessage, canManageMembers, handleManageShareLink, freshShareToken } =
    useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const link = shareLinkState(workspace.shareLink);
  // Le jeton n'est renvoyé qu'une fois, à la création : le lien complet n'existe qu'ici, juste après (8.9).
  const freshPath = link.kind === 'active' && freshShareToken ? shareUrlPath(workspace.id, freshShareToken) : null;
  const copy = (path: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setStatusMessage('Lien copié dans le presse-papiers.');
    }
  };
  return (
    <div className="rcw-stack" data-testid="subdrawer-sharing">
      <Banners />
      <XpEyebrow>Membres & droits</XpEyebrow>
      <XpRows>
        {workspace.members.map((m) => {
          const onlineEntry = presence.find((pr) => pr.userId === m.userId);
          return (
            <XpRow
              key={m.userId}
              icon="users"
              tone={onlineEntry ? 'good' : 'ink'}
              title={m.displayName}
              sub={
                onlineEntry
                  ? `En ligne · ${onlineEntry.mode === 'editing' ? 'Édition en cours' : 'Consultation'}`
                  : rightText(m.role, expert)
              }
              badge={{
                label: rightText(m.role, expert),
                tone: m.role === 'owner' ? 'good' : 'muted',
              }}
            />
          );
        })}
      </XpRows>

      <XpEyebrow>Lien de lecture seule</XpEyebrow>
      {freshPath ? (
        <>
          <div className="rcw-code-box" data-testid="share-link-url">
            {freshPath}
          </div>
          <p className="rcw-sub-note" data-testid="share-link-once">
            Copiez-le maintenant : pour votre sécurité, il ne sera plus affiché ensuite.
          </p>
        </>
      ) : null}
      {link.kind === 'active' ? (
        <>
          <p className="rcw-sub-note" data-testid="share-link-active">
            Lien actif · expire {formatShareExpiry(link.expiresAt)} · zone de départ privée masquée (
            {workspace.shareLink?.hidePrivateStartRadiusM ?? 300} m).
          </p>
          <div className="rcw-inline-actions">
            {freshPath ? (
              <button type="button" className="xp-secondary rcw-tap" onClick={() => copy(freshPath)}>
                Copier le lien
              </button>
            ) : null}
            {canManageMembers ? (
              <button
                type="button"
                className="xp-secondary rcw-tap"
                data-testid="share-link-revoke"
                onClick={() => void handleManageShareLink('revoke')}
              >
                Révoquer
              </button>
            ) : null}
          </div>
        </>
      ) : link.kind === 'expired' ? (
        <p className="rcw-sub-note" data-testid="share-link-expired">
          Lien expiré {formatShareExpiry(link.expiresAt)}. Il ne donne plus accès à rien.
        </p>
      ) : link.kind === 'revoked' ? (
        <p className="rcw-sub-note" data-testid="share-link-revoked">
          Lien révoqué : il ne donne plus accès à rien.
        </p>
      ) : (
        <p className="rcw-sub-note">Aucun lien de partage actif.</p>
      )}
      {canManageMembers ? (
        <button
          type="button"
          className="xp-primary rcw-tap"
          data-testid="share-link-create"
          onClick={() => void handleManageShareLink('create')}
        >
          {link.kind === 'active'
            ? `Remplacer par un nouveau lien (${DEFAULT_SHARE_LINK_HOURS} h)`
            : `Créer un lien de lecture (${DEFAULT_SHARE_LINK_HOURS} h)`}
        </button>
      ) : null}
      <CommunityPublish />
    </div>
  );
}
