// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  present: vi.fn<() => Promise<string | null | undefined>>(),
  push: vi.fn(),
  haptic: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));
vi.mock('@/components/ui/AppIcon', () => ({
  default: () => React.createElement('span'),
}));
vi.mock('@/components/ui', () => ({
  IconButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', props, children),
}));
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }),
}));
vi.mock('@/contexts/SearchContext', () => ({
  useSearchContext: () => ({ openSearch: vi.fn() }),
}));
vi.mock('@/lib/native/ui', () => ({
  presentNativeActions: mocks.present,
}));

import MobileCommunityHeader from '@/components/communaute/MobileCommunityHeader';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Communauté — native create sheet', () => {
  it('opens native action sheet and navigates via Next router without reloading the WebView', async () => {
    mocks.present.mockResolvedValueOnce('publication');
    render(<MobileCommunityHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer un contenu' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/communaute/publier'));
    expect(mocks.present).toHaveBeenCalledWith({
      title: 'Créer un contenu',
      actions: [
        { id: 'publication', title: 'Nouvelle publication' },
        { id: 'carnet', title: 'Créer un carnet' },
      ],
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('navigates to carnet creation for the second native action', async () => {
    mocks.present.mockResolvedValueOnce('carnet');
    render(<MobileCommunityHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer un contenu' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/carnets/nouveau'));
  });

  it('keeps the existing web menu when the native shell is unavailable', async () => {
    mocks.present.mockResolvedValueOnce(undefined);
    render(<MobileCommunityHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer un contenu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    expect(screen.getByRole('menuitem', { name: 'Nouvelle publication' }).getAttribute('href')).toBe('/communaute/publier');
    expect(screen.getByRole('menuitem', { name: 'Créer un carnet' }).getAttribute('href')).toBe('/carnets/nouveau');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('does not open a duplicate web menu when the native sheet is cancelled', async () => {
    mocks.present.mockResolvedValueOnce(null);
    render(<MobileCommunityHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer un contenu' }));
    await waitFor(() => expect(mocks.present).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('prevents duplicate native sheets from rapid taps', async () => {
    let finish!: (value: string | null) => void;
    mocks.present.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<MobileCommunityHeader />);
    const button = screen.getByRole('button', { name: 'Créer un contenu' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.present).toHaveBeenCalledTimes(1);
    finish(null);
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  });
});
