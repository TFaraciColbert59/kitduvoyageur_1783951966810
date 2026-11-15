import type {
  AudienceLevel,
  FlybyCrossing,
  ProtectedPreviewResolution,
  RenderJobStatus,
  SportKind,
} from '@/features/media-sharing';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDistanceM(distanceM: number): string {
  if (!Number.isFinite(distanceM) || distanceM < 0) return '—';
  if (distanceM >= 1000) {
    const km = distanceM / 1000;
    return `${km.toLocaleString('fr-FR', { maximumFractionDigits: km >= 10 ? 0 : 1 })} km`;
  }
  return `${Math.round(distanceM)} m`;
}

export function formatDurationSec(durationSec: number): string {
  if (!Number.isFinite(durationSec) || durationSec < 0) return '—';
  const total = Math.round(durationSec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')}`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, '0')}`;
  return `${seconds} s`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatDateTimeMs(timestampMs: number | null | undefined): string {
  if (timestampMs === null || timestampMs === undefined || !Number.isFinite(timestampMs)) {
    return 'Date non disponible';
  }
  return DATE_TIME_FORMAT.format(new Date(timestampMs));
}

export function formatDateMs(timestampMs: number | null | undefined): string {
  if (timestampMs === null || timestampMs === undefined || !Number.isFinite(timestampMs)) {
    return 'Date non disponible';
  }
  return DATE_FORMAT.format(new Date(timestampMs));
}

export function formatTimeMs(timestampMs: number | null | undefined): string {
  if (timestampMs === null || timestampMs === undefined || !Number.isFinite(timestampMs)) {
    return '—';
  }
  return TIME_FORMAT.format(new Date(timestampMs));
}

export function formatExpiry(expiresAtMs: number, nowMs = Date.now()): string {
  const remainingSec = Math.max(0, Math.round((expiresAtMs - nowMs) / 1000));
  if (remainingSec <= 0) return 'Expiré';
  if (remainingSec < 3600) return `${Math.ceil(remainingSec / 60)} min restantes`;
  if (remainingSec < 86_400) return `${Math.ceil(remainingSec / 3600)} h restantes`;
  return `${Math.ceil(remainingSec / 86_400)} j restants`;
}

export const AUDIENCE_LABELS: Record<AudienceLevel, string> = {
  private: 'Privé',
  followers: 'Abonnés',
  collective: 'Collectif',
  public: 'Public',
};

export const SPORT_LABELS: Record<SportKind, string> = {
  hiking: 'Randonnée',
  trail_running: 'Trail',
  cycling: 'Vélo',
  mtb: 'VTT',
  gravel: 'Gravel',
  ski_touring: 'Ski de randonnée',
  alpinism: 'Alpinisme',
  other: 'Sortie',
};

export const STATUS_LABELS: Record<RenderJobStatus, string> = {
  queued: 'En file',
  rendering: 'Rendu en cours',
  ready: 'Prêt',
  failed: 'Échec',
  revoked: 'Révoqué',
  cancelled: 'Annulé',
};

export const DIRECTION_LABELS: Record<FlybyCrossing['relativeDirection'], string> = {
  same_direction: 'Même direction',
  opposite: 'Face à face',
  intersecting: 'Trajectoires croisées',
};

export const PREVIEW_FAILURE_LABELS: Record<
  Extract<ProtectedPreviewResolution, { ok: false }>['reason'],
  { title: string; message: string }
> = {
  not_found: {
    title: 'Lien introuvable',
    message: "Ce lien n'existe pas ou a été supprimé.",
  },
  revoked: {
    title: 'Lien révoqué',
    message: 'Le propriétaire a révoqué cet aperçu. Aucune donnée ne reste accessible.',
  },
  expired: {
    title: 'Lien expiré',
    message: "La durée de partage est écoulée. Demande un nouveau lien à l'auteur.",
  },
  mask_invalidated: {
    title: 'Confidentialité modifiée',
    message:
      'Les zones masquées ont changé depuis la création du lien. Il est invalidé par précaution.',
  },
};

export function mediaCountLabel(count: number, kind: 'photo' | 'video' | 'item'): string {
  const labels = {
    photo: ['photo', 'photos'],
    video: ['vidéo', 'vidéos'],
    item: ['média', 'médias'],
  } as const;
  const [singular, plural] = labels[kind];
  return `${count} ${count > 1 ? plural : singular}`;
}

export function maskVersionShort(maskVersion: string): string {
  if (!maskVersion) return '—';
  return maskVersion.slice(0, 8);
}

export function formatDistanceApart(distanceM: number): string {
  if (!Number.isFinite(distanceM)) return '—';
  return distanceM < 10 ? `${Math.round(distanceM)} m` : `${Math.round(distanceM)} m`;
}
