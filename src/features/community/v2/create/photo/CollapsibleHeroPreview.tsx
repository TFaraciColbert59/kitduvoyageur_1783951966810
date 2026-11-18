'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function useScrollCollapsePreview(active: boolean, disabled = false) {
  const [collapsed, setCollapsedState] = useState(false);
  const collapsedRef = useRef(false);
  const lockUntilRef = useRef(0);
  const lastTopRef = useRef(0);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (next !== prev) {
        collapsedRef.current = next;
        lockUntilRef.current = Date.now() + 550;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (disabled) {
      collapsedRef.current = false;
      setCollapsedState(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!active || disabled) return undefined;

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
      const prevTop = lastTopRef.current;
      lastTopRef.current = top;

      if (now < lockUntilRef.current) return;

      const overflow = target.scrollHeight - target.clientHeight;
      if (!collapsedRef.current && top > 24 && top >= prevTop && overflow > 24) {
        collapsedRef.current = true;
        lockUntilRef.current = now + 700;
        setCollapsedState(true);
      } else if (collapsedRef.current && top <= 1 && prevTop > 6 && top < prevTop) {
        collapsedRef.current = false;
        lockUntilRef.current = now + 500;
        setCollapsedState(false);
      }
    };

    const onPreviewVerticalDrag = (event: Event) => {
      const detail = (
        event as CustomEvent<{ dy?: number; totalDy?: number; scrollTop?: number }>
      ).detail;
      if (!detail) return;
      const now = Date.now();
      if (now < lockUntilRef.current) return;
      const totalDy = detail.totalDy ?? 0;
      const scrollTop = detail.scrollTop ?? 0;
      if (!collapsedRef.current && totalDy > 24) {
        collapsedRef.current = true;
        lockUntilRef.current = now + 650;
        setCollapsedState(true);
      } else if (collapsedRef.current && totalDy < -28 && scrollTop <= 2) {
        collapsedRef.current = false;
        lockUntilRef.current = now + 500;
        setCollapsedState(false);
      }
    };

    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('lkdv-preview-vertical-drag', onPreviewVerticalDrag);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('lkdv-preview-vertical-drag', onPreviewVerticalDrag);
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
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
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
