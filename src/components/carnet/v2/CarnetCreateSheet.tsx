'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { ActionPill } from '@/components/ui/ActionPill';
import {
  MOMENT_EXPENSE_CATEGORIES,
  MOMENT_TYPES,
  MOMENT_TYPE_LABELS,
  type MomentType,
} from '@/features/carnet/detail/momentTypes';
import type { CreateMomentResult } from '@/features/carnet/detail/useCarnetEdits';
import type { CarnetKitItemRow } from '@/features/carnet/detail/types';
import { MOMENT_TYPE_ICONS } from './CarnetMomentTile';
import { useVoiceRecorder } from '@/features/carnet/detail/useVoiceRecorder';
import { formatClock } from '@/features/carnet/detail/useVoiceRecorder';

/** Textes d'aide de la maquette (`PLACEH`). */
const PLACEHOLDERS: Record<MomentType, string> = {
  photo: 'Raconte ce que tu vois…',
  video: 'Un mot sur ce moment…',
  voice: 'Un mot sur ce moment…',
  text: 'Raconte ton moment terrain…',
  meet: 'Ce qu’on t’a dit…',
  spend: 'Casse-croûte',
  kit: '',
  species: 'Bouquetin des Alpes',
  inc: 'Ce qui s’est passé…',
};

