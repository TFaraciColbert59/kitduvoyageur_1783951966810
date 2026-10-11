import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIpFromHeaders, rateLimit, resetMemoryRateLimits } from '@/lib/rate-limit';

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

  it('IPv6 : l’adresse publique à droite (clé : son /64) ; les adresses locales et les restes illisibles sont sautés', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '2001:db8::7' }))).toBe('2001:db8:0:0::/64');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': 'forgé, 2001:db8::7, fe80::1, fd12:3456::1, ::1' }))).toBe(
      '2001:db8:0:0::/64'
    );
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '2001:db8::7, ::ffff:10.0.0.1' }))).toBe('2001:db8:0:0::/64');
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
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '[2001:db8::7]:51234' }))).toBe('2001:db8:0:0::/64');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '[2001:DB8::7]' }))).toBe('2001:db8:0:0::/64');
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

/**
 * Relecture du 11 octobre : une adresse IPv6 servait de clé entière (/128). Un client ou un
 * réseau reçoit au moins un /64 (une box en donne un /56 ou /48) : il change d'adresse à
 * chaque requête sans quitter son /64, donc de clé, et contourne toutes les limites « par
 * adresse » (essai sans compte, demo-login, /api/checkout, /api/discovery/search,
 * /api/pays/[code]). La clé d'une adresse IPv6 publique est son préfixe /64.
 */
describe('IPv6 : la clé est le préfixe /64, jamais l’adresse entière', () => {
  const ip = (xff: string) => clientIpFromHeaders(headers({ 'x-forwarded-for': xff }));
  const KEY = '2001:db8:1:2::/64';

  it('toutes les adresses d’un même /64 ont la même clé ; un autre /64 en a une autre', () => {
    expect(ip('2001:db8:1:2::1')).toBe(KEY);
    expect(ip('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(KEY);
    expect(ip('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe(KEY);
    expect(ip('2001:db8:1:3::1')).not.toBe(KEY);
    expect(ip('2001:db8:2:2::1')).not.toBe(KEY);
  });

  it('la forme « :: » est développée avant de garder les quatre premiers groupes', () => {
    expect(ip('2001:db8::7')).toBe('2001:db8:0:0::/64');
    expect(ip('2001:db8:0:0:0:0:0:7')).toBe('2001:db8:0:0::/64');
    expect(ip('2001:db8::')).toBe('2001:db8:0:0::/64');
    // « :: » dans le préfixe : les groupes omis sont des zéros du préfixe.
    expect(ip('2001::1:2:3:4')).toBe('2001:0:0:0::/64');
    expect(ip('2001:db8:1::5:6:7')).toBe('2001:db8:1:0::/64');
    expect(ip('2001:db8:1:2:3::')).toBe(KEY);
    expect(ip('1:2:3:4:5:6:7::')).toBe('1:2:3:4::/64');
  });

  it('la casse et les zéros de tête ne changent pas la clé', () => {
    expect(ip('2001:DB8:1:2::AbCd')).toBe(KEY);
    expect(ip('2001:0db8:0001:0002:0000:0000:0000:0001')).toBe(KEY);
    expect(ip('2001:0DB8:1:2::1')).toBe(KEY);
  });

  it('identifiant de zone, crochets et port : retirés', () => {
    expect(ip('2001:db8:1:2::9%eth0')).toBe(KEY);
    expect(ip('[2001:db8:1:2::9%eth0]:51234')).toBe(KEY);
    expect(ip('[2001:db8:1:2::9]:443')).toBe(KEY);
    expect(ip('[2001:DB8:1:2::9]')).toBe(KEY);
  });

  it('IPv4-mappée : l’adresse IPv4, quelle que soit la graphie', () => {
    expect(ip('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(ip('::FFFF:203.0.113.7')).toBe('203.0.113.7');
    expect(ip('::ffff:cb00:7107')).toBe('203.0.113.7');
    expect(ip('0:0:0:0:0:ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(ip('[::ffff:203.0.113.7]:443')).toBe('203.0.113.7');
    // Même clé que la même personne en IPv4 pur : pas de double compteur.
    expect(ip('::ffff:203.0.113.7')).toBe(ip('203.0.113.7'));
    // Mappée d’une adresse privée : un relais interne, sauté comme en IPv4.
    expect(ip('203.0.113.8, ::ffff:10.0.0.1')).toBe('203.0.113.8');
    expect(ip('2001:db8:1:2::1, ::ffff:192.168.0.4, ::ffff:a00:1')).toBe(KEY);
  });

  it('les adresses locales, de réseau privé ou de boucle restent entières, et sont sautées comme avant', () => {
    expect(ip('fe80::1')).toBe('fe80::1');
    expect(ip('::1')).toBe('::1');
    expect(ip('fd12:3456::1')).toBe('fd12:3456::1');
    expect(ip('2001:db8:1:2::1, fe80::1, fd12:3456::1, ::1, 0:0:0:0:0:0:0:1')).toBe(KEY);
    expect(ip('2001:db8:1:2::1, fe80::1%eth0')).toBe(KEY);
  });

  it('une adresse illisible n’est jamais une clé : le saut est écarté', () => {
    expect(ip('2001:db8:1:2::1, 2001:db8::1::2')).toBe(KEY);
    expect(ip('2001:db8:1:2::1, 1:2:3:4:5:6:7:8:9')).toBe(KEY);
    expect(ip('2001:db8:1:2::1, g::1')).toBe(KEY);
    expect(ip('2001:db8:1:2::1, 12345::1')).toBe(KEY);
    expect(ip('2001:db8:1:2::1, ::ffff:300.1.1.1')).toBe(KEY);
  });

  it('sur Vercel aussi (x-vercel-forwarded-for) et par x-real-ip', () => {
    vi.stubEnv('VERCEL', '1');
    expect(clientIpFromHeaders(headers({ 'x-vercel-forwarded-for': '2001:db8:1:2::77' }))).toBe(KEY);
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '2001:db8:1:2::78' }))).toBe(KEY);
  });

  describe('la limite par adresse tient pour tout un /64', () => {
    beforeEach(() => resetMemoryRateLimits());

    const attempt = (address: string) =>
      rateLimit({ key: `trial-login:${ip(address)}`, limit: 5, windowMs: 60 * 60_000, failMode: 'closed' });

    it('changer d’adresse à chaque requête dans son /64 ne remet pas le compteur à zéro', async () => {
      const outcomes: string[] = [];
      for (let i = 1; i <= 8; i += 1) outcomes.push((await attempt(`2001:db8:1:2:${i}:${i * 7}:${i * 13}:${i * 17}`)).outcome);
      expect(outcomes).toEqual(['allowed', 'allowed', 'allowed', 'allowed', 'allowed', 'limited', 'limited', 'limited']);
    });

    it('un autre /64 a son propre compteur', async () => {
      for (let i = 1; i <= 6; i += 1) await attempt(`2001:db8:1:2::${i}`);
      expect((await attempt('2001:db8:1:2::99')).outcome).toBe('limited');
      expect((await attempt('2001:db8:1:3::1')).outcome).toBe('allowed');
    });
  });
});
