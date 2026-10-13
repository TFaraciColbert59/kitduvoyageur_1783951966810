'use client';

/**
 * A-096 — retire les métadonnées (EXIF, GPS) des images publiées en les
 * ré-encodant via canvas. Les GIF sont laissés intacts (le canvas détruirait
 * l'animation) et tout échec renvoie le fichier d'origine : ce nettoyage ne
 * doit jamais empêcher une publication.
 */
export async function stripImageMetadata(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    );
    if (!blob) return file;

    const name = `${file.name.replace(/\.[a-z0-9]+$/i, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
