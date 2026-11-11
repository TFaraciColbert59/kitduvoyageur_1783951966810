'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * « Signal de bord » du cockpit (proposition n° 37 de
 * `docs/carnets/maquette-carnets-de-bord.html`).
 *
 * Pendant la randonnée, en deux gestes : choisir une photo/vidéo (ou taper une
 * ligne), puis envoyer — le signal est rangé dans le jour courant du carnet.
 * `publish` est injecté par la page (route serveur `/api/carnets/signal`) ;
 * sans lui, le comportement historique est conservé (capture locale listée)
 * pour ne rien casser des usages existants du composant.
 */

export interface CaptureItem {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'NOTE' | 'MOMENT';
  text?: string;
  mediaUrl?: string;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
}

export interface CaptureSignalInput {
  kind: 'photo' | 'video' | 'note';
  text?: string;
  file?: File | null;
}

export interface CaptureSignalResult {
  ok: boolean;
  carnetId?: string;
  day?: number;
  error?: string;
}

export interface CaptureSheetContext {
  tripId?: string | null;
  carnetId?: string | null;
  place?: string | null;
}

interface CaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ancien comportement (capture locale) : appelé seulement si `publish` est absent. */
  onCaptureAction?: (item: CaptureItem) => void;
  userLoc?: [number, number] | null;
  /** Envoi réel du signal dans le carnet ; absent = mode local historique. */
  publish?: (input: CaptureSignalInput) => Promise<CaptureSignalResult>;
  /** Contexte du carnet en cours (voyage, carnet déjà résolu, lieu). */
  context?: CaptureSheetContext;
  /** Signal publié : la page mémorise le carnet pour l'arrêt de la randonnée. */
  onPublished?: (result: { carnetId: string; day: number }) => void;
}

interface PendingMedia {
  kind: 'photo' | 'video';
  file: File;
  previewUrl: string;
}

