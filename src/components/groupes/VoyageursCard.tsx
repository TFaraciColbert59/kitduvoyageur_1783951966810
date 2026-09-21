import { lkvConfirm } from '@/components/ui/dialogs';
import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PUBLIC_PROFILES_VIEW, fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useToast } from '@/contexts/ToastContext';
import { Badge, Button, Card, ListItem, Modal, SearchField, Spinner } from '@/components/ui';
import {
  createRoleDelegation,
  revokeRoleDelegation,
  listMyDelegations,
  type ActiveDelegation,
} from '@/features/tribu/actions/delegateRole';

interface Traveler {
  id: string;
  name: string;
  role: string;
  status?: string;
  progress: number;
  user_id?: string;
}

interface VoyageursCardProps {
  travelers: Traveler[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
  members?: any[];
  group?: any;
  isOrganizer?: boolean;
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function VoyageursCard({ travelers, groupId, onRefresh, user, members, group, isOrganizer }: VoyageursCardProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [showManageModal, setShowManageModal] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Member management (organizer)
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [memberSearchBusy, setMemberSearchBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<ActiveDelegation[]>([]);
  const [delegateTo, setDelegateTo] = useState('');
  const [delegateHours, setDelegateHours] = useState(24);
  const [delegationBusy, setDelegationBusy] = useState(false);

  const loadPendingMembers = async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from('group_members')
      .select('id, user_id, status, invited_by')
      .eq('group_id', groupId)
      .eq('status', 'pending');
    // F1 — profils via la vue `public_profiles` (deux étapes, sans embed).
    const rows = (data as any[]) ?? [];
    const profiles = await fetchPublicProfilesWith(
      supabase,
      rows.map((m) => m.user_id as string)
    );
    setPendingMembers(rows.map((m) => ({ ...m, profile: profiles[m.user_id] ?? null })));
  };

  const openManage = () => {
    setShowManageModal(true);
    setMemberQuery('');
    setMemberResults([]);
    if (isOrganizer) {
      loadPendingMembers();
      loadDelegations();
    }
  };

  const loadDelegations = async () => {
    if (!groupId) return;
    const result = await listMyDelegations(groupId);
    if (result.ok) setDelegations(result.delegations);
  };

  const memberName = (userId: string) => {
    const row = (members || []).find((m: any) => m.user_id === userId);
    return row?.user_profiles?.full_name || row?.user_profiles?.first_name || 'Membre';
  };

  const handleDelegate = async () => {
    if (!delegateTo || !groupId) return;
    setDelegationBusy(true);
    const result = await createRoleDelegation({
      groupId,
      toUserId: delegateTo,
      delegatedRole: 'organizer',
      durationHours: delegateHours,
    });
    setDelegationBusy(false);
    if (result.ok) {
      setDelegateTo('');
      await loadDelegations();
    } else {
      toast(result.error, 'error');
    }
  };

  const handleRevokeDelegation = async (delegationId: string) => {
    setDelegationBusy(true);
    const result = await revokeRoleDelegation(delegationId);
    setDelegationBusy(false);
    if (result.ok) await loadDelegations();
    else toast(result.error, 'error');
  };

  const searchMembers = async (q: string) => {
    setMemberQuery(q);
    if (!q.trim()) { setMemberResults([]); return; }
    if (!isOrganizer || !user) return;
    setMemberSearchBusy(true);
    // F1 — annuaire de recherche via la vue `public_profiles`.
    const { data } = await supabase
      .from(PUBLIC_PROFILES_VIEW)
      .select('id, full_name, avatar_url')
      .or(`full_name.ilike.${q.trim().replace(/'/g, "''")}`)
      .limit(8);
    const currentIds = new Set((members || []).map((m: any) => m.user_id));
    setMemberResults((data ?? []).filter((p: any) => !currentIds.has(p.id)));
    setMemberSearchBusy(false);
  };

  const addMember = async (profile: any) => {
    if (!groupId || !user) return;
    setAddingId(profile.id);
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: profile.id,
      role: 'member',
      status: 'pending',
      invited_by: user.id,
    });
    if (error) { toast("Erreur lors de l'invitation : " + error.message, 'error'); }
    else {
      toast(`${profile.full_name || 'Ce membre'} a été invité`, 'success');
      setMemberQuery('');
      setMemberResults([]);
      await loadPendingMembers();
    }
    setAddingId(null);
  };

  const acceptPending = async (id: string, userId: string) => {
    setLoadingId(id);
    await supabase.from('group_members').update({ status: 'active', invited_by: null }).eq('id', id);
    setLoadingId(null);
    toast('Membre ajouté au groupe', 'success');
    await loadPendingMembers();
    if (onRefresh) onRefresh();
  };

