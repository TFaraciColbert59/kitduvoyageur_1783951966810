'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function useScrollCollapsePreview(active: boolean, disabled = false) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (disabled) {
      setCollapsed(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!active || disabled) return undefined;
    let expandTimer: number | null = null;
    let lockUntil = 0;

    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        !target.classList?.contains('lkdv-cv2-pane') &&
        !target.classList?.contains('lkdv-lens-pane') &&
        !target.classList?.contains('lkdv-cv2c-ps-scroll')
      ) {
        return;
      }
      const now = Date.now();
      const top = target.scrollTop;
      const overflow = target.scrollHeight - target.clientHeight;
      if (top > 20 && overflow > 48) {
        if (expandTimer !== null) {
          window.clearTimeout(expandTimer);
          expandTimer = null;
        }
        setCollapsed((prev) => {
          if (!prev) lockUntil = now + 650;
          return true;
        });
      } else if (top <= 4 && now >= lockUntil) {
        if (expandTimer === null) {
          expandTimer = window.setTimeout(() => {
            expandTimer = null;
            setCollapsed(false);
          }, 200);
        }
      }
    };

    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      if (expandTimer !== null) window.clearTimeout(expandTimer);
    };
  }, [active, disabled]);

  return [collapsed, setCollapsed] as const;
}

export interface CollapsibleHeroPreviewProps {
  collapsed: boolean;
  onExpand: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  avatarUrl?: string | null;
  fallbackText?: string;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

const SMOOTH_TRANSITION = {
  duration: 0.82,
  ease: [0.22, 0.61, 0.36, 1] as const,
};

export function CollapsibleHeroPreview({
  collapsed,
  onExpand,
  title,
  subtitle,
  badge,
  avatarUrl,
  fallbackText = '•',
  children,
  className = '',
  testId,
}: CollapsibleHeroPreviewProps) {
  return (
    <motion.div
      className={`lkdv-cv2c-post-hero-preview ${collapsed ? 'is-collapsed' : ''} ${className}`.trim()}
      data-testid={testId}
      initial={false}
      animate={{ height: collapsed ? 35 : 'auto' }}
      transition={SMOOTH_TRANSITION}
    >
      <motion.div
        className="lkdv-post-collapsed-slot"
        aria-hidden={!collapsed}
        initial={false}
        animate={{
          opacity: collapsed ? 1 : 0,
          y: collapsed ? 0 : -4,
        }}
        transition={SMOOTH_TRANSITION}
        style={{ pointerEvents: collapsed ? 'auto' : 'none' }}
      >
        <button
          type="button"
          className="lkdv-post-collapsed-pill"
          onClick={onExpand}
          tabIndex={collapsed ? 0 : -1}
          aria-label={`Déplier l’aperçu : ${title}`}
        >
          <span className="lkdv-post-collapsed-av">
            {badge ? (
              badge
            ) : avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- miniature
              <img src={avatarUrl} alt="" />
            ) : (
              fallbackText.slice(0, 1)
            )}
          </span>
          <span className="lkdv-post-collapsed-txt">
            <b>{title}</b>
            {subtitle ? <small>{subtitle}</small> : null}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </motion.div>

      <motion.div
        className="lkdv-post-expanded-slot"
        aria-hidden={collapsed}
        initial={false}
        animate={{
          opacity: collapsed ? 0 : 1,
          y: collapsed ? -6 : 0,
          scale: collapsed ? 0.99 : 1,
        }}
        transition={SMOOTH_TRANSITION}
        style={{ pointerEvents: collapsed ? 'none' : 'auto' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
