'use client';

import React from 'react';
import { Palette, SlidersHorizontal, Sun } from 'lucide-react';
import type { PhotoEditorCategory } from './photoEditor';

export interface PhotoEditorPillProps {
  activeCategory: PhotoEditorCategory | null;
  onSelectCategory: (category: PhotoEditorCategory) => void;
  className?: string;
}

/**
 * Pilule flottante en verre en bas à droite de l'aperçu photo (F1.3 / F1.4)
 * Remplace Like, Comment, Share par 3 icônes de catégories d'édition :
 * - Lumière (Sun)
 * - Couleur (Palette)
 * - Détails & Géométrie (SlidersHorizontal)
 */
export function PhotoEditorPill({
  activeCategory,
  onSelectCategory,
  className = '',
}: PhotoEditorPillProps) {
  const handleClick = (e: React.MouseEvent, category: PhotoEditorCategory) => {
    e.stopPropagation();
    onSelectCategory(category);
  };

  return (
    <div
      className={`lkdv-post-editor-pill ${className}`.trim()}
      role="toolbar"
      aria-label="Catégories de retouche photo"
      data-testid="photo-editor-pill"
    >
      <button
        type="button"
        role="button"
        aria-label="Lumière"
        aria-pressed={activeCategory === 'light'}
        data-testid="editor-cat-light"
        className={`lkdv-post-editor-pill-btn ${activeCategory === 'light' ? 'is-active' : ''}`}
        onClick={(e) => handleClick(e, 'light')}
        title="Lumière (Luminosité, Contraste, Exposition, Ombres, Chaleur)"
      >
        <Sun size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      <button
        type="button"
        role="button"
        aria-label="Couleur"
        aria-pressed={activeCategory === 'color'}
        data-testid="editor-cat-color"
        className={`lkdv-post-editor-pill-btn ${activeCategory === 'color' ? 'is-active' : ''}`}
        onClick={(e) => handleClick(e, 'color')}
        title="Couleur (Saturation, Teinte, Température, Estompage, Vibrance)"
      >
        <Palette size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      <button
        type="button"
        role="button"
        aria-label="Détails & Géométrie"
        aria-pressed={activeCategory === 'detail'}
        data-testid="editor-cat-detail"
        className={`lkdv-post-editor-pill-btn ${activeCategory === 'detail' ? 'is-active' : ''}`}
        onClick={(e) => handleClick(e, 'detail')}
        title="Détails & Géométrie (Rotation, Vignetage, Netteté/Flou, Zoom, Miroir)"
      >
        <SlidersHorizontal size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default PhotoEditorPill;
