import type React from 'react';
import {
  type PhotoModifiersV2,
  DEFAULT_PHOTO_MODIFIERS,
} from '../engine/createSchemasV2';

export { type PhotoModifiersV2, DEFAULT_PHOTO_MODIFIERS };

export type PhotoEditorCategory = 'light' | 'color' | 'detail';

export interface ModifierSpec {
  key: keyof PhotoModifiersV2;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number | boolean;
  unit: string;
  formatValue: (val: number | boolean) => string;
}

export interface CategorySpec {
  id: PhotoEditorCategory;
  label: string;
  modifiers: readonly ModifierSpec[];
}

export const PHOTO_EDITOR_CATEGORIES: readonly CategorySpec[] = [
  {
    id: 'light',
    label: 'Lumière',
    modifiers: [
      {
        key: 'brightness',
        label: 'Luminosité',
        min: 50,
        max: 150,
        step: 1,
        defaultValue: 100,
        unit: '%',
        formatValue: (v) => `${v}%`,
      },
      {
        key: 'contrast',
        label: 'Contraste',
        min: 50,
        max: 150,
        step: 1,
        defaultValue: 100,
        unit: '%',
        formatValue: (v) => `${v}%`,
      },
      {
        key: 'exposure',
        label: 'Exposition',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`,
      },
      {
        key: 'shadows',
        label: 'Ombres',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`,
      },
      {
        key: 'warmth',
        label: 'Chaleur',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`,
      },
    ],
  },
  {
    id: 'color',
    label: 'Couleur',
    modifiers: [
      {
        key: 'saturation',
        label: 'Saturation',
        min: 0,
        max: 200,
        step: 1,
        defaultValue: 100,
        unit: '%',
        formatValue: (v) => `${v}%`,
      },
      {
        key: 'hue',
        label: 'Teinte',
        min: -180,
        max: 180,
        step: 1,
        defaultValue: 0,
        unit: '°',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}°`,
      },
      {
        key: 'temperature',
        label: 'Température',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`,
      },
      {
        key: 'fade',
        label: 'Estompage',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${v}%`,
      },
      {
        key: 'vibrance',
        label: 'Vibrance',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}%`,
      },
    ],
  },
  {
    id: 'detail',
    label: 'Détails & Géométrie',
    modifiers: [
      {
        key: 'rotation',
        label: 'Rotation',
        min: -45,
        max: 45,
        step: 1,
        defaultValue: 0,
        unit: '°',
        formatValue: (v) => `${Number(v) > 0 ? '+' : ''}${v}°`,
      },
      {
        key: 'vignette',
        label: 'Vignetage',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 0,
        unit: '%',
        formatValue: (v) => `${v}%`,
      },
      {
        key: 'blur',
        label: 'Netteté / Flou',
        min: 0,
        max: 8,
        step: 0.5,
        defaultValue: 0,
        unit: 'px',
        formatValue: (v) => `${v}px`,
      },
      {
        key: 'zoom',
        label: 'Zoom',
        min: 100,
        max: 150,
        step: 1,
        defaultValue: 100,
        unit: '%',
        formatValue: (v) => `${v}%`,
      },
      {
        key: 'flipX',
        label: 'Miroir horizontal',
        min: 0,
        max: 1,
        step: 1,
        defaultValue: false,
        unit: '',
        formatValue: (v) => (v ? 'Activé' : 'Désactivé'),
      },
    ],
  },
];

/**
 * Calcule la chaîne CSS filter et CSS transform correspondante
 * pour un rendu temps-réel à 60 fps sans recalcul lourd ni filtre prédéfini.
 */
export function computePhotoFilterAndTransform(modifiers?: Partial<PhotoModifiersV2>): {
  filter: string;
  transform: string;
} {
  const m = { ...DEFAULT_PHOTO_MODIFIERS, ...modifiers };

  // Calculs précis de la chaîne de filtres CSS
  const effectiveBrightness = Math.max(
    0,
    m.brightness + m.exposure + m.shadows * 0.2,
  );
  const effectiveContrast = Math.max(
    0,
    m.contrast * (1 - m.fade / 200) - m.shadows * 0.1,
  );
  const effectiveSaturation = Math.max(0, m.saturation + m.vibrance);

  const warmShift = m.warmth + m.temperature;
  const sepiaPercent = warmShift > 0 ? Math.min(100, warmShift * 0.4) : 0;
  const coolShift = warmShift < 0 ? warmShift * 0.2 : 0;
  const effectiveHue = m.hue + coolShift;

  const filters: string[] = [
    `brightness(${effectiveBrightness}%)`,
    `contrast(${effectiveContrast}%)`,
    `saturate(${effectiveSaturation}%)`,
    `hue-rotate(${effectiveHue}deg)`,
  ];

  if (sepiaPercent > 0) {
    filters.push(`sepia(${sepiaPercent}%)`);
  }

  if (m.blur > 0) {
    filters.push(`blur(${m.blur}px)`);
  }

  // Calculs précis des transformations géométriques
  const scaleX = m.flipX ? -1 : 1;
  const zoomFactor = Math.max(1, m.zoom / 100);
  const transform = `scaleX(${scaleX}) scale(${zoomFactor}) rotate(${m.rotation}deg)`;

  return {
    filter: filters.join(' '),
    transform,
  };
}

export function computePhotoStyle(modifiers?: Partial<PhotoModifiersV2>): React.CSSProperties {
  const { filter, transform } = computePhotoFilterAndTransform(modifiers);
  return {
    filter,
    transform,
    transformOrigin: 'center center',
    transition: 'filter 75ms ease-out, transform 75ms ease-out',
  };
}

export function computeVignetteOverlayStyle(vignette?: number): React.CSSProperties | null {
  const amount = vignette ?? 0;
  if (amount <= 0) return null;
  const safeAmount = Math.min(100, Math.max(0, amount));
  const innerRadius = Math.max(20, 100 - safeAmount * 0.7);
  const opacity = (safeAmount / 100) * 0.85;

  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    background: `radial-gradient(ellipse at center, transparent ${innerRadius}%, rgba(0, 0, 0, ${opacity}) 100%)`,
    mixBlendMode: 'multiply',
    transition: 'background 75ms ease-out',
  };
}

/**
 * Utilitaires d'export Canvas pour rendu haute fidélité
 */
export async function renderPhotoToCanvas(
  source: string | HTMLImageElement,
  modifiers: PhotoModifiersV2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const processImage = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 1000;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Impossible d’obtenir le contexte 2D Canvas.'));
        return;
      }

      const { filter } = computePhotoFilterAndTransform(modifiers);
      ctx.filter = filter;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((modifiers.rotation * Math.PI) / 180);
      const scaleX = modifiers.flipX ? -1 : 1;
      const zoom = Math.max(1, modifiers.zoom / 100);
      ctx.scale(scaleX * zoom, zoom);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();

      // Application du vignetage sur le Canvas si activé
      if (modifiers.vignette > 0) {
        ctx.save();
        const rad = Math.max(width, height) / 2;
        const grad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          rad * (1 - modifiers.vignette / 120),
          width / 2,
          height / 2,
          rad,
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${(modifiers.vignette / 100) * 0.85})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Échec de la génération du blob Canvas.'));
        },
        'image/jpeg',
        0.92,
      );
    };

    if (typeof source === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => processImage(img);
      img.onerror = () => reject(new Error(`Impossible de charger l’image: ${source}`));
      img.src = source;
    } else {
      if (source.complete) {
        processImage(source);
      } else {
        source.onload = () => processImage(source);
        source.onerror = () => reject(new Error('Impossible de charger l’élément image.'));
      }
    }
  });
}
