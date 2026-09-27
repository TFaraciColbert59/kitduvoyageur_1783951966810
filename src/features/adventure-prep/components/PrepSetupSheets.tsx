'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip, SearchField, Switch } from '@/components/ui';
import { A_VERIFIER } from '../engine/trust';
import { bookWeightLabel, gearSummary } from '../engine/labels';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  AdventurePrepDraft,
  BudgetLevel,
  Pace,
  PlaceRef,
  TransportPreference,
} from '../types';
import { MEAL_SLOT_LABELS } from '../types';
import { buildGearNeeds, gearGaps, packWeight } from '../engine/gear';
import { mealNeeds, uncoveredMeals, waterNeeds } from '../engine/consumables';
import { geocodeMessage, useGeocode } from '../hooks/useGeocode';
import { placeCandidates, type PlaceCandidate } from '../placeCandidates';

export interface PrepSheetProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
  onClose: () => void;
}

const BUDGET_LEVELS: readonly { id: BudgetLevel; label: string }[] = [
  { id: 'economique', label: 'Économe' },
  { id: 'modere', label: 'Modéré' },
  { id: 'confort', label: 'Confort' },
];

const PACES: readonly { id: Pace; label: string }[] = [
  { id: 'tranquille', label: 'Tranquille' },
  { id: 'normal', label: 'Normal' },
  { id: 'rapide', label: 'Rapide' },
];

const TRANSPORTS: readonly { id: TransportPreference; label: string }[] = [
  { id: 'peigne', label: 'À pied' },
  { id: 'train', label: 'Train' },
  { id: 'voiture', label: 'Voiture' },
  { id: 'avion', label: 'Avion' },
  { id: 'mixte', label: 'Mixte' },
];

const INTERESTS: readonly string[] = [
  'Nature',
  'Paysage',
  'Patrimoine',
  'Gastronomie',
  'Photographie',
  'Eau',
];