export interface CarnetCreateSheetProps {
  /** Jour auquel le moment est rattaché (jour affiché, sinon le dernier). */
  day: number;
  /** Lieu proposé d'emblée (dernière étape connue du jour). */
  defaultPlace?: string;
  kitItems: CarnetKitItemRow[];
  /** Type ouvert d'emblée (« + Ajouter une rencontre » → `meet`). */
  initialType?: MomentType | null;
  onSubmit: (input: unknown, file: File | null) => Promise<CreateMomentResult>;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="lkdv-overlay-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * Feuille « Créer » (maquette `buildCreate`) : grille des neuf types, puis le
 * formulaire du type choisi. Écrit réellement un moment (voir `useCarnetEdits`).
 */
export function CarnetCreateSheet({
  day,
  defaultPlace = '',
  kitItems,
  initialType = null,
  onSubmit,
  onClose,
}: CarnetCreateSheetProps) {
  const [type, setType] = useState<MomentType | null>(initialType);
  const [place, setPlace] = useState(defaultPlace);
  const [main, setMain] = useState('');
  const [who, setWho] = useState('');
  const [latin, setLatin] = useState('');
  const [amount, setAmount] = useState('12');
  const [category, setCategory] = useState<string>(MOMENT_EXPENSE_CATEGORIES[0]);
  const [itemId, setItemId] = useState(kitItems[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const voice = useVoiceRecorder();

  const recordedUrl = useMemo(
    () => (voice.recording ? URL.createObjectURL(voice.recording.file) : null),
    [voice.recording]
  );
  useEffect(
    () => () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    },
    [recordedUrl]
  );

  const preview = useMemo(
    () => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file]
  );

  const back = () => {
    setType(null);
    setMessage(null);
  };

  const submit = async () => {
    if (!type || busy) return;
    const selectedItem = kitItems.find((item) => item.id === itemId);
    const input: Record<string, unknown> = {
      type,
      day,
      place,
      caption: type === 'kit' ? selectedItem?.name : main,
    };
    if (type === 'voice') input.durationLabel = voice.recording?.durationLabel;
    if (type === 'meet') input.who = who;
    if (type === 'spend') {
      input.amountEur = Number(amount.replace(',', '.'));
      input.category = category;
    }
    if (type === 'kit') input.itemId = itemId;
    if (type === 'species') input.latin = latin;

    setBusy(true);
    setMessage(null);
    const result = await onSubmit(input, type === 'voice' ? (voice.recording?.file ?? null) : file);
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.error, ok: false });
      return;
    }
    setMessage({ text: 'Moment ajouté.', ok: true });
    window.setTimeout(onClose, 600);
  };

  return (
    <OverlaySheet
      title={type ? MOMENT_TYPE_LABELS[type] : 'Créer'}
      subtitle={type ? undefined : `Ajouter un moment à J${day}`}
      onClose={onClose}
      headerRight={
        type ? (
          <ActionPill
            className="lkdv-create-back"
            label="Tous les types"
            icon={<ChevronLeft />}
            onClick={back}
          />
        ) : undefined
      }
      footer={
        type ? (
          <button
            type="button"
            className="lkdv-carnet-create-cta"
            data-testid="create-submit"
            disabled={busy}
            onClick={() => void submit()}
          >
            Ajouter le moment
          </button>
        ) : undefined
      }
    >
      {!type ? (
        <div className="lkdv-create-catalog" role="group" aria-label="Type de moment">
          {MOMENT_TYPES.map((key) => {
            const Icon = MOMENT_TYPE_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                className="lkdv-create-card"
                data-type={key}
                onClick={() => setType(key)}
              >
                <span className="lkdv-create-icon" aria-hidden="true">
                  <Icon size={20} aria-hidden />
                </span>
                <span>
                  <b>{MOMENT_TYPE_LABELS[key]}</b>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <Field label="Lieu">
            <input
              type="text"
              value={place}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setPlace(event.target.value)}
            />
          </Field>

          {type === 'photo' || type === 'video' ? (
            <>
              {preview ? <img className="lkdv-create-preview" src={preview} alt="" /> : null}
              <Field label={type === 'photo' ? 'Image' : 'Vidéo'}>
                <input
                  type="file"
                  accept={type === 'photo' ? 'image/*' : 'video/*'}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label="Légende">
                <input
                  type="text"
                  value={main}
                  maxLength={120}
                  placeholder={PLACEHOLDERS[type]}
                  onChange={(event) => setMain(event.target.value)}
                />
              </Field>
            </>
          ) : null}

          {type === 'voice' ? (
            <>
              <div className="lkdv-overlay-field" data-testid="voice-recorder">
                <span>Enregistrement</span>
                <div className="lkdv-row-actions" style={{ alignItems: 'center' }}>
                  {voice.state === 'recording' ? (
                    <button type="button" className="lkdv-mbtn danger" onClick={voice.stop}>
                      Arrêter · {formatClock(voice.seconds)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="lkdv-mbtn solid"
                      disabled={!voice.supported}
                      onClick={() => void voice.start()}
                    >
                      {voice.state === 'ready' ? 'Réenregistrer' : 'Enregistrer'}
                    </button>
                  )}
                  {voice.state === 'ready' ? (
                    <button type="button" className="lkdv-mbtn ghost" onClick={voice.reset}>
                      Effacer
                    </button>
                  ) : null}
                </div>
                {voice.state === 'ready' && voice.recording ? (
                  <audio
                    controls
                    src={recordedUrl ?? undefined}
                    aria-label={`Réécouter la note vocale, ${voice.recording.durationLabel}`}
                    style={{ width: '100%' }}
                  />
                ) : null}
                <p className="lkdv-mute" role="status">
                  {voice.message ??
                    (voice.state === 'ready' && voice.recording
                      ? `Note de ${voice.recording.durationLabel}, prête à être ajoutée.`
                      : voice.supported
                        ? '3 minutes au plus. Le micro ne s’ouvre qu’à l’appui.'
                        : 'Ton navigateur ne peut pas enregistrer de son.')}
                </p>
              </div>
              <Field label="Titre">
                <input
                  type="text"
                  value={main}
                  maxLength={120}
                  placeholder={PLACEHOLDERS.voice}
                  onChange={(event) => setMain(event.target.value)}
                />
              </Field>
            </>
          ) : null}

          {type === 'text' || type === 'inc' ? (
            <Field label={type === 'text' ? 'Texte' : 'Récit'}>
              <textarea
                value={main}
                maxLength={400}
                placeholder={PLACEHOLDERS[type]}
                onChange={(event) => setMain(event.target.value)}
              />
            </Field>
          ) : null}

          {type === 'meet' ? (
            <>
              <Field label="Citation">
                <textarea
                  value={main}
                  maxLength={240}
                  placeholder={PLACEHOLDERS.meet}
                  onChange={(event) => setMain(event.target.value)}
                />
              </Field>
              <Field label="Qui ?">
                <input
                  type="text"
                  value={who}
                  maxLength={60}
                  placeholder="Marc, berger"
                  onChange={(event) => setWho(event.target.value)}
                />
              </Field>
            </>
          ) : null}

          {type === 'spend' ? (
            <>
              <Field label="Montant (€)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
              <Field label="Catégorie">
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {MOMENT_EXPENSE_CATEGORIES.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Libellé">
                <input
                  type="text"
                  value={main}
                  maxLength={60}
                  placeholder={PLACEHOLDERS.spend}
                  onChange={(event) => setMain(event.target.value)}
                />
              </Field>
            </>
          ) : null}

          {type === 'kit' ? (
            <Field label="Objet du kit">
              <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
                {kitItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {type === 'species' ? (
            <>
              <Field label="Nom">
                <input
                  type="text"
                  value={main}
                  maxLength={80}
                  placeholder={PLACEHOLDERS.species}
                  onChange={(event) => setMain(event.target.value)}
                />
              </Field>
              <Field label="Nom latin">
                <input
                  type="text"
                  value={latin}
                  maxLength={80}
                  placeholder="Capra ibex"
                  onChange={(event) => setLatin(event.target.value)}
                />
              </Field>
            </>
          ) : null}

          <div
            role="alert"
            className="lkdv-carnet-create-msg"
            data-ok={message?.ok ? 'true' : 'false'}
          >
            {message?.text ?? ''}
          </div>
        </div>
      )}
    </OverlaySheet>
  );
}
