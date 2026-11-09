'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '@/ui/crm.module.css';
import { cx } from '@/ui/cx';
import { Chip } from '@/ui/chip';
import { Countdown } from '@/ui/countdown';
import { Kbd } from '@/ui/kbd';
import { EmptyState } from '@/ui/states';
import { useHotkeys } from '@/ui/use-hotkeys';
import type { InboxItem } from '@/lib/rpc';

export type QueueFilter = 'tout' | 'urgent' | 'signalements' | 'a_valider' | 'contributions';

const GROUP_ORDER = ['urgence_haute', 'delai_bientot', 'a_valider', 'signalements', 'contributions'] as const;
type GroupKey = (typeof GROUP_ORDER)[number];

type Entry =
  | { kind: 'group'; id: string; label: string; tone: 'danger' | 'warn' | 'neutral' }
  | { kind: 'item'; item: InboxItem };

const GROUP_H = 36;
const ROW_H = 58;
const OVERSCAN = 8;

function groupMeta(group: GroupKey): { label: string; tone: 'danger' | 'warn' | 'neutral' } {
  switch (group) {
    case 'urgence_haute':
      return { label: 'Urgence haute', tone: 'danger' };
    case 'delai_bientot':
      return { label: 'Délai bientôt dépassé', tone: 'warn' };
    case 'a_valider':
      return { label: 'À valider', tone: 'neutral' };
    default:
      return { label: 'Signalements et contributions', tone: 'neutral' };
  }
}

function dotTone(group: GroupKey): string {
  if (group === 'urgence_haute') return s.dotDanger;
  if (group === 'delai_bientot') return s.dotWarn;
  if (group === 'a_valider') return s.dotInfo;
  return s.dotSage;
}

export function matchesFilter(item: InboxItem, filter: QueueFilter): boolean {
  if (filter === 'tout') return true;
  if (filter === 'urgent') return item.urgency === 'haute' || item.group === 'urgence_haute' || item.group === 'delai_bientot';
  if (filter === 'a_valider') return item.group === 'a_valider';
  if (filter === 'signalements') return item.group === 'signalements';
  return item.group === 'contributions';
}

function caseHref(item: InboxItem): string {
  return `/cas/${item.source}/${item.id}`;
}

function buildEntries(items: InboxItem[]): Entry[] {
  const entries: Entry[] = [];
  for (const group of GROUP_ORDER) {
    const bucket = items.filter((item) => item.group === group);
    if (bucket.length === 0) continue;
    const meta = groupMeta(group);
    entries.push({ kind: 'group', id: `g:${group}`, label: `${meta.label} · ${bucket.length}`, tone: meta.tone });
    for (const item of bucket) entries.push({ kind: 'item', item });
  }
  return entries;
}

