'use server';

import { cookies } from 'next/headers';
import {
  adventureSchema,
  serializeActiveAdventure,
  deserializeActiveAdventure,
  ACTIVE_ADVENTURE_COOKIE,
  type ActiveAdventureData,
} from './adventureSchema';

/**
 * H2.2 — Persistance serveur de l'aventure active (miroir activeTripServer).
 * Cookie httpOnly 30 jours. L'IA peut suggérer le contexte par défaut, jamais
 * restreindre la liste — le serveur ne filtre rien.
 */
export async function getActiveAdventure(): Promise<ActiveAdventureData | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ACTIVE_ADVENTURE_COOKIE)?.value;
    return deserializeActiveAdventure(raw);
  } catch {
    return null;
  }
}

export async function setActiveAdventureAction(data: ActiveAdventureData): Promise<{ success: boolean }> {
  try {
    const valid = adventureSchema.parse(data);
    const serialized = serializeActiveAdventure(valid);
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ADVENTURE_COOKIE, serialized, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.VERCEL === '1',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    });
    return { success: true };
  } catch (err) {
    console.error('[LKDV] setActiveAdventureAction error:', err);
    return { success: false };
  }
}

export async function clearActiveAdventureAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_ADVENTURE_COOKIE);
    return { success: true };
  } catch (err) {
    console.error('[LKDV] clearActiveAdventureAction error:', err);
    return { success: false };
  }
}
