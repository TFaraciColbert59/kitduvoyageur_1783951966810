'use server';

import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LivePositionSnapshot {
  userId: string;
  routeRevision: number | null;
  alongMeters: number | null;
  lat: number;
  lon: number;
  accuracyM: number | null;
  batteryPct: number | null;
  recordedAt: string;
  expiresAt: string;
}

export async function publishHubLivePosition(input: {
  tripId: string;
  lat: number;
  lon: number;
  recordedAt: string;
  alongMeters?: number | null;
  routeRevision?: number | null;
  accuracyM?: number | null;
  batteryPct?: number | null;
  sharingEnabled?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(input.tripId)) return { ok: false, message: 'Voyage invalide.' };
  if (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90 || !Number.isFinite(input.lon) || Math.abs(input.lon) > 180) {
    return { ok: false, message: 'Coordonnées GPS invalides.' };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { error } = await supabase.rpc('upsert_trip_live_position', {
    p_trip_id: input.tripId,
    p_lat: input.lat,
    p_lon: input.lon,
    p_recorded_at: input.recordedAt,
    p_along_meters: input.alongMeters ?? null,
    p_route_revision: input.routeRevision ?? null,
    p_accuracy_m: input.accuracyM ?? null,
    p_battery_pct: input.batteryPct ?? null,
    p_sharing_enabled: input.sharingEnabled ?? true,
  });

  if (error) {
    return { ok: false, message: error.code === '42501' ? 'Partage non autorisé.' : 'Position non enregistrée.' };
  }
  return { ok: true };
}

export async function readHubLivePositions(tripId: string): Promise<LivePositionSnapshot[]> {
  if (!UUID.test(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('read_trip_live_positions', { p_trip_id: tripId });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({
    userId: String(row.user_id),
    routeRevision: row.route_revision == null ? null : Number(row.route_revision),
    alongMeters: row.along_meters == null ? null : Number(row.along_meters),
    lat: Number(row.lat),
    lon: Number(row.lon),
    accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
    batteryPct: row.battery_pct == null ? null : Number(row.battery_pct),
    recordedAt: String(row.recorded_at),
    expiresAt: String(row.expires_at),
  }));
}

export async function saveHubSafetyContact(input: {
  tripId: string;
  contactName: string;
  contactChannel: 'phone' | 'sms' | 'email';
  contactValue: string;
  consentConfirmed: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!UUID.test(input.tripId)) return { ok: false, message: 'Voyage invalide.' };
  const name = input.contactName.trim().slice(0, 120);
  const value = input.contactValue.trim().slice(0, 160);
  if (!name || value.length < 3) return { ok: false, message: 'Nom et coordonnée du contact requis.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { data, error } = await supabase
    .from('trip_safety_contacts')
    .insert({
      trip_id: input.tripId,
      owner_id: user.id,
      contact_name: name,
      contact_channel: input.contactChannel,
      contact_value: value,
      consent_confirmed: Boolean(input.consentConfirmed),
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, message: 'Impossible d’enregistrer le contact de sécurité.' };
  return { ok: true, id: data.id };
}
