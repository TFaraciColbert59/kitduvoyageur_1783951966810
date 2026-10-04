import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { NAV } from '@/app/admin/_os/routeConfig';
import { Symbol } from '@/app/admin/_os/Symbol';
import { MetricGrid, Hero } from '@/app/admin/_os/panels';

describe('Admin OS shell (rendu statique)', () => {
  it('NAV complète : 11 items vers /admin', () => {
    expect(NAV.length).toBe(11);
    for (const item of NAV) {
      expect(item.href.startsWith('/admin')).toBe(true);
    }
  });

  it('Symbol rend les 25 glyphes sans crash', () => {
    const names = [
      'home', 'users', 'community', 'compass', 'backpack', 'bag', 'shield',
      'support', 'chart', 'system', 'search', 'sun', 'bell', 'sidebar',
      'sparkles', 'report', 'chevron', 'close', 'check', 'warning', 'pulse',
      'clock', 'eye', 'bolt', 'lock',
    ] as const;
    for (const name of names) {
      const html = renderToStaticMarkup(Symbol({ name }));
      expect(html).toContain('<svg');
    }
  });

  it('Hero + MetricGrid composent le vocabulaire visuel OS', () => {
    const html = renderToStaticMarkup(
      Hero({ eyebrow: 'MISSION CONTROL', title: 'Bonsoir', subtitle: 'Test', actions: null }) as unknown as ReactElement
    );
    expect(html).toContain('os-hero');
    expect(html).toContain('MISSION CONTROL');
    const grid = renderToStaticMarkup(
      MetricGrid({ metrics: [{ label: 'KPI', value: '42', icon: 'pulse' }] }) as unknown as ReactElement
    );
    expect(grid).toContain('os-metrics');
    expect(grid).toContain('os-metric');
  });
});
