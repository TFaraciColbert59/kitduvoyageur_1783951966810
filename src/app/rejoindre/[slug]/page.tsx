import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadJoinPreview } from '@/features/trips/server/joinActivity';

export const dynamic = 'force-dynamic';

interface RejoindrePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; erreur?: string }>;
}

function formatCivilDate(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

function HonestUnavailable() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <section className="glass rounded-[var(--lkv-radius-card)] p-5" aria-label="Invitation indisponible">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Invitation
        </p>
        <h1 className="mt-1 font-display text-lg font-extrabold text-[var(--lkv-text-primary)]">
          Ce lien ne permet pas de rejoindre une activité
        </h1>
        <p className="mt-2 text-sm text-[var(--lkv-text-primary)]/75">
          Vérifiez le lien reçu ou demandez une nouvelle invitation au propriétaire de
          l&apos;activité.
        </p>
      </section>
      <Link
        href="/hub"
        className="glass-capsule-btn inline-flex min-h-[44px] items-center justify-center !py-3 text-sm font-bold text-[var(--lkv-primary)]"
      >
        Retour au hub
      </Link>
    </main>
  );
}

/**
 * Task 17 — Page « Rejoindre » mobile-first : résumé honnête de l'activité,
 * consentement explicite puis envoi du formulaire vers la route `accepter`.
 * Anonyme → connexion avec retour ; déjà membre → hub ; lien invalide → page
 * honnête (aucune donnée du voyage révélée).
 */
export default async function RejoindrePage({ params, searchParams }: RejoindrePageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.token === 'string' && sp.token.trim() !== '' ? sp.token.trim() : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = token
    ? `/rejoindre/${slug}?token=${encodeURIComponent(token)}`
    : `/rejoindre/${slug}`;

  if (!user) {
    redirect(`/connexion?next=${encodeURIComponent(nextPath)}`);
  }

  const preview = await loadJoinPreview(slug, { userId: user.id, token });
  if (preview?.alreadyMember) redirect('/hub');
  if (!preview || !preview.accessAllowed) return <HonestUnavailable />;

  const dateRange =
    formatCivilDate(preview.startDate) && formatCivilDate(preview.endDate)
      ? `${formatCivilDate(preview.startDate)} → ${formatCivilDate(preview.endDate)}`
      : formatCivilDate(preview.startDate) ?? 'Dates à préciser';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-5 px-4 py-10">
      {sp.erreur && (
        <div
          role="alert"
          className="glass tone-danger rounded-2xl p-3 text-xs text-[var(--lkv-danger)]"
        >
          La jonction n&apos;a pas abouti. Réessayez ou demandez une nouvelle invitation.
        </div>
      )}

      <section className="glass rounded-[var(--lkv-radius-card)] p-5" aria-label="Activité à rejoindre">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Invitation à préparer à plusieurs
        </p>
        <h1 className="mt-1 font-display text-xl font-extrabold text-[var(--lkv-text-primary)]">
          {preview.title}
        </h1>
        <dl className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="glass-sub-card rounded-2xl p-3">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Destination
            </dt>
            <dd className="mt-1 text-sm font-bold text-[var(--lkv-text-primary)]">
              {preview.destinationName ?? 'À préciser'}
            </dd>
          </div>
          <div className="glass-sub-card rounded-2xl p-3">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Dates
            </dt>
            <dd className="mt-1 text-sm font-bold text-[var(--lkv-text-primary)]">{dateRange}</dd>
          </div>
          <div className="glass-sub-card rounded-2xl p-3">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Participants
            </dt>
            <dd className="mt-1 text-sm font-bold tabular-nums text-[var(--lkv-text-primary)]">
              {preview.participantsCount}
            </dd>
          </div>
          <div className="glass-sub-card rounded-2xl p-3">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Préparation
            </dt>
            <dd className="mt-1 text-sm font-bold text-[var(--lkv-text-primary)]">
              Recalculée à chaque arrivée
            </dd>
          </div>
        </dl>
      </section>

      <form
        action={`/rejoindre/${slug}/accepter`}
        method="post"
        className="glass space-y-4 rounded-[var(--lkv-radius-card)] p-5"
      >
        <input type="hidden" name="token" value={token ?? ''} />
        <label className="flex items-start gap-3 rounded-2xl">
          <input
            type="checkbox"
            name="consent"
            value="true"
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/60"
            aria-describedby="consent-details"
          />
          <span className="text-sm font-semibold text-[var(--lkv-text-primary)]">
            Utiliser mon profil d&apos;auto-apprentissage pour préparer à plusieurs
          </span>
        </label>
        <p id="consent-details" className="text-[11px] leading-relaxed text-[var(--lkv-text-primary)]/70">
          Votre profil appris n&apos;est lu que si un consentement « performance personnelle »
          est actif. Sans cette case, la préparation utilise des moyennes population — jamais
          un profil inventé. Vous pourrez le modifier à tout moment.
        </p>
        <button
          type="submit"
          className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center !py-3 text-sm font-bold"
        >
          Rejoindre
        </button>
      </form>
    </main>
  );
}
