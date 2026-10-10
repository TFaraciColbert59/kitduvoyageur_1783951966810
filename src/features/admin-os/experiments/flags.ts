/** Dette de flags : stale (> 90 j sans changement), always-on, kill-switch. */

export interface FlagRow {
  id: string;
  enabled: boolean;
  updated_at: string;
}

export interface FlagDebt {
  id: string;
  tags: ('stale' | 'always_on')[];
}

const STALE_MS = 90 * 86400000;

export function flagDebt(flags: FlagRow[], now = Date.now()): FlagDebt[] {
  return flags.map((f) => {
    const tags: FlagDebt['tags'] = [];
    const stale = now - Date.parse(f.updated_at) > STALE_MS;
    if (stale) tags.push('stale');
    // Toujours actif depuis > 90 j : dette de kill-switch (jamais réévalué).
    if (f.enabled && stale) tags.push('always_on');
    return { id: f.id, tags };
  });
}
