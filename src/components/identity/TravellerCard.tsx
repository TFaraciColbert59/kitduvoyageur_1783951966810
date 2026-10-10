'use client';

/**
 * PROFIL VOYAGEUR — d'où tu viens, où tu vis (PLAN-100 4.1, lot P)
 * =================================================================
 * Facultatif de bout en bout : rien dans le Compas n'attend ce profil, et sans
 * lui le Compas n'affirme rien qui dépende de la nationalité.
 *  - `collect` : demandé UNE fois, dans le Compas vide ; nationalité et domicile
 *    seulement ; « Passer » toujours visible (la réponse est rangée, la question
 *    n'est plus posée) ; la carte se retire après « Enregistrer » ou « Passer ».
 *  - `edit` : tout le profil, depuis /compte/voyageur.
 * Privé : écrit par une action serveur pour la personne seule, montré à elle seule,
 * sans coordonnées. Styles en ligne sur les jetons `--lkv-*` (aucune classe
 * utilitaire) : la même carte vit dans le Compas et dans /compte.
 */

import { useId, useMemo, useState, useTransition, type ChangeEvent, type CSSProperties } from 'react';
import { Button } from '@/components/ui';
import {
  countryOptions,
  currencyOptions,
  languageOptions,
  timeZoneOptions,
  type TravellerOption,
  type TravellerView,
} from '@/features/compas/engine/traveller';
import { saveTravellerAction, skipTravellerAction } from '@/features/compas/server/travellerActions';

const EMPTY: TravellerView = {
  nationality: null,
  residenceCountry: null,
  currency: null,
  language: null,
  timeZone: null,
  homeName: null,
};

const FIELD: CSSProperties = {
  width: '100%',
  minHeight: 'var(--lkv-touch-min)',
  borderRadius: 'var(--lkv-radius-control)',
  border: '1px solid var(--lkv-field-border)',
  background: 'var(--lkv-field-bg)',
  color: 'var(--lkv-text-primary)',
  padding: '10px var(--space-3)',
  fontSize: 16,
};
const LABEL: CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontSize: 'var(--lkv-text-caption)',
  fontWeight: 600,
  color: 'var(--lkv-text-primary)',
};
const MUTED: CSSProperties = { margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-muted)' };

type SelectKey = 'nationality' | 'residenceCountry' | 'currency' | 'language' | 'timeZone';

export interface TravellerCardProps {
  mode?: 'collect' | 'edit';
  /** Profil déjà rangé (page /compte/voyageur) ; rien pour la question posée une fois. */
  initial?: TravellerView | null;
  /** Après « Enregistrer » réussi ou « Passer ». */
  onDone?: () => void;
  /** Classes du cadre, données par l'écran hôte (`cp-card` dans le Compas). */
  className?: string;
}

export default function TravellerCard({ mode = 'collect', initial = null, onDone, className }: TravellerCardProps) {
  const id = useId();
  const edit = mode === 'edit';
  const [view, setView] = useState<TravellerView>(initial ?? EMPTY);
  const [home, setHome] = useState(initial?.homeName ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const countries = useMemo(() => countryOptions(), []);
  const currencies = useMemo(() => (edit ? currencyOptions() : []), [edit]);
  const languages = useMemo(() => (edit ? languageOptions(view.language) : []), [edit, view.language]);
  const zones = useMemo(() => (edit ? timeZoneOptions(view.timeZone) : []), [edit, view.timeZone]);

  if (done) return null;

  const choose = (key: SelectKey) => (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setView((v) => ({ ...v, [key]: value }));
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(null);
      const res = await saveTravellerAction({
        nationality: view.nationality,
        residenceCountry: view.residenceCountry,
        currency: view.currency,
        language: view.language,
        timeZone: view.timeZone,
        home: home.trim() || null,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setView(res.view);
      setHome(res.view.homeName ?? '');
      onDone?.();
      if (edit) setSaved('Profil voyageur enregistré.');
      else setDone(true);
    });

  // « Passer » : rangé côté serveur ; un échec ne bloque rien, la carte se retire.
  const skip = () =>
    startTransition(async () => {
      await skipTravellerAction().catch(() => null);
      onDone?.();
      setDone(true);
    });

  const select = (key: SelectKey, label: string, empty: string, options: TravellerOption[]) => (
    <div>
      <label htmlFor={`${id}-${key}`} style={LABEL}>
        {label}
      </label>
      <select id={`${id}-${key}`} style={FIELD} value={view[key] ?? ''} onChange={choose(key)} disabled={pending}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className={className} aria-labelledby={`${id}-title`}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div>
          <h2
            id={`${id}-title`}
            style={{ margin: 0, fontSize: 'var(--lkv-text-body-sm)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}
          >
            {edit ? 'Ce que le Compas sait de toi' : 'Pour des conseils justes'}
          </h2>
          <p style={MUTED}>
            {edit
              ? 'Privé : toi seul·e le vois. Sans réponse, le Compas n’affirme rien qui dépende de ta nationalité.'
              : 'Ta nationalité règle les papiers, ton domicile chiffre le trajet. Privé, jamais montré aux autres ; tu peux passer.'}
          </p>
        </div>
        {select('nationality', 'Nationalité', 'Non renseignée', countries)}
        {edit && select('residenceCountry', 'Pays de résidence', 'Non renseigné', countries)}
        <div>
          <label htmlFor={`${id}-home`} style={LABEL}>
            Ville de domicile
          </label>
          <input
            id={`${id}-home`}
            style={FIELD}
            value={home}
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Lyon"
            disabled={pending}
            onChange={(e) => setHome(e.target.value)}
          />
          <p style={{ ...MUTED, marginTop: 'var(--space-1)' }}>Retrouvée une fois sur la carte, gardée à 1 km près.</p>
        </div>
        {edit && select('currency', 'Devise', 'Non renseignée', currencies)}
        {edit && select('language', 'Langue', 'Non renseignée', languages)}
        {edit && select('timeZone', 'Fuseau horaire', 'Non renseigné', zones)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button type="button" loading={pending} onClick={save}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {!edit && (
            <Button type="button" variant="secondary" disabled={pending} onClick={skip}>
              Passer
            </Button>
          )}
        </div>
        {saved && (
          <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-primary)' }}>
            {saved}
          </p>
        )}
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-danger-dark)' }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
