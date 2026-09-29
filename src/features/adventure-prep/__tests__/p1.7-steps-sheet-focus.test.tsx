/**
 * P1.7 - Rend StepsSheet, vérifie que le dispatch prep:focus-step est écouté
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { StepsSheet } from '../components/PrepItinerarySheets';
import { programmeLocalise, storeFactice } from './programmeFactice';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('P1.7 - StepsSheet dispatch prep:focus-step', () => {
  it('01 - rend StepsSheet et ecoute le dispatch', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    const onClose = vi.fn();
    render(
      <StepsSheet
        draft={{ itinerary: programmeLocalise() } as any}
        actions={storeFactice()}
        onClose={onClose}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    const stepButton = buttons.find(b => b.className.includes('prep-act'));
    expect(stepButton).not.toBeUndefined();
    if (stepButton) {
      fireEvent.click(stepButton);
    }
    
    expect(onClose).toHaveBeenCalled();
    const evt = spy.mock.calls.find(call => (call[0] as CustomEvent).type === 'prep:focus-step');
    expect(evt).not.toBeUndefined();
  });

  it('02 - sabotage protocol: le code source lit explicitement dispatchEvent', () => {
    const source = readFileSync(join(__dirname, '../components/PrepItinerarySheets.tsx'), 'utf8');
    expect(source).toContain("CustomEvent('prep:focus-step'");
  });
});
