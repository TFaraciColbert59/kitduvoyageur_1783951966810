import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('../scripts/verify/verify_capacitor_server.mjs', import.meta.url)
);
const temporaryDirectories: string[] = [];

async function createFetchPreload(source: string) {
  const directory = await mkdtemp(join(tmpdir(), 'capacitor-server-'));
  temporaryDirectories.push(directory);
  const preloadPath = join(directory, 'fetch-preload.mjs');
  await writeFile(preloadPath, source);
  return { directory, preloadPath };
}

function runCheck(
  serverUrl: string,
  preloadPath?: string,
  configPath?: string,
  configOnly = false
) {
  const args = preloadPath
    ? ['--import', pathToFileURL(preloadPath).href, scriptPath]
    : [scriptPath];
  if (configPath) args.push(configPath);
  if (configOnly) args.push('--config-only');
  return spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      CAPACITOR_SERVER_URL: serverUrl,
    },
  });
}

function expectUrlNotLeaked(result: ReturnType<typeof runCheck>, url: string) {
  expect(result.stdout).not.toContain(url);
  expect(result.stderr).not.toContain(url);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('validation du serveur Capacitor iOS', () => {
  it('bloque une URL HTTPS dont la résolution réseau échoue', () => {
    const serverUrl = 'https://127.0.0.1:1';
    const result = runCheck(serverUrl);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CAPACITOR_SERVER_URL est injoignable');
    expectUrlNotLeaked(result, serverUrl);
  });

  it("bloque une URL qui n'utilise pas HTTPS", () => {
    const serverUrl = 'http://127.0.0.1:4000';
    const result = runCheck(serverUrl);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CAPACITOR_SERVER_URL doit utiliser HTTPS');
    expectUrlNotLeaked(result, serverUrl);
  });

  it("accepte l'URL exacte, son préfixe et ses bundles Next.js", async () => {
    const serverUrl = 'https://mobile.example/kit';
    const { directory, preloadPath } = await createFetchPreload(
      `const signals = new Set();
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  signals.add(init.signal);
  if (url.href === "https://mobile.example/kit") {
    const userAgent = new Headers(init?.headers).get("user-agent") ?? "";
    if (!userAgent.includes("iPhone") || !userAgent.includes("AppleWebKit/605.1.15")) {
      throw new Error("Unexpected user agent");
    }
    const response = new Response("<!doctype html><html><head><title>Le Kit du Voyageur</title><script src='/_next/static/chunks/app.js'></script></head><body><main><h1>Le Kit du Voyageur</h1><p>Application mobile complete avec itineraires, equipements, carnets et preparation du voyage.</p></main></body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
    Object.defineProperty(response, "url", { value: "https://mobile.example/kit" });
    return response;
  }
  if (url.href === "https://mobile.example/_next/static/chunks/app.js") {
    const response = new Response("globalThis.__LKDV__=true", {
      status: 200,
      headers: { "content-type": "application/javascript; charset=utf-8" }
    });
    Object.defineProperty(response, "url", { value: url.href });
    console.log("UNIQUE_SIGNALS=" + signals.size);
    return response;
  }
  throw new Error("Unexpected mobile request");
};`
    );
    const configPath = join(directory, 'capacitor.config.json');
    await writeFile(configPath, JSON.stringify({ server: { url: serverUrl } }));

    const result = runCheck(serverUrl, preloadPath, configPath);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CAPACITOR_SERVER_URL est joignable');
    expect(result.stdout).toContain('UNIQUE_SIGNALS=2');
    expectUrlNotLeaked(result, serverUrl);
  });

  it("ne contacte pas la cible d'une redirection cross-origin", async () => {
    const serverUrl = 'https://mobile.example';
    const { preloadPath } = await createFetchPreload(
      `globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.origin === "https://other.example") {
    console.log("CROSS_ORIGIN_REQUESTED");
    const response = new Response("<!doctype html><html><head><title>Le Kit du Voyageur</title></head><body>External page</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" }
    });
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  }
  if (init.redirect === "follow") {
    return globalThis.fetch(new URL("https://other.example/hub"), init);
  }
  const response = new Response(null, {
    status: 302,
    headers: { location: "https://other.example/hub" }
  });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
};`
    );

    const result = runCheck(serverUrl, preloadPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CAPACITOR_SERVER_URL est injoignable');
    expect(result.stdout).not.toContain('CROSS_ORIGIN_REQUESTED');
    expectUrlNotLeaked(result, serverUrl);
  });

  it('bloque une page HTML qui ne contient pas le marqueur LKDV', async () => {
    const serverUrl = 'https://mobile.example';
    const { preloadPath } = await createFetchPreload(
      `globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const response = url.pathname === "/"
    ? new Response("<!doctype html><html><head><title>Maintenance</title><script src='/_next/static/chunks/app.js'></script></head><body><main><h1>Maintenance temporaire</h1><p>Le service est temporairement indisponible pendant une intervention technique.</p></main></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    : new Response("globalThis.__LKDV__=true", {
        status: 200,
        headers: { "content-type": "application/javascript; charset=utf-8" }
      });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
};`
    );

    const result = runCheck(serverUrl, preloadPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CAPACITOR_SERVER_URL est injoignable');
    expectUrlNotLeaked(result, serverUrl);
  });

  it('bloque une réponse HTTP en erreur même si le HTML est valide', async () => {
    const serverUrl = 'https://mobile.example';
    const { preloadPath } = await createFetchPreload(
      `globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const response = url.pathname === "/"
    ? new Response("<!doctype html><html><head><title>Le Kit du Voyageur</title><script src='/_next/static/chunks/app.js'></script></head><body><main><h1>Le Kit du Voyageur</h1><p>Application mobile complete avec itineraires, equipements, carnets et preparation du voyage.</p></main></body></html>", {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    : new Response("globalThis.__LKDV__=true", {
        status: 200,
        headers: { "content-type": "application/javascript; charset=utf-8" }
      });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
};`
    );

    const result = runCheck(serverUrl, preloadPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CAPACITOR_SERVER_URL est injoignable');
    expectUrlNotLeaked(result, serverUrl);
  });

  it.each([
    ['HTML au lieu de JavaScript', 'text/html', 200, 'External page'],
    ['JavaScript vide', 'application/javascript', 204, ''],
  ])('bloque un bundle %s', async (_name, contentType, status, body) => {
    const serverUrl = 'https://mobile.example';
    const { preloadPath } = await createFetchPreload(
      `globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const response = url.pathname === "/"
    ? new Response("<!doctype html><html><head><title>Le Kit du Voyageur</title><script src='/_next/static/chunks/app.js'></script></head><body><main><h1>Le Kit du Voyageur</h1><p>Application mobile complete avec itineraires, equipements, carnets et preparation du voyage.</p></main></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    : new Response(${body === '' ? 'null' : JSON.stringify(body)}, {
        status: ${status},
        headers: { "content-type": ${JSON.stringify(contentType)} }
      });
  Object.defineProperty(response, "url", { value: url.href });
  return response;
};`
    );

    const result = runCheck(serverUrl, preloadPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CAPACITOR_SERVER_URL est injoignable');
    expectUrlNotLeaked(result, serverUrl);
  });

  it('vérifie la config embarquée sans refaire la sonde réseau', async () => {
    const serverUrl = 'https://mobile.example';
    const { directory, preloadPath } = await createFetchPreload(
      `globalThis.fetch = async () => {
  console.log("NETWORK_REQUESTED");
  return new Response("", { status: 500 });
};`
    );
    const configPath = join(directory, 'capacitor.config.json');
    await writeFile(configPath, JSON.stringify({ server: { url: serverUrl } }));

    const result = runCheck(serverUrl, preloadPath, configPath, true);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('configuration Capacitor embarquée est valide');
    expect(result.stdout).not.toContain('NETWORK_REQUESTED');
    expectUrlNotLeaked(result, serverUrl);
  });

  it('bloque une configuration native qui embarque une autre URL', async () => {
    const serverUrl = 'https://mobile.example';
    const { directory, preloadPath } = await createFetchPreload(
      `globalThis.fetch = async () => {
  console.log("NETWORK_REQUESTED");
  return new Response("", { status: 500 });
};`
    );
    const configPath = join(directory, 'capacitor.config.json');
    await writeFile(configPath, JSON.stringify({ server: { url: 'https://stale.example' } }));

    const result = runCheck(serverUrl, preloadPath, configPath, true);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('configuration Capacitor embarquée');
    expect(result.stdout).not.toContain('NETWORK_REQUESTED');
    expectUrlNotLeaked(result, serverUrl);
  });
});
