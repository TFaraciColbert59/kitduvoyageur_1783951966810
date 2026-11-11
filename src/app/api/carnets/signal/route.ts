import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { momentInsertRow, validateMomentInput } from '@/features/carnet/detail/createMoment';
import { signalDayNumber, SIGNAL_MEDIA_RULES, SIGNAL_TEXT_MAX } from '@/features/carnet/detail/signalDeBord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/carnets/signal — « signal de bord » publié pendant la randonnée
 * (proposition n° 37 de `docs/carnets/maquette-carnets-de-bord.html`).
 *
 * Multipart : `kind` ('photo' | 'video' | 'note'), `text` (une ligne, <= 400),
 * `place` facultatif, `tripId` / `carnetId` facultatifs, `file` pour photo/vidéo.
 *
 * Le carnet est résolu côté serveur : carnet explicite (participant requis),
 * sinon un carnet de l'utilisateur en cours (dates couvrant aujourd'hui),
 * sinon le carnet lié au voyage (`tripId`), sinon un carnet minimal créé à
 * l'instant — le cockpit transmet ensuite son id à l'arrêt de la randonnée
 * pour éviter un doublon. Aucun client privilégié : la RLS de la session
 * applique les droits (carnets insert auteur, carnet_moments participant,
 * storage chemin `<uid>/carnet-moments/<carnetId>/…`).
 */

const uuid = z.string().uuid();

const kindSchema = z.enum(['photo', 'video', 'note']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Jour civil de Paris (`YYYY-MM-DD`), la date de référence des carnets. */
function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function parisDateLabel(): string {
  const label = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date());
  return `Carnet du ${label}`;
}

interface ResolvedCarnet {
  id: string;
  startDate: string | null;
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user ?? null;
  if (!user || user.is_anonymous) {
    return NextResponse.json({ ok: false, error: 'Connexion requise.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Envoi illisible.');
  }

  const kindParsed = kindSchema.safeParse(String(form.get('kind') ?? ''));
  if (!kindParsed.success) return badRequest('Type de signal inconnu.');
  const kind = kindParsed.data;

  const rawText = String(form.get('text') ?? '').trim();
  if (rawText.length > SIGNAL_TEXT_MAX) {
    return badRequest(`La ligne fait plus de ${SIGNAL_TEXT_MAX} caractères.`);
  }
  if (kind === 'note' && !rawText) {
    return badRequest('Écris une ligne avant d’envoyer ton signal.');
  }

  const placeRaw = String(form.get('place') ?? '').trim();
  const place = (placeRaw || 'En chemin').slice(0, 80);

  const tripIdRaw = form.get('tripId');
  const tripId =
    tripIdRaw && String(tripIdRaw).trim() ? uuid.safeParse(String(tripIdRaw).trim()) : null;
  if (tripId && !tripId.success) return badRequest('Voyage invalide.');

  const carnetIdRaw = form.get('carnetId');
  const carnetIdInput =
    carnetIdRaw && String(carnetIdRaw).trim()
      ? uuid.safeParse(String(carnetIdRaw).trim())
      : null;
  if (carnetIdInput && !carnetIdInput.success) return badRequest('Carnet invalide.');

  /* ── 1. Résolution du carnet ──────────────────────────────────────────── */
  let carnet: ResolvedCarnet | null = null;

  if (carnetIdInput?.success) {
    const { data: participant } = await supabase.rpc('is_carnet_participant', {
      p_carnet: carnetIdInput.data,
    });
    if (participant !== true) {
      return NextResponse.json(
        { ok: false, error: 'Tu ne participes pas à ce carnet.' },
        { status: 403 }
      );
    }
    const { data, error } = await supabase
      .from('carnets')
      .select('id, start_date')
      .eq('id', carnetIdInput.data)
      .maybeSingle();
    if (error || !data) return badRequest('Carnet introuvable.');
    carnet = { id: (data as { id: string }).id, startDate: (data as { start_date: string | null }).start_date };
  } else {
    const today = parisToday();
    const { data: current } = await supabase
      .from('carnets')
      .select('id, start_date')
      .eq('author_id', user.id)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (current) {
      carnet = {
        id: (current as { id: string }).id,
        startDate: (current as { start_date: string | null }).start_date,
      };
    } else if (tripId?.success) {
      const { data: byTrip } = await supabase
        .from('carnets')
        .select('id, start_date')
        .eq('trip_id', tripId.data)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byTrip) {
        carnet = {
          id: (byTrip as { id: string }).id,
          startDate: (byTrip as { start_date: string | null }).start_date,
        };
      }
    }

    if (!carnet) {
      /* Aucun carnet en cours : on en crée un minimal (l'auteur est autorisé
         par `carnets_insert`), le cockpit le réutilisera à l'arrêt. */
      const { data: created, error: createError } = await supabase
        .from('carnets')
        .insert({
          author_id: user.id,
          title: parisDateLabel(),
          start_date: today,
          end_date: today,
          visibility: 'private',
        })
        .select('id, start_date')
        .single();
      if (createError || !created) {
        console.error('[POST /api/carnets/signal] création du carnet', createError);
        return NextResponse.json(
          { ok: false, error: 'Impossible de créer le carnet du signal.' },
          { status: 500 }
        );
      }
      carnet = {
        id: (created as { id: string }).id,
        startDate: (created as { start_date: string | null }).start_date,
      };
    }
  }

