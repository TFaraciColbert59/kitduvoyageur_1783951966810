import { describe, expect, it } from 'vitest';
import { parseWeather } from '../dayView';

describe('parseWeather', () => {
  it('lit le glyphe d’après les mots et la température seule', () => {
    expect(parseWeather('éclaircies · 11 °C')).toMatchObject({ kind: 'partly', temp: '11°' });
    expect(parseWeather('grand soleil · 16 °C')).toMatchObject({ kind: 'sun', temp: '16°' });
    expect(parseWeather('nuageux · 12 °C')).toMatchObject({ kind: 'cloud', temp: '12°' });
    expect(parseWeather('pluie fine, -2 °C')).toMatchObject({ kind: 'rain', temp: '-2°' });
    expect(parseWeather('neige')).toMatchObject({ kind: 'snow', temp: null });
  });

  it('ne devine rien : mot inconnu = pas de glyphe, texte conservé ; vide = rien', () => {
    expect(parseWeather('vent de nord')).toEqual({ kind: null, temp: null, label: 'vent de nord' });
    expect(parseWeather('   ')).toBeNull();
    expect(parseWeather(null)).toBeNull();
  });
});
