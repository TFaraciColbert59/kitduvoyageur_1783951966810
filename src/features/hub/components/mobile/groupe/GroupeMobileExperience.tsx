'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckSquare, Package, Plus, Users, Wallet } from 'lucide-react';
import TachesCard from '@/components/groupes/TachesCard';
import EquipementCard from '@/components/groupes/EquipementCard';
import DepensesCard from '@/components/groupes/DepensesCard';
import DecisionsCard from '@/components/groupes/DecisionsCard';
import DiscussionCard from '@/components/groupes/DiscussionCard';
import VoyageursCard from '@/components/groupes/VoyageursCard';
import ParcoursCard from '@/components/groupes/ParcoursCard';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import {
  assignGroupeKitItem,
  settleGroupeExpense,
  toggleGroupeTaskStatus,
  updateGroupeTaskDueDate,
  voteInGroupeOption,
} from '@/lib/queries/groupe';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  buildGroupeBalances,
  buildGroupeCriticalPath,
  computeGroupeReadiness,
  type GroupeCriticalTask,
} from '../../../mobile/groupeEngine';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import { GroupeReadinessHero } from './GroupeReadinessHero';
import { GroupeChipsRow, type GroupeChipDef } from './GroupeChipsRow';
import { GroupeCriticalPath } from './GroupeCriticalPath';
import { GroupeBalancesCard } from './GroupeBalancesCard';
import { GroupeMembersCard } from './GroupeMembersCard';
import { GroupeRail } from './GroupeRail';
import { GroupeDrawer, GroupeReadinessDrawer, type GroupeReadinessFactor } from './GroupeDrawer';

export interface GroupeMobileExperienceProps {
  data: any;
  groupId: string;
  user?: any;
  members?: any[];
  onRefresh?: () => void;
  linkedTrip?: { id: string; slug: string; title: string } | null;
  initialTab?: string;
}

const TAB_DRAWERS: Record<string, string> = {
  tasks: 'tasks',
  equipment: 'equipment',
  expenses: 'caisse',
  decisions: 'decisions',
  discussion: 'discussion',
  members: 'members',
};

