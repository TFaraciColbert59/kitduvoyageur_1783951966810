import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { ROLE_LABELS } from '../labels';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function sharingDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Membres, Droits & Partage',
    subtitle: `${ws.workspace.members.length} membre(s) · ${ws.presence.length} en ligne`,
  };
}

export function SharingDrawer() {
  const { workspace, presence, setStatusMessage, canManageMembers, handleManageShareLink } =
    useRouteWorkspace();
  const activeShareUrl =
    workspace.shareLink && !workspace.shareLink.revokedAt
      ? `/compas/itineraire?workspaceId=${encodeURIComponent(workspace.id)}&token=${encodeURIComponent(workspace.shareLink.token)}`
      : null;
  return (
    <div className="rcw-stack" data-testid="subdrawer-sharing">
      <Banners />
      <XpEyebrow>Membres & rôles</XpEyebrow>
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
                  : (ROLE_LABELS[m.role] ?? m.role)
              }
              badge={{
                label: ROLE_LABELS[m.role] ?? m.role,
                tone: m.role === 'owner' ? 'good' : 'muted',
              }}
            />
          );
        })}
      </XpRows>

      <XpEyebrow>Lien lecture seule révocable</XpEyebrow>
      {activeShareUrl ? (
        <>
          <div className="rcw-code-box" data-testid="share-link-url">
            {activeShareUrl}
          </div>
          <p className="rcw-sub-note">
            Zone de départ privée masquée ({workspace.shareLink?.hidePrivateStartRadiusM ?? 300} m).
          </p>
          <div className="rcw-inline-actions">
            <button
              type="button"
              className="xp-secondary"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  void navigator.clipboard.writeText(`${window.location.origin}${activeShareUrl}`);
                  setStatusMessage('Lien copié dans le presse-papiers.');
                }
              }}
            >
              Copier le lien
            </button>
            {canManageMembers ? (
              <button
                type="button"
                className="xp-secondary"
                onClick={() => void handleManageShareLink('revoke')}
              >
                Révoquer le lien
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="rcw-sub-note">Aucun lien de partage actif.</p>
      )}
      {canManageMembers ? (
        <button
          type="button"
          className="xp-primary"
          onClick={() => void handleManageShareLink('create')}
        >
          Générer un lien lecture seule (48 h)
        </button>
      ) : null}
    </div>
  );
}
