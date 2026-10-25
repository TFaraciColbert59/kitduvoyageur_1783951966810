'use server';

import { cookies } from 'next/headers';
import {
  activeTripSchema,
  serializeActiveTrip,
  deserializeActiveTrip,
  ACTIVE_TRIP_COOKIE,
  type ActiveTripData,
} from './activeTripSchema';

/**
 * Récupère le voyage actif depuis le cookie httpOnly (Server-Side).
 */
export async function getActiveTrip(): Promise<ActiveTripData | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ACTIVE_TRIP_COOKIE)?.value;
    return deserializeActiveTrip(raw);
  } catch {
    return null;
  }
}

/**
 * Définit le voyage actif en cookie httpOnly (Server Action).
 */
export async function setActiveTripAction(data: ActiveTripData): Promise<{ success: boolean }> {
  try {
    const valid = activeTripSchema.parse(data);
    const serialized = serializeActiveTrip(valid);
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_TRIP_COOKIE, serialized, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.VERCEL === '1',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    });
    return { success: true };
  } catch (err) {
    console.error('[LKDV] setActiveTripAction error:', err);
    return { success: false };
  }
}

/**
 * Invalide et supprime le cookie de voyage actif (Server Action).
 */
export async function clearActiveTripAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_TRIP_COOKIE);
    return { success: true };
  } catch (err) {
    console.error('[LKDV] clearActiveTripAction error:', err);
    return { success: false };
  }
}
