// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CarnetCardV2 } from '../CarnetCardV2';
import { buildEcrinsDetail } from '@/features/carnet/detail/fixtures/ecrinsDetail';

vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ haptic: vi.fn() }) }));

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function renderAt(iso: string, patch: Record<string, unknown>) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
  const detail = { ...buildEcrinsDetail(), startDate: '2026-07-13', endDate: '2026-07-16', ...patch };
  render(
    <CarnetCardV2
      detail={detail}
      activeDay={0}
      onDayChange={vi.fn()}
      onOpenDrawerSlot={vi.fn()}
      onOpenStories={vi.fn()}
      onSelectMoment={vi.fn()}
      onPeekMoment={vi.fn()}
      highlights={[]}
      onHighlightTap={vi.fn()}
      onHighlightEdit={vi.fn()}
      pinnedIds={new Set()}
    />
  );
}

describe('pilule d’état du carnet (jours civils, lue après le montage)', () => {
  it('le jour de fin, même après midi : toujours « En route · J4 sur 4 »', async () => {
    renderAt('2026-07-16T18:30:00', { liveSharing: true });
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: /En route · J4 sur 4/ })).toBeTruthy();
  });

  it('le lendemain de la fin : « Terminé »', async () => {
    renderAt('2026-07-17T08:00:00', { liveSharing: true });
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: /Terminé/ })).toBeTruthy();
  });

  it('avant le départ : « Départ le … » ; sans partage en direct et en cours : aucune pilule', async () => {
    renderAt('2026-07-10T08:00:00', { liveSharing: true });
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: /Départ le/ })).toBeTruthy();
    cleanup();
    renderAt('2026-07-14T08:00:00', { liveSharing: false });
    await act(async () => undefined);
    expect(screen.queryByRole('button', { name: /En route|Terminé|Départ/ })).toBeNull();
  });
});
