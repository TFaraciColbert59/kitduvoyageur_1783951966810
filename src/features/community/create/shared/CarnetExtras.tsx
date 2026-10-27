'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Plus, Mountain, Camera, Utensils, Tent, MapPin, Footprints, Bike, Waves, ChevronDown, ImagePlus } from 'lucide-react';
import './carnet-extras.css';

function dayCount(start: string, end: string): number {
  if (!start || !end) return 1;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.min(14, Math.max(1, Math.round((b - a) / 86_400_000) + 1));
}

export function CarnetCoverBoard({
  cover,
  onAddCover,
}: {
  cover: Array<{ previewUrl?: string; url?: string | null; alt?: string }>;
  onAddCover: () => void;
}) {
  const [secondary, setSecondary] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const item = cover[0];
  const src = item?.previewUrl || item?.url || '';
  const addSecondary = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setSecondary((current) => [...current, ...urls]);
  };
  return (
    <div className="lkdv-cover-board">
      <button type="button" className="lkdv-cover-hero" onClick={onAddCover} aria-label="Ajouter une couverture">
        {src ? <img src={src} alt={item?.alt || 'Couverture du carnet'} /> : <span className="lkdv-cover-plus"><Plus size={20} aria-hidden="true" /></span>}
      </button>
      <div className="lkdv-cover-strip" aria-label="Photos secondaires">
        <button type="button" className="lkdv-cover-thumb lkdv-cover-thumb-add" onClick={() => inputRef.current?.click()} aria-label="Ajouter une photo secondaire">
          <ImagePlus size={15} aria-hidden="true" />
        </button>
        <input ref={inputRef} type="file" accept="image/*,image/gif" multiple className="sr-only" onChange={(event) => { addSecondary(event.currentTarget.files); event.currentTarget.value = ''; }} />
        {secondary.map((url, index) => (
          <span key={url} className="lkdv-cover-thumb"><img src={url} alt={`Photo secondaire ${index + 1}`} /></span>
        ))}
      </div>
    </div>
  );
}

export function CarnetGpxBlock() {
  const [name, setName] = useState('');
  const [activity, setActivity] = useState('rando');
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="lkdv-gpx-block">
      <button type="button" className="lkdv-gpx-add" onClick={() => inputRef.current?.click()} aria-label="Ajouter un GPX ou une activité">
        <MapPin size={15} aria-hidden="true" />
        <span>{name ? 'Trace ajoutée' : 'GPX / activité'}</span>
        <Plus size={14} aria-hidden="true" />
      </button>
      <input ref={inputRef} type="file" accept=".gpx,application/gpx+xml" className="sr-only" onChange={(event) => { setName(event.currentTarget.files?.[0]?.name || 'Trace'); event.currentTarget.value = ''; }} />
      <select value={activity} onChange={(event) => setActivity(event.target.value)} aria-label="Activité effectuée">
        <option value="rando">Randonnée</option>
        <option value="bivouac">Bivouac</option>
        <option value="velo">Vélo</option>
        <option value="alpinisme">Alpinisme</option>
        <option value="eau">Eau</option>
      </select>
    </div>
  );
}

const KINDS = [
  { id: 'rando', label: 'Randonnée', icon: Mountain },
  { id: 'photo', label: 'Prise de vue', icon: Camera },
  { id: 'resto', label: 'Resto', icon: Utensils },
  { id: 'bivouac', label: 'Bivouac', icon: Tent },
  { id: 'velo', label: 'Vélo', icon: Bike },
  { id: 'eau', label: 'Eau', icon: Waves },
  { id: 'sommet', label: 'Sommet', icon: Footprints },
];

type DayEvent = { id: string; kind: string; label: string; emoji: string };

export function CarnetDays({ startDate, endDate }: { startDate: string; endDate: string }) {
  const count = useMemo(() => dayCount(startDate, endDate), [startDate, endDate]);
  const [events, setEvents] = useState<Record<number, DayEvent[]>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true });
  const add = (day: number, kind: string, label: string) => {
    const event: DayEvent = { id: crypto.randomUUID(), kind, label, emoji: '•' };
    setEvents((current) => ({ ...current, [day]: [...(current[day] || []), event] }));
  };
  const all = Object.values(events).flat();
  return (
    <section className="lkdv-carnet-days" aria-label="Journées du carnet">
      <div className="lkdv-days-timeline" aria-hidden="true">
        <span className="lkdv-days-line" />
        {Array.from({ length: count }).map((_, index) => <i key={index} className="lkdv-days-day-dot" />)}
        {all.map((event) => <i key={event.id} className="lkdv-days-event-dot" data-kind={event.kind} />)}
      </div>
      {Array.from({ length: count }).map((_, index) => {
        const day = index + 1;
        const list = events[day] || [];
        return (
          <details key={day} className="lkdv-day" open={open[day]} onToggle={(event) => { const target = event.target as HTMLDetailsElement; setOpen((current) => ({ ...current, [day]: Boolean(target?.open) })); }}>
            <summary>
              <span>Jour {day}</span>
              <small>{list.length > 0 ? `${list.length} moment${list.length > 1 ? 's' : ''}` : 'Ajouter un moment'}</small>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="lkdv-day-kinds">
              {KINDS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => add(day, id, label)}><Icon size={12} aria-hidden="true" />{label}</button>
              ))}
            </div>
            {list.length > 0 ? (
              <ul className="lkdv-day-events">
                {list.map((event) => (
                  <li key={event.id}>
                    <span className="lkdv-day-event-kind">{event.label}</span>
                    <button type="button" className="lkdv-day-photo" aria-label={`Photo pour ${event.label}`}>{event.emoji}</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        );
      })}
    </section>
  );
}