function SheetActions({
  onClose,
  onApply,
  label = 'Appliquer',
}: {
  onClose: () => void;
  onApply: () => void;
  label?: string;
}) {
  return (
    <div className="prep-actionrow" style={{ marginTop: 16, justifyContent: 'flex-end', display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="md" onClick={onClose}>
        Annuler
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={() => {
          onApply();
          onClose();
        }}
      >
        {label}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      <h3 className="prep-section-title" style={{ fontSize: 'var(--f-h2)', fontWeight: 700 }}>{title}</h3>
      {children}
    </section>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="seg tap">
      {options.map((option) => (
        <button
          key={option.id}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MultiChipRow<T extends string>({
  options,
  values,
  onChange,
}: {
  options: readonly { id: T; label: string }[] | readonly string[];
  values: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((option) => {
        const id = typeof option === 'string' ? option : option.id;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <button
            key={id}
            className="chip"
            aria-pressed={values.includes(id as T)}
            onClick={() => onChange(id as T)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function useLocalPlaces(): readonly PlaceRef[] {
  return useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('lkdv_prep_recent_places_v1');
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PlaceRef[]) : [];
    } catch {
      return [];
    }
  }, []);
}

function rememberPlace(place: PlaceRef): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem('lkdv_prep_recent_places_v1');
    const current: PlaceRef[] = raw ? (JSON.parse(raw) as PlaceRef[]) : [];
    const next = [place, ...current.filter((item) => item.id !== place.id)].slice(0, 12);
    window.localStorage.setItem('lkdv_prep_recent_places_v1', JSON.stringify(next));
  } catch {
  }
}

function PlaceRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: PlaceCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { place } = candidate;
  const where = [place.country, candidate.context].filter(Boolean).join(' · ');
  return (
    <div className={`li ${selected ? 'sel' : ''}`} onClick={onSelect} style={{ cursor: 'pointer' }}>
      <div className="rt">
        <div className="t1">{place.name}</div>
        <div className="t2">{where}</div>
      </div>
      {selected ? <Icon name="check" size={16} /> : null}
    </div>
  );
}

export function PlaceSheet({ draft, actions, onClose }: PrepSheetProps) {
  const recent = useLocalPlaces();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = draft.route.origin === null ? 'origin' : 'destination';
  const isOrigin = target === 'origin';
  const current = isOrigin ? draft.route.origin : draft.route.destination;

  const geo = useGeocode(query);
  const matches = geo.kind === 'results' ? geo.matches : [];
  const results: readonly PlaceCandidate[] = useMemo(
    () => placeCandidates({ recent, matches, hasQuery: query.trim().length > 0, query }),
    [recent, matches, query],
  );
  
  const geoMessage = geocodeMessage(geo);

  const apply = (place: PlaceRef) => {
    rememberPlace(place);
    actions.setRoute(
      isOrigin
        ? { ...draft.route, origin: place }
        : { ...draft.route, destination: place },
    );
  };

  const useMyPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Localisation indisponible');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        apply({
          id: `here-${Date.now().toString(36)}`,
          name: 'Ma position',
          country: '',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setError('Position non obtenue');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <SearchField
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un lieu..."
          aria-label="Rechercher un lieu"
          onClear={() => setQuery('')}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="secondary" onClick={useMyPosition} loading={locating} style={{ flex: 1 }}>
          <Icon name="navigation" size={18} /> Ma position
        </Button>
        <Button variant="secondary" onClick={() => {}} style={{ flex: 1 }}>
          <Icon name="map" size={18} /> Choisir sur la carte
        </Button>
      </div>

      {error && <div className="note red">{error}</div>}

      <div className="list">
        {results.map((candidate) => (
          <PlaceRow
            key={`${candidate.source}:${candidate.place.id}`}
            candidate={candidate}
            selected={current?.id === candidate.place.id}
            onSelect={() => apply(candidate.place)}
          />
        ))}
      </div>

      {geoMessage && <div className="note neutral">{geoMessage}</div>}

      <div style={{ marginTop: 'auto', paddingTop: '16px', position: 'sticky', bottom: 0, backgroundColor: 'var(--surface)' }}>
        <Button 
          variant="primary" 
          style={{ width: '100%' }} 
          disabled={!current}
          onClick={onClose}
        >
          Choisir ce lieu
        </Button>
      </div>
    </div>
  );
}

function isoPlusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CalendarSheet({ draft, actions, onClose }: PrepSheetProps) {
  const [startDate, setStartDate] = useState(draft.calendar.startDate ?? '');
  const [duration, setDuration] = useState(
    draft.calendar.durationDays === null ? '' : String(draft.calendar.durationDays),
  );
  const [isReturn, setIsReturn] = useState(draft.calendar.returnDate !== null);

  const days = Number(duration);
  const suggested = draft.calendar.durationIsSuggested;

  const apply = () => {
    actions.setCalendar({
      startDate: startDate || null,
      durationDays: Number.isFinite(days) && days >= 1 ? Math.round(days) : null,
      durationIsSuggested: false,
      returnDate: isReturn && startDate ? isoPlusDays(startDate, Math.max(0, days - 1)) : null,
    });
    onClose();
  };

  return (
    <div>
      <Section title="Date de départ">
        <input
          type="date"
          className="field"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </Section>

      <Section title="Durée">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
          <span>Je fixe une date de retour</span>
          <Switch checked={isReturn} onCheckedChange={setIsReturn} label="" />
        </div>
        
        {!isReturn ? (
          <div className="stepper" style={{ marginTop: '16px' }}>
            <button onClick={() => setDuration(String(Math.max(1, days - 1)))} disabled={days <= 1}>
              <Icon name="minus" size={16} />
            </button>
            <div className="n">{days || 1} jours</div>
            <button onClick={() => setDuration(String(days + 1))}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        ) : (
          <input
            type="date"
            className="field"
            style={{ marginTop: '16px' }}
            value={startDate && days ? isoPlusDays(startDate, Math.max(0, days - 1)) : ''}
            onChange={(e) => {
              if (startDate && e.target.value) {
                const start = new Date(startDate);
                const end = new Date(e.target.value);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                setDuration(String(diffDays));
              }
            }}
          />
        )}
        
        {suggested && <div className="badge amber" style={{ marginTop: '8px' }}>Durée proposée · modifiable</div>}
      </Section>

      <SheetActions onClose={onClose} onApply={apply} />
    </div>
  );
}

export function GroupSheet({ draft, actions, onClose }: PrepSheetProps) {
  const { mode, adults, children, hasPets, knownMembers } = draft.group;

  const apply = () => {
    actions.setGroup({ mode, adults, children, hasPets, knownMembers });
    onClose();
  };

  return (
    <div>
      <Section title="Composition">
        <ChipRow
          options={[
            { id: 'solo' as const, label: 'Solo' },
            { id: 'groupe' as const, label: 'Groupe' },
          ]}
          value={mode}
          onChange={(next) =>
            actions.setGroup({
              ...draft.group,
              mode: next,
              adults: next === 'solo' ? 1 : Math.max(1, draft.group.adults),
            })
          }
        />
      </Section>

      {mode === 'groupe' && (
        <>
          <Section title="Adultes">
            <div className="stepper">
              <button onClick={() => actions.setGroup({ ...draft.group, adults: Math.max(1, adults - 1) })} disabled={adults <= 1}>
                <Icon name="minus" size={16} />
              </button>
              <div className="n">{adults}</div>
              <button onClick={() => actions.setGroup({ ...draft.group, adults: adults + 1 })}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          </Section>
          <Section title="Enfants">
            <div className="stepper">
              <button onClick={() => actions.setGroup({ ...draft.group, children: Math.max(0, children - 1) })} disabled={children <= 0}>
                <Icon name="minus" size={16} />
              </button>
              <div className="n">{children}</div>
              <button onClick={() => actions.setGroup({ ...draft.group, children: children + 1 })}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          </Section>
        </>
      )}

      <Section title="Animaux">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Un animal accompagne le groupe</span>
          <Switch checked={hasPets} onCheckedChange={(next) => actions.setGroup({ ...draft.group, hasPets: next })} label="" />
        </div>
      </Section>

      {knownMembers.length > 0 && (
        <Section title="Membres connus">
          <div className="avs">
            {knownMembers.map((m, i) => (
              <div key={i} className="av lg" style={{ backgroundColor: 'var(--green)' }}>
                {m.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </Section>
      )}

      <SheetActions onClose={onClose} onApply={apply} label="Confirmer" />
    </div>
  );
}

export function PreferencesSheet({ draft, actions, onClose }: PrepSheetProps) {
  const { preferences } = draft;

  const toggle = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const apply = () => {
    onClose();
  };

  return (
    <div>
      <Section title="Budget">
        <ChipRow
          options={BUDGET_LEVELS}
          value={preferences.budgetLevel}
          onChange={(next) => actions.setPreferences({ ...preferences, budgetLevel: next })}
        />
      </Section>

      <Section title="Rythme">
        <ChipRow
          options={PACES}
          value={preferences.pace}
          onChange={(next) => actions.setPreferences({ ...preferences, pace: next })}
        />
      </Section>

      <Section title="Transport">
        <MultiChipRow
          options={TRANSPORTS}
          values={[preferences.transport]}
          onChange={(next) => actions.setPreferences({ ...preferences, transport: next })}
        />
      </Section>

      <Section title="Intérêts">
        <MultiChipRow
          options={INTERESTS}
          values={preferences.interests}
          onChange={(next) => actions.setPreferences({ ...preferences, interests: toggle(preferences.interests, next) })}
        />
      </Section>

      <SheetActions onClose={onClose} onApply={apply} />
    </div>
  );
}

export function CoverageSheet({ draft, actions, onClose }: PrepSheetProps) {
  const [name, setName] = useState(draft.coverName ?? '');
  const model = draft.itinerary;

  return (
    <div>
      <Section title="Nom de l’aventure">
        <input
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => actions.setCoverName(name.trim() || null)}
          aria-label="Nom de l'aventure"
          placeholder="Ex. Boucle des lacs"
        />
      </Section>

      <Section title="Image">
        <p className="note neutral">
          Aucune image n’est appliquée automatiquement. La photo du paysage vient de la
          carte quand elle est disponible.
        </p>
      </Section>

      <Section title="Repères">
        <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>
          {model ? `${model.days} jour${model.days > 1 ? 's' : ''} · ${model.steps.length} étapes` : 'Programme pas encore généré'}
        </p>
      </Section>

      <SheetActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}

export function ParticipantsSheet({
  draft,
  actions,
  onClose,
  onOpenInvite,
}: PrepSheetProps & { onOpenInvite?: () => void }) {
  const gear = buildGearNeeds(draft);
  const shared = gear.filter((item) => item.quantity > 1 || item.ownerId !== null);
  const total = packWeight(gear);
  const meals = uncoveredMeals(mealNeeds(draft.itinerary));
  const water = waterNeeds(draft.itinerary);

  return (
    <div>
      <Section title="Effectif">
        <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>
          {draft.group.adults + draft.group.children} personne
          {draft.group.adults + draft.group.children > 1 ? 's' : ''} prévue
          {draft.group.adults + draft.group.children > 1 ? 's' : ''} ·{' '}
          {draft.group.knownMembers.length > 0
            ? `${draft.group.knownMembers.length} déjà connu(s)`
            : 'aucun membre connu'}
        </p>
      </Section>

      <Section title="Matériel partagé">
        {shared.length === 0 ? (
          <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>
            Aucun matériel partagé identifié pour cette aventure.
          </p>
        ) : (
          <ul className="list">
            {shared.map((item) => (
              <li key={item.id} className="li">
                <div className="rt">
                  <div className="t1">{item.name} ×{item.quantity}</div>
                  <div className="t2">{item.ownerId ?? 'Responsable à confirmer'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <SheetActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}

export { MEAL_SLOT_LABELS, gearGaps };
