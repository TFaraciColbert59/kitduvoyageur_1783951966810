'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon as ChevronLeftAnimated } from '@/components/icons/chevron-left';
import { SearchIcon as SearchAnimated } from '@/components/icons/search';
import { XIcon as XAnimated } from '@/components/icons/x';
import type { Country } from '@/lib/countries';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface EarthMobileHeaderProps {
  countries: Country[];
  onSelect: (country: Country) => void;
}

function flagEmoji(code: string): string {
  const cps = code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cps);
}

export default function EarthMobileHeader({ countries, onSelect }: EarthMobileHeaderProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter(
        (c) =>
          c.nom.toLowerCase().includes(q) ||
          c.capital.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [query, countries]);

  const handleSelect = useCallback(
    (c: Country) => {
      triggerHaptic('light');
      setQuery('');
      setFocused(false);
      inputRef.current?.blur();
      onSelect(c);
    },
    [onSelect, triggerHaptic]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  return (
    <header
      className="absolute left-3.5 right-3.5 z-[900] pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
    >
      <div
        className="glass bg-white/90 backdrop-blur-xl border border-white/90 w-full rounded-full px-2.5 py-1 flex items-center gap-2 pointer-events-auto shadow-sm"
        style={{ borderRadius: 9999 }}
      >
        {/* Retour */}
        <Link
          href="/"
          onClick={() => triggerHaptic('light')}
          aria-label="Retour à l'accueil"
          className="w-8.5 h-8.5 rounded-full bg-white/80 hover:bg-white text-[#17402C] border border-white/80 flex-shrink-0 flex items-center justify-center font-bold shadow-2xs transition-all active:scale-95"
        >
          <ChevronLeftAnimated size={18} />
        </Link>

        {/* Recherche */}
        <div className="relative flex-1 min-w-0">
          <SearchAnimated size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A7064]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Explorer un pays, massif, capitale…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="w-full !min-h-9 h-9 pl-8 pr-7 rounded-full text-[12px] font-semibold bg-white/70 border border-white/80 text-[#17402C] placeholder-[#5C6B5E] focus:outline-none focus:ring-1 focus:ring-[#17402C]/40 shadow-2xs"
            aria-label="Rechercher un pays"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A7064] hover:text-[#17402C]"
            >
              <XAnimated size={13} />
            </button>
          )}

          {/* Suggestions */}
          <AnimatePresence>
            {focused && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
                transition={{ duration: 0.14 }}
                className="absolute left-0 right-0 top-full mt-2 glass bg-white/95 backdrop-blur-2xl rounded-2xl border border-white shadow-xl overflow-hidden py-1 z-[950]"
              >
                {suggestions.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onMouseDown={() => handleSelect(c)}
                    className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-[#17402C]/5 text-left transition-colors cursor-pointer"
                  >
                    <span className="text-2xl leading-none">{flagEmoji(c.code)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#17402C] truncate">{c.nom}</p>
                      <p className="text-[10px] text-[#5A7064] truncate">
                        {c.capital} · {c.continent}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Légende du Globe : code couleur sécurité */}
      <div className="flex justify-center mt-2 pointer-events-auto">
        <div
          className="glass-pill flex items-center gap-2 px-3 py-1 bg-white/80 backdrop-blur-md border border-white/90 text-[10.5px] font-bold text-[#17402C] shadow-2xs"
          style={{ borderRadius: 999 }}
        >
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B7F55]" />
            Sûr
          </span>
          <span className="text-black/20">·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C89A3B]" />
            Vigilance
          </span>
          <span className="text-black/20">·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A8443A]" />
            Risqué
          </span>
        </div>
      </div>
    </header>
  );
}