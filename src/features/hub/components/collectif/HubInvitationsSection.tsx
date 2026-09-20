import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, ListItem } from '@/components/ui';
import { HubInviteButtons } from './HubInviteButtons';

interface PendingInvite {
  id: string;
  group_id: string;
  name: string;
}

/**
 * H4.3 — Section invitations du hub (miroir groupes/page loadPendingInvites +
 * handleInvite). RLS : seuls les pending de l'utilisateur sont lisibles.
 */
export async function HubInvitationsSection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let invites: PendingInvite[] = [];
  if (user) {
    try {
      const { data } = await supabase
        .from('group_members')
        .select('id, group_id, group:travel_groups!group_members_group_id_fkey(name)')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      invites = ((data ?? []) as Array<{ id: string; group_id: string; group: { name: string } | { name: string }[] | null }>).map((r) => ({
        id: r.id,
        group_id: r.group_id,
        name: Array.isArray(r.group) ? (r.group[0]?.name ?? 'Groupe') : (r.group?.name ?? 'Groupe'),
      }));
    } catch {
      /* ignoré — liste vide */
    }
  }

  if (invites.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Aucune invitation en attente." />
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {invites.map((inv) => (
        <ListItem
          key={inv.id}
          title={inv.name}
          trailing={<HubInviteButtons groupId={inv.group_id} />}
        />
      ))}
    </ul>
  );
}

export default HubInvitationsSection;
