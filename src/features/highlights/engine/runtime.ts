export interface Runtime {
  id: () => string;
  now: () => string;
  token: () => string;
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1)
      values[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function defaultRuntime(): Runtime {
  return {
    id: () => {
      const cryptoApi = globalThis.crypto;
      if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
      return `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;
    },
    now: () => new Date().toISOString(),
    token: () => randomHex(32),
  };
}

export function fixedRuntime(now = '2026-11-11T10:00:00.000Z'): Runtime {
  let sequence = 0;
  return {
    id: () => `id-${++sequence}`,
    now: () => now,
    token: () => `token-${++sequence}`,
  };
}
