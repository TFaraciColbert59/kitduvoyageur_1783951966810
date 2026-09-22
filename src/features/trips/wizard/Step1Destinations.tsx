'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { type SelectedCountry, CURATED_COUNTRIES, OTHER_COUNTRIES } from './wizardTypes';
import { Badge, Card, IconButton, ListItem, SearchField } from '@/components/ui';

interface Step1DestinationsProps {
  selectedCountries: SelectedCountry[];
  onChange: (countries: SelectedCountry[]) => void;
}

export function Step1Destinations({ selectedCountries, onChange }: Step1DestinationsProps) {
  const [search, setSearch] = useState('');

  const isSelected = (code: string) => selectedCountries.some((c) => c.code === code);

  const toggleCountry = (country: SelectedCountry) => {
    if (isSelected(country.code)) {
      // Ne retire que si plus d'un pays est sélectionné
      if (selectedCountries.length > 1) {
        onChange(selectedCountries.filter((c) => c.code !== country.code));
      }
    } else {
      onChange([...selectedCountries, country]);
    }
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...selectedCountries];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index >= selectedCountries.length - 1) return;
    const next = [...selectedCountries];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const removeCountry = (code: string) => {
    if (selectedCountries.length <= 1) return;
    onChange(selectedCountries.filter((c) => c.code !== code));
  };

  // Filtrage des autres pays pour recherche
  const allAvailable = [...CURATED_COUNTRIES, ...OTHER_COUNTRIES];
  const filteredCountries = search.trim()
    ? allAvailable.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
          <Icon name="map-pin" size={14} />
          <span>Étape 1 sur 5</span>
        </div>
        <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
          Où partez-vous à l&apos;aventure ?
        </h2>
        <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Choisissez un ou plusieurs pays. Le moteur de répartition distribuera vos journées de
          marche de manière cohérente.
        </p>
      </div>

      {/* Destinations phares curées (5 pays réels) */}
      <div>
        <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
          <Icon name="sparkles" size={14} className="text-[color:var(--lkv-secondary)]" />
          <span>Destinations phares (itinéraires réels sourcés)</span>
        </div>
        <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {CURATED_COUNTRIES.map((country) => {
            const active = isSelected(country.code);
            return (
              <Card
                key={country.code}
                variant="interactive"
                selected={active}
                onClick={() => toggleCountry(country)}
                className="flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-[var(--space-3)]">
                  <span aria-hidden="true" className="text-2xl">
                    {country.flag}
                  </span>
                  <div>
                    <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                      {country.name}
                    </div>
                    <div
                      className={`text-[11px] ${
                        active
                          ? 'text-[color:var(--sage-300)]'
                          : 'text-[color:var(--lkv-text-secondary)]'
                      }`}
                    >
                      Étapes GPS & refuges vérifiés
                    </div>
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[length:var(--lkv-text-caption-2)] font-bold ${
                    active
                      ? 'bg-white text-[color:var(--lkv-primary)]'
                      : 'border border-[color:var(--lkv-border-strong)] text-transparent'
                  }`}
                >
                  <Icon name="check" size={12} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Sélecteur de recherche d'autres destinations */}
      <div>
        <div className="mb-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
          Ajouter une autre destination
        </div>
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Rechercher un pays (ex: Norvège, Suisse, Japon...)"
          aria-label="Rechercher un pays"
        />

        {filteredCountries.length > 0 && (
          <Card className="mt-[var(--space-2)] max-h-48 space-y-[var(--space-1)] overflow-y-auto p-[var(--space-2)] shadow-elevation-2">
            {filteredCountries.map((c) => {
              const active = isSelected(c.code);
              return (
                <ListItem
                  key={c.code}
                  onClick={() => {
                    toggleCountry(c);
                    setSearch('');
                  }}
                  leading={<span aria-hidden="true">{c.flag}</span>}
                  title={c.name}
                  trailing={
                    active ? (
                      <Badge tone="sage">Sélectionné</Badge>
                    ) : (
                      <Icon name="plus" size={14} className="text-[color:var(--lkv-text-muted)]" />
                    )
                  }
                />
              );
            })}
          </Card>
        )}
      </div>

      {/* Liste des pays sélectionnés avec ordre modifiable */}
      <div className="pt-[var(--space-2)]">
        <div className="mb-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
          Itinéraire multi-destinations ({selectedCountries.length})
        </div>
        <ul className="space-y-[var(--space-2)]">
          {selectedCountries.map((country, idx) => (
            <li key={country.code}>
              <Card variant="compact" className="flex items-center justify-between">
                <div className="flex items-center gap-[var(--space-3)]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                    {idx + 1}
                  </span>
                  <span aria-hidden="true" className="text-xl">
                    {country.flag}
                  </span>
                  <span className="text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]">
                    {country.name}
                  </span>
                  {country.isCurated && (
                    <Badge tone="sage" className="hidden sm:inline-flex">
                      Curé
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-[var(--space-1)]">
                  {selectedCountries.length > 1 && (
                    <>
                      <IconButton
                        type="button"
                        size="sm"
                        disabled={idx === 0}
                        onClick={() => moveUp(idx)}
                        aria-label="Monter ce pays"
                      >
                        <Icon name="arrow-up" size={14} />
                      </IconButton>
                      <IconButton
                        type="button"
                        size="sm"
                        disabled={idx === selectedCountries.length - 1}
                        onClick={() => moveDown(idx)}
                        aria-label="Descendre ce pays"
                      >
                        <Icon name="arrow-down" size={14} />
                      </IconButton>
                      <IconButton
                        type="button"
                        size="sm"
                        onClick={() => removeCountry(country.code)}
                        aria-label="Retirer ce pays"
                      >
                        <Icon name="trash2" size={14} />
                      </IconButton>
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
