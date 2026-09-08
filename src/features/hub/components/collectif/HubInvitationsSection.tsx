import { createClient } from '@/lib/supabase/server';
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
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-sm text-[var(--lkv-text-secondary)]">Aucune invitation en attente.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {invites.map((inv) => (
        <li
          key={inv.id}
          className="glass p-4 rounded-[var(--lkv-radius-card)] flex items-center gap-3"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-[var(--lkv-text-primary)] truncate">{inv.name}</span>
            <span className="block text-[11px] text-[var(--lkv-text-secondary)]">Invitation à rejoindre</span>
          </span>
          <HubInviteButtons groupId={inv.group_id} />
        </li>
      ))}
    </ul>
  );
}

export default HubInvitationsSection;
