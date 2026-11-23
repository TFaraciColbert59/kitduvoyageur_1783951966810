import { useMemo, useState } from 'react';
import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { mergeTripKit, TRIP_ITEM_PREFIX } from '../../../depart/tripKit';
import { distributeSharedGear, type GearMember } from '../../../insights/sharedGear';
import { isRealTripId } from '../../../startPersist';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { fetchDepart } from '../depart/departClient';
import { useRouteViewMode } from '../expertMode';
import { useGroupMembers } from '../stages/usePace';
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

const DEP_LABEL = { overnight: 'la nuit', water: 'l’eau', weather: 'la météo', duration: 'la durée', distance: 'la distance' } as const;
const kg = (g: number) => `${(g / 1000).toFixed(1).replace('.', ',')} kg`;

/** 10.6 Achat prévu : montant saisi pour le groupe ; vide = pas d'achat prévu (rien n'est estimé ni écrit au budget). */
function PurchaseField({ name, value, canEdit, onSave }: { name: string; value: number | null; canEdit: boolean; onSave: (amount: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const clean = text.trim().replace(',', '.');
  const valid = clean === '' || /^\d{1,7}(\.\d{1,2})?$/.test(clean);
  const next = clean === '' ? null : Number(clean);
  if (!canEdit && value == null) return null;
  return (
    <div className="rcw-inline-actions" data-testid="kit-purchase">
      <input
        aria-label={`Achat prévu pour ${name} (total, en euros)`}
        inputMode="decimal"
        placeholder="Achat prévu (€)"
        value={text}
        disabled={!canEdit}
        onChange={(e) => setText(e.target.value)}
      />
      {canEdit ? (
        <button type="button" className="xp-secondary" disabled={!valid || next === value} onClick={() => onSave(next)}>
          {next == null ? 'Retirer l’achat' : 'Enregistrer l’achat'}
        </button>
      ) : null}
    </div>
  );
}

export function KitDrawer() {
  const { workspace, handleAssignKitItem, handleAssignKitItems, handleRevalidateKitItem, handleAddKitItems, handleSetKitPurchase, canEditStages } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const paceMembers = useGroupMembers();
  const [importNote, setImportNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = isRealTripId(workspace.tripId);
  const active = workspace.members.filter((m) => !m.revokedAt);

  /** 9.1 : le sac de l'itinéraire vient du kit du voyage (`trip_items`). */
  const importTripKit = async () => {
    setBusy(true);
    try {
      const d = await fetchDepart(workspace.tripId);
      if (d.kit == null) {
        setImportNote('Le sac du voyage n’a pas pu être lu (droit de lecture ou réseau).');
        return;
      }
      const merged = mergeTripKit(workspace.kitItems, d.kit, active);
      await handleAddKitItems(merged.added);
      setImportNote(
        d.kit.length === 0
          ? 'Le sac du voyage est vide.'
          : `${merged.added.length} objet${merged.added.length > 1 ? 's' : ''} ajouté${merged.added.length > 1 ? 's' : ''} depuis le sac du voyage${merged.orphanIds.length > 0 ? ` · ${merged.orphanIds.length} retiré${merged.orphanIds.length > 1 ? 's' : ''} du voyage, gardé${merged.orphanIds.length > 1 ? 's' : ''} ici` : ''}.`
      );
    } finally {
      setBusy(false);
    }
  };

  /** 9.3 : poids partagé selon le niveau et l'allure de chacun ; niveau et allure inconnus = traités à égalité, et dit. */
  const gearMembers = useMemo<GearMember[]>(
    () => active.map((m) => ({ id: m.userId, name: m.displayName, speedKmh: paceMembers.find((p) => p.id === m.userId)?.speedKmh ?? null })),
    [active, paceMembers]
  );
  const plan = useMemo(() => distributeSharedGear(workspace.kitItems, gearMembers), [workspace.kitItems, gearMembers]);
  const hasShared = workspace.kitItems.some((i) => i.shared);
  const toAssign = workspace.kitItems.filter((i) => i.shared && !i.assigneeUserId);

  const applyPlan = async () => {
    setBusy(true);
    try {
      const assignments: { itemId: string; userId: string }[] = [];
      const taken = new Set<string>();
      for (const load of plan.loads) {
        for (const c of load.carries) {
          if (c.kept || taken.has(c.itemId)) continue;
          const item = workspace.kitItems.find((i) => i.id === c.itemId);
          // Un objet en plusieurs exemplaires n'a qu'un porteur : il va à celui qui reçoit le premier.
          if (item && !item.assigneeUserId) {
            taken.add(c.itemId);
            assignments.push({ itemId: c.itemId, userId: load.memberId });
          }
        }
      }
      await handleAssignKitItems(assignments);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rcw-stack" data-testid="subdrawer-kit">
      <Banners />

      <XpEyebrow>Sac du voyage</XpEyebrow>
      <p className="rcw-sub-note">Les objets viennent du kit du voyage, pas d’une liste à part.</p>
      <div className="rcw-inline-actions">
        <button type="button" className="xp-primary" disabled={!linked || busy} onClick={() => void importTripKit()} data-testid="import-trip-kit">
          Importer le sac du voyage
        </button>
      </div>
      {!linked ? <p className="rcw-sub-note">Itinéraire non rattaché à un voyage : pas de sac à importer.</p> : null}
      {importNote ? (
        <p className="rcw-sub-note" role="status" data-testid="import-note">
          {importNote}
        </p>
      ) : null}

      <XpEyebrow>Matériel personnel & commun</XpEyebrow>
      {workspace.kitItems.length === 0 ? <p className="rcw-sub-note">Le sac est vide.</p> : null}
      <XpRows>
        {workspace.kitItems.map((item) => (
          <div key={item.id} className="rcw-stack" data-testid={`kit-item-${item.id}`}>
            <XpRow
              icon={item.shared ? 'users' : 'pack'}
              tone={item.status === 'needs_revalidation' ? 'warn' : 'good'}
              title={`${item.name} (${item.shared ? 'Commun' : 'Personnel'})`}
              sub={
                item.status === 'needs_revalidation' && item.revalidationReason
                  ? `À revérifier : ${item.revalidationReason}`
                  : item.assigneeName
                    ? `Porté par ${item.assigneeName}${item.weightGrams != null ? ` · ${kg(item.weightGrams * item.quantity)}` : ' · poids inconnu'}`
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
            {expert ? (
              <small className="rcw-expert-note" data-testid={`kit-deps-${item.id}`}>
                {item.dependsOn.length > 0
                  ? `Revérifié si change : ${item.dependsOn.map((d) => DEP_LABEL[d]).join(', ')}`
                  : 'Aucune dépendance reconnue : jamais revérifié automatiquement'}
                {item.id.startsWith(TRIP_ITEM_PREFIX) ? ' · vient du sac du voyage' : ''}
              </small>
            ) : null}
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
            <PurchaseField
              key={`${item.id}-${item.plannedPurchase?.amount ?? 'none'}`}
              name={item.name}
              value={item.plannedPurchase?.amount ?? null}
              canEdit={canEditStages}
              onSave={(amount) => void handleSetKitPurchase(item.id, amount == null ? null : { amount, currency: 'EUR' })}
            />
          </div>
        ))}
      </XpRows>

      {hasShared && active.length > 0 ? (
        <section data-testid="shared-gear" aria-label="Qui porte quoi">
          <XpEyebrow>Qui porte quoi</XpEyebrow>
          <XpRows>
            {plan.loads.map((l) => (
              <XpRow
                key={l.memberId}
                icon="users"
                tone="ink"
                title={l.name}
                sub={l.carries.length > 0 ? l.carries.map((c) => c.name).join(', ') : 'Rien de commun'}
                badge={{ label: `${kg(l.totalGrams)} / cible ${kg(l.targetGrams)}`, tone: Math.abs(l.totalGrams - l.targetGrams) <= plan.reasonableDeviationGrams ? 'good' : 'warn' }}
              />
            ))}
          </XpRows>
          {plan.unknownProfileMemberIds.length > 0 ? (
            <p className="rcw-sub-note" data-testid="shared-gear-unknown">
              Niveau et allure inconnus pour {plan.unknownProfileMemberIds.map((id) => active.find((m) => m.userId === id)?.displayName ?? id).join(', ')} : traité{plan.unknownProfileMemberIds.length > 1 ? 's' : ''} à égalité, pas deviné{plan.unknownProfileMemberIds.length > 1 ? 's' : ''}.
            </p>
          ) : null}
          {plan.unweightedItemIds.length > 0 ? <p className="rcw-sub-note">{plan.unweightedItemIds.length} objet(s) commun(s) sans poids : répartis au nombre, pas au poids.</p> : null}
          {expert ? <small className="rcw-expert-note">{plan.method}</small> : null}
          <div className="rcw-inline-actions">
            <button type="button" className="xp-primary" disabled={busy || toAssign.length === 0} onClick={() => void applyPlan()} data-testid="apply-shared-gear">
              Répartir les {toAssign.length} objet{toAssign.length > 1 ? 's' : ''} sans porteur
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
