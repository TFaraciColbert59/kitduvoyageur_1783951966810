/**
 * Phase 5 TRIBU — panneau Journal du groupe.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GroupActivityLog from '@/features/tribu/components/GroupActivityLog';

describe('GroupActivityLog', () => {
  it('chronologie inversée avec résumés et horodatage relatif', () => {
    const html = renderToStaticMarkup(
      React.createElement(GroupActivityLog, {
        entries: [
          {
            id: 'l1',
            summary: 'LOG Alice a créé la tâche « Réserver les refuges »',
            actionType: 'created',
            entityType: 'group_tasks',
            createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
            actorName: 'LOG Alice',
          },
        ],
      })
    );
    expect(html).toContain('Journal du groupe');
    expect(html).toContain('Réserver les refuges');
    expect(html).toContain('il y a 5 min');
  });

  it('état vide explicite', () => {
    const html = renderToStaticMarkup(
      React.createElement(GroupActivityLog, { entries: [] })
    );
    expect(html).toContain('Aucune activité pour le moment');
  });
});
