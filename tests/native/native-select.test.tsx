// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const native = vi.hoisted(() => ({
  available: vi.fn(async () => true),
  choose: vi.fn(async (): Promise<string | null | undefined> => 'kit-42'),
}));
vi.mock('@/lib/native/ui', () => ({
  hasNativeChoices: native.available,
  presentNativeChoices: native.choose,
}));
import NativeSelect from '@/components/native/NativeSelect';

const options = [
  { id: '', title: 'Aucun' },
  { id: 'kit-42', title: 'Kit montagne' },
];

beforeEach(() => {
  native.available.mockReset().mockResolvedValue(true);
  native.choose.mockReset().mockResolvedValue('kit-42');
});
afterEach(cleanup);

describe('one searchable native select or web fallback', () => {
  it('renders one native button and commits the chosen ID', async () => {
    const changed = vi.fn();
    render(<NativeSelect id="kit" label="Choisir un kit" options={options} value="" onChange={changed} />);
    const button = await screen.findByTestId('lkdv-native-select');
    expect(screen.queryByTestId('lkdv-web-select')).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(changed).toHaveBeenCalledWith('kit-42'));
  });

  it('uses the existing HTML select without a native capability', async () => {
    native.available.mockResolvedValueOnce(false);
    const changed = vi.fn();
    render(<NativeSelect id="kit" label="Choisir un kit" options={options} value="" onChange={changed} />);
    const select = await screen.findByTestId('lkdv-web-select');
    fireEvent.change(select, { target: { value: 'kit-42' } });
    expect(changed).toHaveBeenCalledWith('kit-42');
    expect(screen.queryByTestId('lkdv-native-select')).toBeNull();
  });

  it('restores HTML on native bridge errors, but not on sheet cancellation', async () => {
    native.choose.mockResolvedValueOnce(null).mockResolvedValueOnce(undefined);
    const changed = vi.fn();
    render(<NativeSelect id="kit" label="Choisir un kit" options={options} value="" onChange={changed} />);
    const nativeButton = await screen.findByTestId('lkdv-native-select');
    fireEvent.click(nativeButton);
    await waitFor(() => expect(native.choose).toHaveBeenCalledTimes(1));
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(nativeButton);
    await screen.findByTestId('lkdv-web-select');
    expect(screen.queryByTestId('lkdv-native-select')).toBeNull();
  });

  it('does not enable a disabled select or dispatch selection changes', async () => {
    const changed = vi.fn();
    render(<NativeSelect id="kit" label="Choisir un kit" options={options} value="" onChange={changed} disabled />);
    const button = await screen.findByTestId('lkdv-native-select');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(native.choose).not.toHaveBeenCalled();
  });
});
