'use client';

/**
 * Lot A01 — S1.08 / S1.12 : Sous-drawer de saisie manuelle d'une activité
 * (Compte -> Sorties -> Ajouter manuellement).
 * Supporte tous les sports, variantes indoor/piscine/ski et la rééducation.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Check, PlusCircle } from 'lucide-react';
import {
  REHAB_VARIANTS,
  SPORT_FAMILIES,
} from '@/features/explorer-v2/sheet/sportSelection';
import { validateManualActivityInput } from '@/features/explorer-v2/activity/modes/manualActivity';
import {
  REHAB_BODY_ZONES,
  type RehabBodyZone,
} from '@/features/explorer-v2/activity/modes/rehabActivity';
import {
  ACTIVITY_TAGS,
  type LifecycleActivityRecord,
} from '@/features/compte/lifecycle';
import { tagLabel } from '@/components/compte/lifecycle/format';

export interface ManualActivityDrawerProps {
  onCreated?: (record: LifecycleActivityRecord) => void;
  onCancel?: () => void;
}

function defaultStartedAtLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - 45);
  now.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `man-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function ManualActivityDrawer({
  onCreated,
  onCancel,
}: ManualActivityDrawerProps) {
  const variantOptions = useMemo(() => {
    const base = SPORT_FAMILIES.flatMap((family) =>
      family.variants.map((v) => ({
        id: v.id,
        label: `${family.label} · ${v.label}`,
        isFlatWater: v.id === 'natation-piscine' || v.id === 'natation-eau-libre' || v.id === 'rameur-indoor',
        isPool: v.id === 'natation-piscine',
        isRehab: false,
      })),
    );
    const rehab = REHAB_VARIANTS.map((v) => ({
      id: v.id,
      label: v.label,
      isFlatWater: v.id === 'rehab-aquatique',
      isPool: false,
      isRehab: true,
    }));
    return [...base, ...rehab];
  }, []);

  const [sportOrVariant, setSportOrVariant] = useState('rando-journee');
  const [title, setTitle] = useState('');
  const [startedAtLocal, setStartedAtLocal] = useState(defaultStartedAtLocal);
  const [durationMin, setDurationMin] = useState('45');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevGainM, setElevGainM] = useState('');
  const [poolLengthM, setPoolLengthM] = useState('25');
  const [poolLengthsCount, setPoolLengthsCount] = useState('');
  const [rpe, setRpe] = useState('');
  const [bodyZone, setBodyZone] = useState<RehabBodyZone | ''>('');
  const [painLevel, setPainLevel] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'private' | 'collective_anonymized'>('private');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<LifecycleActivityRecord | null>(null);
  const clientSessionIdRef = useRef<string>(newClientUuid());

  const selectedMeta = variantOptions.find((opt) => opt.id === sportOrVariant) ?? variantOptions[0];

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedDurationMin = Number(durationMin);
    if (!Number.isFinite(parsedDurationMin) || parsedDurationMin <= 0) {
      setError('Indique une durée valide en minutes (strictement positive).');
      return;
    }
    const durationS = Math.round(parsedDurationMin * 60);
    const startedMs = Date.parse(startedAtLocal);
    if (!Number.isFinite(startedMs)) {
      setError('Date et heure de début invalides.');
      return;
    }
    const startedAtIso = new Date(startedMs).toISOString();

    const parsedPoolM = Number(poolLengthM);
    const parsedLengths = Number(poolLengthsCount);
    const rawDistanceKm =
      distanceKm.trim() !== ''
        ? Number(distanceKm)
        : selectedMeta.isPool &&
            Number.isFinite(parsedPoolM) &&
            parsedPoolM >= 10 &&
            Number.isFinite(parsedLengths) &&
            parsedLengths > 0
          ? (parsedPoolM * parsedLengths) / 1000
          : null;

    const rawElevM =
      !selectedMeta.isFlatWater && elevGainM.trim() !== '' ? Number(elevGainM) : null;

    const validation = validateManualActivityInput({
      sportOrVariant,
      startedAt: startedAtIso,
      durationS,
      distance: rawDistanceKm,
      distanceUnit: 'km',
      elevGain: rawElevM,
      elevationUnit: 'm',
      title: title.trim() || null,
      notes: notes.trim() || null,
      perceivedExertion: rpe.trim() !== '' ? Number(rpe) : null,
      clientSessionId: clientSessionIdRef.current,
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/activities/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sportOrVariant,
          startedAt: startedAtIso,
          durationS,
          distance: rawDistanceKm,
          distanceUnit: 'km',
          elevGain: rawElevM,
          elevationUnit: 'm',
          title: title.trim() || null,
          notes: notes.trim() || null,
          perceivedExertion: rpe.trim() !== '' ? Number(rpe) : null,
          clientSessionId: clientSessionIdRef.current,
          visibility,
          tags,
          ...(selectedMeta.isPool && Number.isFinite(parsedPoolM)
            ? {
                poolLengthM: parsedPoolM,
                poolLengthsCount: Number.isFinite(parsedLengths) ? parsedLengths : null,
              }
            : {}),
          ...(selectedMeta.isRehab
            ? {
                bodyZone: bodyZone || null,
                painLevel: painLevel !== '' ? Number(painLevel) : null,
              }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        id?: string;
        record?: LifecycleActivityRecord;
        error?: string;
      } | null;
      if (!res.ok || !json?.record) {
        setError(json?.error ?? 'Enregistrement manuel impossible.');
        return;
      }
      setSavedRecord(json.record);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('lkdv:outings-changed', { detail: { outingId: json.record.id } }),
        );
      }
      onCreated?.(json.record);
    } catch {
      setError('Connexion indisponible pendant l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="lkdv-trace-import"
      aria-label="Ajouter une activité manuellement"
      data-testid="manual-activity-drawer"
    >
      <header className="lkdv-trace-import-head">
        <div>
          <p className="lkdv-trace-import-eyebrow">Saisie manuelle · sans GPS</p>
          <h2 className="lkdv-trace-import-title">Ajouter une activité</h2>
        </div>
        {onCancel ? (
          <button type="button" className="lkdv-trace-import-btn ghost" onClick={onCancel}>
            Fermer
          </button>
        ) : null}
      </header>

      {savedRecord ? (
        <div className="lkdv-trace-import-saved" data-testid="manual-activity-saved">
          <div className="lkdv-trace-import-saved-title">
            <Check size={16} aria-hidden="true" />
            <strong>{savedRecord.title} enregistrée</strong>
          </div>
          <p className="lkdv-trace-import-saved-sub">
            Ajoutée à tes sorties (provenance : saisie manuelle).
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="lkdv-trace-import-btn primary"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('lkdv:open-outing', { detail: { outingId: savedRecord.id } }),
                  );
                }
              }}
            >
              Ouvrir la fiche
            </button>
            <button
              type="button"
              className="lkdv-trace-import-btn ghost"
              onClick={() => {
                clientSessionIdRef.current = newClientUuid();
                setSavedRecord(null);
                setTitle('');
                setNotes('');
              }}
            >
              Ajouter une autre
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>Sport / discipline</span>
            <select
              value={sportOrVariant}
              onChange={(e) => setSportOrVariant(e.target.value)}
              aria-label="Sport ou discipline"
              style={{ padding: '8px 10px', borderRadius: 10 }}
            >
              {variantOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>Titre (optionnel)</span>
            <input
              type="text"
              maxLength={120}
              placeholder="Ex. Séance tapis matinale ou Rééducation genou"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 10 }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span>Date et heure</span>
              <input
                type="datetime-local"
                value={startedAtLocal}
                onChange={(e) => setStartedAtLocal(e.target.value)}
                required
                style={{ padding: '8px 10px', borderRadius: 10 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span>Durée (minutes)</span>
              <input
                type="number"
                min={1}
                max={14400}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                required
                style={{ padding: '8px 10px', borderRadius: 10 }}
              />
            </label>
          </div>

          {selectedMeta.isPool ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                <span>Bassin (m)</span>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={poolLengthM}
                  onChange={(e) => setPoolLengthM(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                <span>Longueurs</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Ex. 40"
                  value={poolLengthsCount}
                  onChange={(e) => setPoolLengthsCount(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              <span>Distance (km · optionnel)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex. 10.5"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 10 }}
              />
            </label>
            {!selectedMeta.isFlatWater ? (
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                <span>Dénivelé D+ (m · optionnel)</span>
                <input
                  type="number"
                  min={0}
                  max={20000}
                  placeholder="Ex. 350"
                  value={elevGainM}
                  onChange={(e) => setElevGainM(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
            ) : (
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                <span>Effort perçu RPE (1–10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="Optionnel"
                  value={rpe}
                  onChange={(e) => setRpe(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
            )}
          </div>

          {selectedMeta.isRehab ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                <span>Zone travaillée (S1.12)</span>
                <select
                  value={bodyZone}
                  onChange={(e) => setBodyZone(e.target.value as RehabBodyZone | '')}
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                >
                  <option value="">Non précisée</option>
                  {REHAB_BODY_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                <span>Douleur /10 (optionnel)</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0 à 10"
                  value={painLevel}
                  onChange={(e) => setPainLevel(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <span>Tags d’activité</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ACTIVITY_TAGS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    className={`lkdv-trace-import-btn ${active ? 'primary' : 'ghost'}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tagLabel(tag)}
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>Visibilité</span>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(
                  e.target.value === 'collective_anonymized' ? 'collective_anonymized' : 'private',
                )
              }
              style={{ padding: '8px 10px', borderRadius: 10 }}
            >
              <option value="private">Privée</option>
              <option value="collective_anonymized">Collective anonymisée</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <span>Notes (optionnel)</span>
            <textarea
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sensations, consigne kiné, équipement…"
              style={{ padding: '8px 10px', borderRadius: 10 }}
            />
          </label>

          {error ? (
            <div className="lkdv-trace-import-error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="lkdv-trace-import-btn primary"
          >
            <PlusCircle size={15} aria-hidden="true" />
            {submitting ? 'Enregistrement…' : 'Enregistrer l’activité'}
          </button>
        </form>
      )}
    </section>
  );
}
