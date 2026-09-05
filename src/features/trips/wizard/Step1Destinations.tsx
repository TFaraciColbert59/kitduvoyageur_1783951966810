'use client';

import React, { useState } from 'react';
import {
  type SelectedCountry,
  CURATED_COUNTRIES,
  OTHER_COUNTRIES,
} from './wizardTypes';
import {
  MapPin,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Check,
  Sparkles,
  Search,
} from 'lucide-react';

interface Step1DestinationsProps {
  selectedCountries: SelectedCountry[];
  onChange: (countries: SelectedCountry[]) => void;
}

export function Step1Destinations({
  selectedCountries,
  onChange,
}: Step1DestinationsProps) {
  const [search, setSearch] = useState('');

  const isSelected = (code: string) =>
    selectedCountries.some((c) => c.code === code);

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
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5B7F55] mb-1">
          <MapPin size={14} />
          <span>Étape 1 sur 5</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#17402C]">
          Où partez-vous à l&apos;aventure ?
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Choisissez un ou plusieurs pays. Le moteur de répartition distribuera vos journées de marche de manière cohérente.
        </p>
      </div>

      {/* Destinations phares curées (5 pays réels) */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#17402C] mb-3">
          <Sparkles size={14} className="text-[#5B7F55]" />
          <span>Destinations phares (itinéraires réels sourcés)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CURATED_COUNTRIES.map((country) => {
            const active = isSelected(country.code);
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => toggleCountry(country)}
                className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border text-left transition-all min-h-[56px] ${
                  active
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-md'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-black/5 hover:border-black/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{country.flag}</span>
                  <div>
                    <div className="text-sm font-semibold">{country.name}</div>
                    <div
                      className={`text-[11px] ${
                        active ? 'text-[#A6C1A0]' : 'text-[#5B7F55]'
                      }`}
                    >
                      Étapes GPS & refuges vérifiés
                    </div>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    active
                      ? 'bg-white text-[#17402C]'
                      : 'border border-black/20 text-transparent'
                  }`}
                >
                  <Check size={12} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sélecteur de recherche d'autres destinations */}
      <div>
        <div className="text-xs font-semibold text-[#17402C] mb-2">
          Ajouter une autre destination
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un pays (ex: Norvège, Suisse, Japon...)"
            className="w-full pl-10 pr-4 py-3 bg-white/90 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#17402C] text-[#17402C]"
          />
        </div>

        {filteredCountries.length > 0 && (
          <div className="mt-2 p-2 bg-white rounded-xl border border-black/10 shadow-lg space-y-1 max-h-48 overflow-y-auto">
            {filteredCountries.map((c) => {
              const active = isSelected(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    toggleCountry(c);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors min-h-[44px] ${
                    active ? 'bg-emerald-50 text-[#17402C] font-semibold' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                  </span>
                  {active ? (
                    <span className="text-[11px] text-[#5B7F55]">Sélectionné</span>
                  ) : (
                    <Plus size={14} className="text-gray-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Liste des pays sélectionnés avec ordre modifiable */}
      <div className="pt-2">
        <div className="text-xs font-semibold text-[#17402C] uppercase tracking-wider mb-2">
          Itinéraire multi-destinations ({selectedCountries.length})
        </div>
        <div className="space-y-2">
          {selectedCountries.map((country, idx) => (
            <div
              key={country.code}
              className="flex items-center justify-between p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-black/5"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#FAF8F5] border border-black/10 text-xs font-bold text-[#17402C] flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-xl">{country.flag}</span>
                <span className="text-sm font-medium text-[#17402C]">
                  {country.name}
                </span>
                {country.isCurated && (
                  <span className="text-[10px] bg-emerald-100/80 text-[#17402C] px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                    Curé
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {selectedCountries.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveUp(idx)}
                      aria-label="Monter ce pays"
                      className="p-2 rounded-lg text-gray-500 hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent min-w-[36px] min-h-[36px] flex items-center justify-center"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === selectedCountries.length - 1}
                      onClick={() => moveDown(idx)}
                      aria-label="Descendre ce pays"
                      className="p-2 rounded-lg text-gray-500 hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent min-w-[36px] min-h-[36px] flex items-center justify-center"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCountry(country.code)}
                      aria-label="Retirer ce pays"
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
