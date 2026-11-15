import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';
import { isValidContactDestination } from '@/features/compte/live-tracking/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Channel = z.enum(['sms', 'email', 'push', 'in_app']);
const Destination = z.string().trim().min(1).max(320);
const Create = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    channel: Channel,
    destination: Destination,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isValidContactDestination(value.channel, value.destination)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'Destination invalide pour ce canal.',
      });
    }
  });

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok({ contacts: await getLiveTrackingRuntime().listContacts(auth.user.id) });
  } catch {
    return fail('server', 'Impossible de charger les contacts de sécurité.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = Create.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('conflict', 'Contact invalide.');

  try {
    const result = await getLiveTrackingRuntime().addContact(auth.user.id, body.data);
    if (!result.ok) {
      if (result.error === 'max_contacts_reached') {
        return fail('conflict', 'Tu as atteint la limite de 5 contacts de sécurité.');
      }
      if (result.error === 'duplicate_contact') {
        return fail('conflict', 'Ce contact existe déjà pour ce canal.');
      }
      return fail('conflict', 'Contact invalide.');
    }
    return ok({ contact: result.contact }, 201);
  } catch {
    return fail('server', 'Impossible d’ajouter ce contact.');
  }
}
