import type {
  AudienceLevel,
  PublishableTrackProjection,
  RenderJobStatus,
  SportKind,
} from '@/features/media-sharing';

export interface PreviewLinkSummary {
  linkId: string;
  trackId: string;
  ownerId: string;
  maskVersion: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  title: string;
  sport: SportKind;
  totalDistanceM: number;
  elevationGainM: number;
}

export interface CreatedPreviewLink {
  token: string;
  url: string;
  record: PreviewLinkSummary;
}

export interface FlyoverJob {
  jobId: string;
  status: RenderJobStatus;
  outputUrl: string | null;
  fallbackImageUrl: string | null;
  error?: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
  } catch {
    /* réponse non JSON */
  }
  return `Erreur ${response.status}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

export function createProtectedPreviewLink(input: {
  track: PublishableTrackProjection;
  ownerId: string;
  expiresInSec: number;
}): Promise<CreatedPreviewLink> {
  return postJson<CreatedPreviewLink>('/api/media-sharing/preview', input);
}

export async function revokeProtectedPreviewLink(input: {
  linkId: string;
  ownerId: string;
}): Promise<void> {
  const response = await fetch('/api/media-sharing/preview/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export function enqueueFlyoverRender(input: {
  trackId: string;
  maskVersion: string;
  audience: Exclude<AudienceLevel, 'private'>;
  preset?: string;
  fallbackImageUrl?: string | null;
}): Promise<{ job: FlyoverJob; deduplicated: boolean }> {
  return postJson<{ job: FlyoverJob; deduplicated: boolean }>(
    '/api/media-sharing/flyover/jobs',
    input,
  );
}

export function absolutePreviewUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (/^https?:\/\//.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