function upperBound(prefix: number[], value: number): number {
  let lo = 0;
  let hi = prefix.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((prefix[mid] ?? 0) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * File unifiée virtualisée (10 000 lignes tiennent sans ralentir l'écran) :
 * groupes colorés, compte à rebours, raccourcis J/K/↵, préchargement du cas suivant.
 */
export function QueueList({
  items,
  now,
  filter,
  cursor,
  onCursorChange
}: {
  items: InboxItem[];
  now: string;
  filter: QueueFilter;
  cursor: number;
  onCursorChange: (index: number) => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(640);

  const filtered = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [items, filter]);
  const entries = useMemo(() => buildEntries(filtered), [filtered]);
  const prefix = useMemo(() => {
    const sums: number[] = [0];
    for (const entry of entries) sums.push((sums[sums.length - 1] ?? 0) + (entry.kind === 'group' ? GROUP_H : ROW_H));
    return sums;
  }, [entries]);
  const totalHeight = prefix[prefix.length - 1] ?? 0;

  const itemEntries = useMemo(() => entries.filter((entry): entry is Extract<Entry, { kind: 'item' }> => entry.kind === 'item'), [entries]);

  useEffect(() => {
    if (cursor > itemEntries.length - 1) onCursorChange(Math.max(itemEntries.length - 1, 0));
  }, [cursor, itemEntries.length, onCursorChange]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setViewport(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const start = Math.max(0, upperBound(prefix, scrollTop) - 1 - OVERSCAN);
  const end = Math.min(entries.length, upperBound(prefix, scrollTop + viewport) + OVERSCAN);
  const visible = entries.slice(start, end);

  const selected = itemEntries[cursor]?.item;

  useEffect(() => {
    const next = itemEntries[cursor + 1]?.item;
    if (next) router.prefetch(caseHref(next));
  }, [cursor, itemEntries, router]);

  const move = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(cursor + delta, 0), Math.max(itemEntries.length - 1, 0));
      onCursorChange(next);
      const element = scrollRef.current;
      const entryIndex = entries.findIndex((entry) => entry.kind === 'item' && entry.item === itemEntries[next]?.item);
      if (element && entryIndex >= 0) {
        const top = prefix[entryIndex] ?? 0;
        if (top < element.scrollTop) element.scrollTop = top;
        else if (top + ROW_H > element.scrollTop + element.clientHeight) element.scrollTop = top + ROW_H - element.clientHeight;
      }
    },
    [cursor, entries, itemEntries, onCursorChange, prefix]
  );

  useHotkeys(
    {
      j: () => move(1),
      k: () => move(-1),
      enter: () => {
        if (selected) router.push(caseHref(selected));
      }
    },
    { enabled: true }
  );

  if (filtered.length === 0) {
    return (
      <div className={s.card}>
        <EmptyState title="Rien dans cette vue pour le moment">
          Changez de filtre, ou attendez qu’un élément arrive. La file se met à jour toute seule quand le temps réel est
          connecté.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <div
        ref={scrollRef}
        className={cx(s.card, s.scroll)}
        style={{ overflowY: 'auto', height: 'calc(100vh - 340px)', minHeight: 320, position: 'relative' }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        aria-label="File des éléments à traiter"
        tabIndex={0}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visible.map((entry, offset) => {
            const index = start + offset;
            const top = prefix[index] ?? 0;
            if (entry.kind === 'group') {
              return (
                <div
                  key={entry.id}
                  className={cx(
                    s.groupHead,
                    entry.tone === 'danger' ? s.groupUrgent : entry.tone === 'warn' ? s.groupWarn : s.groupNeutral
                  )}
                  style={{ position: 'absolute', top, left: 0, right: 0, height: GROUP_H, display: 'flex', alignItems: 'center' }}
                >
                  <span
                    className={cx(
                      s.label,
                      entry.tone === 'danger' ? s.groupLabelDanger : entry.tone === 'warn' ? s.groupLabelWarn : undefined
                    )}
                  >
                    {entry.label}
                  </span>
                </div>
              );
            }

            const item = entry.item;
            const itemIndex = itemEntries.findIndex((candidate) => candidate.item.key === item.key);
            const isSelected = itemIndex === cursor;
            const group = item.group as GroupKey;

            return (
              <button
                key={item.key}
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                className={cx(s.row, isSelected && s.rowSel)}
                style={{ position: 'absolute', top, left: 0, right: 0, height: ROW_H, overflow: 'hidden' }}
                onClick={() => {
                  onCursorChange(itemIndex);
                  router.push(caseHref(item));
                }}
              >
                <span className={cx(s.dot, dotTone(group))} style={group === 'urgence_haute' ? { width: 10, height: 10 } : undefined} aria-hidden="true" />
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{item.title}</span>
                  <span className={s.rowSub}>{item.subtitle}</span>
                </span>

                {item.group === 'urgence_haute' ? (
                  <Chip tone="danger">{item.badges[0] ?? 'Urgence haute'}</Chip>
                ) : item.group === 'delai_bientot' ? (
                  <Countdown dueAt={item.due_at} initialNow={now} />
                ) : (
                  item.badges.slice(0, 2).map((badge) => (
                    <Chip key={badge} tone={item.group === 'a_valider' ? 'info' : 'stone'}>
                      {badge}
                    </Chip>
                  ))
                )}

                {item.source === 'sos' ? <Kbd>P</Kbd> : isSelected ? <Kbd>↵</Kbd> : null}
              </button>
            );
          })}
        </div>
      </div>

      <p className={s.muted} style={{ margin: 0, fontSize: 12.5, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <span>
          <Kbd>J</Kbd> <Kbd>K</Kbd> naviguer
        </span>
        <span>
          <Kbd>↵</Kbd> ouvrir
        </span>
        <span>
          <Kbd>⌘K</Kbd> chercher ou agir
        </span>
        <span>
          <Kbd>?</Kbd> aide
        </span>
        <span style={{ marginLeft: 'auto' }}>
          {filtered.length} élément{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </span>
      </p>
    </>
  );
}
