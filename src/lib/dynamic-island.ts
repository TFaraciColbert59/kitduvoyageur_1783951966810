'use client';

export interface DynamicIslandUndo {
  label?: string;
  onUndo: () => void;
}

export interface DynamicIslandAction {
  label: string;
  onAction: () => void;
}

export interface DynamicIslandEvent {
  id: string;
  title: string;
  subtitle?: string;
  leadingIcon?: string;
  trailingText?: string;
  undo?: DynamicIslandUndo;
  action?: DynamicIslandAction;
  durationMs?: number;
  variant?: 'compact' | 'expanded';
}

const listeners = new Set<(event: DynamicIslandEvent | null) => void>();
let currentEvent: DynamicIslandEvent | null = null;

export function onDynamicIsland(callback: (event: DynamicIslandEvent | null) => void): () => void {
  listeners.add(callback);
  callback(currentEvent);
  return () => {
    listeners.delete(callback);
  };
}

export function showDynamicIsland(
  options: Omit<DynamicIslandEvent, 'id'> & { id?: string }
): string {
  const id = options.id ?? `island-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const event: DynamicIslandEvent = {
    ...options,
    id,
    durationMs: options.durationMs ?? 3800,
  };
  currentEvent = event;
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
  return id;
}

export function dismissDynamicIsland(id?: string): void {
  if (id && currentEvent?.id !== id) return;
  currentEvent = null;
  listeners.forEach((listener) => {
    try {
      listener(null);
    } catch {}
  });
}
