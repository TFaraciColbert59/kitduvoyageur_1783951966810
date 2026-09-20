'use client';

import Icon from '@/components/ui/Icon';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUpIcon as TrendingUp } from '@/components/icons/trending-up';
import { NavigationIcon as Navigation } from '@/components/icons/navigation';
import { DocIcon as FileText } from '@/components/icons/doc';
import { ListIcon as List } from '@/components/icons/list';
import { LayersIcon as Layers } from '@/components/icons/layers';
import { ClockIcon as Clock } from '@/components/icons/clock';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import Link from 'next/link';
import type { MapTrail } from './types';
import {
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
  getTrailImage,
} from './types';
import ExplorerListCard from './ExplorerListCard';
import { Badge, Button, Card, IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const LINK_PILL = [
  'inline-flex min-h-[36px] flex-1 select-none items-center justify-center whitespace-nowrap rounded-full',
  'border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)]',
  'text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--card-content)] no-underline',
  'transition-transform duration-[var(--motion-press-duration)] active:scale-[var(--motion-press-scale)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]',
].join(' ');

interface ExplorerMobileHikeCarouselProps {
  trails: MapTrail[];
  selectedTrailId: string | null;
  count: number;
  onSelectTrail: (trail: MapTrail) => void;
  onOpenDetail: (trail: MapTrail) => void;
}

export default function ExplorerMobileHikeCarousel({
  trails,
  selectedTrailId,
  count,
  onSelectTrail,
  onOpenDetail,
}: ExplorerMobileHikeCarouselProps) {
  const { triggerHaptic } = useHapticFeedback();
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');

  // Haptique au changement de carte centrée (mission gestes, Phase 6) —
  // le scroll natif + snap-x est conservé (momentum, a11y, perf) ; on
  // détecte la carte la plus proche du centre au scroll et on confirme
  // par retour léger. Garde anti-spam : pas d'haptique pendant les
  // 700ms qui suivent un auto-scroll programmatique.
  const programmaticUntilRef = useRef(0);
  const lastSnappedIndexRef = useRef(0);

  const handleCarouselScroll = useCallback(() => {
    const el = carouselScrollRef.current;
    if (!el || el.children.length < 2) return;
    const first = el.querySelector<HTMLElement>('[data-trail-id]');
    if (!first) return;
    const step = first.offsetWidth + 12; // gap-3
    const idx = Math.round(el.scrollLeft / step);
    if (idx !== lastSnappedIndexRef.current) {
      lastSnappedIndexRef.current = idx;
      if (Date.now() > programmaticUntilRef.current) {
        triggerHaptic('light');
      }
    }
  }, [triggerHaptic]);

  // Auto-scroll the horizontal carousel to center the selected trail card
  useEffect(() => {
    if (!selectedTrailId || viewMode !== 'carousel' || !carouselScrollRef.current) return;
    const activeEl = carouselScrollRef.current.querySelector<HTMLElement>(
      `[data-trail-id="${selectedTrailId}"]`
    );
    if (activeEl) {
      programmaticUntilRef.current = Date.now() + 700;
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedTrailId, viewMode]);

  const toggleViewMode = useCallback(() => {
    triggerHaptic('medium');
    setViewMode((prev) => (prev === 'carousel' ? 'list' : 'carousel'));
  }, [triggerHaptic]);

  // E1 — publie la hauteur réelle du carrousel (mode cartes comme liste) dans
  // `--explorer-carousel-height` : les contrôles carte (CTA/zoom) se placent
  // AU-DESSUS du carrousel au lieu de rester recouverts par lui.
  const hasTrails = trails.length > 0;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => {
      const height = Math.round(el.getBoundingClientRect().height);
      root.style.setProperty('--explorer-carousel-height', `${height}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      root.style.removeProperty('--explorer-carousel-height');
    };
  }, [hasTrails]);

  if (trails.length === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-offset)+8px)] z-[var(--z-fab)] block md:hidden"
    >
      {/* ── TOP FLOATING PILL (Mode Switch & Counter) ── */}
      <div className="pointer-events-auto mb-1.5 flex items-center justify-between px-3.5">
        <Badge tone="stone" className="gap-1.5">
          <Icon name="map-pin" size={12} className="text-[color:var(--lkv-primary)]" />
          <span>{count} randonnées</span>
        </Badge>

        <Button variant="secondary" size="sm" onClick={toggleViewMode}>
          {viewMode === 'carousel' ? (
            <>
              <List size={12} />
              <span>Voir liste</span>
            </>
          ) : (
            <>
              <Layers size={12} />
              <span>Mode cartes</span>
            </>
          )}
        </Button>
      </div>

      {/* ── MODE 1: HORIZONTAL SWIPEABLE CAROUSEL (NATIVE APP FEEL) ── */}
      {viewMode === 'carousel' && (
        <div
          ref={carouselScrollRef}
          onScroll={handleCarouselScroll}
          className="no-scrollbar pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-pl-[14px] scroll-pr-[28px] px-3.5 pb-1 [-webkit-overflow-scrolling:touch]"
        >
          {trails.slice(0, 40).map((trail) => {
            const isSelected = String(trail.id) === String(selectedTrailId);

            return (
              <Card
                key={trail.id}
                as="article"
                variant="standard"
                selected={isSelected}
                data-trail-id={trail.id}
                onClick={() => {
                  triggerHaptic('selection');
                  onSelectTrail(trail);
                }}
                className="w-[calc(100vw-68px)] max-w-[290px] shrink-0 snap-start overflow-hidden p-0"
              >
                {/* Photo Header */}
                <div className="relative h-20 w-full overflow-hidden bg-[color:var(--lkv-surface-muted)]">
                  <img
                    src={getTrailImage(trail.id)}
                    alt={trail.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Difficulty Badge */}
                  {trail.difficulty && (
                    <Badge
                      className="absolute bottom-1.5 left-2 border-transparent text-white shadow-2xs"
                      style={{ backgroundColor: getDifficultyColor(trail.difficulty) }}
                    >
                      {getDifficultyLabel(trail.difficulty)}
                    </Badge>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col gap-1.5 p-2.5">
                  <h4 className="font-display text-[length:var(--lkv-text-footnote)] font-bold leading-snug text-[color:var(--lkv-text-primary)] line-clamp-1">
                    {trail.name}
                  </h4>

                  {/* Metrics Row */}
                  <div className="flex items-center gap-2 font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                    <span className="flex items-center gap-0.5 font-semibold">
                      <Navigation size={9} className="text-[color:var(--lkv-primary)]" />
                      {formatDistance(trail.distance_km)}
                    </span>
                    <span aria-hidden="true" className="opacity-40">·</span>
                    <span className="flex items-center gap-0.5 text-[color:var(--lkv-text-muted)]">
                      <Clock size={9} />
                      {formatDuration(trail.duration_hours)}
                    </span>
                    {trail.elevation_gain != null && (
                      <>
                        <span aria-hidden="true" className="opacity-40">·</span>
                        <span className="flex items-center gap-0.5 font-bold text-[color:var(--lkv-text-primary)]">
                          <TrendingUp size={9} />+{Math.round(trail.elevation_gain)}m
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 border-t border-[color:var(--lkv-border)] pt-1.5">
                    <Link
                      href={`/preparer-sentier/${trail.id}`}
                      prefetch={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                      }}
                      className={LINK_PILL}
                    >
                      <span>Préparer</span>
                    </Link>

                    <IconButton
                      variant="glass"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        onOpenDetail(trail);
                      }}
                      title="Voir la fiche complète"
                      aria-label="Voir la fiche complète"
                    >
                      <FileText size={15} strokeWidth={2.2} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            );
          })}
          {/* Trailing safe spacer so last card is never clipped */}
          <div className="pointer-events-none h-1 w-4 shrink-0" aria-hidden="true" />
        </div>
      )}

      {/* ── MODE 2: VERTICAL EXPANDABLE LIST SHEET ── */}
      {viewMode === 'list' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="pointer-events-auto mx-3 flex max-h-[50vh] flex-col"
        >
          <Card variant="featured" className="flex max-h-[50vh] flex-col p-3">
            <div className="mb-1 flex items-center justify-between border-b border-[color:var(--lkv-border)] px-1 pb-2">
              <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
                Tous les sentiers ({trails.length})
              </span>
              <Button variant="secondary" size="sm" onClick={toggleViewMode} icon={<ChevronDown size={12} />}>
                Fermer
              </Button>
            </div>

            <div className="no-scrollbar flex flex-col gap-1.5 overflow-y-auto pr-0.5">
              {trails.map((trail) => (
                <ExplorerListCard
                  key={trail.id}
                  trail={trail}
                  isSelected={String(selectedTrailId) === String(trail.id)}
                  onClick={() => {
                    onSelectTrail(trail);
                    onOpenDetail(trail);
                  }}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
