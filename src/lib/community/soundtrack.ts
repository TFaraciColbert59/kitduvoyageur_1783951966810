/**
 * Only source URLs ending in playable audio extensions can reach the media element.
 * Ogg is supported on most browsers; render a link to original on unsupported devices.
 */
export function isPlayableSoundtrack(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /\.(ogg|oga|mp3|m4a|aac|wav|flac)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
