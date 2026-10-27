'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Mountain, Camera, Utensils, Tent, MapPin, Footprints, Bike, Waves, ChevronDown, ImagePlus } from 'lucide-react';
import './carnet-extras.css';
import { ActivitySearch } from './ActivitySearch';

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
  const secondaryRef = useRef<string[]>([]);
  useEffect(() => { secondaryRef.current = secondary; }, [secondary]);
  useEffect(() => () => { secondaryRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
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
        {src ? <img src={src} alt={item?.alt || 'Couverture du carnet'} loading="lazy" decoding="async" /> : <span className="lkdv-cover-plus"><Plus size={20} aria-hidden="true" /></span>}
      </button>
      <div className="lkdv-cover-strip" aria-label="Photos secondaires">
        <button type="button" className="lkdv-cover-thumb lkdv-cover-thumb-add" onClick={() => inputRef.current?.click()} aria-label="Ajouter une photo secondaire">
          <ImagePlus size={15} aria-hidden="true" />
        </button>
        <input ref={inputRef} type="file" accept="image/*,image/gif" multiple className="sr-only" onChange={(event) => { addSecondary(event.currentTarget.files); event.currentTarget.value = ''; }} />
        {secondary.map((url, index) => (
          <span key={url} className="lkdv-cover-thumb"><img src={url} alt={`Photo secondaire ${index + 1}`} loading="lazy" decoding="async" /></span>
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
      <ActivitySearch value={activity} onChange={setActivity} placeholder="Activité effectuée…" />
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

type DayEvent = { id: string; kind: string; label: string; emoji: string; media?: string };

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
                    <label className="lkdv-day-photo" aria-label={`Ajouter une image ou vidéo pour ${event.label}`}>
                      {event.media ? <img src={event.media} alt="" loading="lazy" decoding="async" /> : <Plus size={12} aria-hidden="true" />}
                      <input type="file" accept="image/*,video/*,image/gif" className="sr-only" onChange={(input) => {
                        const file = input.currentTarget.files?.[0];
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        setEvents((current) => ({ ...current, [day]: (current[day] || []).map((entry) => entry.id === event.id ? { ...entry, media: url } : entry) }));
                        input.currentTarget.value = '';
                      }} />
                    </label>
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

export function TraceCanvas() {
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [drawing, setDrawing] = useState(false);
  const addPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPoints((current) => [...current, { x: Math.round(((event.clientX - rect.left) / rect.width) * 300), y: Math.round(((event.clientY - rect.top) / rect.height) * 150) }]);
  };
  return (
    <div
      className="lkdv-trace-canvas"
      role="img"
      aria-label="Dessiner le tracé du carnet"
      onPointerDown={(event) => { setDrawing(true); setPoints([]); addPoint(event); event.currentTarget.setPointerCapture?.(event.pointerId); }}
      onPointerMove={(event) => { if (drawing) addPoint(event); }}
      onPointerUp={() => setDrawing(false)}
      onPointerCancel={() => setDrawing(false)}
    >
      <svg viewBox="0 0 300 150" aria-hidden="true">
        <path d="M20 115 C70 90 95 30 150 55 S240 110 280 40" fill="none" stroke="rgba(23,64,44,.18)" strokeWidth="1" strokeDasharray="3 4" />
        {points.length > 1 ? <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#17402C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
      <span>{points.length > 0 ? 'Tracé dessiné' : 'Dessine le tracé'}</span>
    </div>
  );
}
