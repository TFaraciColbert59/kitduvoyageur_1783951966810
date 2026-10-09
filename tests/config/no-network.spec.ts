/**
 * Plan 100, 2.12 : le garde réseau des tests unitaires (`tests/setup/no-network.ts`,
 * chargé par `setupFiles`) refuse tout serveur public et laisse passer la
 * machine locale ; un test qui pose sa propre simulation de `fetch` n'est pas gêné.
 */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NetworkForbiddenError,
  failOnBlocked,
  isLoopbackHost,
  networkGuardInstalled,
  takeBlockedNetworkCalls,
} from '../setup/networkGuard';

const FORBIDDEN = /^Réseau interdit dans les tests unitaires : /;

describe('garde réseau des tests unitaires', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('installé pour chaque fichier par setupFiles (sans import du test)', () => {
    expect(networkGuardInstalled()).toBe(true);
  });

  it('fetch vers un serveur public : rejet avec le message en français', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow(
      'Réseau interdit dans les tests unitaires : example.com'
    );
    await expect(fetch(new URL('http://api.example.org:8080/x'))).rejects.toThrow(
      'Réseau interdit dans les tests unitaires : api.example.org:8080'
    );
    // Chaque refus est noté (le test qui l'avale échoue en fin de test).
    expect(takeBlockedNetworkCalls().map((b) => b.host)).toEqual(['example.com', 'api.example.org:8080']);
  });

  it('fetch vers la machine locale : pas bloqué par le garde (échec de connexion seulement)', async () => {
    const err = await fetch('http://127.0.0.1:1/').then(
      () => null,
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toMatch(FORBIDDEN);
    expect(String((err as Error & { cause?: unknown }).cause ?? '')).not.toMatch(FORBIDDEN);
    expect(takeBlockedNetworkCalls()).toEqual([]);
  });

  it('un fetch simulé par le test remplace le garde, puis le garde revient', async () => {
    const stub = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', stub);
    const res = await fetch('https://example.com/simule');
    expect(await res.text()).toBe('ok');
    expect(stub).toHaveBeenCalledWith('https://example.com/simule');
    vi.unstubAllGlobals();
    await expect(fetch('https://example.com')).rejects.toThrow(FORBIDDEN);
    expect(takeBlockedNetworkCalls()).toHaveLength(1);
  });

  it('clients Node (http, https, net) : serveur public refusé', () => {
    expect(() => https.get('https://example.com/')).toThrow(
      'Réseau interdit dans les tests unitaires : example.com'
    );
    expect(() => http.request({ hostname: 'example.com', path: '/' })).toThrow(FORBIDDEN);
    expect(() => net.connect({ host: 'example.com', port: 443 })).toThrow(
      'Réseau interdit dans les tests unitaires : example.com:443'
    );
    expect(takeBlockedNetworkCalls()).toHaveLength(3);
  });

  it('net.Socket#connect brut (chemin de pg) : serveur public refusé, machine locale laissée passer', async () => {
    expect(() => new net.Socket().connect(9, '192.0.2.1')).toThrow(
      'Réseau interdit dans les tests unitaires : 192.0.2.1:9'
    );
    expect(() => new net.Socket().connect({ host: 'example.com', port: 5432 })).toThrow(
      'Réseau interdit dans les tests unitaires : example.com:5432'
    );
    // tls.connect finit aussi dans Socket#connect : refusé une seule fois, par l'enveloppe extérieure.
    expect(() => tls.connect({ host: 'example.com', port: 443 })).toThrow(FORBIDDEN);
    expect(takeBlockedNetworkCalls().map((b) => b.via)).toEqual([
      'net.Socket#connect',
      'net.Socket#connect',
      'tls.connect',
    ]);

    const local = new net.Socket();
    const err = await new Promise<Error>((resolve) => {
      local.once('error', resolve);
      expect(() => local.connect(1, '127.0.0.1')).not.toThrow();
    });
    local.destroy();
    expect(err.message).not.toMatch(FORBIDDEN);
    expect(takeBlockedNetworkCalls()).toEqual([]);
  });

  it('un refus avalé par le code testé fait échouer le test, l’appel et le test nommés', async () => {
    expect(await fetch('https://example.com/avale').catch(() => null)).toBeNull();
    let err: unknown = null;
    try {
      failOnBlocked('pendant ce test');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(NetworkForbiddenError);
    expect((err as NetworkForbiddenError).host).toBe('example.com');
    expect((err as Error).message).toMatch(
      /^Réseau interdit dans les tests unitaires : example\.com \(1 appel pendant ce test, refusé puis rattrapé/
    );
    expect((err as Error).message).toContain(
      'fetch → example.com dans « garde réseau des tests unitaires > un refus avalé par le code testé'
    );
    expect(takeBlockedNetworkCalls()).toEqual([]);
  });

  it('WebSocket vers un serveur public : refusé', () => {
    expect(() => new WebSocket('wss://example.com/flux')).toThrow(
      'Réseau interdit dans les tests unitaires : example.com'
    );
    expect(takeBlockedNetworkCalls()).toHaveLength(1);
  });

  it('serveur local réel : la requête aboutit', async () => {
    const server = http.createServer((_req, res) => res.end('local'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address() as net.AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(await res.text()).toBe('local');
      const viaHttp = await new Promise<string>((resolve, reject) => {
        http
          .get({ host: 'localhost', port, path: '/' }, (r) => {
            let body = '';
            r.on('data', (c) => (body += String(c)));
            r.on('end', () => resolve(body));
          })
          .on('error', reject);
      });
      expect(viaHttp).toBe('local');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('machine locale reconnue, le reste non', () => {
    for (const h of ['localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]', 'api.localhost'])
      expect(isLoopbackHost(h)).toBe(true);
    for (const h of ['example.com', '10.0.0.1', '192.168.1.2', '128.0.0.1', 'localhost.example.com'])
      expect(isLoopbackHost(h)).toBe(false);
  });
});
