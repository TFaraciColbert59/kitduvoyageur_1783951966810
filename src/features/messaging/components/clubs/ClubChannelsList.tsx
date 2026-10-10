'use client';

import React from 'react';
import type { ClubChannel, OutdoorRole } from '../../types/clubs.types';
import { canReadChannel, canWriteChannel } from '../../types/clubs.types';

export interface ClubChannelsListProps {
  channels: ClubChannel[];
  activeChannelId?: string;
  userRole: OutdoorRole;
  onSelectChannel?: (id: string) => void;
  className?: string;
}

export const ClubChannelsList: React.FC<ClubChannelsListProps> = ({
  channels,
  activeChannelId,
  userRole,
  onSelectChannel,
  className = '',
}) => {
  // Filter channels the user has permission to read
  const visibleChannels = channels.filter((ch) => canReadChannel(userRole, ch));

  return (
    <nav
      aria-label="Salons du Club"
      className={`flex w-full flex-col gap-1 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-2 shadow-elevation-1 backdrop-blur-md ${className}`}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-[color:var(--lkv-text-secondary)]">
        Salons du Club
      </div>
      <ul className="flex flex-col gap-1">
        {visibleChannels.map((ch) => {
          const isActive = ch.id === activeChannelId;
          const canWrite = canWriteChannel(userRole, ch);

          return (
            <li key={ch.id}>
              <button
                type="button"
                onClick={() => onSelectChannel?.(ch.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[44px] min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-primary)] active:scale-[0.99] ${
                  isActive
                    ? 'bg-[color:var(--lkv-secondary)]/15 font-semibold text-[color:var(--lkv-primary)]'
                    : 'text-[color:var(--lkv-text-primary)] hover:bg-[color:var(--lkv-hover-surface)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm"># {ch.name}</span>
                  {!canWrite && (
                    <span
                      role="img"
                      aria-label="Salon en lecture seule"
                      className="text-xs text-[color:var(--lkv-text-secondary)]"
                    >
                      🔒
                    </span>
                  )}
                </div>
                {ch.unreadCount != null && ch.unreadCount > 0 && (
                  <span className="flex min-w-[20px] h-5 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] px-1.5 text-[10px] font-bold text-white">
                    {ch.unreadCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
