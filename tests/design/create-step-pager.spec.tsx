// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREATE_STEPS, StepPager } from '@/features/community/create/shared/StepPager';

afterEach(cleanup);

function Harness({ initial = 0 }: { initial?: number }) {
  const [index, setIndex] = useState(initial);
  return (
    <StepPager steps={CREATE_STEPS.post} index={index} onIndexChange={setIndex}>
      <div>Panneau format</div>
      <div>Panneau contenu</div>
      <div>Panneau audience</div>
    </StepPager>
  );
}

describe('CREATE_STEPS — les six types', () => {
  it('expose au moins deux étapes par type avec les libellés attendus', () => {
    expect(CREATE_STEPS.post.map((step) => step.label)).toEqual(['Format', 'Contenu', 'Audience']);
    expect(CREATE_STEPS.story.map((step) => step.label)).toEqual(['Média', 'Légende']);
    expect(CREATE_STEPS.carnet.map((step) => step.label)).toEqual(['Infos', 'Dates', 'Visibilité']);
    expect(CREATE_STEPS.sortie.map((step) => step.label)).toEqual(['Infos', 'Détails', 'Participants']);
    expect(CREATE_STEPS.kit.map((step) => step.label)).toEqual(['Identité', 'Poids']);
    expect(CREATE_STEPS.club.map((step) => step.label)).toEqual(['Identité', 'Présentation', 'Adhésion']);
    for (const steps of Object.values(CREATE_STEPS)) {
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
    }
  });
});

describe('StepPager — pager commun', () => {
  it('affiche les étapes en capsule et change de pane au clic', () => {
    render(<Harness />);

    const format = screen.getByRole('tab', { name: 'Format' });
    const content = screen.getByRole('tab', { name: 'Contenu' });
    const audience = screen.getByRole('tab', { name: 'Audience' });
    expect(format.getAttribute('aria-selected')).toBe('true');
    expect(content.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(audience);

    expect(audience.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Panneau audience').closest('section')?.hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Panneau format').closest('section')?.hasAttribute('inert')).toBe(true);
  });

  it('change d’étape au clavier et laisse le swipe à LensPager', () => {
    const onIndexChange = vi.fn();
    render(
      <StepPager steps={CREATE_STEPS.post} index={1} onIndexChange={onIndexChange}>
        <div>Un</div>
        <div>Deux</div>
        <div>Trois</div>
      </StepPager>
    );

    const pager = screen.getByRole('group', { name: 'Étapes de création' });
    fireEvent.keyDown(pager, { key: 'ArrowRight' });

    expect(onIndexChange).toHaveBeenCalledWith(2);
  });
});
