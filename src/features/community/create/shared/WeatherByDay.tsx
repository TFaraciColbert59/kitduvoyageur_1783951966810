'use client';

import React, { useEffect, useMemo, useState } from 'react';
import './weather-by-day.css';

const WEATHER = ['Ensoleillé', 'Nuageux', 'Pluie', 'Orage', 'Neige', 'Vent', 'Brouillard', 'Chaud', 'Froid'];

function dayCount(start: string, end: string): number {
  if (!start || !end) return 1;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.min(14, Math.max(1, Math.round((b - a) / 86_400_000) + 1));
}

function parse(value: string, count: number): string[] {
  const parts = value.split('·').map((part) => part.replace(/^J\d+\s*/i, '').trim()).filter(Boolean);
  return Array.from({ length: count }, (_, index) => parts[index] ?? '');
}

/** Météo modifiable jour par jour ; sérialisée dans `weather` pour rester persistée. */
export function WeatherByDay({
  startDate,
  endDate,
  value,
  onChange,
}: {
  startDate: string;
  endDate: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const count = useMemo(() => dayCount(startDate, endDate), [startDate, endDate]);
  const [days, setDays] = useState<string[]>(() => parse(value, count));

  useEffect(() => {
    setDays((previous) => Array.from({ length: count }, (_, index) => previous[index] ?? ''));
  }, [count]);

  useEffect(() => {
    setDays(parse(value, count));
  }, [value, count]);

  const update = (index: number, next: string) => {
    const updated = days.map((day, i) => (i === index ? next : day));
    setDays(updated);
    onChange(updated.map((day, i) => `J${i + 1} ${day || '—'}`).join(' · '));
  };

  return (
    <div className="lkdv-weather-days">
      <span className="lkdv-form-label">Météo par jour</span>
      <div className="lkdv-weather-grid">
        {days.map((day, index) => (
          <label key={index} className="lkdv-weather-day">
            <span>Jour {index + 1}</span>
            <select value={day} onChange={(event) => update(index, event.target.value)} aria-label={`Météo jour ${index + 1}`}>
              <option value="">—</option>
              {WEATHER.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

export default WeatherByDay;
