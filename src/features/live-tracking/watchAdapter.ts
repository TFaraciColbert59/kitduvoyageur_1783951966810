import { computePositionFreshness } from './privacy';
import { SafetyContactService } from './safetyContacts';
import { LiveTrackingTokenService, resolveShareLinkStatus, SystemClock } from './tokenService';
import type {
  LiveTrackingClock,
  LiveTrackingStore,
  P01PrivacyContext,
  WatchCommand,
  WatchCommandResult,
  WatchDeviceInfo,
  WatchPlatform,
  WatchSnapshot,
} from './types';

const MIN_WATCH_MAJOR_VERSION: Record<WatchPlatform, number> = {
  apple_watch: 9,
  wear_os: 4,
};

function parseMajorVersion(version: string): number {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : 0;
}

export function checkWatchEligibility(
  device: WatchDeviceInfo,
): { ok: true } | Extract<WatchCommandResult, { ok: false }> {
  if (!device.isPaired) {
    return {
      ok: false,
      error: 'watch_not_paired',
      message: 'La montre doit être appairée pour piloter le Live Tracking.',
    };
  }
  const minMajor = MIN_WATCH_MAJOR_VERSION[device.platform];
  if (parseMajorVersion(device.osVersion) < minMajor) {
    return {
      ok: false,
      error: 'unsupported_os_version',
      message: `Version OS non supportée (minimum ${minMajor}.0 requis).`,
    };
  }
  if (!device.hasLocationPermission) {
    return {
      ok: false,
      error: 'missing_location_permission',
      message: 'Permission de localisation requise sur la montre.',
    };
  }
  if (!device.hasBackgroundPermission) {
    return {
      ok: false,
      error: 'missing_background_permission',
      message: 'Permission de suivi en arrière-plan requise sur la montre.',
    };
  }
  return { ok: true };
}

export class WatchLiveTrackingAdapter {
  constructor(
    private readonly store: LiveTrackingStore,
    private readonly tokenService: LiveTrackingTokenService,
    private readonly safetyService?: SafetyContactService,
    private readonly clock: LiveTrackingClock = new SystemClock(),
    private readonly shareBaseUrl: string = 'https://lkdv.app/live/',
  ) {}

  async handleCommand(
    device: WatchDeviceInfo,
    command: WatchCommand,
    privacy: P01PrivacyContext = { liveSharingAllowed: true },
  ): Promise<WatchCommandResult> {
    const eligibility = checkWatchEligibility(device);
    if (!eligibility.ok) {
      return eligibility;
    }

    const session = await this.store.getSession(command.sessionId);
    if (!session || session.status === 'ended') {
      return {
        ok: false,
        error: 'session_not_active',
        message: 'Aucune séance active pour cette montre.',
      };
    }
    if (session.ownerUserId !== command.ownerUserId) {
      return {
        ok: false,
        error: 'unauthorized',
        message: 'Accès non autorisé à cette séance.',
      };
    }

    if (command.type === 'start_live_share') {
      const created = await this.tokenService.createShareLink(
        {
          sessionId: command.sessionId,
          ownerUserId: command.ownerUserId,
          durationMinutes: command.durationMinutes,
          label: `Montre (${device.platform})`,
        },
        privacy,
      );

      if (!created.ok) {
        return {
          ok: false,
          error: created.error === 'privacy_denied' ? 'privacy_denied' : 'session_not_active',
          message:
            created.error === 'privacy_denied'
              ? 'Partage refusé par les règles de confidentialité P01.'
              : 'Impossible de démarrer le partage depuis la montre.',
        };
      }

      if (command.notifySafetyContacts && this.safetyService) {
        await this.safetyService.broadcastEvent({
          ownerUserId: command.ownerUserId,
          sessionId: command.sessionId,
          event: 'live_share_started',
          shareUrl: `${this.shareBaseUrl}${created.link.rawToken}`,
        });
      }

      const snapshot = await this.buildSnapshot(device.platform, command.sessionId);
      return { ok: true, snapshot, shareCreated: true };
    }

    if (command.type === 'stop_live_share') {
      if (command.tokenId) {
        await this.tokenService.revokeShareLink(
          command.tokenId,
          command.ownerUserId,
          command.sessionId,
        );
      } else {
        const tokens = await this.store.listTokensBySession(command.sessionId);
        for (const token of tokens) {
          if (token.revokedAtMs === null) {
            await this.tokenService.revokeShareLink(
              token.id,
              command.ownerUserId,
              command.sessionId,
            );
          }
        }
      }

      if (this.safetyService) {
        await this.safetyService.broadcastEvent({
          ownerUserId: command.ownerUserId,
          sessionId: command.sessionId,
          event: 'live_share_stopped',
        });
      }

      const snapshot = await this.buildSnapshot(device.platform, command.sessionId);
      return { ok: true, snapshot };
    }

    const snapshot = await this.buildSnapshot(device.platform, command.sessionId);
    return { ok: true, snapshot };
  }

  private async buildSnapshot(
    platform: WatchPlatform,
    sessionId: string,
  ): Promise<WatchSnapshot> {
    const nowMs = this.clock.nowMs();
    const session = await this.store.getSession(sessionId);
    const tokens = await this.store.listTokensBySession(sessionId);
    const activeTokens = tokens.filter(
      (t) => resolveShareLinkStatus(t, session, nowMs) === 'active',
    );
    const maxExpiresMs = activeTokens.reduce(
      (max, t) => (t.expiresAtMs > max ? t.expiresAtMs : max),
      0,
    );

    const positions = await this.store.getPositions(sessionId);
    const latest = positions.length > 0 ? positions[positions.length - 1] : null;
    const lastPositionAgeSeconds = latest
      ? computePositionFreshness(latest.recordedAtMs, nowMs).ageSeconds
      : null;

    return {
      platform,
      sessionId,
      isSharingActive: activeTokens.length > 0 && session?.status !== 'ended',
      activeLinkCount: activeTokens.length,
      expiresAtIso: maxExpiresMs > 0 ? new Date(maxExpiresMs).toISOString() : null,
      lastPositionAgeSeconds,
    };
  }
}
