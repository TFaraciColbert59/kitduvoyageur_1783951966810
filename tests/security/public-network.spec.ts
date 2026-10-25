import { describe, it, expect } from 'vitest';
import {
  isPrivateAddress,
  parsePublicHttpUrl,
  assertHostResolvesPublic,
} from '@/lib/security/publicNetwork';

describe('A-215 — garde SSRF des aperçus de liens', () => {
  it('refuse les adresses littérales privées (IPv4 de toutes classes)', () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://10.1.2.3/',
      'http://172.16.0.1/',
      'http://172.31.255.254/',
      'http://192.168.1.1/',
      'http://169.254.169.254/',
      'http://100.64.0.1/',
      'http://198.18.0.1/',
      'http://224.0.0.1/',
      'http://0.0.0.0/',
    ]) {
      const result = parsePublicHttpUrl(url);
      expect(result.ok, url).toBe(false);
    }
  });

  it('refuse les IPv6 privées et mappées', () => {
    expect(parsePublicHttpUrl('http://[::1]/').ok).toBe(false);
    expect(parsePublicHttpUrl('http://[fe80::1]/').ok).toBe(false);
    expect(parsePublicHttpUrl('http://[fd12:3456::1]/').ok).toBe(false);
    expect(parsePublicHttpUrl('http://[::ffff:127.0.0.1]/').ok).toBe(false);
  });

  it('normalise les formes IPv4 numériques (WHATWG) et les refuse', () => {
    expect(parsePublicHttpUrl('http://2130706433/').ok).toBe(false);
    expect(parsePublicHttpUrl('http://0x7f000001/').ok).toBe(false);
  });

  it('refuse les protocoles non http(s) et les identifiants embarqués', () => {
    expect(parsePublicHttpUrl('ftp://example.com/').ok).toBe(false);
    expect(parsePublicHttpUrl('file:///etc/passwd').ok).toBe(false);
    expect(parsePublicHttpUrl('http://user:pass@example.com/').ok).toBe(false);
  });

  it('refuse localhost et domaines internes', () => {
    expect(parsePublicHttpUrl('http://localhost/').ok).toBe(false);
    expect(parsePublicHttpUrl('http://mon.service.local/').ok).toBe(false);
    expect(parsePublicHttpUrl('http://git.internal/').ok).toBe(false);
  });

  it('accepte une URL publique standard', () => {
    const result = parsePublicHttpUrl('https://example.com/article?x=1');
    expect(result.ok).toBe(true);
  });

  it('isPrivateAddress couvre les plages sensibles', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('rejette un hôte dont le DNS résout vers le réseau privé', async () => {
    const result = await assertHostResolvesPublic('public-name.example', async () => ['10.0.0.5']);
    expect(result.ok).toBe(false);
  });

  it('accepte un hôte dont toutes les adresses sont publiques', async () => {
    const result = await assertHostResolvesPublic('example.com', async () => [
      '93.184.216.34',
      '2606:2800:220:1:248:1893:25c8:1946',
    ]);
    expect(result.ok).toBe(true);
  });

  it('échoue proprement sur un hôte introuvable', async () => {
    const result = await assertHostResolvesPublic('inexistant.example', async () => {
      throw new Error('ENOTFOUND');
    });
    expect(result.ok).toBe(false);
  });
});
