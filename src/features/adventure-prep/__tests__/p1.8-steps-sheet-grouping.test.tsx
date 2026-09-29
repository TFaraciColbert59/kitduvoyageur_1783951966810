/**
 * P1.8 - Rend StepsSheet avec un itinéraire mocké, vérifie le regroupement par jour
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { StepsSheet } from '../components/PrepItinerarySheets';
import { programmeLocalise, storeFactice } from './programmeFactice';

afterEach(() => cleanup());

describe('P1.8 - StepsSheet regroupement par jour', () => {
  it('01 - rend StepsSheet et verifie que les etapes sont groupees par jour', () => {
    const { container } = render(
      <StepsSheet
        draft={{ itinerary: programmeLocalise() } as any}
        actions={storeFactice()}
        onClose={() => {}}
      />
    );
    
    const model = programmeLocalise();
    
    const titresJours = container.querySelectorAll('.prep-section-title');
    expect(titresJours.length).toBe(model.days);
    expect(titresJours[0].textContent).toContain('Jour 1');
  });

  it('02 - sabotage protocol: on boucle sur les jours, pas sur les etapes en bloc', () => {
    const source = readFileSync(join(__dirname, '../components/PrepItinerarySheets.tsx'), 'utf8');
    expect(source).toContain('model.days');
    expect(source).toContain('daySteps(model,');
  });
});
