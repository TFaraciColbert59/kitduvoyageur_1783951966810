import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { compasSources } from '../server/sources';

describe('sources gratuites du déploiement', () => {
  it('dit seulement si chaque clé est là, jamais sa valeur', () => {
    const sources = compasSources({
      GEOAPIFY_API_KEY: 'cle-geo',
      LOCATIONIQ_API_KEY: '  ',
      NEXT_PUBLIC_ARCGIS_API_KEY: 'cle-arcgis',
      NVIDIA_API_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: 'https://projet.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'cle-service',
    });
    expect(sources).toEqual({
      geoapify: true,
      locationiq: false,
      arcgis: true,
      hcaptcha: false,
      captcha: false,
      nvidia: false,
      database: true,
    });
    expect(JSON.stringify(sources)).not.toMatch(/cle-/);
  });
});
