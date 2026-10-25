// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormErrorSummary } from '@/features/community/create/shared/FormErrorSummary';
import { TagChips } from '@/features/community/create/shared/TagChips';
import { NumberStepper } from '@/features/community/create/shared/NumberStepper';
import { DateRangeField } from '@/features/community/create/shared/DateRangeField';

afterEach(cleanup);

describe('FormErrorSummary', () => {
  it('liste les erreurs et place le focus sur le champ cliqué', () => {
    render(
      <>
        <input id="title" name="title" aria-label="Titre" />
        <FormErrorSummary
          errors={{
            title: { type: 'required', message: 'Le titre est requis.' },
            media: [{ alt: { type: 'required', message: 'Le texte alternatif est requis.' } }],
          }}
        />
      </>
    );

    expect(screen.getByText('Le titre est requis.')).toBeTruthy();
    expect(screen.getByText('Le texte alternatif est requis.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Le titre est requis/ }));
    expect(document.activeElement).toBe(screen.getByLabelText('Titre'));
  });
});

function TagsHarness() {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <TagChips
      value={tags}
      onChange={setTags}
      label="Tags"
      suggestions={['bivouac', 'rando']}
      max={2}
    />
  );
}

describe('TagChips', () => {
  it('ajoute au clavier, déduplique et retire un tag', () => {
    render(<TagsHarness />);
    const input = screen.getByLabelText('Tags');

    fireEvent.change(input, { target: { value: 'bivouac' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('bivouac')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Bivouac' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getAllByText('bivouac')).toHaveLength(1);

    fireEvent.change(input, { target: { value: 'rando,' } });
    expect(screen.getByText('rando')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer rando' }));
    expect(screen.queryByText('rando')).toBeNull();
  });

  it('ajoute une suggestion et respecte le maximum', () => {
    render(<TagsHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter bivouac' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter rando' }));
    expect(screen.queryByRole('button', { name: 'Ajouter bivouac' })).toBeNull();
    expect(screen.getByText('2 tags maximum.')).toBeTruthy();
  });
});

function StepperHarness({ initial = 8 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      label="Participants"
      value={value}
      onChange={setValue}
      min={2}
      max={10}
      unit="pers."
    />
  );
}

describe('NumberStepper', () => {
  it('incrémente, décrémente et borne la valeur', () => {
    render(<StepperHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter Participants' }));
    expect((screen.getByRole('spinbutton', { name: 'Participants' }) as HTMLInputElement).value).toBe('9');

    fireEvent.click(screen.getByRole('button', { name: 'Diminuer Participants' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diminuer Participants' }));
    expect((screen.getByRole('spinbutton', { name: 'Participants' }) as HTMLInputElement).value).toBe('7');
    expect(screen.getByText('pers.')).toBeTruthy();
  });

  it('désactive le bouton au maximum', () => {
    render(<StepperHarness initial={10} />);
    const increase = screen.getByRole('button', { name: 'Augmenter Participants' }) as HTMLButtonElement;
    expect(increase.disabled).toBe(true);
  });

  it('accepte une saisie directe', () => {
    render(<StepperHarness />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Participants' }), { target: { value: '6' } });
    expect((screen.getByRole('spinbutton', { name: 'Participants' }) as HTMLInputElement).value).toBe('6');
  });
});

function DatesHarness() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  return (
    <DateRangeField
      start={start}
      end={end}
      onStartChange={setStart}
      onEndChange={setEnd}
      label="Dates du carnet"
      startLabel="Date de début"
      endLabel="Date de fin"
    />
  );
}

describe('DateRangeField', () => {
  it('signale une fin antérieure au début sans bloquer la saisie', () => {
    render(<DatesHarness />);
    const start = screen.getByLabelText('Date de début');
    const end = screen.getByLabelText('Date de fin');

    fireEvent.change(start, { target: { value: '2026-11-10' } });
    fireEvent.change(end, { target: { value: '2026-11-05' } });

    expect(screen.getByRole('alert').textContent).toContain(
      'La date de fin ne peut pas précéder la date de début.'
    );
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect((end as HTMLInputElement).value).toBe('2026-11-05');

    fireEvent.change(end, { target: { value: '2026-11-12' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(end.getAttribute('aria-invalid')).toBeNull();
  });
});
