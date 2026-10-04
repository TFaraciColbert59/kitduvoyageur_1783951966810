import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { NAV, ROUTES } from '@/app/admin/_os/routeConfig';
import { ICON_NAMES } from '@/app/admin/_os/Symbol';

describe('Admin OS routeConfig', () => {
  it('chaque item NAV pointe vers une route /admin existante', () => {
    const dirs = readdirSync('src/app/admin', { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
    for (const item of NAV) {
      expect(item.href.startsWith('/admin'), item.id).toBe(true);
      const seg = item.href.replace('/admin', '').replace(/^\//, '');
      if (seg !== '') expect(dirs, item.id).toContain(seg);
      expect(ICON_NAMES, item.id).toContain(item.icon);
    }
  });

  it('chaque route a sa copy complète + 4 métriques définies', () => {
    for (const item of NAV) {
      const cfg = ROUTES[item.id];
      expect(cfg, item.id).toBeDefined();
      for (const key of ['eyebrow', 'title', 'subtitle', 'ctaLabel'] as const) {
        expect(cfg[key].length, `${item.id}.${key}`).toBeGreaterThan(0);
      }
      expect(cfg.metricDefs.length, item.id).toBe(4);
      for (const m of cfg.metricDefs) {
        expect(ICON_NAMES).toContain(m.icon);
      }
    }
  });
});