  const removePending = async (id: string) => {
    if (!(await lkvConfirm('Retirer cette invitation ?'))) return;
    setLoadingId(id);
    await supabase.from('group_members').delete().eq('id', id);
    setLoadingId(null);
    toast('Invitation retirée', 'success');
    await loadPendingMembers();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId || !isOrganizer) return;
    if (!(await lkvConfirm('Êtes-vous sûr de vouloir retirer ce membre du groupe ?'))) return;

    setLoadingId(memberId);
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (!error && onRefresh) onRefresh();
    setLoadingId(null);
  };

  const handleChangeRole = async (memberId: string, currentRole: string) => {
    if (!groupId || !isOrganizer) return;
    const newRole = currentRole === 'organizer' ? 'member' : 'organizer';

    setLoadingId(memberId);
    const { error } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (!error && onRefresh) onRefresh();
    setLoadingId(null);
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !user) return;
    const myMembership = members?.find((m: any) => m.user_id === user.id);
    if (!myMembership) return;
    if (!(await lkvConfirm('Voulez-vous quitter ce groupe ? Vous pourrez rejoindre un autre groupe sans aucune pénalité.'))) return;

    setLoadingId(myMembership.id);
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', myMembership.id)
      .eq('user_id', user.id);

    if (!error) {
      toast('Vous avez quitté le groupe.', 'info');
      if (onRefresh) onRefresh();
    }
    setLoadingId(null);
  };

  const handleJoinByCode = async () => {
    if (!user) { toast('Connectez-vous pour rejoindre', 'error'); return; }
    if (!joinCode.trim()) return;

    setJoining(true);
    try {
      const { data: targetGroup } = await supabase
        .from('travel_groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();

      if (!targetGroup) {
        toast('Code invalide', 'error');
        setJoining(false);
        return;
      }

      const { error } = await supabase.from('group_members').insert({
        group_id: targetGroup.id,
        user_id: user.id,
        role: 'member',
        status: 'active'
      });

      if (error && error.code === '42501') {
        toast('Ce groupe est privé — une invitation de l’organisateur est requise.', 'error');
        setJoining(false);
        return;
      }
      if (error && error.code !== '23505') throw error;

      toast(`Vous avez rejoint "${targetGroup.name}" !`, 'success');
      setJoinCode('');
      if (targetGroup.id === groupId && onRefresh) onRefresh();
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    }
    setJoining(false);
  };

  return (
    <Card className="space-y-[var(--space-2)] p-[var(--space-3)] transition-all duration-[var(--motion-control-duration)]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
          Voyageurs ({travelers.length})
        </h2>
        {isOrganizer && (
          <Button variant="secondary" size="sm" onClick={openManage}>
            Gérer →
          </Button>
        )}
      </div>

      <div className="space-y-[var(--space-1)]">
        {travelers.slice(0, 3).map(t => (
          <ListItem
            key={t.id}
            as="div"
            className="bg-[color:var(--lkv-surface-muted)] p-[var(--space-2)]"
            leading={
              <Link
                href={t.user_id ? `/profil/${t.user_id}` : '#'}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lkv-primary)]/10 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
                aria-label={`Voir le profil de ${t.name}`}
              >
                {t.name.charAt(0)}
              </Link>
            }
            title={<span className="text-[length:var(--lkv-text-caption)] font-bold">{t.name}</span>}
            trailing={
              t.status ? (
                <Badge>{t.status}</Badge>
              ) : (
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                  {t.progress}%
                </span>
              )
            }
          />
        ))}
        {travelers.length > 3 && (
          <Button variant="ghost" size="sm" fullWidth onClick={openManage} className="text-[length:var(--lkv-text-caption-2)]">
            + {travelers.length - 3} autre{travelers.length - 3 > 1 ? 's' : ''} voyageur{travelers.length - 3 > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {group?.invite_code && (
        <div className="flex items-center justify-between rounded-[var(--lkv-radius-md)] border-t border-[color:var(--lkv-primary)]/10 bg-[color:var(--lkv-surface-muted)] p-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
          <span>Code invitation :</span>
          <strong className="font-mono font-bold tracking-widest text-[color:var(--lkv-text-primary)]">{group.invite_code}</strong>
        </div>
      )}

      <Modal
        open={showManageModal && !!isOrganizer}
        onOpenChange={(next) => { if (!next) setShowManageModal(false); }}
        title="Gérer les membres"
        size="md"
        footer={
          <Button fullWidth onClick={() => setShowManageModal(false)}>
            Terminé
          </Button>
        }
      >
        <div className="space-y-[var(--space-4)]">
          <Card variant="compact">
            <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Code d&apos;invitation secret :</p>
            <div className="flex gap-[var(--space-2)]">
              <input
                type="text"
                readOnly
                value={group?.invite_code || ''}
                aria-label="Code d'invitation secret"
                className={`${FIELD_CLASS} text-center font-mono font-bold tracking-widest`}
              />
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(group?.invite_code || '');
                  toast('Code copié !', 'success');
                }}
              >
                Copier
              </Button>
            </div>
          </Card>

          <div className="max-h-52 space-y-[var(--space-1)] overflow-y-auto pr-[var(--space-1)]">
            {members?.map(m => {
              const name = m.user_profiles ? (m.user_profiles.full_name || m.user_profiles.first_name || 'Membre') : 'Utilisateur';
              const isMe = m.user_id === user?.id;

              return (
                <ListItem
                  key={m.id}
                  as="div"
                  className="bg-[color:var(--lkv-surface-muted)]"
                  title={
                    m.user_id ? (
                      <Link href={`/profil/${m.user_id}`} className="text-[length:var(--lkv-text-caption)] font-bold hover:underline">
                        {name} {isMe && '(Vous)'}
                      </Link>
                    ) : (
                      <span className="text-[length:var(--lkv-text-caption)] font-bold">{name} {isMe && '(Vous)'}</span>
                    )
                  }
                  subtitle={m.role === 'organizer' ? 'Organisateur' : 'Membre'}
                  trailing={
                    !isMe && (
                      <span className="flex gap-[var(--space-1)]">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleChangeRole(m.id, m.role)}
                          disabled={loadingId === m.id}
                        >
                          {m.role === 'organizer' ? 'Rétrograder' : 'Promouvoir'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={loadingId === m.id}
                          className="text-[color:var(--lkv-danger)]"
                        >
                          {loadingId === m.id ? '...' : 'Retirer'}
                        </Button>
                      </span>
                    )
                  }
                />
              );
            })}
          </div>

          {isOrganizer && (
            <div>
              <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Inviter un membre</p>
              <div className="relative">
                <SearchField
                  value={memberQuery}
                  onChange={e => searchMembers(e.target.value)}
                  onClear={() => searchMembers('')}
                  placeholder="Rechercher par nom..."
                  aria-label="Rechercher un membre à inviter"
                />
                {memberSearchBusy && (
                  <span className="absolute right-[var(--space-3)] top-1/2 -translate-y-1/2">
                    <Spinner size="xs" label="Recherche" />
                  </span>
                )}
              </div>
              {memberResults.length > 0 && (
                <div className="mt-[var(--space-2)] max-h-36 space-y-[var(--space-1)] overflow-y-auto">
                  {memberResults.map(p => (
                    <ListItem
                      key={p.id}
                      as="div"
                      className="bg-[color:var(--lkv-surface-muted)]"
                      leading={
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lkv-primary)]/10 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                          {p.full_name?.charAt(0) || '?'}
                        </span>
                      }
                      title={<span className="text-[length:var(--lkv-text-caption)] font-semibold">{p.full_name}</span>}
                      trailing={
                        <Button
                          size="sm"
                          onClick={() => addMember(p)}
                          disabled={addingId === p.id}
                          loading={addingId === p.id}
                        >
                          {addingId === p.id ? '...' : '+ Inviter'}
                        </Button>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <Card variant="compact" data-testid="delegation-block">
            <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              Déléguer mon rôle (temporaire)
            </p>
            <div className="flex items-center gap-[var(--space-2)]">
              <select
                value={delegateTo}
                onChange={(e) => setDelegateTo(e.target.value)}
                aria-label="Membre à qui déléguer"
                className={`${FIELD_CLASS} flex-1`}
              >
                <option value="">Choisir un membre…</option>
                {(members || [])
                  .filter(
                    (m: any) =>
                      m.user_id && m.user_id !== user?.id && m.status !== 'pending' && m.status !== 'banned'
                  )
                  .map((m: any) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_profiles?.full_name || m.user_profiles?.first_name || 'Membre'}
                    </option>
                  ))}
              </select>
              <select
                value={delegateHours}
                onChange={(e) => setDelegateHours(Number(e.target.value))}
                aria-label="Durée de la délégation"
                className={FIELD_CLASS}
              >
                <option value={24}>24 h</option>
                <option value={72}>3 j</option>
                <option value={168}>7 j</option>
              </select>
              <Button
                onClick={handleDelegate}
                disabled={!delegateTo || delegationBusy}
                loading={delegationBusy}
              >
                Déléguer
              </Button>
            </div>
            {delegations.length > 0 && (
              <div className="mt-[var(--space-2)] space-y-[var(--space-1)]">
                {delegations.map((delegation) => (
                  <div
                    key={delegation.id}
                    className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]"
                  >
                    <span className="truncate">
                      {delegation.fromUserId === user?.id ? 'Vers' : 'De'}{' '}
                      {memberName(
                        delegation.fromUserId === user?.id
                          ? delegation.toUserId
                          : delegation.fromUserId
                      )}{' '}
                      · {delegation.delegatedRole} · fin{' '}
                      {new Date(delegation.endsAt).toLocaleDateString('fr-FR')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeDelegation(delegation.id)}
                      disabled={delegationBusy}
                      className="shrink-0 text-[color:var(--lkv-danger)]"
                    >
                      Reprendre
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </Modal>
    </Card>
  );
}
