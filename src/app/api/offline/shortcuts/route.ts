import { NextRequest, NextResponse } from 'next/server';
import {
  buildAndroidOfflineShortcuts,
  buildIosSpotlightSearchableItems,
  queryIosSpotlightOfflineIndex,
  resolveNativeShortcutLaunch,
  type OfflinePackManager,
} from '@/features/offline';
import { summaryToInstalledRecord } from '../_lib/adapters';
import { invalidBody, serverError } from '../_lib/http';
import { shortcutsInputSchema } from '../_lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/offline/shortcuts — descripteurs Android, index Spotlight iOS et
 * résolution d’un deep link (K4.19).
 *
 * Invariants du contrat : aucune entrée dans la navigation principale, aucune
 * écriture serveur. Seuls les paquets `available`/`degraded` sont indexés.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps invalide', details: 'JSON attendu' },
        { status: 400 }
      );
    }

    const parsed = shortcutsInputSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);

    const { packs, platform = 'all', query = '', deepLinkUri, maxDynamicShortcuts } = parsed.data;
    const records = packs.map(summaryToInstalledRecord);

    const androidShortcuts =
      platform === 'ios' ? [] : buildAndroidOfflineShortcuts(records, maxDynamicShortcuts ?? 4);
    const iosSpotlightItems =
      platform === 'android' ? [] : buildIosSpotlightSearchableItems(records);
    const queryHits = query.trim() ? queryIosSpotlightOfflineIndex(query, records) : null;

    let resolution = null;
    if (deepLinkUri) {
      // `resolveNativeShortcutLaunch` ne lit que `listInstalledPacks()` : un
      // adaptateur en lecture seule suffit, sans jamais construire de manager
      // qui pourrait écrire ou télécharger.
      const readonlyManager = {
        listInstalledPacks: () => records,
      } as unknown as OfflinePackManager;
      resolution = resolveNativeShortcutLaunch(deepLinkUri, readonlyManager, {
        platform: platform === 'android' ? 'android' : 'ios',
      });
    }

    return NextResponse.json(
      {
        androidShortcuts,
        iosSpotlightItems,
        queryHits,
        resolution,
        addsMainNavigationEntry: false,
        performsServerWrite: false,
      },
      { status: 200 }
    );
  } catch (error) {
    return serverError('offline/shortcuts', error);
  }
}
