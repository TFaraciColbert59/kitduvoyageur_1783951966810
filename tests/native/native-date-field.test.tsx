// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const native = vi.hoisted(() => ({
  ready: vi.fn(async () => true),
  date: vi.fn(async (): Promise<string | null | undefined> => '2026-11-02'),
}));
vi.mock('@/lib/native/ui', () => ({
  hasNativeDatePicker: native.ready,
  presentNativeDate: native.date,
}));

import NativeDateField from '@/components/native/NativeDateField';

beforeEach(() => {
  native.ready.mockReset().mockResolvedValue(true);
  native.date.mockReset().mockResolvedValue('2026-11-02');
});
afterEach(cleanup);

describe('native event calendar without duplicate controls', () => {
  it('shows only the real SwiftUI launcher on a capable iOS shell', async () => {
    const onChange = vi.fn();
    render(<NativeDateField id="event-date" title="Date" value="2026-10-20" onChange={onChange} />);
    const button = await screen.findByTestId('lkdv-native-date');
    expect(screen.queryByTestId('lkdv-web-date')).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('2026-11-02'));
  });

  it('keeps the OS-backed HTML date field when the plugin is missing', async () => {
    native.ready.mockResolvedValueOnce(false);
    const onChange = vi.fn();
    render(<NativeDateField id="event-date" title="Date" value="" onChange={onChange} />);
    const field = await screen.findByTestId('lkdv-web-date');
    fireEvent.change(field, { target: { value: '2026-12-04' } });
    expect(onChange).toHaveBeenCalledWith('2026-12-04');
    expect(screen.queryByTestId('lkdv-native-date')).toBeNull();
  });

  it('restores web input on runtime native failure rather than trapping the user', async () => {
    native.date.mockResolvedValueOnce(undefined);
    render(<NativeDateField id="event-date" title="Date" value="" onChange={vi.fn()} />);
    const button = await screen.findByTestId('lkdv-native-date');
    fireEvent.click(button);
    expect(await screen.findByTestId('lkdv-web-date')).toBeTruthy();
    expect(screen.queryByTestId('lkdv-native-date')).toBeNull();
  });

  it('never changes the form state when the native picker is dismissed', async () => {
    native.date.mockResolvedValueOnce(null);
    const onChange = vi.fn();
    render(<NativeDateField id="event-date" title="Date" value="2026-10-20" onChange={onChange} />);
    fireEvent.click(await screen.findByTestId('lkdv-native-date'));
    await waitFor(() => expect(native.date).toHaveBeenCalledTimes(1));
    expect(onChange).not.toHaveBeenCalled();
  });
});