  const day = signalDayNumber(carnet.startDate, new Date());

  /* ── 2. Média éventuel ─────────────────────────────────────────────────── */
  let imageUrl: string | null = null;
  if (kind !== 'note') {
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('Choisis un fichier à envoyer.');
    const rule = SIGNAL_MEDIA_RULES[kind];
    if (!rule.mimes.includes(file.type)) {
      return badRequest(
        kind === 'photo'
          ? 'Format photo non pris en charge (JPEG, PNG, WebP ou HEIC).'
          : 'Format vidéo non pris en charge (MP4, WebM ou MOV).'
      );
    }
    if (!file.size || file.size > rule.maxBytes) {
      return badRequest('Fichier vide ou trop lourd.');
    }
    const ext = EXT_BY_MIME[file.type] ?? 'bin';
    const path = `${user.id}/carnet-moments/${carnet.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const upload = await supabase.storage.from(rule.bucket).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) {
      console.error('[POST /api/carnets/signal] upload', upload.error);
      return NextResponse.json(
        { ok: false, error: 'Le média n’a pas pu être envoyé.' },
        { status: 500 }
      );
    }
    imageUrl = supabase.storage.from(rule.bucket).getPublicUrl(path).data.publicUrl;
  }

  /* ── 3. Insertion du moment, validée par le même schéma que la fiche ───── */
  const validated = validateMomentInput({
    type: kind === 'note' ? 'text' : kind,
    place,
    day,
    caption: rawText || undefined,
  });
  if (!validated.ok) return badRequest(validated.error);

  const row = momentInsertRow(validated.value, {
    carnetId: carnet.id,
    userId: user.id,
    authorName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    imageUrl,
    now: new Date(),
  });

  let result = await supabase.from('carnet_moments').insert(row).select('id').single();
  if (result.error?.code === '42703') {
    /* Migration moment_type pas appliquée : on écrit le moment sans type,
       il sera déduit à la relecture (même repli que le mode modification). */
    const { moment_type: _type, moment_meta: _meta, ...legacy } = row;
    void _type;
    void _meta;
    result = await supabase.from('carnet_moments').insert(legacy).select('id').single();
  }
  if (result.error || !result.data) {
    console.error('[POST /api/carnets/signal] insertion', result.error);
    return NextResponse.json(
      { ok: false, error: 'Le signal n’a pas pu être publié.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    carnetId: carnet.id,
    day,
    momentId: String((result.data as { id: string }).id),
  });
}
