'use client';

/**
 * Caméra directe de la story (`Story#8`) — `@capacitor/camera` déjà installé,
 * utilisé uniquement sur natif ; sur le web on retombe sur la galerie.
 *
 * Retourne un `File` prêt pour le téléversement (aucun blob: conservé).
 */
export interface CameraResultV2 {
  file: File;
  /** Chemin local Capacitor (prévisualisation éventuelle). */
  webPath: string;
}

function extensionFor(format: string | undefined): string {
  switch (format) {
    case 'png':
      return 'png';
    case 'gif':
      return 'gif';
    case 'heic':
      return 'heic';
    default:
      return 'jpg';
  }
}

export async function captureStoryPhoto(): Promise<CameraResultV2 | null> {
  if (typeof window === 'undefined') return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    width: 1440,
    correctOrientation: true,
    saveToGallery: false,
  });
  if (!photo.webPath) return null;
  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error('Lecture de la photo impossible.');
  const blob = await response.blob();
  const format = photo.format || 'jpeg';
  const extension = extensionFor(format);
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : `image/${format}`;
  const file = new File([blob], `story-${Date.now()}.${extension}`, { type });
  return { file, webPath: photo.webPath };
}

/** La caméra n'est proposée que dans une app Capacitor (pas dans un navigateur). */
export function cameraAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
}
