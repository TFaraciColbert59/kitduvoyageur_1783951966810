import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function kitDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Sac & Matériel',
    subtitle:
      ws.kitToRevalidateCount > 0
        ? `${ws.kitToRevalidateCount} article(s) à revalider`
        : 'Toutes les vérifications sont à jour',
  };
}

export function KitDrawer() {
  const { workspace, handleAssignKitItem, handleRevalidateKitItem } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="subdrawer-kit">
      <Banners />
      <XpEyebrow>Matériel personnel & commun</XpEyebrow>
      <XpRows>
        {workspace.kitItems.map((item) => (
          <div key={item.id} className="rcw-stack" data-testid={`kit-item-${item.id}`}>
            <XpRow
              icon={item.shared ? 'users' : 'pack'}
              tone={item.status === 'needs_revalidation' ? 'warn' : 'good'}
              title={`${item.name} (${item.shared ? 'Commun' : 'Personnel'})`}
              sub={
                item.revalidationReason
                  ? item.revalidationReason
                  : item.assigneeName
                    ? `Porté par ${item.assigneeName}`
                    : 'Non attribué'
              }
              badge={{
                label:
                  item.status === 'needs_revalidation'
                    ? 'À revalider'
                    : item.status === 'confirmed'
                      ? 'Confirmé'
                      : 'À attribuer',
                tone:
                  item.status === 'needs_revalidation'
                    ? 'warn'
                    : item.status === 'confirmed'
                      ? 'good'
                      : 'muted',
              }}
            />
            <div className="rcw-inline-actions">
              {item.shared ? (
                <select
                  className="rcw-select"
                  aria-label={`Attribuer ${item.name}`}
                  value={item.assigneeUserId ?? ''}
                  onChange={(e) => void handleAssignKitItem(item.id, e.target.value || null)}
                >
                  <option value="">Non attribué</option>
                  {workspace.members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              ) : null}
              {item.status === 'needs_revalidation' ? (
                <button
                  type="button"
                  className="xp-primary"
                  onClick={() => void handleRevalidateKitItem(item.id)}
                >
                  Confirmer
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </XpRows>
    </div>
  );
}
