'use client';

import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface IOSRowItem {
  id: string;
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  detail?: string;
  showChevron?: boolean;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onClick?: () => void;
}

interface IOSInsetGroupedListProps {
  header?: string;
  footer?: string;
  items: IOSRowItem[];
  className?: string;
}

export default function IOSInsetGroupedList({
  header,
  footer,
  items,
  className = '',
}: IOSInsetGroupedListProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className={`space-y-1.5 my-3 ${className}`}>
      {header && (
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#5A7064] font-bold px-4 block">
          {header}
        </span>
      )}

      <div className="rounded-[24px] bg-white/90 backdrop-blur-xl border border-white/80 shadow-xs overflow-hidden divide-y divide-[#17402C]/06">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              if (item.onClick) {
                triggerHaptic('light');
                item.onClick();
              }
            }}
            className={`min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 select-none ${
              item.onClick ? 'cursor-pointer active:bg-black/[0.03] transition-colors' : ''
            }`}
          >
            {/* Left: Icon & Label */}
            <div className="flex items-center gap-3 min-w-0">
              {item.icon && (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: item.iconBg || '#17402C' }}
                >
                  {item.icon}
                </div>
              )}
              <span className="text-xs sm:text-sm font-semibold text-[#17402C] truncate">
                {item.title}
              </span>
            </div>

            {/* Right: Value, Toggle or Chevron */}
            <div className="flex items-center gap-2 shrink-0">
              {item.detail && (
                <span className="text-xs text-[#5A7064] font-medium">{item.detail}</span>
              )}

              {item.isToggle && (
                <button
                  type="button"
                  aria-pressed={item.toggleValue}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('selection');
                    item.onToggle?.(!item.toggleValue);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    item.toggleValue ? 'bg-[#17402C]' : 'bg-[#C8C3B0]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                      item.toggleValue ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}

              {item.showChevron && !item.isToggle && (
                <span className="text-[#5A7064]/50 font-bold text-xs">›</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {footer && (
        <span className="text-[10px] text-[#5A7064] px-4 block leading-tight">
          {footer}
        </span>
      )}
    </div>
  );
}
