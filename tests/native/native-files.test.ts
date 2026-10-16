// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  platform: 'ios',
  native: true,
  getCapabilities: vi.fn(async () => ({ available: true, files: true })),
  importGPX: vi.fn(async () => ({ active: true, text: '<gpx version="1.1"></gpx>' as string | undefined })),
  exportGPX: vi.fn(async () => ({ active: true, saved: true })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => api.platform,
    isNativePlatform: () => api.native,
  },
  registerPlugin: () => ({
    getCapabilities: api.getCapabilities,
    importGPX: api.importGPX,
    exportGPX: api.exportGPX,
  }),
}));

import { hasNativeGPXFiles, importNativeGPX, exportNativeGPX } from '@/lib/native/ui';

beforeEach(() => {
  api.platform = 'ios';
  api.native = true;
  api.getCapabilities.mockReset().mockResolvedValue({ available: true, files: true });
  api.importGPX.mockReset().mockResolvedValue({ active: true, text: '<gpx version="1.1"></gpx>' });
  api.exportGPX.mockReset().mockResolvedValue({ active: true, saved: true });
  vi.stubGlobal('window', { location: { pathname: '/explorer' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('native GPX files bridge', () => {
  it('advertises native Files only with a real iOS shell capability', async () => {
    expect(await hasNativeGPXFiles()).toBe(true);
    api.getCapabilities.mockResolvedValueOnce({ available: true, files: false });
    expect(await hasNativeGPXFiles()).toBe(false);
    api.platform = 'android';
    expect(await hasNativeGPXFiles()).toBe(false);
  });

  it('returns imported GPX to the existing parser, or null on cancellation', async () => {
    expect(await importNativeGPX()).toBe('<gpx version="1.1"></gpx>');
    api.importGPX.mockResolvedValueOnce({ active: true, text: undefined });
    expect(await importNativeGPX()).toBeNull();
  });

  it('rejects an invalid or oversized document and preserves the web fallback', async () => {
    api.importGPX.mockResolvedValueOnce({ active: true, text: '<html>oops</html>' });
    expect(await importNativeGPX()).toBeUndefined();
    api.importGPX.mockResolvedValueOnce({ active: true, text: '<gpx>' + 'x'.repeat(2_000_001) + '</gpx>' });
    expect(await importNativeGPX()).toBeUndefined();
    api.importGPX.mockRejectedValueOnce(new Error('unimplemented'));
    expect(await importNativeGPX()).toBeUndefined();
    vi.stubGlobal('window', { location: { pathname: '/compas' } });
    expect(await importNativeGPX()).toBeUndefined();
    expect(api.importGPX).toHaveBeenCalledTimes(3);
  });

  it('exports a valid GPX through the native Save to Files picker', async () => {
    const xml = '<?xml version="1.0"?><gpx version="1.1"></gpx>';
    expect(await exportNativeGPX(xml, 'trace-lkdv.gpx')).toBe(true);
    expect(api.exportGPX).toHaveBeenCalledWith({ xml, fileName: 'trace-lkdv.gpx' });
    api.exportGPX.mockResolvedValueOnce({ active: true, saved: false });
    expect(await exportNativeGPX(xml, 'trace-lkdv.gpx')).toBe(false);
  });

  it('does not send arbitrary files or malformed XML across the native bridge', async () => {
    expect(await exportNativeGPX('<html></html>', 'test.gpx')).toBeUndefined();
    expect(await exportNativeGPX('<gpx></gpx>', '../evil.gpx')).toBeUndefined();
    expect(await exportNativeGPX('<gpx></gpx>', 'trail.txt')).toBeUndefined();
    expect(api.exportGPX).not.toHaveBeenCalled();
  });
});
