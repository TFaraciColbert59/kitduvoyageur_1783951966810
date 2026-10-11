import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIpFromHeaders } from '@/lib/rate-limit';

/**
 * Plan 100, 2.2 : la clé « par adresse » (essai sans compte, routes /api
 * publiques) ne se lit plus sur le PREMIER saut de `x-forwarded-for`. Le premier
 * saut est celui que le navigateur écrit lui-même : hors de Vercel (qui réécrit
 * l'en-tête), changer ce préfixe à chaque appel remettait le compteur à zéro. Le
 * saut qui compte est celui qu'ajoute NOTRE proxy, à droite ; les sauts internes
 * (adresses privées) qui le suivent éventuellement sont sautés.
 */
const headers = (init: Record<string, string>) => new Headers(init);

afterEach(() => vi.unstubAllEnvs());

describe('adresse du client : le saut ajouté par notre proxy, pas celui du navigateur', () => {
  it('une seule adresse : c’est elle', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('préfixe forgé par le navigateur : il ne change pas la clé', () => {
    const real = clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7' }));
    for (const forged of ['1.1.1.1', '9.9.9.9, 8.8.8.8', 'nimporte quoi', '203.0.113.99']) {
      expect(clientIpFromHeaders(headers({ 'x-forwarded-for': `${forged}, 203.0.113.7` }))).toBe(real);
    }
  });

  it('sauts internes après le proxy : sautés (10/8, 172.16/12, 192.168/16, CGNAT, boucle locale)', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(
      clientIpFromHeaders(
        headers({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7, 172.20.0.5, 192.168.1.1, 100.64.0.9, 127.0.0.1' })
      )
    ).toBe('203.0.113.7');
  });

  it('IPv6 : l’adresse publique à droite ; les adresses locales et les restes illisibles sont sautés', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '2001:db8::7' }))).toBe('2001:db8::7');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': 'forgé, 2001:db8::7, fe80::1, fd12:3456::1, ::1' }))).toBe(
      '2001:db8::7'
    );
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '2001:db8::7, ::ffff:10.0.0.1' }))).toBe('2001:db8::7');
  });

  it('aucune adresse publique (développement local) : la plus à droite', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '10.0.0.5, 127.0.0.1' }))).toBe('127.0.0.1');
  });

  it('sans x-forwarded-for : x-real-ip, sinon « inconnue »', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
    expect(clientIpFromHeaders(headers({}))).toBe('inconnue');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': ' , ' }))).toBe('inconnue');
  });

  it('port collé à l’adresse (certains relais) : retiré, la clé reste celle de l’adresse', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7:51234' }))).toBe('203.0.113.7');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '[2001:db8::7]:51234' }))).toBe('2001:db8::7');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '[2001:DB8::7]' }))).toBe('2001:db8::7');
  });

  it('x-real-ip : lu comme une adresse, pas comme un texte libre', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': 'x'.repeat(500) }))).toBe('inconnue');
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.9:443' }))).toBe('198.51.100.9');
  });

  it('x-forwarded-for prime sur x-real-ip', () => {
    expect(
      clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.9' }))
    ).toBe('203.0.113.7');
  });
});

describe('sur Vercel : l’en-tête posé par la plateforme', () => {
  it('x-vercel-forwarded-for prime sur x-forwarded-for', () => {
    vi.stubEnv('VERCEL', '1');
    expect(
      clientIpFromHeaders(
        headers({ 'x-vercel-forwarded-for': '198.51.100.4', 'x-forwarded-for': '203.0.113.7' })
      )
    ).toBe('198.51.100.4');
  });

  it('hors de Vercel, un x-vercel-forwarded-for écrit par le navigateur est ignoré', () => {
    vi.stubEnv('VERCEL', '');
    expect(
      clientIpFromHeaders(
        headers({ 'x-vercel-forwarded-for': '198.51.100.4', 'x-forwarded-for': '203.0.113.7' })
      )
    ).toBe('203.0.113.7');
  });

  it('sur Vercel sans cet en-tête : x-forwarded-for, comme ailleurs', () => {
    vi.stubEnv('VERCEL', '1');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });
});
