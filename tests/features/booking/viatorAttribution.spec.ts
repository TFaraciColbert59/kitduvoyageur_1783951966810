import { describe, expect, it } from 'vitest';

import { buildViatorAttributionUrl } from '@/features/booking/server/viatorAttribution';
import { BOOKING_PROVIDER_ERROR_CODES } from '@/features/booking/server/bookingProviderErrors';

/**
 * W4 / D-08 — attribution Viator.
 *
 * Le helper est un garde-fou, pas un formateur. Il REFUSE une URL malveillante
 * au lieu de la nettoyer : une campagne contenant `&` ou un espace permet
 * d'injecter des paramètres arbitraires dans l'URL de suivi et de s'attribuer
 * (ou de voler) la commission d'un autre trafic. Mieux vaut une erreur visible
 * qu'une URL silencieusement malformée.
 */
const VALID_PID = '123456789';
const VALID_MCID = 'abc123';
const VALID_CAMPAIGN = 'lkdv-prepare';

describe('buildViatorAttributionUrl — refus', () => {
  const base = 'https://www.viator.com/';

  it('refuse une campagne contenant &', () => {
    expect(() =>
      buildViatorAttributionUrl(base, {
        pid: VALID_PID,
        mcid: VALID_MCID,
        campaign: 'evil&medium=cpc',
      })
    ).toThrowError();
  });

  it('refuse une campagne contenant ?', () => {
    expect(() =>
      buildViatorAttributionUrl(base, { pid: VALID_PID, mcid: VALID_MCID, campaign: 'a?b=c' })
    ).toThrowError();
  });

  it('refuse une campagne contenant un espace', () => {
    expect(() =>
      buildViatorAttributionUrl(base, { pid: VALID_PID, mcid: VALID_MCID, campaign: 'a b' })
    ).toThrowError();
  });

  it('refuse un pid qui n est pas exactement 9 chiffres', () => {
    for (const pid of ['12345678', '1234567890', 'abcdefghi', '12345678a', '', '12 3456789', '+123456789']) {
      expect(() =>
        buildViatorAttributionUrl(base, { pid, mcid: VALID_MCID, campaign: VALID_CAMPAIGN })
      ).toThrowError();
    }
  });

  it('tolere un pid entoure d espaces, la validation se fait apres trim', () => {
    // Normalisation d'un .envila, pas un assouplissement : apres trim il ne
    // peut rester que des chiffres, donc aucune charge utile ne passe.
    const url = buildViatorAttributionUrl(base, {
      pid: '  123456789  ',
      mcid: VALID_MCID,
      campaign: VALID_CAMPAIGN,
    });
    expect(url).toContain('pid=123456789');
  });

  it('refuse un hôte hors allowlist', () => {
    expect(() =>
      buildViatorAttributionUrl('https://evil.example.com/', {
        pid: VALID_PID,
        mcid: VALID_MCID,
        campaign: VALID_CAMPAIGN,
      })
    ).toThrowError();
  });

  it('refuse une base non HTTPS', () => {
    expect(() =>
      buildViatorAttributionUrl('http://www.viator.com/', {
        pid: VALID_PID,
        mcid: VALID_MCID,
        campaign: VALID_CAMPAIGN,
      })
    ).toThrowError();
  });

  it('refuse une base avec identifiants embarqués', () => {
    expect(() =>
      buildViatorAttributionUrl('https://user:pwd@www.viator.com/', {
        pid: VALID_PID,
        mcid: VALID_MCID,
        campaign: VALID_CAMPAIGN,
      })
    ).toThrowError();
  });

  it('l erreur est typée validation, pas une exception générique', () => {
    try {
      buildViatorAttributionUrl(base, { pid: '1', mcid: VALID_MCID, campaign: VALID_CAMPAIGN });
      expect.unreachable('aurait dû lever');
    } catch (error) {
      expect(error).toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.validation });
    }
  });
});

describe('buildViatorAttributionUrl — URL valide', () => {
  it('force medium=api et conserve l ordre des paramètres', () => {
    const url = buildViatorAttributionUrl('https://www.viator.com/', {
      pid: VALID_PID,
      mcid: VALID_MCID,
      campaign: VALID_CAMPAIGN,
    });

    expect(url).toContain('medium=api');
    // L'ordre est stable : pid, mcid, campaign, medium.
    expect(url).toBe(
      'https://www.viator.com/?pid=123456789&mcid=abc123&campaign=lkdv-prepare&medium=api'
    );
  });

  it('accepte un sous-domaine viator autorisé', () => {
    const url = buildViatorAttributionUrl('https://viator.com/experiences', {
      pid: VALID_PID,
      mcid: VALID_MCID,
      campaign: VALID_CAMPAIGN,
    });
    expect(url.startsWith('https://viator.com/experiences?')).toBe(true);
  });

  it('écrase un medium préexistant au lieu de le laisser passer', () => {
    const url = buildViatorAttributionUrl('https://www.viator.com/?medium=cpc', {
      pid: VALID_PID,
      mcid: VALID_MCID,
      campaign: VALID_CAMPAIGN,
    });
    expect(url).toContain('medium=api');
    expect(url).not.toContain('medium=cpc');
  });

  it('mcid et campaign absents → simple renvoi de la base, medium toujours posé', () => {
    const url = buildViatorAttributionUrl('https://www.viator.com/', { pid: VALID_PID });
    expect(url).toBe('https://www.viator.com/?pid=123456789&medium=api');
  });

  it('le refus ne divulgue pas la valeur rejetée', () => {
    try {
      buildViatorAttributionUrl('https://www.viator.com/', {
        pid: VALID_PID,
        mcid: VALID_MCID,
        campaign: 'secret&injected=1',
      });
      expect.unreachable('aurait dû lever');
    } catch (error) {
      expect((error as Error).message).not.toContain('injected=1');
    }
  });
});
