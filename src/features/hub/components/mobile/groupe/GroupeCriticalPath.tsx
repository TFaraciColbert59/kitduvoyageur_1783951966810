'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { GroupeCriticalTask } from '../../../mobile/groupeEngine';

export interface GroupeCriticalPathProps {
  tasks: GroupeCriticalTask[];
  openCount: number;
  overdueCount: number;
  canManage: boolean;
  isPending: boolean;
  onToggle: (task: GroupeCriticalTask) => void;
  onDueDate: (taskId: string, dueDate: string | null) => void;
  onOpenAll: () => void;
}

function dueMeta(daysLeft: number | null): { label: string; className: string } {
  if (daysLeft === null) {
    return { label: 'Sans date', className: 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]' };
  }
  if (daysLeft < 0) {
    return {
      label: `${Math.abs(daysLeft)} j de retard`,
      className: 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]',
    };
  }
  if (daysLeft === 0) {
    return { label: 'Aujourd’hui', className: 'bg-[var(--lkv-primary)] text-white' };
  }
  if (daysLeft === 1) {
    return { label: 'Demain', className: 'bg-[var(--lkv-primary)]/15 text-[var(--lkv-primary)]' };
  }
  return { label: `J-${daysLeft}`, className: 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]' };
}

export function GroupeCriticalPath({
  tasks,
  openCount,
  overdueCount,
  canManage,
  isPending,
  onToggle,
  onDueDate,
  onOpenAll,
}: GroupeCriticalPathProps) {
  const { triggerHaptic } = useHapticFeedback();
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const syncArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncArrows();
  }, [tasks.length, syncArrows]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.querySelector('li');
    const step = first ? first.offsetWidth + 12 : Math.round(el.clientWidth * 0.8);
    triggerHaptic('light');
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <section aria-label="Chemin critique">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
            Chemin critique
          </p>
          <p className="mt-0.5 text-xs font-medium text-[var(--lkv-text-primary)]/70">
            {openCount} tâche{openCount > 1 ? 's' : ''} ouverte{openCount > 1 ? 's' : ''}
            {overdueCount > 0 ? ` · ${overdueCount} en retard` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenAll}
            className="glass-capsule-btn !px-3 !py-1.5 text-[11px] font-bold min-h-[44px]"
          >
            Tout voir
          </button>
          {tasks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                disabled={!canLeft}
                aria-label="Tâches précédentes"
                className="glass-circle-btn h-10 w-10 disabled:opacity-40"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                disabled={!canRight}
                aria-label="Tâches suivantes"
                className="glass-circle-btn primary h-10 w-10 disabled:opacity-40"
              >
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="glass-sub-card rounded-2xl p-4">
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
            {openCount === 0 ? 'Rien dans le chemin critique' : 'Aucune échéance active'}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--lkv-text-primary)]/70">
            {openCount === 0
              ? 'Toutes les tâches ouvertes sont terminées. Beau travail.'
              : 'Ajoutez une date à vos tâches pour prioriser la préparation.'}
          </p>
          <button
            type="button"
            onClick={onOpenAll}
            className="glass-capsule-btn mt-3 min-h-[44px] !px-4 text-xs font-bold"
          >
            Gérer les tâches
          </button>
        </div>
      ) : (
        <ul
          ref={scrollRef}
          onScroll={syncArrows}
          className="hub-hscroll -mx-4 flex list-none snap-x gap-3 overflow-x-auto px-4 pb-1"
        >
          {tasks.map((task) => {
            const due = dueMeta(task.daysLeft);
            return (
              <li key={task.id} className="shrink-0 snap-start">
                <div
                  className={`flex h-[10.5rem] w-[9.5rem] flex-col rounded-[1.4rem] p-3 ${
                    task.isOverdue
                      ? 'glass border-2 border-[var(--lkv-danger)]/25'
                      : 'glass'
                  }`}
                >
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${due.className}`}
                  >
                    {due.label}
                  </span>

                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[12.5px] font-bold leading-snug text-[var(--lkv-text-primary)]">
                    {task.title}
                  </p>

                  <p className="mt-1.5 truncate text-[10.5px] font-medium text-[var(--lkv-text-primary)]/70">
                    {task.assignedName ?? 'Non attribué'}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        onToggle(task);
                      }}
                      disabled={!canManage || isPending}
                      aria-label={`Marquer « ${task.title} » comme terminée`}
                      className="glass-check-circle h-10 w-10 disabled:opacity-40"
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>

                    <label
                      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full glass-sub-card text-[var(--lkv-text-primary)]/70 transition-colors ${
                        canManage ? 'cursor-pointer' : 'opacity-40'
                      }`}
                      title="Changer l’échéance"
                    >
                      <CalendarDays size={15} aria-hidden="true" />
                      <input
                        type="date"
                        value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                        onChange={(event) => onDueDate(task.id, event.target.value || null)}
                        disabled={!canManage || isPending}
                        aria-label={`Échéance de « ${task.title} »`}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      />
                    </label>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default GroupeCriticalPath;
