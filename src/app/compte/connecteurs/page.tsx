import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import '@/components/compte/connectors/connectors.css';
import { ConnectorsScreen } from '@/components/compte/connectors/ConnectorsScreen';
import { createClient } from '@/lib/supabase/server';
import { getConnectorCatalog, getConnectorSyncQueue } from '@/lib/connectors/service';
import { hydrateConnectorConsentFromDb } from '@/lib/connectors/consents';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connecteurs partenaires — Compte',
  description:
    'Garmin, Wahoo, COROS, Suunto, Polar, Hammerhead, Strava et plateformes indoor : état réel, connexion OAuth, file de synchronisation et envoi d’itinéraires.',
};

const PROVIDER_LABELS: Record<string, string> = {
  garmin: 'Garmin Connect',
  garmin_connect_iq: 'Garmin Connect IQ',
  wahoo: 'Wahoo',
  coros: 'COROS',
  suunto: 'Suunto',
  polar: 'Polar',
  hammerhead: 'Hammerhead',
  bosch: 'Bosch eBike',
  apple_watch: 'Apple Watch',
  samsung_health: 'Samsung Health',
  zwift: 'Zwift',
  peloton: 'Peloton',
  trainerroad: 'TrainerRoad',
  rouvy: 'ROUVY',
  strava: 'Strava',
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ConnecteursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/connexion?next=/compte/connecteurs');
  }

  const params = await searchParams;
  const connected = firstParam(params.connected);
  const oauthError = firstParam(params.oauth_error);
  const notice = connected
    ? `${PROVIDER_LABELS[connected] ?? connected} est connecté. Vérifie les usages autorisés avant de synchroniser.`
    : null;
  const error = oauthError ? oauthError : null;

  await hydrateConnectorConsentFromDb(user.id, supabase);
  const catalog = getConnectorCatalog(user.id);
  const queue = getConnectorSyncQueue(user.id);

  return (
    <ConnectorsScreen
      initialCatalog={catalog}
      initialQueue={queue}
      initialNotice={notice}
      initialError={error}
    />
  );
}
