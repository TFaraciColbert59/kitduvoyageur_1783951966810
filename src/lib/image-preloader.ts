/**
 * LKDV Image Preloader & Decode Cache
 *
 * Utilise HTMLImageElement.prototype.decode() pour décoder les images
 * en tâche de fond sur un thread séparé avant même que l'utilisateur n'ouvre la page.
 */

const decodedCache = new Set<string>();

export async function preloadAndDecodeImage(src: string): Promise<void> {
  if (!src || typeof window === "undefined" || decodedCache.has(src)) return;

  try {
    const img = new Image();
    img.src = src;
    img.decoding = "async";
    if ("decode" in img) {
      await img.decode();
    }
    decodedCache.add(src);
  } catch {
    // Échec silencieux
  }
}

export function batchPreloadImages(urls: string[]): void {
  if (typeof window === "undefined" || !("requestIdleCallback" in window)) {
    urls.slice(0, 5).forEach(preloadAndDecodeImage);
    return;
  }

  window.requestIdleCallback(() => {
    urls.forEach(preloadAndDecodeImage);
  }, { timeout: 2000 });
}
