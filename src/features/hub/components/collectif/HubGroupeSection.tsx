import { createClient } from '@/lib/supabase/server';
import { CopyInviteCode } from './CopyInviteCode';
import type { ActiveAdventureData } from '../../context/adventureSchema';

/**
 * Étape 2 — Section Groupe du hub (nature collectif), in-hub : les anciennes
 * pages /groupes et /equipages disparaissent. Membres, rôles et code
 * d'invitation selon la kind active (groupe de voyage ou équipage).
 * Le bloc reste visible même vide — un groupe n'est jamais un cul-de-sac.
 */

interface GroupeMember {
  userId: string;
  role: string;
  status: string;
  fullName: string | null;
  avatarUrl: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  organizer: 'Organisateur',
  admin: 'Admin',
  member: 'Membre',
  guest: 'Invité',
};

export async function HubGroupeSection({ adventure }: { adventure: ActiveAdventureData }) {
  if (adventure.nature !== 'collectif') return null;

  const supabase = await createClient();
  const isGroupe = adventure.kind === 'groupe';

  let members: GroupeMember[] = [];
  let pendingCount = 0;
  let inviteCode: string | null = null;

  try {
    if (isGroupe) {
      const [groupRes, membersRes] = await Promise.all([
        supabase.from('travel_groups').select('invite_code').eq('id', adventure.id).maybeSingle(),
        supabase
          .from('group_members')
          .select('user_id, role, status, profile:user_profiles!group_members_user_id_fkey(full_name, username, avatar_url)')
          .eq('group_id', adventure.id)
          .order('created_at', { ascending: true }),
      ]);
      inviteCode = (groupRes.data as { invite_code?: string } | null)?.invite_code ?? null;
      const rows = (membersRes.data ?? []) as Array<{
        user_id: string;
        role: string;
        status: string;
        profile?: { full_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
      }>;
      members = rows.map((m) => ({
        userId: m.user_id,
        role: m.role,
        status: m.status,
        fullName: m.profile?.full_name ?? m.profile?.username ?? null,
        avatarUrl: m.profile?.avatar_url ?? null,
      }));
    } else {
      const membersRes = await supabase
        .from('crew_members')
        .select('user_id, role, status, profile:user_profiles!crew_members_user_id_fkey(full_name, username, avatar_url)')
        .eq('crew_id', adventure.id)
        .order('joined_at', { ascending: true });
      const rows = (membersRes.data ?? []) as Array<{
        user_id: string;
        role: string;
        status: string;
        profile?: { full_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
      }>;
      members = rows.map((m) => ({
        userId: m.user_id,
        role: m.role,
        status: m.status,
        fullName: m.profile?.full_name ?? m.profile?.username ?? null,
        avatarUrl: m.profile?.avatar_url ?? null,
      }));
    }
    pendingCount = members.filter((m) => m.status === 'pending').length;
  } catch {
    /* ignoré — état vide affiché */
  }

  const activeMembers = members.filter((m) => m.status === 'active');
  const pendingMembers = members.filter((m) => m.status === 'pending');

  return (
    <div className="space-y-4">
      <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Membres">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Membres · {activeMembers.length}
          </p>
          {pendingCount > 0 && (
            <p className="text-[10px] font-semibold tabular-nums text-[var(--lkv-text-secondary)]">
              {pendingCount} invitation(s) en attente
            </p>
          )}
        </div>
        <ul className="mt-3 space-y-2">
          {activeMembers.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 min-h-[44px]">
              <span className="w-8 h-8 rounded-full bg-[var(--lkv-surface-raised)] flex items-center justify-center text-xs font-bold text-[var(--lkv-text-secondary)] shrink-0">
                {(m.fullName ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[var(--lkv-text-primary)]">
                {m.fullName ?? 'Compagnon'}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </li>
          ))}
          {activeMembers.length === 0 && (
            <li className="text-sm text-[var(--lkv-text-secondary)]">
              Aucun membre actif pour le moment.
            </li>
          )}
        </ul>
      </section>

      {pendingMembers.length > 0 && (
        <section className="glass p-4 rounded-[var(--lkv-radius-card)]" aria-label="Invitations en attente">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Invitations en attente · {pendingMembers.length}
          </p>
          <ul className="mt-3 space-y-2">
            {pendingMembers.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 min-h-[44px] opacity-70">
                <span className="w-8 h-8 rounded-full bg-[var(--lkv-surface-raised)] flex items-center justify-center text-xs font-bold text-[var(--lkv-text-secondary)] shrink-0">
                  {(m.fullName ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-[var(--lkv-text-secondary)]">
                  {m.fullName ?? 'Invité'}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
                  En attente
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isGroupe && inviteCode && <CopyInviteCode code={inviteCode} />}
    </div>
  );
}
