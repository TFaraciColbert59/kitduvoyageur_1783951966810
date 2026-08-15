"use client";

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllCountries } from '@/lib/countries';
import CountryHeader from '@/components/pays/CountryHeader';

const CountryGlobe = dynamic(
  () => import('@/components/pays/CountryGlobe'),
  { ssr: false }
);

const ALL_COUNTRIES = getAllCountries();

function getDangerLabel(level: string): string {
  return level === 'low' ? '🟢 Sûr' : level === 'medium' ? '🟡 Vigilance' : '🔴 Risqué';
}

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const country = useMemo(
    () => ALL_COUNTRIES.find((c) => c.code.toLowerCase() === code.toLowerCase()),
    [code]
  );

  if (!country) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#17402C' }}>Destination introuvable</h1>
        <p style={{ margin: 0, color: '#1C2620' }}>Ce pays ne fait pas encore partie de l&apos;atlas Le Kit du Voyageur.</p>
        <Link href="/pays" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0 1.25rem', borderRadius: '0.75rem', background: '#17402C', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
          ← Retour à l&apos;atlas
        </Link>
      </div>
    );
  }

  const stats = [
    { label: 'Capitale', value: country.capital },
    { label: 'Continent', value: country.continent },
    { label: 'Meilleure saison', value: country.meilleure_saison },
    { label: 'Monnaie', value: country.monnaie },
    { label: 'Sécurité', value: getDangerLabel(country.danger_level) },
  ];

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#F5F3EE', color: '#1C2620', fontFamily: 'sans-serif' }}>
      <main style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', padding: 'calc(10px + env(safe-area-inset-top)) 1rem 2rem' }}>
        <Link
          href="/pays"
          aria-label="Retour à l'atlas"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minHeight: '44px', padding: '0 0.75rem', borderRadius: '0.75rem', color: '#17402C', fontWeight: 600, textDecoration: 'none' }}
        >
          ← Atlas des pays
        </Link>

        <CountryHeader country={country} />

        <div style={{ marginTop: '1rem', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(23,64,44,0.15)', background: '#0B1F17', minHeight: '320px', aspectRatio: '16 / 10' }}>
          <CountryGlobe
            countries={ALL_COUNTRIES}
            onCountryClick={() => {}}
            focusCode={country.code}
            fullscreen={false}
          />
        </div>

        <section style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: '#FBFAF6', border: '1px solid rgba(23,64,44,0.12)', borderRadius: '0.75rem', padding: '0.875rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2D6A4F' }}>{s.label}</div>
              <div style={{ marginTop: '0.25rem', fontWeight: 600, color: '#17402C' }}>{s.value}</div>
            </div>
          ))}
        </section>

        <section style={{ marginTop: '1.25rem', background: '#FBFAF6', border: '1px solid rgba(23,64,44,0.12)', borderRadius: '1rem', padding: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#17402C' }}>Activités &amp; expériences</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
            {country.tags.map((tag) => (
              <span key={tag} style={{ background: '#A8C8A0', color: '#0B1F17', borderRadius: '999px', padding: '0.375rem 0.75rem', fontSize: '0.875rem', fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}