'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetMoment } from '@/lib/mock/carnet-chartreuse';
import { Badge, Card, IconButton, Modal } from '@/components/ui';

interface MomentCardProps {
  moment: CarnetMoment;
}

const PHOTO_MAP: Record<string, string> = {
  'm1': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop',
  'm2': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
  'm3': 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop',
};

export default function MomentCard({ moment }: MomentCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(Math.floor(Math.random() * 8) + 4);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const photoUrl = PHOTO_MAP[moment.id] || 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?q=80&w=800&auto=format&fit=crop';

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('selection');
    setIsLiked(!isLiked);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  return (
    <>
      <Card
        variant="interactive"
        onClick={() => {
          triggerHaptic('light');
          setIsLightboxOpen(true);
        }}
        ariaLabelledBy={`moment-${moment.id}-citation`}
        className="group flex flex-col justify-between space-y-[var(--space-3)] p-[var(--space-3)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--lkv-radius-2xl)] bg-[color:var(--btn-tint)]">
          <img
            src={photoUrl}
            alt={moment.location}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
            loading="lazy"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

          <div className="absolute left-[var(--space-2)] top-[var(--space-2)]">
            <Badge className="border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-bold uppercase tracking-widest text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
              {moment.label}
            </Badge>
          </div>

          <div className="absolute bottom-[var(--space-2)] left-[var(--space-2)] right-[var(--space-2)] flex items-center justify-between text-[color:var(--lkv-text-inverted)]">
            <span className="flex items-center gap-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-semibold drop-shadow-md">
              📍 {moment.location}
            </span>
            <IconButton
              type="button"
              onClick={handleLike}
              aria-label={isLiked ? 'Retirer mon like' : 'Aimer ce moment'}
              aria-pressed={isLiked}
              size="sm"
              variant={isLiked ? 'solid' : 'glass'}
              className={isLiked ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-danger)]' : 'bg-[color:var(--btn-tint)]  text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]'}
            >
              <motion.svg
                whileTap={{ scale: 1.3 }}
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </motion.svg>
            </IconButton>
          </div>
        </div>

        <div className="space-y-[var(--space-2)] pl-[var(--space-1)]">
          <p id={`moment-${moment.id}-citation`} className="font-serif text-[length:var(--lkv-text-caption-2)] italic leading-relaxed text-[color:var(--lkv-text-primary)]">
            &ldquo;{moment.citation}&rdquo;
          </p>

          <div className="flex items-center justify-between border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]" aria-hidden>
                {moment.author.charAt(0)}
              </div>
              <span className="font-sans text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{moment.author}</span>
            </div>
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">❤️ {likes} likes</span>
          </div>
        </div>
      </Card>

      <Modal
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        title={`${moment.label} · ${moment.location}`}
        size="lg"
      >
        <div className="space-y-[var(--space-4)]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--lkv-radius-2xl)] bg-black">
            <img src={photoUrl} alt={moment.location} className="h-full w-full object-cover" />
          </div>

          <div className="space-y-[var(--space-1)]">
            <span className="block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Récit de {moment.author}</span>
            <p className="font-serif text-[length:var(--lkv-text-caption)] italic leading-relaxed text-[color:var(--lkv-text-primary)]">
              &ldquo;{moment.citation}&rdquo;
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