export function GroupeMobileExperience({
  data,
  groupId,
  user,
  members,
  onRefresh,
  linkedTrip,
  initialTab,
}: GroupeMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [localTasks, setLocalTasks] = useState<any[]>(data.tasks || []);
  useEffect(() => {
    setLocalTasks(data.tasks || []);
  }, [data.tasks]);

  const [localExpenses, setLocalExpenses] = useState<any[]>(data.expenses?.items || []);
  useEffect(() => {
    setLocalExpenses(data.expenses?.items || []);
  }, [data.expenses]);

  const [localKit, setLocalKit] = useState<any[]>(data.equipment || []);
  useEffect(() => {
    setLocalKit(data.equipment || []);
  }, [data.equipment]);

  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user?.id) return;
    const next: Record<string, number> = {};
    for (const decision of data.decisions || []) {
      const mine = (decision.votesDetail || []).find((vote: any) => vote.userId === user.id);
      if (mine) next[decision.id] = mine.optionIndex;
    }
    setMyVotes(next);
  }, [data.decisions, user?.id]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [caisseOpen, setCaisseOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  // Deep links du menu racine (?onglet=tasks, expenses, …) → tiroir correspondant.
  useEffect(() => {
    const target = initialTab ? TAB_DRAWERS[initialTab] : undefined;
    if (!target) return;
    const setters: Record<string, (open: boolean) => void> = {
      tasks: setTasksOpen,
      caisse: setCaisseOpen,
      equipment: setEquipmentOpen,
      decisions: setDecisionsOpen,
      discussion: setDiscussionOpen,
      members: setMembersOpen,
    };
    const timer = setTimeout(() => setters[target](true), 220);
    return () => clearTimeout(timer);
  }, [initialTab]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const travelers = useMemo(() => data.travelers || [], [data.travelers]);
  const pendingTravelers = useMemo(() => data.pendingTravelers || [], [data.pendingTravelers]);
  const decisions = useMemo(() => data.decisions || [], [data.decisions]);
  const messages = useMemo(() => data.discussions || [], [data.discussions]);
  const canManage = !!user;

  const engineTasks = useMemo(
    () =>
      localTasks.map((task) => ({
        id: task.id,
        title: task.title,
        completed: !!task.completed,
        dueDate: task.dueDate ?? null,
        assignedName: task.assignee ?? null,
      })),
    [localTasks]
  );

  const engineKit = useMemo(
    () => localKit.map((item) => ({ id: item.id, assigned: !!item.assigneeId })),
    [localKit]
  );

  const engineMembers = useMemo(
    () => [
      ...travelers.map((member: any) => ({ userId: member.user_id, name: member.name, status: 'active' })),
      ...pendingTravelers.map((member: any) => ({ userId: member.user_id, name: member.name, status: 'pending' })),
    ],
    [travelers, pendingTravelers]
  );

  const engineExpenses = useMemo(
    () =>
      localExpenses.map((expense) => ({
        id: expense.id,
        title: expense.title,
        amount: Number(expense.amount || 0),
        paidBy: expense.paidBy ?? null,
        splitBetween: Array.isArray(expense.splitBetween) ? expense.splitBetween : [],
        settled: expense.statusCode === 'settled',
      })),
    [localExpenses]
  );

  const readiness = useMemo(
    () => computeGroupeReadiness({ tasks: engineTasks, kit: engineKit, expenses: engineExpenses, members: engineMembers }),
    [engineTasks, engineKit, engineExpenses, engineMembers]
  );

  const criticalPath = useMemo(() => buildGroupeCriticalPath(engineTasks, today), [engineTasks, today]);
  const balances = useMemo(() => buildGroupeBalances(engineExpenses, engineMembers), [engineExpenses, engineMembers]);

  const nameFor = useMemo(() => {
    const names = new Map<string, string>(engineMembers.map((member) => [member.userId, member.name]));
    return (userId: string | null | undefined): string => {
      if (!userId) return 'Membre';
      return names.get(userId) ?? 'Membre';
    };
  }, [engineMembers]);

  const pendingExpenses = useMemo(
    () =>
      engineExpenses
        .filter((expense) => !expense.settled)
        .map((expense) => ({
          id: expense.id,
          title: expense.title ?? 'Dépense',
          amount: expense.amount,
          payerName: nameFor(expense.paidBy),
        })),
    [engineExpenses, nameFor]
  );

  const recentExpenses = useMemo(
    () =>
      localExpenses.slice(0, 6).map((expense) => ({
        id: expense.id,
        title: expense.title ?? 'Dépense',
        amount: Number(expense.amount || 0),
        payerName: nameFor(expense.paidBy),
        settled: expense.statusCode === 'settled',
      })),
    [localExpenses, nameFor]
  );

  const openCount = criticalPath.length;
  const overdueCount = criticalPath.filter((task) => task.isOverdue).length;
  const activeCount = travelers.length;
  const pendingCount = pendingTravelers.length;
  const memberNames = travelers.map((member: any) => member.name as string);
  const kitTotal = engineKit.length;
  const kitAssigned = engineKit.filter((item) => item.assigned).length;
  const doneCount = engineTasks.filter((task) => task.completed).length;
  const settledCount = engineExpenses.filter((expense) => expense.settled).length;

  /* ---------------- Actions ---------------- */

  const handleToggleTask = (task: GroupeCriticalTask) => {
    const snapshot = localTasks;
    setLocalTasks((prev) =>
      prev.map((entry) =>
        entry.id === task.id ? { ...entry, completed: true, statusCode: 'done', tags: ['Fait'] } : entry
      )
    );
    startTransition(async () => {
      const res = await toggleGroupeTaskStatus(task.id, false);
      if (res.error) {
        setLocalTasks(snapshot);
        setErrorMsg('Impossible de terminer cette tâche');
      } else {
        triggerHaptic('success');
        onRefresh?.();
      }
    });
  };

  const handleDueDate = (taskId: string, dueDate: string | null) => {
    const snapshot = localTasks;
    setLocalTasks((prev) => prev.map((entry) => (entry.id === taskId ? { ...entry, dueDate } : entry)));
    startTransition(async () => {
      const res = await updateGroupeTaskDueDate(taskId, dueDate);
      if (res.error) {
        setLocalTasks(snapshot);
        setErrorMsg("Impossible de mettre à jour l'échéance");
      } else {
        triggerHaptic('selection');
        onRefresh?.();
      }
    });
  };

  const handleSettle = (expenseId: string) => {
    const snapshot = localExpenses;
    setLocalExpenses((prev) =>
      prev.map((entry) => (entry.id === expenseId ? { ...entry, statusCode: 'settled' } : entry))
    );
    startTransition(async () => {
      const res = await settleGroupeExpense(expenseId);
      if (res.error) {
        setLocalExpenses(snapshot);
        setErrorMsg('Impossible de marquer cette dépense comme remboursée');
      } else {
        triggerHaptic('success');
        onRefresh?.();
      }
    });
  };

  const handleAssignKit = (itemId: string, targetUserId: string | null) => {
    const snapshot = localKit;
    const targetName = targetUserId ? user?.user_metadata?.full_name ?? 'Moi' : null;
    setLocalKit((prev) =>
      prev.map((entry) =>
        entry.id === itemId ? { ...entry, assigneeId: targetUserId ?? undefined, assignee: targetName ?? 'Non attribué' } : entry
      )
    );
    startTransition(async () => {
      const res = await assignGroupeKitItem(itemId, targetUserId);
      if (res.error) {
        setLocalKit(snapshot);
        setErrorMsg("Impossible de mettre à jour l'équipement");
      } else {
        triggerHaptic('success');
        onRefresh?.();
      }
    });
  };

  const handleVote = (decisionId: string, optionId: string) => {
    if (!user?.id) return;
    const optionIndex = Number(optionId.replace(/^opt-/, ''));
    const snapshot = myVotes;
    setMyVotes((prev) => ({ ...prev, [decisionId]: Number.isFinite(optionIndex) ? optionIndex : 0 }));
    startTransition(async () => {
      const res = await voteInGroupeOption(decisionId, optionId, user.id);
      if (res.error) {
        setMyVotes(snapshot);
        setErrorMsg('Impossible d’enregistrer votre vote');
      } else {
        triggerHaptic('success');
        onRefresh?.();
      }
    });
  };

  /* ---------------- Dérivés UI ---------------- */

  const primaryAction = useMemo(() => {
    if (overdueCount > 0) return { label: 'Rattraper les retards', open: () => setTasksOpen(true) };
    if (openCount > 0) return { label: 'Voir le chemin critique', open: () => setTasksOpen(true) };
    return { label: 'Inviter des compagnons', open: () => setMembersOpen(true) };
  }, [overdueCount, openCount]);

  const readinessFactors: GroupeReadinessFactor[] = [
    {
      key: 'tasks',
      label: 'Tâches',
      pct: readiness.factors.tasks,
      detail: `${doneCount}/${engineTasks.length} terminée(s)${overdueCount > 0 ? ` · ${overdueCount} en retard` : ''}`,
    },
    {
      key: 'kit',
      label: 'Équipement',
      pct: readiness.factors.kit,
      detail: `${kitAssigned}/${kitTotal} objet(s) pris en charge`,
    },
    {
      key: 'members',
      label: 'Invitations',
      pct: readiness.factors.members,
      detail: `${activeCount} actif(s)${pendingCount > 0 ? ` · ${pendingCount} en attente` : ''}`,
    },
    {
      key: 'budget',
      label: 'Règlements',
      pct: readiness.factors.budget,
      detail: `${settledCount}/${engineExpenses.length} réglée(s) · ${formatEuro(balances.outstanding)} à régler`,
    },
  ];

  const chips: GroupeChipDef[] = [
    {
      key: 'tasks',
      icon: CheckSquare,
      value: String(openCount),
      label: overdueCount > 0 ? `${overdueCount} en retard` : 'à faire',
      tone: overdueCount > 0 ? 'warn' : 'default',
      onClick: () => setTasksOpen(true),
    },
    {
      key: 'balances',
      icon: Wallet,
      value: formatEuro(data.expenses?.total ?? 0),
      label: pendingExpenses.length > 0 ? `${pendingExpenses.length} à rembourser` : 'dépenses',
      tone: pendingExpenses.length > 0 ? 'accent' : 'default',
      onClick: () => setCaisseOpen(true),
    },
    {
      key: 'members',
      icon: Users,
      value: String(activeCount),
      label: pendingCount > 0 ? `${pendingCount} en attente` : 'membres',
      tone: pendingCount > 0 ? 'accent' : 'default',
      onClick: () => setMembersOpen(true),
    },
    {
      key: 'equipment',
      icon: Package,
      value: String(kitTotal),
      label: 'objets partagés',
      onClick: () => setEquipmentOpen(true),
    },
  ];

  const daysLeft = typeof data.meta?.daysLeft === 'number' ? data.meta.daysLeft : null;

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      {errorMsg && (
        <div
          className="glass tone-danger flex items-center justify-between gap-2 rounded-xl p-3 text-xs text-[var(--lkv-danger)]"
          role="alert"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-muted)] hover:text-[var(--lkv-text-primary)]"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}

      <GroupeReadinessHero
        readiness={readiness}
        daysLeft={daysLeft}
        memberNames={memberNames}
        pendingCount={pendingCount}
        primaryLabel={primaryAction.label}
        onPrimary={() => {
          triggerHaptic('light');
          primaryAction.open();
        }}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      <GroupeChipsRow chips={chips} />

      <GroupeCriticalPath
        tasks={criticalPath}
        openCount={openCount}
        overdueCount={overdueCount}
        canManage={canManage}
        isPending={isPending}
        onToggle={handleToggleTask}
        onDueDate={handleDueDate}
        onOpenAll={() => setTasksOpen(true)}
      />

      {/* ── RAIL CAISSE ── */}
      <GroupeRail
        title="Caisse commune"
        subtitle={`${formatEuro(data.expenses?.total ?? 0)} engagés · ${
          balances.outstanding > 0 ? `${formatEuro(balances.outstanding)} à régler` : 'comptes équilibrés'
        }`}
        actionLabel="Gérer"
        onAction={() => setCaisseOpen(true)}
        ariaLabel="Caisse commune"
      >
        <li className="shrink-0 snap-start">
          <button
            type="button"
            onClick={() => setCaisseOpen(true)}
            aria-label={`Caisse commune — ${balances.outstanding > 0 ? `${formatEuro(balances.outstanding)} à régler` : 'comptes équilibrés'}`}
            className={`glass interactive flex h-[9.5rem] w-[9.5rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] ${
              balances.outstanding > 0 ? 'border-2 border-[var(--lkv-primary)]/35' : ''
            }`}
          >
            <span className="w-fit rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--lkv-primary)]">
              {balances.outstanding > 0 ? 'À régler' : 'Équilibré'}
            </span>
            <span className="mt-2 font-display text-xl font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
              {balances.outstanding > 0 ? formatEuro(balances.outstanding) : '—'}
            </span>
            <span className="mt-auto text-[10.5px] font-medium text-[var(--lkv-text-primary)]/70">
              {pendingExpenses.length > 0
                ? `${pendingExpenses.length} à rembourser`
                : 'Rien à rembourser'}
            </span>
          </button>
        </li>
        {recentExpenses.map((expense) => (
          <li key={expense.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setCaisseOpen(true)}
              aria-label={`${expense.title} — ${formatEuro(expense.amount)}`}
              className="glass interactive flex h-[9.5rem] w-[9.5rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97]"
            >
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  expense.settled
                    ? 'bg-[var(--sage-50)] text-[var(--sage-700)]'
                    : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                }`}
              >
                {expense.settled ? 'Réglée' : 'En attente'}
              </span>
              <span className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                {expense.title}
              </span>
              <span className="mt-auto block font-display text-lg font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
                {formatEuro(expense.amount)}
              </span>
              <span className="block truncate text-[10px] font-medium text-[var(--lkv-text-primary)]/70">
                Avancé par {expense.payerName}
              </span>
            </button>
          </li>
        ))}
      </GroupeRail>

      {/* ── RAIL ÉQUIPEMENT ── */}
      <GroupeRail
        title="Équipement partagé"
        subtitle={`${kitAssigned}/${kitTotal} pris en charge`}
        actionLabel="Gérer"
        onAction={() => setEquipmentOpen(true)}
        ariaLabel="Équipement partagé"
      >
        {localKit.length === 0 ? (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setEquipmentOpen(true)}
              className="glass-sub-card flex h-[9.5rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[1.4rem] p-4 text-left"
            >
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucun objet partagé</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Ajoutez le matériel commun du groupe.
              </span>
            </button>
          </li>
        ) : (
          localKit.slice(0, 8).map((item: any) => {
            const mine = !!user?.id && item.assigneeId === user.id;
            return (
              <li key={item.id} className="shrink-0 snap-start">
                <div
                  className={`flex h-[9.5rem] w-[9.5rem] flex-col rounded-[1.4rem] p-3 ${
                    mine ? 'glass border-2 border-[var(--lkv-primary)]/35' : 'glass'
                  }`}
                >
                  <span className="w-fit rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[9.5px] font-bold text-[var(--lkv-primary)]">
                    {item.category || 'Divers'}
                  </span>
                  <p className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                    {item.item}
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-[var(--lkv-text-primary)]/70">{item.weight}</p>
                  <div className="mt-auto">
                    {mine ? (
                      <button
                        type="button"
                        onClick={() => handleAssignKit(item.id, null)}
                        disabled={isPending}
                        className="glass-capsule-btn primary inline-flex w-full items-center justify-center !py-2 text-[11px] font-bold min-h-[44px] disabled:opacity-50"
                      >
                        Pris par moi ✓
                      </button>
                    ) : item.assigneeId ? (
                      <p className="truncate text-[10.5px] font-semibold text-[var(--lkv-text-primary)]/70">
                        Pris par {item.assignee}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssignKit(item.id, user?.id ?? null)}
                        disabled={!canManage || isPending}
                        className="glass-capsule-btn primary inline-flex w-full items-center justify-center !py-2 text-[11px] font-bold min-h-[44px] disabled:opacity-50"
                      >
                        Je l’apporte
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </GroupeRail>

      {/* ── RAIL DÉCISIONS ── */}
      {decisions.length > 0 && (
        <GroupeRail
          title="Décisions en cours"
          subtitle={`${decisions.length} vote${decisions.length > 1 ? 's' : ''} ouvert${decisions.length > 1 ? 's' : ''}`}
          actionLabel="Tout voir"
          onAction={() => setDecisionsOpen(true)}
          ariaLabel="Décisions en cours"
        >
          {decisions.map((decision: any) => (
            <li key={decision.id} className="shrink-0 snap-start">
              <div className="glass flex h-[11rem] w-[16rem] flex-col rounded-[1.4rem] p-3.5">
                <p className="line-clamp-2 text-[13px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                  {decision.question}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {(decision.options || []).slice(0, 3).map((option: any) => {
                    const selected = myVotes[decision.id] === option.index;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          onClick={() => handleVote(decision.id, option.id)}
                          disabled={!canManage || isPending}
                          aria-pressed={selected}
                          className={`w-full rounded-xl px-2.5 py-1.5 text-left transition-colors disabled:opacity-60 ${
                            selected
                              ? 'bg-[var(--lkv-primary)]/15 ring-1 ring-[var(--lkv-primary)]/30'
                              : 'bg-black/[0.03] hover:bg-black/[0.05]'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[11.5px] font-semibold text-[var(--lkv-text-primary)]">
                              {option.label}
                            </span>
                            <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-[var(--lkv-text-primary)]/70">
                              {option.percentage}%
                            </span>
                          </span>
                          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-black/5">
                            <span
                              className="block h-full rounded-full bg-[var(--lkv-primary)]"
                              style={{ width: `${Math.min(100, Math.max(0, option.percentage))}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-auto pt-1.5 text-[10px] font-medium text-[var(--lkv-text-primary)]/60">
                  {decision.footer}
                  {myVotes[decision.id] !== undefined ? ' · Voté' : ' · Touchez pour voter'}
                </p>
              </div>
            </li>
          ))}
        </GroupeRail>
      )}

      {/* ── RAIL MEMBRES ── */}
      <GroupeRail
        title="Membres"
        subtitle={`${activeCount} actif${activeCount > 1 ? 's' : ''}${
          pendingCount > 0 ? ` · ${pendingCount} en attente` : ''
        }`}
        actionLabel="Gérer"
        onAction={() => setMembersOpen(true)}
        ariaLabel="Membres du groupe"
      >
        {travelers.map((member: any) => (
          <li key={member.user_id} className="shrink-0 snap-start">
            <div className="glass flex h-[8rem] w-[8.75rem] flex-col items-center justify-center gap-1.5 rounded-[1.4rem] p-3 text-center">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-sm font-bold text-[var(--lkv-primary)]"
                aria-hidden="true"
              >
                {(member.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="w-full truncate text-[12px] font-bold text-[var(--lkv-text-primary)]">
                {member.name}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
                {member.role}
              </span>
            </div>
          </li>
        ))}
        {pendingTravelers.map((member: any) => (
          <li key={member.user_id} className="shrink-0 snap-start">
            <div className="flex h-[8rem] w-[8.75rem] flex-col items-center justify-center gap-1.5 rounded-[1.4rem] border-2 border-dashed border-[var(--lkv-primary)]/25 p-3 text-center opacity-80">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-sm font-bold text-[var(--lkv-text-primary)]/60"
                aria-hidden="true"
              >
                {(member.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="w-full truncate text-[12px] font-semibold text-[var(--lkv-text-primary)]/80">
                {member.name}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/50">
                En attente
              </span>
            </div>
          </li>
        ))}
        {data.inviteCode && (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              aria-label="Inviter des compagnons"
              className="glass-sub-card flex h-[8rem] w-[8.75rem] flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-[var(--lkv-primary)]/30 p-3 transition-transform active:scale-[0.97]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]">
                <Plus size={18} aria-hidden="true" />
              </span>
              <span className="text-[11px] font-bold text-[var(--lkv-text-primary)]">Inviter</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
                {data.inviteCode}
              </span>
            </button>
          </li>
        )}
      </GroupeRail>

      {/* ── RAIL DISCUSSION ── */}
      {messages.length > 0 && (
        <GroupeRail
          title="Discussion"
          subtitle={`${messages.length} message${messages.length > 1 ? 's' : ''}`}
          actionLabel="Ouvrir"
          onAction={() => setDiscussionOpen(true)}
          ariaLabel="Discussion du groupe"
        >
          {messages.slice(0, 5).map((message: any) => (
            <li key={message.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setDiscussionOpen(true)}
                className="glass interactive flex h-[8.5rem] w-[14.5rem] flex-col rounded-[1.4rem] p-3.5 text-left transition-transform active:scale-[0.98]"
              >
                <p className="line-clamp-3 font-serif-lkv text-[13.5px] italic leading-snug text-[var(--lkv-text-primary)]">
                  « {message.content} »
                </p>
                <p className="mt-auto truncate pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--lkv-text-primary)]/60">
                  {message.author} · {message.time}
                </p>
              </button>
            </li>
          ))}
        </GroupeRail>
      )}

      {linkedTrip && (
        <Link
          href={tripSectionHref(linkedTrip.slug, 'overview')}
          className="glass flex items-center justify-between gap-3 rounded-2xl p-3.5"
        >
          <span className="min-w-0">
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Voyage lié
            </span>
            <span className="block truncate text-sm font-bold text-[var(--lkv-text-primary)]">
              {linkedTrip.title}
            </span>
          </span>
          <span className="glass-capsule-btn primary min-h-[44px] shrink-0 !px-4 text-xs font-bold">
            Ouvrir le cockpit →
          </span>
        </Link>
      )}

      {data.trail && <ParcoursCard groupId={groupId} trail={data.trail} meta={data.meta} />}

      {/* ── TIROIRS ── */}
      <GroupeReadinessDrawer
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        readiness={readiness}
        factors={readinessFactors}
        primaryLabel={primaryAction.label}
        onPrimary={primaryAction.open}
      />

      <GroupeDrawer open={tasksOpen} onOpenChange={setTasksOpen} title="Tâches du groupe" width={470}>
        <TachesCard
          tasks={localTasks}
          groupId={groupId}
          onRefresh={onRefresh}
          user={user}
          members={members}
        />
      </GroupeDrawer>

      <GroupeDrawer open={caisseOpen} onOpenChange={setCaisseOpen} title="Caisse commune" width={470}>
        <GroupeBalancesCard
          view={balances}
          pendingExpenses={pendingExpenses}
          isPending={isPending}
          onSettle={handleSettle}
        />
        <DepensesCard
          expenses={data.expenses}
          groupId={groupId}
          onRefresh={onRefresh}
          user={user}
          members={members}
        />
      </GroupeDrawer>

      <GroupeDrawer open={equipmentOpen} onOpenChange={setEquipmentOpen} title="Équipement partagé" width={470}>
        <EquipementCard
          equipment={data.equipment}
          groupId={groupId}
          onRefresh={onRefresh}
          user={user}
          members={members}
        />
      </GroupeDrawer>

      <GroupeDrawer open={decisionsOpen} onOpenChange={setDecisionsOpen} title="Décisions du groupe" width={470}>
        <DecisionsCard decisions={data.decisions} groupId={groupId} onRefresh={onRefresh} user={user} />
      </GroupeDrawer>

      <GroupeDrawer open={discussionOpen} onOpenChange={setDiscussionOpen} title="Discussion" width={470}>
        <DiscussionCard discussions={data.discussions} groupId={groupId} onRefresh={onRefresh} user={user} />
      </GroupeDrawer>

      <GroupeDrawer open={membersOpen} onOpenChange={setMembersOpen} title="Membres & invitations" width={470}>
        <GroupeMembersCard
          members={travelers.map((member: any) => ({
            userId: member.user_id,
            name: member.name,
            role: member.role,
          }))}
          pending={pendingTravelers.map((member: any) => ({
            userId: member.user_id,
            name: member.name,
            role: member.role,
          }))}
          inviteCode={data.inviteCode || null}
        />
        <VoyageursCard
          travelers={travelers}
          groupId={groupId}
          onRefresh={onRefresh}
          user={user}
          members={members}
        />
      </GroupeDrawer>
    </div>
  );
}

export default GroupeMobileExperience;
