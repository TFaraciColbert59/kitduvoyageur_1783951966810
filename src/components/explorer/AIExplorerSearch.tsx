'use client';

import React, { useState, useRef, useEffect } from 'react';

interface AIExplorerSearchProps {
  onSearch?: (query: string) => void;
}

const SUGGESTIONS = [
  'Une randonnée facile en famille',
  'Un trek montagne avec refuge',
  'Une aventure proche de moi',
  'Les plus beaux panoramas de France',
  'Un parcours de 3 jours en Corse',
];

export default function AIExplorerSearch({ onSearch }: AIExplorerSearchProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
    setFocused(false);
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    setFocused(false);
    if (onSearch) onSearch(s);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!focused) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion((p) => Math.min(p + 1, SUGGESTIONS.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion((p) => Math.max(p - 1, -1));
      } else if (e.key === 'Enter' && activeSuggestion >= 0) {
        e.preventDefault();
        handleSuggestion(SUGGESTIONS[activeSuggestion]);
      } else if (e.key === 'Escape') {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, activeSuggestion]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div
          className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
            focused
              ? 'bg-[#1a2820]/95 border-[#E4501C]/60 shadow-lg shadow-[#E4501C]/10'
              : 'bg-[#1a2820]/80 border-white/10 hover:border-white/20'
          }`}
        >
          {/* AI spark icon */}
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#E4501C]/15 border border-[#E4501C]/30 flex items-center justify-center">
            <span className="text-sm">✨</span>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Quelle aventure recherches-tu ?"
            className="flex-1 bg-transparent text-white placeholder-white/30 text-sm focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#E4501C] flex items-center justify-center hover:bg-[#cc3d10] transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {focused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#141e1a]/98 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 backdrop-blur-md">
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Suggestions</p>
          </div>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              onMouseDown={() => handleSuggestion(s)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                activeSuggestion === i ? 'bg-white/8 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-[#E4501C]/60 text-xs">→</span>
              <span className="text-sm">{s}</span>
            </button>
          ))}
          <div className="px-4 py-2.5 border-t border-white/5">
            <p className="text-[10px] text-white/20 font-mono">
              ✨ Recherche IA — Bientôt disponible
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
