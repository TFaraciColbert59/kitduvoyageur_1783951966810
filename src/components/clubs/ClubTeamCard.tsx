'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, IconButton, ListItem } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TeamMember {
  id: string;
  user_id?: string;
  role: string;
  user?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface ClubTeamCardProps {
  admins: TeamMember[];
  onViewAll?: () => void;
  onContact?: (name: string) => void;
}

export default function ClubTeamCard({
  admins,
  onViewAll,
  onContact,
}: ClubTeamCardProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <Card className="space-y-[var(--space-3)] p-[var(--space-4)] transition-all duration-[var(--motion-control-duration)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-caption)]" aria-hidden>🛡️</span>
          <h2 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
            Équipe d&apos;animation ({admins.length})
          </h2>
        </div>
        {onViewAll && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              triggerHaptic('light');
              onViewAll();
            }}
            className="font-mono font-bold"
          >
            Tous les membres →
          </Button>
        )}
      </div>

      <div className="space-y-[var(--space-2)]">
        {admins.length === 0 ? (
          <p className="py-[var(--space-3)] text-center font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
            Aucun administrateur désigné.
          </p>
        ) : (
          admins.slice(0, 4).map((admin) => (
            <ListItem
              key={admin.id}
              as="div"
              className="bg-[color:var(--glass-bg-medium)]"
              leading={
                <Link
                  href={admin.user_id ? `/profil/${admin.user_id}` : '#'}
                  onClick={() => triggerHaptic('light')}
                  className="relative block shrink-0"
                  aria-label={`Voir le profil de ${admin.user?.full_name || 'ce membre'}`}
                >
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn font-serif text-[length:var(--lkv-text-caption-2)] font-bold italic text-[color:var(--lkv-text-primary)]">
                    {admin.user?.avatar_url ? (
                      <img
                        src={admin.user.avatar_url}
                        alt={admin.user?.full_name || 'Administrateur du club'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      admin.user?.full_name?.charAt(0) || '👤'
                    )}
                  </span>
                </Link>
              }
              title={
                <Link
                  href={admin.user_id ? `/profil/${admin.user_id}` : '/communaute'}
                  onClick={() => triggerHaptic('light')}
                  className="truncate text-[length:var(--lkv-text-caption)] font-bold leading-tight hover:underline"
                >
                  {admin.user?.full_name || 'Membre collectif'}
                </Link>
              }
              subtitle={<span className="font-mono text-[length:var(--lkv-text-caption-2)]">{admin.role === 'admin' ? '👑 Leader' : '🛡️ Modérateur'}</span>}
              trailing={
                onContact && (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      triggerHaptic('selection');
                      onContact(admin.user?.full_name || "l'organisateur");
                    }}
                    aria-label={`Envoyer un message à ${admin.user?.full_name || "l'organisateur"}`}
                  >
                    <Icon name="ChatBubbleLeftIcon" size={12} aria-hidden="true" />
                  </IconButton>
                )
              }
            />
          ))
        )}

        {admins.length > 4 && onViewAll && (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onViewAll}
            className="font-medium"
          >
            + {admins.length - 4} autre{admins.length - 4 > 1 ? 's' : ''} organisateur{admins.length - 4 > 1 ? 's' : ''}
          </Button>
        )}
      </div>
    </Card>
  );
}
