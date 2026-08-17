import React from "react";

interface MobileFilterBarProps {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
}

const filters = ["Tendance", "Populaires", "Sauvage", "Proche"] as const;

export default function MobileFilterBar({ activeFilter, setActiveFilter }: MobileFilterBarProps) {
  return (
    <div className="mobile-filter-bar flex gap-2 overflow-x-auto pb-2">
      {filters.map((f) => (
        <button
          key={f}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${activeFilter === f ? "bg-var(--lkv-sage-300) text-var(--lkv-ink-900)" : "bg-var(--lkv-ink-200) text-var(--lkv-ink-700)"}`}
          onClick={() => setActiveFilter(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
