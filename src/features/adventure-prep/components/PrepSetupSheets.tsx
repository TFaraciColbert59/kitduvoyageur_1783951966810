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
    <div className="prep-actionrow" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
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
      <h3 className="prep-section-title">{title}</h3>
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
    <div className="prep-cats">
      {options.map((option) => (
        <Chip
          key={option.id}
          selected={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recherche d'un lieu (A4)                                             */
/* ------------------------------------------------------------------ */

function useLocalPlaces(): readonly PlaceRef[] {
  return useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('lkdv_prep_places_v1');
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
    const raw = window.localStorage.getItem('lkdv_prep_places_v1');
    const current: PlaceRef[] = raw ? (JSON.parse(raw) as PlaceRef[]) : [];
    const next = [place, ...current.filter((item) => item.id !== place.id)].slice(0, 12);
    window.localStorage.setItem('lkdv_prep_places_v1', JSON.stringify(next));
  } catch {
    /* stockage indisponible : la saisie reste valable pour la session */
  }
}

function PlaceRow({
  place,
  selected,
  onSelect,
}: {
  place: PlaceRef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button type="button" className="prep-act" aria-pressed={selected} onClick={onSelect}>
        <span className="prep-act__icon">
          <Icon name="map-pin" size={20} />
        </span>
        <span className="prep-act__name">{place.name}</span>
        <span className="prep-act__meta">
          {place.country}
          {selected ? (
            <Icon name="check" size={16} className="ml-1 inline-flex" />
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function PlaceSheet({ draft, actions, onClose }: PrepSheetProps) {
  const recent = useLocalPlaces();
  const [query, setQuery] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftCountry, setDraftCountry] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = draft.route.origin === null ? 'origin' : 'destination';
  const isOrigin = target === 'origin';
  const current = isOrigin ? draft.route.origin : draft.route.destination;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recent;
    return recent.filter((place) =>
      `${place.name} ${place.country}`.toLowerCase().includes(needle),
    );
  }, [query, recent]);

  const apply = (place: PlaceRef) => {
    rememberPlace(place);
    actions.setRoute(
      isOrigin
        ? { ...draft.route, origin: place }
        : { ...draft.route, destination: place },
    );
    onClose();
  };

  const useMyPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Localisation indisponible sur cet appareil');
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
        setError('Position non obtenue — réessaie quand tu en as besoin');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  return (
    <div>
      <p className="prep-note" style={{ marginBottom: 14 }}>
        {isOrigin ? 'Départ' : 'Arrivée'} — les lieux déjà utilisés apparaissent d’abord.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <Button variant="secondary" size="md" onClick={useMyPosition} loading={locating}>
          <Icon name="navigation" size={18} />
          Utiliser ma position
        </Button>

        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un lieu déjà utilisé"
          aria-label="Rechercher un lieu"
          onClear={() => setQuery('')}
        />

        {results.length > 0 ? (
          <ul className="prep-acts">
            {results.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
                selected={current?.id === place.id}
                onSelect={() => apply(place)}
              />
            ))}
          </ul>
        ) : (
          <p className="prep-visually-hidden" role="status">
            Aucun lieu enregistré pour cette recherche
          </p>
        )}
      </div>

      {error && (
        <p className="prep-note" data-tone="warn" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      <Section title="Autre lieu">
        <p className="prep-note">
          Aucun service de géocodage n’est branché ici : le lieu que tu saisis reste
          « à vérifier » jusqu’à confirmation.
        </p>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="prep-block__label">Nom du lieu</span>
            <input
              className="prep-block__row"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Ex. Refuge du Col"
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="prep-block__label">Commune, pays</span>
            <input
              className="prep-block__row"
              value={draftCountry}
              onChange={(event) => setDraftCountry(event.target.value)}
              placeholder="Ex. Bourg-d’Oisans, France"
            />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="primary"
            size="md"
            disabled={draftName.trim().length < 2}
            onClick={() => {
              const place: PlaceRef = {
                id: `place-${Date.now().toString(36)}`,
                name: draftName.trim(),
                country: draftCountry.trim(),
                lat: 0,
                lon: 0,
              };
              apply(place);
            }}
          >
            Choisir ce lieu
          </Button>
        </div>
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
          Coordonnées {A_VERIFIER.toLowerCase()} : le parcours ne sera pas calculé tant que
          l’origine et l’arrivée ne sont pas confirmées.
        </p>
      </Section>

      <SheetActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendrier (A4)                                                     */
/* ------------------------------------------------------------------ */

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
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && days >= 1 && days <= 60;
  const suggested = draft.calendar.durationIsSuggested;

  const apply = () => {
    actions.setCalendar({
      startDate: startDate || null,
      durationDays: Number.isFinite(days) && days >= 1 ? Math.round(days) : null,
      // Une durée saisie à la main n'est plus une proposition.
      durationIsSuggested: false,
      returnDate: isReturn && startDate ? isoPlusDays(startDate, Math.max(0, days - 1)) : null,
    });
    onClose();
  };

  return (
    <div>
      <Section title="Départ">
        <input
          type="date"
          className="prep-block__row"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          aria-label="Date de départ"
        />
        {draft.calendar.startDate === null && (
          <p className="prep-block__hint" style={{ paddingInline: 0 }}>
            Date inconnue — choisis-la quand tu veux.
          </p>
        )}
      </Section>

      <Section title="Durée disponible">
        <div style={{ display: 'grid', gap: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            className="prep-block__row"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            aria-label="Nombre de jours"
            placeholder="Nombre de jours"
          />
          {suggested && (
            <p className="prep-note">
              Durée proposée d’après l’activité — modifie-la librement, ce n’est pas une
              préférence déjà connue.
            </p>
          )}
        </div>
      </Section>

      <Section title="Retour">
        <Switch
          checked={isReturn}
          onCheckedChange={setIsReturn}
          label="Je fixe une date de retour"
        />
        {isReturn && startDate && Number.isFinite(days) && days >= 1 && (
          <p className="prep-block__hint" style={{ paddingInline: 0 }}>
            Retour le {isoPlusDays(startDate, Math.max(0, days - 1))}
          </p>
        )}
      </Section>

      <SheetActions onClose={onClose} onApply={apply} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Groupe (A4)                                                         */
/* ------------------------------------------------------------------ */

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
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              className="prep-block__row"
              value={adults}
              onChange={(event) =>
                actions.setGroup({
                  ...draft.group,
                  adults: Math.max(1, Number(event.target.value) || 1),
                })
              }
              aria-label="Nombre d'adultes"
            />
          </Section>
          <Section title="Enfants">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              className="prep-block__row"
              value={children}
              onChange={(event) =>
                actions.setGroup({
                  ...draft.group,
                  children: Math.max(0, Number(event.target.value) || 0),
                })
              }
              aria-label="Nombre d'enfants"
            />
          </Section>
        </>
      )}

      <Section title="Animaux">
        <Switch
          checked={hasPets}
          onCheckedChange={(next) => actions.setGroup({ ...draft.group, hasPets: next })}
          label="Un animal accompagne le groupe"
        />
      </Section>

      {knownMembers.length > 0 && (
        <Section title="Déjà connus">
          <p className="prep-block__hint" style={{ paddingInline: 0 }}>
            {knownMembers.join(', ')}
          </p>
        </Section>
      )}

      <SheetActions onClose={onClose} onApply={apply} label="Confirmer le groupe" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Préférences (A4)                                                    */
/* ------------------------------------------------------------------ */

export function PreferencesSheet({ draft, actions, onClose }: PrepSheetProps) {
  const { preferences } = draft;
  const [budget, setBudget] = useState(
    preferences.budgetPerPerson === null ? '' : String(preferences.budgetPerPerson),
  );

  const toggle = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const apply = () => {
    const amount = Number(budget);
    actions.setPreferences({
      ...preferences,
      budgetPerPerson: budget.trim() !== '' && Number.isFinite(amount) && amount >= 0 ? amount : null,
    });
    onClose();
  };

  return (
    <div>
      <Section title="Budget par personne">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={10}
          className="prep-block__row"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          aria-label="Budget par personne en euros"
          placeholder="Budget par personne"
        />
        {preferences.budgetPerPerson === null && (
          <p className="prep-block__hint" style={{ paddingInline: 0 }}>
            Budget inconnu — aucun montant ne sera inventé avant que tu le donnes.
          </p>
        )}
      </Section>

      <Section title="Niveau de budget">
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
        <ChipRow
          options={TRANSPORTS}
          value={preferences.transport}
          onChange={(next) => actions.setPreferences({ ...preferences, transport: next })}
        />
      </Section>

      <Section title="Intérêts">
        <div className="prep-cats">
          {INTERESTS.map((interest) => (
            <Chip
              key={interest}
              selected={preferences.interests.includes(interest)}
              onClick={() =>
                actions.setPreferences({
                  ...preferences,
                  interests: toggle(preferences.interests, interest),
                })
              }
            >
              {interest}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Contraintes et accessibilité">
        <textarea
          className="prep-block__row"
          rows={3}
          style={{ alignItems: 'flex-start', resize: 'vertical' }}
          value={preferences.accessibilityNeeds.join(', ')}
          onChange={(event) =>
            actions.setPreferences({
              ...preferences,
              accessibilityNeeds: event.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          aria-label="Contraintes et besoins d'accessibilité, séparés par des virgules"
          placeholder="Ex. poussette, mal solitaire, pas de dénivelé"
        />
      </Section>

      <SheetActions onClose={onClose} onApply={apply} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Couverture de l'aventure (A9)                                       */
/* ------------------------------------------------------------------ */

export function CoverageSheet({ draft, actions, onClose }: PrepSheetProps) {
  const [name, setName] = useState(draft.coverName ?? '');
  const model = draft.itinerary;

  return (
    <div>
      <Section title="Nom de l’aventure">
        <input
          className="prep-block__row"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => actions.setCoverName(name.trim() || null)}
          aria-label="Nom de l'aventure"
          placeholder="Ex. Boucle des lacs"
        />
      </Section>

      <Section title="Image">
        <p className="prep-note">
          Aucune image n’est appliquée automatiquement. La photo du paysage vient de la
          carte quand elle est disponible.
        </p>
      </Section>

      <Section title="Repères">
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
          {model ? `${model.days} jour${model.days > 1 ? 's' : ''} · ${model.steps.length} étapes` : 'Programme pas encore généré'}
        </p>
      </Section>

      <SheetActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Participants (A10)                                                  */
/* ------------------------------------------------------------------ */

export function ParticipantsSheet({ draft, actions, onClose }: PrepSheetProps) {
  const gear = buildGearNeeds(draft);
  const shared = gear.filter((item) => item.quantity > 1 || item.ownerId !== null);
  const total = packWeight(gear);
  const meals = uncoveredMeals(mealNeeds(draft.itinerary));
  const water = waterNeeds(draft.itinerary);

  return (
    <div>
      <Section title="Effectif">
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
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
          <p className="prep-block__hint" style={{ paddingInline: 0 }}>
            Aucun matériel partagé identifié pour cette aventure.
          </p>
        ) : (
          <ul className="prep-acts">
            {shared.map((item) => (
              <li key={item.id} className="prep-act" style={{ cursor: 'default' }}>
                <span className="prep-act__icon">
                  <Icon name="backpack" size={20} />
                </span>
                <span className="prep-act__name">
                  {item.name} ×{item.quantity}
                </span>
                <span className="prep-act__meta">
                  {item.ownerId ?? 'Responsable à confirmer'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="prep-note" style={{ marginTop: 10 }}>
          Une tente attribuée à quelqu’un qui n’a pas accepté reste à confirmer.
        </p>
      </Section>

      <Section title="Inviter">
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
          L’invitation portera la couverture, le nom, les dates, la destination, le budget
          estimatif et ton message. Une invitation ne donne pas accès à la localisation.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="md" disabled>
            <Icon name="user-plus" size={18} />
            Inviter
          </Button>
          <Button variant="secondary" size="md" disabled>
            <Icon name="link" size={18} />
            Copier le lien
          </Button>
        </div>
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
          L’envoi d’invitations n’est pas encore branché : aucune adresse ne partira d’ici.
        </p>
      </Section>

      <Section title="Repères calculés">
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
          {gearSummary(gear, draft.packedGearIds)} ·{' '}
          {bookWeightLabel(total)} · {water.length} besoin(s) d’eau · {meals.length} repas à
          prévoir
        </p>
      </Section>

      <SheetActions onClose={onClose} onApply={onClose} label="Fermer" />
    </div>
  );
}

export { MEAL_SLOT_LABELS, gearGaps };