'use client';

import React, { useEffect, useState } from 'react';
import { Archive, Check, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import type { ArchivedStoryItem } from '@/app/api/stories/archive/route';
import { StoryArchiveDrawer } from '@/components/stories/StoryArchiveDrawer';
import type { ClubStoryHighlight } from './ClubInlineFeed';

export interface ClubHighlightManageDrawerProps {
  isOpen: boolean;
  clubId: string;
  clubName: string;
  highlight: ClubStoryHighlight | null;
  isCreating?: boolean;
  archiveStories: ArchivedStoryItem[];
  onSave: (payload: {
    highlightId?: string;
    title: string;
    coverUrl: string;
    coverStoryId: string | null;
    storyIds: string[];
  }) => Promise<void> | void;
  onDelete?: (highlightId: string) => Promise<void> | void;
  onClose: () => void;
}

/**
 * Drawer de gestion d'une Story à la une du club (ouvert sur appui long par un membre habilité) :
 * - Modifier l'image affichée sur la page du club (couverture depuis une story ou URL) ;
 * - Modifier le nom de la story à la une ;
 * - Retirer individuellement certaines stories ou supprimer tout l'album ;
 * - Ajouter d'autres stories depuis le drawer universel d'archives du club (avec auteur conservé).
 */
export function ClubHighlightManageDrawer({
  isOpen,
  clubId,
  clubName,
  highlight,
  isCreating = false,
  archiveStories,
  onSave,
  onDelete,
  onClose,
}: ClubHighlightManageDrawerProps) {
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverStoryId, setCoverStoryId] = useState<string | null>(null);
  const [selectedStories, setSelectedStories] = useState<ArchivedStoryItem[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (highlight && !isCreating) {
      setTitle(highlight.title || '');
      setCoverUrl(highlight.coverUrl || '');
      setCoverStoryId(highlight.coverStoryId ?? highlight.slides[0]?.storyId ?? null);
      const slideStoryIds = new Set(
        highlight.slides.map((s) => s.storyId || s.id).filter(Boolean),
      );
      const matchedFromArchive = archiveStories.filter((st) => slideStoryIds.has(st.id));
      if (matchedFromArchive.length > 0) {
        setSelectedStories(matchedFromArchive);
      } else {
        setSelectedStories(
          highlight.slides.map((s) => ({
            id: s.storyId || s.id,
            authorId: s.authorId || '',
            authorName: s.authorName || clubName,
            authorHandle: s.authorHandle || 'club',
            authorAvatarUrl: s.authorAvatarUrl ?? null,
            imageUrl: s.image || highlight.coverUrl,
            caption: s.caption || '',
            mediaType: 'image',
            createdAt: s.createdAt || new Date().toISOString(),
            expiresAt: s.createdAt || new Date().toISOString(),
            isExpired: false,
            clubId,
            outingId: s.outingId ?? null,
            outingTitle: s.outingTitle ?? null,
            massif: null,
            spot: s.spot ?? null,
            lat: null,
            lng: null,
            trackProgress: null,
          })),
        );
      }
    } else {
      setTitle('');
      setCoverUrl(archiveStories[0]?.imageUrl || '/assets/images/mountain-1.jpg');
      setCoverStoryId(archiveStories[0]?.id ?? null);
      setSelectedStories(archiveStories.slice(0, 2));
    }
    setArchiveOpen(false);
  }, [archiveStories, clubId, clubName, highlight, isCreating, isOpen]);

  if (!isOpen) return null;

  const removeStory = (storyId: string) => {
    setSelectedStories((prev) => {
      const next = prev.filter((s) => s.id !== storyId);
      if (coverStoryId === storyId) {
        setCoverStoryId(next[0]?.id ?? null);
        if (next[0]?.imageUrl) setCoverUrl(next[0].imageUrl);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const cleanTitle = title.trim() || highlight?.title || 'À la une';
    setSaving(true);
    try {
      await onSave({
        highlightId: isCreating ? undefined : highlight?.id,
        title: cleanTitle,
        coverUrl: coverUrl.trim() || selectedStories[0]?.imageUrl || '/assets/images/mountain-1.jpg',
        coverStoryId,
        storyIds: selectedStories.map((s) => s.id),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!highlight?.id || !onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(highlight.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? 'Créer une story à la une' : `Modifier la story à la une ${highlight?.title ?? ''}`}
        data-testid="club-highlight-manage-drawer"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3250,
          background: 'rgba(12, 22, 18, 0.56)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 400,
            maxHeight: '85vh',
            borderRadius: 26,
            background: 'rgba(247, 250, 246, 0.96)',
            border: '0.5px solid rgba(255, 255, 255, 0.85)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#172b24',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '0.5px solid rgba(23, 64, 44, 0.1)',
            }}
          >
            <div>
              <b style={{ fontSize: 15, display: 'block' }}>
                {isCreating ? 'Nouvelle story à la une' : `Modifier · ${highlight?.title ?? 'À la une'}`}
              </b>
              <small style={{ fontSize: 11, color: '#56665d' }}>
                Couverture, nom et stories issues des archives du club
              </small>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l’éditeur de story à la une"
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: 0,
                background: 'rgba(23, 64, 44, 0.08)',
                color: '#17402c',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Aperçu circulaire + Titre + URL Couverture */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 12,
                borderRadius: 18,
                background: 'rgba(255, 255, 255, 0.86)',
                border: '0.5px solid rgba(23, 64, 44, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    padding: 2.5,
                    border: '2px solid #17402c',
                    background: '#fff',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl || '/assets/images/mountain-1.jpg'}
                    alt="Aperçu couverture"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                </div>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 700 }}>
                  <span>Nom affiché sur la page club</span>
                  <input
                    type="text"
                    className="club-glass-input"
                    value={title}
                    maxLength={32}
                    placeholder="Ex. Lac d’Annecy, GR 55…"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ImageIcon size={12} aria-hidden="true" />
                  <span>Image de couverture (URL ou choisir ci-dessous)</span>
                </span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={coverUrl}
                  placeholder="/assets/images/..."
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    setCoverStoryId(null);
                  }}
                />
              </label>
            </div>

            {/* Stories incluses + Bouton Archives */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                borderRadius: 18,
                background: 'rgba(255, 255, 255, 0.86)',
                border: '0.5px solid rgba(23, 64, 44, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 13 }}>
                  Stories incluses ({selectedStories.length})
                </b>
                <button
                  type="button"
                  className="lkdv-carnet-btn-soft"
                  style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
                  onClick={() => setArchiveOpen(true)}
                  data-testid="open-club-story-archive-btn"
                >
                  <Archive size={12} aria-hidden="true" />
                  <span>Ajouter depuis les archives</span>
                </button>
              </div>

              {selectedStories.length === 0 ? (
                <div
                  style={{
                    padding: '14px 10px',
                    borderRadius: 12,
                    border: '1px dashed rgba(23, 64, 44, 0.2)',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#56665d',
                  }}
                >
                  Aucune story sélectionnée. Clique sur « Ajouter depuis les archives » pour en choisir.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {selectedStories.map((st) => {
                    const isCover = coverStoryId === st.id || (!coverStoryId && coverUrl === st.imageUrl);
                    return (
                      <div
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: 6,
                          borderRadius: 12,
                          background: isCover ? 'rgba(23, 64, 44, 0.08)' : 'rgba(247, 249, 246, 0.9)',
                          border: isCover
                            ? '1px solid rgba(23, 64, 44, 0.28)'
                            : '0.5px solid rgba(23, 64, 44, 0.08)',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={st.imageUrl}
                          alt={st.caption || st.spot || 'Story'}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 650,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {st.caption || st.spot || 'Story du club'}
                          </div>
                          <small style={{ fontSize: 10.5, color: '#56665d', display: 'block' }}>
                            Par {st.authorName}
                            {st.spot ? ` · ${st.spot}` : ''}
                          </small>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCoverStoryId(st.id);
                            setCoverUrl(st.imageUrl);
                          }}
                          title="Utiliser comme image de couverture"
                          aria-label={`Définir la story de ${st.authorName} comme couverture`}
                          style={{
                            height: 26,
                            padding: '0 8px',
                            borderRadius: 999,
                            border: '0.5px solid rgba(23, 64, 44, 0.18)',
                            background: isCover ? '#17402c' : '#fff',
                            color: isCover ? '#fff' : '#17402c',
                            fontSize: 10,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {isCover ? <Check size={10} aria-hidden="true" /> : <ImageIcon size={10} aria-hidden="true" />}
                          <span>{isCover ? 'Couv.' : 'Couv.'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStory(st.id)}
                          aria-label={`Retirer la story de ${st.authorName}`}
                          title="Retirer de cette story à la une"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            border: 0,
                            background: 'rgba(168, 68, 58, 0.1)',
                            color: '#a8443a',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px 14px',
              borderTop: '0.5px solid rgba(23, 64, 44, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.92)',
            }}
          >
            {!isCreating && highlight && onDelete ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ color: '#a8443a', height: 36, padding: '0 12px', fontSize: 12 }}
                disabled={deleting || saving}
                onClick={() => {
                  void handleDelete();
                }}
              >
                <Trash2 size={13} aria-hidden="true" />
                <span>{deleting ? 'Suppression…' : 'Supprimer'}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="lkdv-carnet-btn-primary"
              style={{ flex: 1, justifyContent: 'center', height: 36, fontSize: 12.5 }}
              disabled={saving || deleting}
              onClick={() => {
                void handleSave();
              }}
            >
              {isCreating ? <Plus size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              <span>{saving ? 'Enregistrement…' : isCreating ? 'Créer la story à la une' : 'Enregistrer'}</span>
            </button>
          </div>
        </div>
      </div>

      <StoryArchiveDrawer
        isOpen={archiveOpen}
        scope="club"
        scopeId={clubId}
        title={`Archives · ${clubName}`}
        mode="select"
        initialSelectedIds={selectedStories.map((s) => s.id)}
        prefetchedStories={archiveStories}
        onConfirmSelection={(picked) => {
          setSelectedStories(picked);
          if (!coverUrl && picked[0]?.imageUrl) {
            setCoverUrl(picked[0].imageUrl);
            setCoverStoryId(picked[0].id);
          }
          setArchiveOpen(false);
        }}
        onClose={() => setArchiveOpen(false)}
      />
    </>
  );
}

export default ClubHighlightManageDrawer;
