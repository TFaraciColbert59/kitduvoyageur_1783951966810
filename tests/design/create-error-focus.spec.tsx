// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateFormEngine } from '@/features/community/create/engine/CreateFormEngine';
import {
  createDefaults,
  CREATE_FIELD_LABELS,
  type ClubFormValues,
} from '@/features/community/create/engine/createSchemas';
import { CREATE_STEPS, StepPager } from '@/features/community/create/shared/StepPager';
import { FormErrorSummary } from '@/features/community/create/shared/FormErrorSummary';

afterEach(cleanup);

// Découpage propre au harnais : chaque champ est dans la pane qui le rend.
const STEP_FIELDS = [
  ['name', 'location'],
  ['category', 'description', 'cover'],
  ['privacy', 'membershipRules', 'joinQuestions'],
  ['welcomePost'],
] as const;

function FocusHarness() {
  const [step, setStep] = useState(0);
  return (
    <CreateFormEngine<ClubFormValues>
      kind="club"
      defaultValues={createDefaults('club')}
      onSubmit={async () => {}}
      step={step}
      onStepChange={setStep}
      stepFields={STEP_FIELDS}
    >
      {(form, api) => (
        <>
          <FormErrorSummary
            errors={form.formState.errors}
            labels={CREATE_FIELD_LABELS}
            onFocusField={api.focusField}
          />
          <button type="button" onClick={api.submit}>
            Publier le club
          </button>
          <StepPager steps={CREATE_STEPS.club} index={step} onIndexChange={setStep}>
            <div>
              <span>Étape identité</span>
              <label htmlFor="club-name">Nom</label>
              <input id="club-name" {...form.register('name')} />
            </div>
            <div>
              <span>Étape présentation</span>
              <label htmlFor="club-category">Catégorie</label>
              <input id="club-category" {...form.register('category')} />
            </div>
            <div>
              <span>Étape adhésion</span>
              <label htmlFor="club-privacy">Adhésion</label>
              <select id="club-privacy" {...form.register('privacy')}>
                <option value="open">Ouvert</option>
                <option value="closed">Sur demande</option>
              </select>
            </div>
            <div>
              <span>Étape publication</span>
              <label htmlFor="club-welcome">Post d’accueil</label>
              <input id="club-welcome" type="checkbox" {...form.register('welcomePost')} />
            </div>
          </StepPager>
        </>
      )}
    </CreateFormEngine>
  );
}

function activeTabLabel(): string | null {
  const tab = screen
    .getAllByRole('tab')
    .find((element) => element.getAttribute('aria-selected') === 'true');
  return tab?.getAttribute('aria-label') ?? null;
}

describe('focus des erreurs — étape avant champ', () => {
  it('focalise le premier champ fautif de l’étape courante', async () => {
    render(<FocusHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Publier le club' }));

    await waitFor(() =>
      expect((document.activeElement as HTMLElement | null)?.id).toBe('club-name'),
    );
    expect(activeTabLabel()).toBe('Identité');
  });

  it('bascule sur l’étape fautive avant de focaliser, malgré les panes inert', async () => {
    render(<FocusHarness />);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'La Cordée' } });

    fireEvent.click(screen.getByRole('button', { name: 'Publier le club' }));

    await waitFor(() => expect(activeTabLabel()).toBe('Univers'));
    await waitFor(() =>
      expect((document.activeElement as HTMLElement | null)?.id).toBe('club-category'),
    );

    const presentation = screen.getByText('Étape présentation').closest('section');
    const identity = screen.getByText('Étape identité').closest('section');
    expect(presentation?.hasAttribute('inert')).toBe(false);
    expect(identity?.hasAttribute('inert')).toBe(true);
  });

  it('route un clic du résumé d’erreurs vers la bonne étape', async () => {
    render(<FocusHarness />);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'La Cordée' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publier le club' }));
    await waitFor(() => expect(activeTabLabel()).toBe('Univers'));

    fireEvent.click(screen.getByRole('tab', { name: 'Identité' }));
    await waitFor(() => expect(activeTabLabel()).toBe('Identité'));

    fireEvent.click(screen.getByRole('button', { name: /Catégorie : La catégorie est requise/ }));

    await waitFor(() => expect(activeTabLabel()).toBe('Univers'));
    await waitFor(() =>
      expect((document.activeElement as HTMLElement | null)?.id).toBe('club-category'),
    );

    const presentation = screen.getByText('Étape présentation').closest('section');
    expect(presentation?.hasAttribute('inert')).toBe(false);
  });

  it('appelle api.submit une seule fois par clic', async () => {
    const onSubmit = vi.fn();
    function SingleSubmitHarness() {
      const [step] = useState(0);
      return (
        <CreateFormEngine<ClubFormValues>
          kind="club"
          defaultValues={{ ...createDefaults('club'), name: 'La Cordée', category: 'Rando' }}
          onSubmit={onSubmit}
          step={step}
          stepFields={STEP_FIELDS}
        >
          {(_form, api) => (
            <button type="button" onClick={api.submit}>
              Publier
            </button>
          )}
        </CreateFormEngine>
      );
    }

    render(<SingleSubmitHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
