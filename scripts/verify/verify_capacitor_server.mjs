#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const REQUEST_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const BATCH_SIZE = 8;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const serverUrlValue = process.env.CAPACITOR_SERVER_URL;
const configOnly = process.argv.includes('--config-only');
const configPath = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const userAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function createRequestOptions(accept) {
  return {
    cache: 'no-store',
    headers: {
      accept,
      'user-agent': userAgent,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
}

function getMediaType(contentType) {
  return contentType.split(';', 1)[0].trim().toLowerCase();
}

async function fetchSameOrigin(initialUrl, expectedOrigin, accept) {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(currentUrl, createRequestOptions(accept));

    if (!redirectStatuses.has(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Redirect without location');
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== 'https:' || nextUrl.origin !== expectedOrigin) {
      throw new Error('Unsafe redirect');
    }
    currentUrl = nextUrl;
  }

  throw new Error('Too many redirects');
}

if (!serverUrlValue) {
  fail('CAPACITOR_SERVER_URL est requise et doit utiliser HTTPS.');
}

let serverUrl;
try {
  serverUrl = new URL(serverUrlValue);
} catch {
  fail('CAPACITOR_SERVER_URL doit être une URL HTTPS valide.');
}

if (serverUrl.protocol !== 'https:' || serverUrl.username || serverUrl.password) {
  fail('CAPACITOR_SERVER_URL doit utiliser HTTPS sans identifiants.');
}

if (configPath) {
  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch {
    fail('La configuration Capacitor embarquée est absente ou invalide.');
  }
  if (config?.server?.url !== serverUrlValue) {
    fail('La configuration Capacitor embarquée ne correspond pas à CAPACITOR_SERVER_URL.');
  }
}

if (configOnly) {
  if (!configPath) {
    fail('Le chemin de la configuration Capacitor embarquée est requis.');
  }
  console.log('La configuration Capacitor embarquée est valide.');
} else {
  try {
    const { response, finalUrl } = await fetchSameOrigin(
      serverUrl,
      serverUrl.origin,
      'text/html,application/xhtml+xml'
    );
    const pageContentType = getMediaType(response.headers.get('content-type') ?? '');
    const html = await response.text();
    const scriptUrls = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((source) => source.includes('/_next/static/'))
      .map((source) => new URL(source, finalUrl));

    if (
      !response.ok ||
      !pageContentType.toLowerCase().includes('text/html') ||
      !html.includes('Le Kit du Voyageur') ||
      scriptUrls.length === 0 ||
      scriptUrls.length > 100 ||
      scriptUrls.some((url) => url.origin !== serverUrl.origin)
    ) {
      throw new Error('Invalid mobile page');
    }

    for (let index = 0; index < scriptUrls.length; index += BATCH_SIZE) {
      const scriptsAreValid = await Promise.all(
        scriptUrls.slice(index, index + BATCH_SIZE).map(async (url) => {
          const script = await fetchSameOrigin(
            url,
            serverUrl.origin,
            'application/javascript,text/javascript,*/*;q=0.8'
          );
          const contentType = getMediaType(script.response.headers.get('content-type') ?? '');
          const body = await script.response.text();
          return (
            script.response.ok &&
            /^(?:text|application)\/(?:x-)?javascript$/i.test(contentType) &&
            body.trim().length > 0
          );
        })
      );
      if (scriptsAreValid.some((isValid) => !isValid)) {
        throw new Error('Invalid mobile script');
      }
    }

    console.log("CAPACITOR_SERVER_URL est joignable et renvoie l'application LKDV.");
  } catch {
    fail('CAPACITOR_SERVER_URL est injoignable ou ne renvoie pas une page HTML exploitable.');
  }
}