export default function CaptureSheet({
  isOpen,
  onClose,
  onCaptureAction,
  userLoc,
  publish,
  context,
  onPublished,
}: CaptureSheetProps) {
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [noteMode, setNoteMode] = useState<'NOTE' | 'MOMENT' | null>(null);
  const [noteText, setNoteText] = useState('');
  const [pending, setPending] = useState<PendingMedia | null>(null);
  const [lineText, setLineText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  /* À chaque ouverture : formulaire propre, jamais de brouillon fantôme. */
  useEffect(() => {
    if (!isOpen) return;
    setNoteMode(null);
    setNoteText('');
    setError(null);
    setSuccess(null);
    setLineText('');
    setPending((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return null;
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const addLegacyCapture = (type: CaptureItem['type'], text?: string, mediaUrl?: string) => {
    const newItem: CaptureItem = {
      id: `cap-${Date.now()}`,
      type,
      text: text?.trim() || undefined,
      mediaUrl,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      lat: userLoc ? userLoc[0] : null,
      lng: userLoc ? userLoc[1] : null,
    };
    setCaptures((prev) => [newItem, ...prev]);
    onCaptureAction?.(newItem);
    setNoteMode(null);
    setNoteText('');
  };

  const handleFileChange = (kind: 'photo' | 'video', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setSuccess(null);
    setPending((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return { kind, file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const sendMedia = async () => {
    if (!pending) return;
    const text = lineText.trim();
    if (!publish) {
      addLegacyCapture(pending.kind === 'photo' ? 'PHOTO' : 'VIDEO', text || pending.file.name, pending.previewUrl);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await publish({
        kind: pending.kind,
        text: text || undefined,
        file: pending.file,
      });
      if (!result.ok) {
        setError(result.error ?? 'Le signal n’a pas pu être envoyé.');
        return;
      }
      const day = result.day ?? 1;
      const carnetId = result.carnetId ?? '';
      setCaptures((prev) => [
        {
          id: `sig-${Date.now()}`,
          type: pending.kind === 'photo' ? 'PHOTO' : 'VIDEO',
          text: text || (pending.kind === 'photo' ? 'Photo' : 'Vidéo'),
          mediaUrl: pending.previewUrl,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      setLineText('');
      setSuccess(`Signal envoyé · J${day}`);
      if (carnetId) onPublished?.({ carnetId, day });
    } finally {
      setBusy(false);
    }
  };

  const sendNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    if (!publish) {
      addLegacyCapture(noteMode ?? 'NOTE', text);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await publish({ kind: 'note', text });
      if (!result.ok) {
        setError(result.error ?? 'Le signal n’a pas pu être envoyé.');
        return;
      }
      const day = result.day ?? 1;
      const carnetId = result.carnetId ?? '';
      setCaptures((prev) => [
        {
          id: `sig-${Date.now()}`,
          type: 'NOTE',
          text,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);
      setNoteMode(null);
      setNoteText('');
      setSuccess(`Signal envoyé · J${day}`);
      if (carnetId) onPublished?.({ carnetId, day });
    } finally {
      setBusy(false);
    }
  };

  const actionButtonClass = (active: boolean, accent = false) =>
    `aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1 transition-transform active:scale-95 ${
      active
        ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
        : accent
          ? 'bg-gradient-to-br from-[var(--lkv-warning)] to-[var(--lkv-warning)] text-[var(--lkv-warning-dark)]'
          : 'bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-text-primary)]'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center select-none">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => handleFileChange('photo', e)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => handleFileChange('video', e)}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[color:var(--lkv-text-primary)] rounded-t-[34px] pt-3 pb-10 px-4 max-h-[85vh] overflow-y-auto space-y-5"
      >
        <div className="w-10 h-1 bg-[color:var(--lkv-primary)]/14 rounded-full mx-auto" />

        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              Capturer <em className="font-serif italic text-[color:var(--lkv-text-primary)]">un souvenir</em>
            </h2>
            <p className="text-[11px] font-mono text-[color:var(--lkv-text-muted)] tracking-wider mt-0.5">
              SIGNAL DE BORD · CARNET DU JOUR
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le signal de bord"
            className="w-11 h-11 rounded-full bg-[color:var(--lkv-surface-muted)] flex items-center justify-center text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-text-primary)]"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label="Prendre une photo et l’envoyer au carnet"
            className={actionButtonClass(false)}
          >
            <span className="text-xl leading-none" aria-hidden="true">📸</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              PHOTO
            </span>
          </button>

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            aria-label="Prendre une vidéo et l’envoyer au carnet"
            className={actionButtonClass(false)}
          >
            <span className="text-xl leading-none" aria-hidden="true">🎥</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              VIDÉO
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPending(null);
              setNoteMode('NOTE');
              setSuccess(null);
            }}
            aria-pressed={noteMode === 'NOTE'}
            aria-label="Écrire une note terrain"
            className={actionButtonClass(noteMode === 'NOTE')}
          >
            <span className="text-xl leading-none" aria-hidden="true">📝</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              NOTE
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPending(null);
              setNoteMode('MOMENT');
              setSuccess(null);
            }}
            aria-pressed={noteMode === 'MOMENT'}
            aria-label="Signaler un moment fort"
            className={actionButtonClass(noteMode === 'MOMENT', true)}
          >
            <span className="text-xl leading-none" aria-hidden="true">✨</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-center leading-none">
              MOMENT
            </span>
          </button>
        </div>

        {pending ? (
          <div className="p-3.5 bg-[color:var(--lkv-surface-muted)] rounded-2xl border border-[color:var(--lkv-border)] space-y-2.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[color:var(--lkv-text-primary)]">
              <span>
                {pending.kind === 'photo' ? '📸 Photo prête' : '🎥 Vidéo prête'} — une ligne avec ?
              </span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pending.previewUrl);
                  setPending(null);
                }}
                className="text-[color:var(--lkv-text-muted)] text-xs min-h-11 px-2"
              >
                Annuler
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-[color:var(--lkv-surface)] max-h-56">
              {pending.kind === 'photo' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pending.previewUrl} alt="Aperçu du signal" className="w-full max-h-56 object-cover" />
              ) : (
                <video src={pending.previewUrl} muted playsInline className="w-full max-h-56 object-cover" />
              )}
            </div>
            <label className="sr-only" htmlFor="signal-line">
              Ligne du signal
            </label>
            <input
              id="signal-line"
              value={lineText}
              onChange={(e) => setLineText(e.target.value)}
              maxLength={400}
              placeholder="Une ligne : ce que tu vis, là, maintenant…"
              className="w-full min-h-11 px-3 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] rounded-xl text-xs text-[color:var(--lkv-text-primary)] focus:outline-none focus:border-[color:var(--lkv-primary)]"
            />
            <button
              type="button"
              onClick={() => void sendMedia()}
              aria-busy={busy}
              disabled={busy}
              className="w-full min-h-11 py-2 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] lkv-rim-btn text-[color:var(--lkv-text-primary)] text-xs font-bold rounded-xl disabled:opacity-50 hover:brightness-[1.05] transition-colors"
            >
              {busy ? 'Envoi…' : 'Envoyer le signal'}
            </button>
          </div>
        ) : null}

        {noteMode ? (
          <div className="p-3.5 bg-[color:var(--lkv-surface-muted)] rounded-2xl border border-[color:var(--lkv-border)] space-y-2.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[color:var(--lkv-text-primary)]">
              <span>{noteMode === 'NOTE' ? '📝 Note terrain' : '✨ Moment fort'}</span>
              <button
                type="button"
                onClick={() => {
                  setNoteMode(null);
                  setNoteText('');
                }}
                className="text-[color:var(--lkv-text-muted)] text-xs min-h-11 px-2"
              >
                Annuler
              </button>
            </div>
            <label className="sr-only" htmlFor="signal-note">
              Ligne du signal
            </label>
            <textarea
              id="signal-note"
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={400}
              placeholder={
                noteMode === 'NOTE'
                  ? 'Ta note de terrain, en une ligne…'
                  : 'Le moment fort, en une ligne…'
              }
              className="w-full p-2.5 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] rounded-xl text-xs text-[color:var(--lkv-text-primary)] focus:outline-none focus:border-[color:var(--lkv-primary)]"
            />
            <button
              type="button"
              onClick={() => void sendNote()}
              aria-busy={busy}
              disabled={busy || !noteText.trim()}
              className="w-full min-h-11 py-2 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] lkv-rim-btn text-[color:var(--lkv-text-primary)] text-xs font-bold rounded-xl disabled:opacity-50 hover:brightness-[1.05] transition-colors"
            >
              {busy ? 'Envoi…' : 'Envoyer le signal'}
            </button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="px-2 text-xs text-[color:var(--lkv-danger)]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="px-2 text-xs font-semibold text-[color:var(--lkv-success-dark,var(--lkv-primary))]">
            {success}
          </p>
        ) : null}

        <div className="p-3.5 bg-[color:var(--lkv-forest-50)] border border-[color:var(--lkv-forest-200)] rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] text-[color:var(--lkv-text-primary)] flex items-center justify-center text-lg flex-shrink-0">
            📌
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[color:var(--lkv-text-primary)]">
              Rangé dans le <em className="font-serif italic text-[color:var(--lkv-text-primary)]">jour en cours</em>
            </div>
            <div className="text-[10px] font-mono text-[color:var(--lkv-primary-hover)] tracking-wider mt-0.5 truncate">
              {context?.place
                ? `Lieu : ${context.place}`
                : userLoc
                  ? `Position : ${userLoc[0].toFixed(4)}°, ${userLoc[1].toFixed(4)}°`
                  : 'Position GPS en attente…'}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
            Signaux envoyés ({captures.length})
          </h3>
          {captures.length === 0 ? (
            <div className="p-4 bg-[color:var(--glass-bg-medium)] border border-[color:var(--lkv-primary)]/06 rounded-2xl text-center">
              <p className="text-xs text-[color:var(--lkv-text-muted)]">
                Aucun signal envoyé pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {captures.map((cap) => (
                <div
                  key={cap.id}
                  className="p-3 bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span aria-hidden="true">
                      {cap.type === 'PHOTO' ? '📸' : cap.type === 'VIDEO' ? '🎥' : cap.type === 'NOTE' ? '📝' : '✨'}
                    </span>
                    <span className="font-medium text-[color:var(--lkv-text-primary)] truncate">
                      {cap.text || cap.type}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[color:var(--lkv-text-muted)] flex-shrink-0 ml-2">
                    {cap.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
