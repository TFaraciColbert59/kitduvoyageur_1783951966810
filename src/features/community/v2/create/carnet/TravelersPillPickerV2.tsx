'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import type { CarnetFormValuesV2 } from '../engine/createSchemasV2';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  fetchSubscribersOnlyV2,
  normalizeSearchText,
  type SubscriberProfileV2,
} from './followersSearchV2';

interface SelectedTraveler {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isFriendId?: boolean;
}

function AvatarThumb({
  url,
  name,
}: {
  url?: string | null;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar abonné
      <img
        src={url}
        alt=""
        className="lkdv-post-preview-av-img"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="lkdv-post-preview-av-fallback">
      {(name.trim().slice(0, 1) || 'V').toUpperCase()}
    </span>
  );
}

/**
 * TravelersPillPickerV2 — rangée horizontale scrollable de pilules voyageurs
 * identiques aux pilules d'auteur des posts (`.lkdv-post-hero-author-pill`).
 * Recherche réelle et filtrée **uniquement dans nos abonnés/abonnements** avec
 * photo de profil et nom complets.
 */
export function TravelersPillPickerV2({
  userId,
  compact = false,
}: {
  userId: string | null;
  compact?: boolean;
}) {
  const form = useFormContext<CarnetFormValuesV2>();
  const collaborators = form.watch('collaborators') ?? [];
  const nbVoyageurs = form.watch('nbVoyageurs') ?? 1;
  const { haptic } = useHapticFeedback();

  const [subscribers, setSubscribers] = useState<SubscriberProfileV2[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Charge la liste réelle de nos abonnés dès qu'on connaît userId pour que
  // les pilules restaurées (brouillon) affichent aussi le vrai nom et la photo.
  useEffect(() => {
    let active = true;
    if (!userId) return undefined;
    const supabase = createClient();
    void fetchSubscribersOnlyV2(supabase, userId).then((list) => {
      if (!active) return;
      setSubscribers(list);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!editing) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [editing]);

  const selectedList: SelectedTraveler[] = useMemo(
    () =>
      collaborators.map((id) => {
        const match = subscribers.find((f) => f.id === id);
        return {
          id,
          name: match?.name ?? 'Voyageur',
          avatarUrl: match?.avatarUrl ?? null,
          isFriendId: true,
        };
      }),
    [collaborators, subscribers],
  );

  const syncCount = (nextCollabCount: number) => {
    const total = Math.max(1, 1 + nextCollabCount);
    if (form.getValues('nbVoyageurs') !== total) {
      form.setValue('nbVoyageurs', total, { shouldDirty: true, shouldValidate: true });
    }
  };

  const filteredFriends = useMemo(() => {
    const q = normalizeSearchText(query);
    const alreadyIds = new Set(collaborators);
    return subscribers
      .filter((f) => !alreadyIds.has(f.id))
      .filter((f) => {
        if (!q) return true;
        const nameMatch = normalizeSearchText(f.name).includes(q);
        const handleMatch = f.handle ? normalizeSearchText(f.handle).includes(q) : false;
        return nameMatch || handleMatch;
      })
      .slice(0, 8);
  }, [collaborators, subscribers, query]);

  const addFriend = (friend: SubscriberProfileV2) => {
    haptic('selection');
    const next = [...collaborators, friend.id];
    form.setValue('collaborators', next, { shouldDirty: true, shouldValidate: true });
    form.setValue('isCollaborative', true, { shouldDirty: true });
    syncCount(next.length);
    setQuery('');
    setEditing(false);
  };

  const removeTraveler = (item: SelectedTraveler) => {
    haptic('light');
    const next = collaborators.filter((id) => id !== item.id);
    form.setValue('collaborators', next, { shouldDirty: true, shouldValidate: true });
    if (next.length === 0) {
      form.setValue('isCollaborative', false, { shouldDirty: true });
    }
    syncCount(next.length);
  };

  const openEditor = () => {
    haptic('light');
    setEditing(true);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  return (
    <div
      className={`${compact ? 'lkdv-cv2c-travelers-wrap is-compact' : 'lkdv-cv2-field lkdv-cv2c-travelers-wrap'}`}
      ref={wrapRef}
    >
      {!compact ? (
        <label className="lkdv-cv2-field-label">
          Voyageurs ({nbVoyageurs})
        </label>
      ) : null}

      {editing ? (
        <div className="lkdv-cv2c-traveler-dropdown" role="listbox" aria-label="Choisir un voyageur parmi tes abonnés">
          {filteredFriends.map((friend) => (
            <button
              key={friend.id}
              type="button"
              className="lkdv-cv2c-traveler-dropdown-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addFriend(friend)}
            >
              <span className="lkdv-post-preview-av">
                <AvatarThumb url={friend.avatarUrl} name={friend.name} />
              </span>
              <span className="lkdv-cv2c-traveler-dropdown-meta">
                <span className="lkdv-cv2c-traveler-dropdown-name">{friend.name}</span>
                {friend.handle ? (
                  <small className="lkdv-cv2c-traveler-dropdown-handle">@{friend.handle}</small>
                ) : null}
              </span>
            </button>
          ))}
          {filteredFriends.length === 0 ? (
            <div className="lkdv-cv2c-traveler-dropdown-empty">
              {!loaded
                ? 'Chargement de tes abonnés…'
                : subscribers.length === 0
                  ? 'Aucun abonné trouvé pour le moment.'
                  : 'Aucun abonné correspondant.'}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="lkdv-cv2c-travelers-scroll">
        <div className="lkdv-cv2c-travelers-row">
          {selectedList.map((traveler) => (
            <div
              key={traveler.id}
              className="lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill"
            >
              <span className="lkdv-post-preview-av">
                <AvatarThumb url={traveler.avatarUrl} name={traveler.name} />
              </span>
              <span className="lkdv-post-hero-author-meta">
                <b>{traveler.name}</b>
              </span>
              <button
                type="button"
                className="lkdv-cv2c-encounter-chip-remove"
                aria-label={`Retirer ${traveler.name}`}
                onClick={() => removeTraveler(traveler)}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </div>
          ))}

          {editing ? (
            <div className="lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill is-editing">
              <span className="lkdv-post-preview-av">
                <span className="lkdv-post-preview-av-fallback">
                  {(query.trim().slice(0, 1) || '+').toUpperCase()}
                </span>
              </span>
              <input
                ref={inputRef}
                type="text"
                className="lkdv-cv2c-traveler-input"
                value={query}
                placeholder="Rechercher un abonné…"
                aria-label="Rechercher un voyageur"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredFriends.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    addFriend(filteredFriends[0]);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditing(false);
                  }
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill is-dashed"
              onClick={openEditor}
              aria-label="Ajouter un voyageur"
            >
              <span className="lkdv-post-preview-av lkdv-cv2c-traveler-plus-av">
                <Plus size={13} aria-hidden="true" />
              </span>
              <span className="lkdv-post-hero-author-meta">
                <b>{selectedList.length === 0 ? 'Ajouter un voyageur' : 'Ajouter'}</b>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
