'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface TabOption {
  id: string;
  label: string;
  icon?: React.ReactNode | string;
  badge?: number | string;
}

interface ScrollableTabsProps {
  tabs: TabOption[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  className?: string;
  variant?: 'pill' | 'underline' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  layoutIdPrefix?: string;
}

export default function ScrollableTabs({
  tabs,
  activeTab,
  onSelectTab,
  className = '',
  variant = 'glass',
  size = 'md',
  layoutIdPrefix = 'scrollable-tab',
}: ScrollableTabsProps) {
  const { triggerHaptic } = useHapticFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  // Check if content overflows to show right fade indicator
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkOverflow = () => {
      const isOverflowing = el.scrollWidth > el.clientWidth + 4;
      const isScrolledToEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      setShowRightFade(isOverflowing && !isScrolledToEnd);
    };

    checkOverflow();
    el.addEventListener('scroll', checkOverflow, { passive: true });
    window.addEventListener('resize', checkOverflow);

    return () => {
      el.removeEventListener('scroll', checkOverflow);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [tabs]);

  // Auto-scroll to center active tab
  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  const sizeClasses = {
    sm: 'h-7 text-[11px] px-2.5 gap-1',
    md: 'h-8.5 text-xs px-3.5 gap-1.5',
    lg: 'h-10 text-sm px-4 gap-2',
  }[size];

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 px-1"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x proximity',
          scrollPaddingLeft: '8px',
          scrollPaddingRight: '28px',
          maskImage: showRightFade
            ? 'linear-gradient(to right, black 85%, transparent 100%)'
            : undefined,
          WebkitMaskImage: showRightFade
            ? 'linear-gradient(to right, black 85%, transparent 100%)'
            : undefined,
        }}
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onSelectTab(tab.id);
              }}
              className={`snap-start shrink-0 relative flex items-center justify-center font-bold whitespace-nowrap rounded-xl transition-all cursor-pointer select-none ${sizeClasses} ${
                isSelected
                  ? 'text-white'
                  : 'text-[#17402C]/70 hover:text-[#17402C] hover:bg-white/40'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId={`${layoutIdPrefix}-active`}
                  className="absolute inset-0 rounded-xl bg-[#17402C] shadow-xs -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span className="relative z-10">{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#17402C]/10 text-[#17402C]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Trailing safe space spacer */}
        <div className="shrink-0 w-4 h-1 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}
