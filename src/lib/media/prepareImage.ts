'use client';

/**
 * Prépare une image avant envoi : réduit le côté le plus long à `maxSide`,
 * ré-encode en JPEG (ce qui retire EXIF et GPS) et ne grossit jamais.
 *
 * Les GIF restent intacts (le canvas détruirait l'animation) et tout échec
 * renvoie le fichier d'origine : la préparation ne doit jamais empêcher une
 * publication. Une photo de téléphone de 6 Mo passe sous 600 Ko.
 */

export const DEFAULT_MAX_SIDE = 2048;
export const DEFAULT_QUALITY = 0.85;

/** Dimensions réduites pour tenir dans `max`, proportions conservées, jamais agrandies. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest <= 0) return { width, height };
  const ratio = max / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function prepareImage(
  file: File,
  { maxSide = DEFAULT_MAX_SIDE, quality = DEFAULT_QUALITY }: { maxSide?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close?.();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    const name = `${file.name.replace(/\.[a-z0-9]+$/i, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
