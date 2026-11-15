import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  buildOffersOverview,
  claimFreeStarterRegion,
  inviteFamilySeat,
  refreshUnlockedRegionMaps,
  revokeFamilySeat,
  submitStudentVerificationEmail,
} from '@/features/offers/server/offersStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('claim_free_region'),
    regionId: z.string().trim().min(1).max(80),
  }).strict(),
  z.object({
    action: z.literal('refresh_maps'),
    regionIds: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  }).strict(),
  z.object({
    action: z.literal('invite_family_seat'),
    email: z.string().trim().email().max(160),
  }).strict(),
  z.object({
    action: z.literal('revoke_family_seat'),
    seatId: z.string().trim().min(1).max(80),
  }).strict(),
  z.object({
    action: z.literal('submit_student_email'),
    email: z.string().trim().email().max(160),
  }).strict(),
]);

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const isNativeIos = url.searchParams.get('platform') === 'ios';
    const overview = await buildOffersOverview(
      auth.user.id,
      auth.user.email ?? '',
      { isNativeIos },
    );
    return ok(overview);
  } catch {
    return fail('server', 'Impossible de charger vos offres et droits.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail('conflict', 'Action offre invalide.');
  }

  const body = parsed.data;
  const email = auth.user.email ?? '';

  try {
    if (body.action === 'claim_free_region') {
      const res = await claimFreeStarterRegion(auth.user.id, email, body.regionId);
      if (!res.ok) return fail('conflict', res.message);
    } else if (body.action === 'refresh_maps') {
      await refreshUnlockedRegionMaps(auth.user.id, email, body.regionIds);
    } else if (body.action === 'invite_family_seat') {
      const res = await inviteFamilySeat(auth.user.id, email, body.email);
      if (!res.ok) return fail('conflict', res.message);
    } else if (body.action === 'revoke_family_seat') {
      const res = revokeFamilySeat(auth.user.id, email, body.seatId);
      if (!res.ok) return fail('conflict', res.message);
    } else if (body.action === 'submit_student_email') {
      submitStudentVerificationEmail(auth.user.id, email, body.email);
    }

    const overview = await buildOffersOverview(auth.user.id, email);
    return ok(overview);
  } catch {
    return fail('server', 'Traitement offre impossible.');
  }
}
