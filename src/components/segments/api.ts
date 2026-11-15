export interface ApiFailure {
  error?: string;
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as (T & ApiFailure) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Erreur ${response.status}`);
  }
  return payload as T;
}
