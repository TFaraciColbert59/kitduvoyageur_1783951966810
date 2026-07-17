import { NextResponse } from 'next/server';

export const maxDuration = 60;

/**
 * POST /api/map/seed-trails
 *
 * Seeds Supabase hiking_trails with real GPS data from OpenStreetMap
 * by calling the Supabase Edge Function for one or multiple zones.
 *
 * Body options:
 *   { zone: "chamonix" }                    — single zone
 *   { zones: ["chamonix", "vercors"] }      — multiple zones (sequential)
 *   { zone: "all" }                          — all predefined zones
 */

const ALL_ZONES = [
  'chamonix',
  'vercors',
  'belledonne',
  'mercantour',
  'pyrenees',
  'alpes_sud',
  'ecrins',
  'jura',
  'corsica',
  'alpes_nord',
];

export async function POST() {
  return NextResponse?.json({ disabled: true });
}

/**
 * GET /api/map/seed-trails
 * Returns available zones for seeding.
 */
export async function GET() {
  return NextResponse?.json({ disabled: true });
}
