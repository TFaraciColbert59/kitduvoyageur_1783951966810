/**
 * LKDV Social — Community Clubs & Outdoor Roles Type Definitions & Permissions
 * File: src/features/messaging/types/clubs.types.ts
 */

export type OutdoorRole = 'member' | 'safety' | 'guide' | 'admin' | 'owner';

export const OUTDOOR_ROLE_HIERARCHY: Record<OutdoorRole, number> = {
  owner: 5,
  admin: 4,
  guide: 3,
  safety: 2,
  member: 1,
};

export type ChannelCategory = 'general' | 'announcements' | 'safety' | 'trips' | 'gear';

export interface ClubChannel {
  id: string;
  clubId: string;
  conversationId: string;
  name: string;
  description?: string | null;
  channelType?: ChannelCategory;
  minRoleToRead: OutdoorRole;
  minRoleToWrite: OutdoorRole;
  position?: number;
  unreadCount?: number;
  isMuted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Validates whether a user's role meets or exceeds the required threshold.
 */
export function hasRolePermission(
  userRole: OutdoorRole | string | undefined | null,
  requiredRole: OutdoorRole
): boolean {
  if (!userRole) return false;
  const userRank = OUTDOOR_ROLE_HIERARCHY[userRole as OutdoorRole] || 0;
  const requiredRank = OUTDOOR_ROLE_HIERARCHY[requiredRole] || 0;
  if (userRank === 0 || requiredRank === 0) return false;
  return userRank >= requiredRank;
}

/**
 * Checks whether the user has permission to read a given channel.
 */
export function canReadChannel(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToRead'>
): boolean {
  return hasRolePermission(userRole, channel.minRoleToRead);
}

/**
 * Checks whether the user has permission to post/write to a given channel.
 */
export function canWriteChannel(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToWrite'>
): boolean {
  return hasRolePermission(userRole, channel.minRoleToWrite);
}

export interface ChannelPostPermissionCheck {
  allowed: boolean;
  reason?: 'INSUFFICIENT_ROLE_PERMISSIONS' | 'USER_NOT_MEMBER' | 'CHANNEL_NOT_FOUND' | 'CHANNEL_ARCHIVED';
}

/**
 * Validates post permission and returns a structured decision with machine-readable rejection code.
 */
export function validateChannelPostPermission(
  userRole: OutdoorRole | string | undefined | null,
  channel: Pick<ClubChannel, 'minRoleToWrite'>
): ChannelPostPermissionCheck {
  if (!userRole) {
    return { allowed: false, reason: 'USER_NOT_MEMBER' };
  }
  if (!canWriteChannel(userRole, channel)) {
    return { allowed: false, reason: 'INSUFFICIENT_ROLE_PERMISSIONS' };
  }
  return { allowed: true };
}
