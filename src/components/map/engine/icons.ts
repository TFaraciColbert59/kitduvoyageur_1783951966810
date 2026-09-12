import type { Map as MapLibreMap } from 'maplibre-gl';
import { MAP_COLORS } from './mapTheme';

/**
 * CHANTIER ATLAS — images d'icônes générées sur canvas (MapLibre addImage).
 * Aucun glyph/font externe : les compteurs de clusters sont dessinés sur canvas.
 */

const DOT_SIZE = 26;
const CLUSTER_SIZE = 56;

export const CLUSTER_BUCKETS = [5, 10, 25, 50, 100] as const;

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createDotImage(color: string): ImageData {
  const canvas = createCanvas(DOT_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[atlas/icons] canvas 2d indisponible');
  const center = DOT_SIZE / 2;
  ctx.beginPath();
  ctx.arc(center, center, center - 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = MAP_COLORS.white;
  ctx.stroke();
  return ctx.getImageData(0, 0, DOT_SIZE, DOT_SIZE);
}

function createUserDotImage(): ImageData {
  const canvas = createCanvas(DOT_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[atlas/icons] canvas 2d indisponible');
  const center = DOT_SIZE / 2;
  ctx.beginPath();
  ctx.arc(center, center, center - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(23,64,44,0.15)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(center, center, center - 6, 0, Math.PI * 2);
  ctx.fillStyle = MAP_COLORS.info;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = MAP_COLORS.white;
  ctx.stroke();
  return ctx.getImageData(0, 0, DOT_SIZE, DOT_SIZE);
}

function createClusterImage(count: number): ImageData {
  const canvas = createCanvas(CLUSTER_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[atlas/icons] canvas 2d indisponible');
  const center = CLUSTER_SIZE / 2;
  ctx.beginPath();
  ctx.arc(center, center, center - 3, 0, Math.PI * 2);
  ctx.fillStyle = MAP_COLORS.ink;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();

  const label = count >= 100 ? '99+' : String(count);
  ctx.fillStyle = MAP_COLORS.white;
  ctx.font = `600 ${label.length > 2 ? 14 : 16}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, center, center + 1);
  return ctx.getImageData(0, 0, CLUSTER_SIZE, CLUSTER_SIZE);
}

export function getClusterImageId(count: number): string {
  const bucket = CLUSTER_BUCKETS.find((b) => count < b) ?? 100;
  return `atlas-cluster-${bucket}`;
}

/**
 * Enregistre toutes les images du moteur (idempotent).
 * À appeler après l'événement `load` de la carte.
 */
export function registerAtlasMapImages(map: MapLibreMap): void {
  if (map.hasImage('atlas-dot-easy')) return;

  map.addImage('atlas-dot-easy', createDotImage(MAP_COLORS.sage));
  map.addImage('atlas-dot-moderate', createDotImage(MAP_COLORS.warn));
  map.addImage('atlas-dot-hard', createDotImage(MAP_COLORS.danger));
  map.addImage('atlas-dot-expert', createDotImage(MAP_COLORS.ink));
  map.addImage('atlas-dot-default', createDotImage(MAP_COLORS.inkTertiary));
  map.addImage('atlas-user-dot', createUserDotImage());

  for (const bucket of CLUSTER_BUCKETS) {
    map.addImage(`atlas-cluster-${bucket}`, createClusterImage(bucket));
  }
}
