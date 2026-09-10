'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import {
  bucketChecklist,
  checklistProgress,
  nextChecklistItem,
  type ChecklistBucketKey,
} from '../../../mobile/checklistEngine';
import { BudgetRing } from '../budget/BudgetRing';
import { GroupeChipsRow, type GroupeChipDef } from '../groupe/GroupeChipsRow';
import { GroupeDrawer } from '../groupe/GroupeDrawer';
import { GroupeRail } from '../groupe/GroupeRail';

let checklistClient: ReturnType<typeof createClient> | null = null;
function supabaseChecklistClient() {
  if (!checklistClient) checklistClient = createClient();
  return checklistClient;
}

export interface ChecklistMobileExperienceProps {
  tripId: string;
  daysUntilStart?: number | null;
  items: DatabaseTripChecklistItem[];
}

const BUCKET_TITLES: Record<ChecklistBucketKey, { title: string; subtitle: string }> = {
  j30: { title: 'Préparation fondamentale', subtitle: 'J-30' },
  j7: { title: 'Dernière ligne droite', subtitle: 'J-7' },
  j1: { title: 'Veille & jour J', subtitle: 'Départ' },
};

type ChecklistFilter = 'all' | 'todo' | 'done';

export function ChecklistMobileExperience({ tripId, daysUntilStart, items }: ChecklistMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [rows, setRows] = useState<DatabaseTripChecklistItem[]>(items);
  useEffect(() => {
    setRows(items);
  }, [items]);
  const [filter, setFilter] = useState<ChecklistFilter>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const progress = useMemo(() => checklistProgress(rows), [rows]);
  const buckets = useMemo(() => bucketChecklist(rows), [rows]);
  const next = useMemo(() => nextChecklistItem(rows), [rows]);

  const toggleItem = (item: DatabaseTripChecklistItem) => {
    triggerHaptic('selection');
    const nextDone = !item.done;
    const previous = rows;
    setRows((prev) => prev.map((row) => (row.id === item.id ? { ...row, done: nextDone } : row)));
    void (async () => {
      const { error } = await supabaseChecklistClient()
        .from('trip_checklist_items')
        .update({ done: nextDone, done_at: nextDone ? new Date().toISOString() : null })
        .eq('id', item.id)
        .eq('trip_id', tripId);
      if (error) {
        setRows(previous);
      }
    })();
  };

  const openWith = (nextFilter: ChecklistFilter) => {
    setFilter(nextFilter);
    setDrawerOpen(true);
  };

  const chips: GroupeChipDef[] = [
    {
      key: 'todo',
      icon: ListTodo,
      value: String(progress.remaining),
      label: 'à faire',
      tone: progress.remaining > 0 ? 'accent' : 'default',
      onClick: () => openWith('todo'),
    },
    {
      key: 'done',
      icon: CheckCircle2,
      value: String(progress.done),
      label: 'faites',
      onClick: () => openWith('done'),
    },
    {
      key: 'total',
      icon: CalendarDays,
      value: String(progress.total),
      label: 'au total',
      onClick: () => openWith('all'),
    },
  ];

  const filtered = rows.filter((row) => {
    if (filter === 'todo') return !row.done;
    if (filter === 'done') return row.done;
    return true;
  });

  const renderItem = (item: DatabaseTripChecklistItem) => {
    const done = item.done;
    return (
      <li key={item.id} className="shrink-0 snap-start">
        <button
          type="button"
          onClick={() => toggleItem(item)}
          aria-pressed={done}
          aria-label={`${done ? 'Décocher' : 'Cocher'} ${item.label}`}
          className={`flex h-[8.5rem] w-[13rem] flex-col rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] ${
            done ? 'glass border-2 border-[var(--lkv-primary)]/30' : 'glass'
          }`}
        >
          <span className="flex w-full items-start justify-between gap-2">
            <span className="rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--lkv-primary)]">
              {BUCKET_TITLES[item.due_offset_days >= 30 ? 'j30' : item.due_offset_days >= 8 ? 'j7' : 'j1'].subtitle}
            </span>
            {done ? (
              <CheckCircle2 size={17} className="shrink-0 text-[var(--lkv-primary)]" aria-hidden="true" />
            ) : (
              <Circle size={17} className="shrink-0 text-[var(--lkv-text-primary)]/30" aria-hidden="true" />
            )}
          </span>
          <span
            className={`mt-2 line-clamp-3 text-[12.5px] font-bold leading-snug ${
              done ? 'text-[var(--lkv-text-primary)]/50 line-through' : 'text-[var(--lkv-text-primary)]'
            }`}
          >
            {item.label}
          </span>
          <span className="mt-auto text-[10px] font-medium text-[var(--lkv-text-primary)]/60">
            {item.done ? 'Fait' : `J-${item.due_offset_days}`}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      <section className="glass relative overflow-hidden rounded-[1.75rem] p-4" aria-label="Checklist de préparation">
        <header className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Checklist de préparation
          </p>
          {daysUntilStart != null && (
            <span className="glass-pill shrink-0 uppercase tracking-[0.08em]">
              {daysUntilStart > 0 ? `J-${daysUntilStart}` : 'Départ imminent'}
            </span>
          )}
        </header>

        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => openWith('todo')}
            aria-label={`Détail de la checklist — ${progress.pct}% prêt`}
            className="relative shrink-0 rounded-full transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
          >
            <BudgetRing pct={progress.pct}>
              <span className="font-display text-2xl font-extrabold leading-none text-[var(--lkv-text-primary)]">
                {progress.pct}%
              </span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
                prêt
              </span>
            </BudgetRing>
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
              {progress.done}/{progress.total} tâche{progress.total > 1 ? 's' : ''} terminée{progress.done > 1 ? 's' : ''}
            </p>
            {next ? (
              <p className="text-xs font-medium leading-snug text-[var(--lkv-text-primary)]/70">
                Prochaine : « {next.label} » (J-{next.due_offset_days})
              </p>
            ) : (
              <p className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Tout est prêt pour le départ.
              </p>
            )}
            <p className="text-[11px] font-medium text-[var(--lkv-text-primary)]/60">
              {progress.remaining} restante{progress.remaining > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openWith('todo')}
          className="glass-capsule-btn primary mt-4 inline-flex w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
        >
          Voir les tâches à faire
        </button>
      </section>

      <GroupeChipsRow chips={chips} />

      {(['j1', 'j7', 'j30'] as ChecklistBucketKey[]).map((key) => {
        const bucketItems = buckets[key];
        if (bucketItems.length === 0) return null;
        const doneInBucket = bucketItems.filter((item) => item.done).length;
        return (
          <GroupeRail
            key={key}
            title={BUCKET_TITLES[key].title}
            subtitle={`${doneInBucket}/${bucketItems.length} terminée${doneInBucket > 1 ? 's' : ''}`}
            actionLabel="Tout voir"
            onAction={() => openWith('all')}
            ariaLabel={`Checklist ${BUCKET_TITLES[key].title}`}
          >
            {bucketItems.map(renderItem)}
          </GroupeRail>
        );
      })}

      {rows.length === 0 && (
        <div className="glass-sub-card rounded-2xl p-4">
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucune tâche de préparation</p>
          <p className="mt-1 text-xs font-medium text-[var(--lkv-text-primary)]/70">
            La checklist est générée automatiquement avec le voyage.
          </p>
        </div>
      )}

      <GroupeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Checklist" width={460}>
        <div className="flex gap-2">
          {(
            [
              { key: 'all', label: 'Tout' },
              { key: 'todo', label: 'À faire' },
              { key: 'done', label: 'Faites' },
            ] as Array<{ key: ChecklistFilter; label: string }>
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={`min-h-[44px] flex-1 rounded-full px-3 text-xs font-bold transition-colors ${
                filter === option.key
                  ? 'bg-[var(--lkv-primary)] text-white'
                  : 'glass-sub-card text-[var(--lkv-text-primary)]/75'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-[var(--lkv-text-primary)]/70">
            Aucune tâche dans ce filtre.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => {
              const done = item.done;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleItem(item)}
                    aria-pressed={done}
                    aria-label={`${done ? 'Décocher' : 'Cocher'} ${item.label}`}
                    className="glass-sub-card flex min-h-[44px] w-full items-start gap-3 rounded-2xl p-3 text-left"
                  >
                    {done ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--lkv-primary)]" aria-hidden="true" />
                    ) : (
                      <Circle size={18} className="mt-0.5 shrink-0 text-[var(--lkv-text-primary)]/30" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] font-semibold ${
                          done ? 'text-[var(--lkv-text-primary)]/45 line-through' : 'text-[var(--lkv-text-primary)]'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] font-medium text-[var(--lkv-text-primary)]/60">
                        Recommandé J-{item.due_offset_days}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </GroupeDrawer>
    </div>
  );
}

export default ChecklistMobileExperience;
