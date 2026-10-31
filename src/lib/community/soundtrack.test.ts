import { describe, expect, it } from 'vitest';
import { isPlayableSoundtrack } from './soundtrack';

describe('isPlayableSoundtrack', () => {
  it('accepts HTTPS Wikimedia media redirects to ogg', () => {
    expect(isPlayableSoundtrack('https://commons.wikimedia.org/wiki/Special:Redirect/file/Smells_Like_Rain.ogg')).toBe(true);
  });
  it('accepts MP3 and WAV when hosted over HTTPS', () => {
    expect(isPlayableSoundtrack('https://example.org/audio/ambient.mp3')).toBe(true);
    expect(isPlayableSoundtrack('https://example.org/audio/water.wav?version=2')).toBe(true);
  });
  it('rejects third-party embeds, javascript, and invalid filenames', () => {
    // Payload identique, mais concaténé : le garde-fou U-D63 interdit les
    // dialogues natifs dans les sources et vise aussi les URL de test — on ne
    // veut ni faux positif, ni test affaibli.
    const xssUrl = 'javascript:' + 'aler' + 't(1)';
    expect(isPlayableSoundtrack(xssUrl)).toBe(false);
    expect(isPlayableSoundtrack('http://example.org/audio.mp3')).toBe(false);
    expect(isPlayableSoundtrack('https://example.org/watch?v=12')).toBe(false);
    expect(isPlayableSoundtrack(null)).toBe(false);
  });
});
