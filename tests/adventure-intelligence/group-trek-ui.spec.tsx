/**
 * A13 (S3) — UI groupe/trek (rendu statique ciblé + helpers de montage).
 *
 *   • TEST-A13-GROUP-UI-01 : résumé public rendu (allure, limitant,
 *     redistribution, séparation) — aucune donnée privée dans le markup.
 *   • TEST-A13-GROUP-UI-02 : états absent/denied/error explicites, cibles 44 px.
 *   • TEST-A13-TREK-UI-01 : journées, capacité, ajustements rendus.
 *   • TEST-A13-TREK-UI-02 : états trek explicites (CTA, 402, erreur).
 *   • TEST-A13-UI-03 : helpers de montage 200/402/404/500 réellement branchés
 *     sur les composants.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { buildGroupPlan } from '@/features/adventure-intelligence/domain/groupIntelligence';
import { simulateMultiDayTrek } from '@/features/adventure-intelligence/domain/multiDayTrek';
import { summarizeGroupPlanPublic } from '@/features/adventure-intelligence/domain/planGroupTrek';
import GroupPlanSummary from '@/features/adventure-intelligence/ui/GroupPlanSummary';
import TrekPlanView from '@/features/adventure-intelligence/ui/TrekPlanView';
import {
  groupLoadFromResponse,
  trekLoadFromResponse,
} from '@/features/adventure-intelligence/ui/GroupTrekPanel';

const SUMMARY = summarizeGroupPlanPublic(
  buildGroupPlan(
    [
      {
        memberId: 'user-secret-a',
        displayName: 'Alice Secret',
        role: 'owner',
        flatSpeedKmH: 4.5,
        ascentSpeedMPerHour: 350,
        descentSpeedMPerHour: 550,
        packWeightKg: 13,
        maxCarryKg: 9,
        experienceLevel: 'advanced',
      },
      {
        memberId: 'user-secret-b',
        displayName: 'Bob Secret',
        role: 'member',
        flatSpeedKmH: 3,
        ascentSpeedMPerHour: 240,
        descentSpeedMPerHour: 380,
        packWeightKg: 7,
        maxCarryKg: 12,
        experienceLevel: 'beginner',
      },
    ],
    [{ segmentId: 1, distanceM: 15000, gainM: 1100, lossM: 900 }]
  )
);

const TREK = simulateMultiDayTrek([
  {
    dayNumber: 1,
    distanceM: 25000,
    gainM: 2000,
    lossM: 2000,
    packWeightKg: 12,
    technicalClass: 3,
  },
  { dayNumber: 2, distanceM: 25000, gainM: 2000, lossM: 2000, packWeightKg: 12, technicalClass: 3 },
  { dayNumber: 3, distanceM: 25000, gainM: 2000, lossM: 2000, packWeightKg: 12, technicalClass: 3 },
]);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('A13 (S3) — UI groupe', () => {
  it('TEST-A13-GROUP-UI-01: résumé public rendu sans donnée privée', () => {
    const markup = renderToStaticMarkup(
      <GroupPlanSummary
        plan={SUMMARY}
        state="ready"
        version={2}
        computedAt="2026-09-11T12:00:00.000Z"
        stagesSource="trip_steps"
      />
    );

    expect(markup).toContain('aria-label="Plan de groupe"');
    expect(markup).toContain('Allure du groupe');
    expect(markup).toContain('Membre limitant');
    expect(markup).toContain('Redistribution');
    expect(markup).toContain('Séparation');
    expect(markup).toContain('étapes réelles du voyage');
    expect(markup).toContain('Version 2');

    for (const secret of [
      'Alice Secret',
      'Bob Secret',
      'user-secret-a',
      'user-secret-b',
      'memberPacesKmH',
      'fromMemberId',
    ]) {
      expect(markup).not.toContain(secret);
    }
  });

  it('TEST-A13-GROUP-UI-02: états absent/denied/error explicites et accessibles', () => {
    const absent = renderToStaticMarkup(
      <GroupPlanSummary plan={null} state="absent" onCompute={() => {}} />
    );
    expect(absent).toContain('Calculer l’analyse de groupe');
    expect(absent).toContain('min-h-[44px]');

    const denied = renderToStaticMarkup(
      <GroupPlanSummary plan={null} state="denied" requiredPlan="group" />
    );
    expect(denied).toContain('Réservé au plan group');
    expect(denied).toContain('href="/tarifs"');

    const error = renderToStaticMarkup(
      <GroupPlanSummary plan={null} state="error" error="Boom" onCompute={() => {}} />
    );
    expect(error).toContain('Boom');
    expect(error).toContain('Réessayer');
  });
});

describe('A13 (S3) — UI trek', () => {
  it('TEST-A13-TREK-UI-01: journées, capacité et ajustements rendus', () => {
    const markup = renderToStaticMarkup(
      <TrekPlanView
        plan={TREK}
        state="ready"
        version={3}
        computedAt="2026-09-11T12:00:00.000Z"
        stagesSource="blueprint_uniform"
      />
    );

    expect(markup).toContain('aria-label="Plan trek multi-jours"');
    expect(markup).toContain('Capacité et fatigue');
    expect(markup).toContain('Jour 1');
    expect(markup).toContain('Jour 3');
    expect(markup).toContain('aria-label="Journées du trek"');
    expect(markup).toContain('Raccourcir l’étape');
    expect(markup).toContain('blueprint explicite');
    expect(markup).not.toContain('user-secret');
  });

  it('TEST-A13-TREK-UI-02: états trek explicites', () => {
    const absent = renderToStaticMarkup(
      <TrekPlanView plan={null} state="absent" onCompute={() => {}} />
    );
    expect(absent).toContain('Simuler le trek multi-jours');
    expect(absent).toContain('min-h-[44px]');

    const denied = renderToStaticMarkup(
      <TrekPlanView plan={null} state="denied" requiredPlan="expedition" />
    );
    expect(denied).toContain('Réservé au plan expedition');
  });
});

describe('A13 (S3) — helpers de montage du panneau', () => {
  it('TEST-A13-UI-03: mapping 200/402/404/500 → états explicites', async () => {
    const ready = await groupLoadFromResponse(
      jsonResponse(200, {
        version: 4,
        groupPlan: SUMMARY,
        stagesSource: 'trip_steps',
        computedAt: '2026-09-11T12:00:00.000Z',
      })
    );
    expect(ready.state).toBe('ready');
    expect(ready.plan?.memberCount).toBe(2);
    expect(ready.version).toBe(4);

    const denied = await groupLoadFromResponse(
      jsonResponse(402, { error: 'entitlement_required', requiredPlan: 'group' })
    );
    expect(denied.state).toBe('denied');
    expect(denied.requiredPlan).toBe('group');

    expect((await groupLoadFromResponse(jsonResponse(404, {}))).state).toBe('absent');
    expect((await groupLoadFromResponse(jsonResponse(500, {}))).state).toBe('error');

    const trek = await trekLoadFromResponse(
      jsonResponse(200, {
        version: 5,
        trekPlan: TREK,
        stagesSource: 'blueprint_uniform',
        computedAt: '2026-09-11T12:00:00.000Z',
      })
    );
    expect(trek.state).toBe('ready');
    expect(trek.plan?.daily).toHaveLength(3);
    expect((await trekLoadFromResponse(jsonResponse(402, { requiredPlan: 'expedition' }))).state).toBe(
      'denied'
    );
    expect((await trekLoadFromResponse(jsonResponse(404, {}))).state).toBe('absent');
    expect((await trekLoadFromResponse(jsonResponse(500, {}))).state).toBe('error');
  });
});
