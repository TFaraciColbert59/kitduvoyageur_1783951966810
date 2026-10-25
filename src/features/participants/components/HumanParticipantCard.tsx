'use client';

import React, { useState } from 'react';
import { HumanParticipant } from '../types/participant.types';
import { GlassBreakModal } from './GlassBreakModal';
import { Badge, Button, Card, IconButton } from '@/components/ui';
import Icon from '@/components/ui/Icon';

interface HumanParticipantCardProps {
  participant: HumanParticipant;
  onUnlock: (id: string) => void;
  onLock: (id: string) => void;
  onRemove?: (id: string) => void;
}

export const HumanParticipantCard: React.FC<HumanParticipantCardProps> = ({
  participant,
  onUnlock,
  onLock,
  onRemove,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { publicData } = participant;

  const getRoleBadge = (role: HumanParticipant['publicData']['role']) => {
    switch (role) {
      case 'guide':
        return { label: 'Guide', tone: 'sage' as const };
      case 'medic':
        return { label: 'Secouriste', tone: 'danger' as const };
      case 'member':
      default:
        return { label: 'Équipier', tone: 'info' as const };
    }
  };

  const role = getRoleBadge(publicData.role);

  return (
    <>
      <Card className="flex flex-col justify-between gap-[var(--space-3)]">
        <div className="flex items-start justify-between gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              {publicData.firstName[0]}
            </div>
            <div>
              <div className="flex items-center gap-[var(--space-2)]">
                <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                  {publicData.firstName}
                </h4>
                <Badge tone={role.tone}>{role.label}</Badge>
              </div>
              <span className="font-mono text-[11px] text-[color:var(--lkv-text-muted)]">
                🎒 Sac : {publicData.packWeightKg} kg · Forme : {publicData.fitnessScore}%
              </span>
            </div>
          </div>

          {onRemove && (
            <IconButton
              aria-label="Supprimer le participant"
              title="Supprimer le participant"
              size="sm"
              onClick={() => onRemove(participant.id)}
            >
              <Icon name="x" size={14} />
            </IconButton>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
          <span className="font-mono text-[10px] text-[color:var(--lkv-text-muted)]">
            Matrice Privée
          </span>

          <Button
            size="sm"
            variant="secondary"
            icon={<Icon name="shield" size={14} />}
            onClick={() => setIsModalOpen(true)}
          >
            Fiche Médicale / ICE →
          </Button>
        </div>
      </Card>

      <GlassBreakModal
        participant={participant}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUnlock={onUnlock}
        onLock={onLock}
      />
    </>
  );
};
