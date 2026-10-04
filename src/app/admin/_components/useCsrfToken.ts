'use client';

import { useCallback, useEffect, useState } from 'react';

/** Jeton CSRF double-submit pour les mutations admin (en-tête `x-admin-csrf`). */
export function useCsrfToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/csrf', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.csrfToken) setToken(j.csrfToken as string);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return token;
}

export function useAdminFetch() {
  const token = useCsrfToken();
  const call = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set('content-type', 'application/json');
      if (token) headers.set('x-admin-csrf', token);
      return fetch(url, { ...init, headers });
    },
    [token]
  );
  return { csrfReady: token !== null, call };
}
