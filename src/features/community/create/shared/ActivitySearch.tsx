'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import './activity-search.css';

const SUGGESTIONS = [
  'Randonnée', 'Bivouac', 'Alpinisme', 'Ski', 'Vélo', 'Eau', 'Trail',
  'Resto', 'Prise de vue', 'Sommet', 'Refuge', 'Plage', 'Marché', 'Musée',
];

export function ActivitySearch({
  value,
  onChange,
  placeholder = 'Activité libre…',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUGGESTIONS.slice(0, 8);
    return SUGGESTIONS.filter((item) => item.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);
  return (
    <div className="lkdv-activity-search">
      <div className="lkdv-activity-input">
        <Search size={13} aria-hidden="true" />
        <input
          value={query}
          placeholder={placeholder}
          aria-label="Activité"
          onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        />
      </div>
      {open && filtered.length > 0 ? (
        <div className="lkdv-activity-suggestions">
          {filtered.map((item) => (
            <button key={item} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(item); onChange(item); setOpen(false); }}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
