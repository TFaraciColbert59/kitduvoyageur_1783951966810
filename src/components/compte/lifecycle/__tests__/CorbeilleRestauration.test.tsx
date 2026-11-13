// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CorbeilleRestauration } from '../CorbeilleRestauration';
import { makeRecord } from './fixtures';

afterEach(cleanup);

const NOW = Date.parse('2026-09-12T12:00:00.000Z');

function deletedRecord(title: string, daysAgo: number, purgeInDays: number) {
  return makeRecord({
    title,
    lifecycleStatus: 'deleted',
    deletedAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
    purgeAfter: new Date(NOW + purgeInDays * 86_400_000).toISOString(),
  });
}

describe('A02 — corbeille et restauration 30 jours', () => {
  it('affiche un état vide honnête', () => {
    render(<CorbeilleRestauration items={[]} nowMs={NOW} onRestore={vi.fn()} />);
    expect(screen.getByText('Corbeille vide')).toBeTruthy();
  });

  it('affiche le délai restant et restaure une séance éligible', async () => {
    const onRestore = vi.fn(async () => ({ ok: true as const }));
    render(
      <CorbeilleRestauration
        items={[deletedRecord('Séance récente', 2, 28)]}
        nowMs={NOW}
        onRestore={onRestore}
      />
    );

    expect(screen.getByText(/Reste 28 jours/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurer Séance récente' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(expect.any(String)));
  });

  it('désactive la restauration quand la rétention est dépassée', () => {
    render(
      <CorbeilleRestauration
        items={[deletedRecord('Séance ancienne', 40, -10)]}
        nowMs={NOW}
        onRestore={vi.fn()}
      />
    );
    expect(screen.getByText('Délai de 30 jours dépassé')).toBeTruthy();
    const button = screen.getByRole('button', {
      name: 'Restaurer Séance ancienne',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('signale explicitement que la purge n’est pas déclenchée par l’écran', () => {
    render(
      <CorbeilleRestauration
        items={[deletedRecord('Séance récente', 2, 28)]}
        nowMs={NOW}
        onRestore={vi.fn()}
      />
    );
    expect(screen.getByText(/purge définitive est traitée par le job de base/)).toBeTruthy();
  });

  it('affiche l’erreur de restauration sans masquer la séance', async () => {
    const onRestore = vi.fn(async () => ({ ok: false as const, error: 'Serveur indisponible.' }));
    render(
      <CorbeilleRestauration
        items={[deletedRecord('Séance récente', 2, 28)]}
        nowMs={NOW}
        onRestore={onRestore}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restaurer Séance récente' }));
    expect(await screen.findByText('Serveur indisponible.')).toBeTruthy();
    expect(screen.getByText('Séance récente')).toBeTruthy();
  });
});
