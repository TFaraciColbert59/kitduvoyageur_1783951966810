import React from 'react';
import type { Country } from '@/lib/countries';

export default function CountryHeader({ country }: { country: Country }) {
  const flag = country.code ? country.code.toUpperCase().replace(/([A-Z])/g, (c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)) : '';
  return (
    <header className="card fade-in" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '2.5rem' }}>{flag}</span>
      <div>
        <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--color-primary)' }}>{country.nom}</h1>
        <p style={{ margin: 0, color: 'var(--color-text)' }}>{country.capital} – {country.continent}</p>
      </div>
    </header>
  );
}
