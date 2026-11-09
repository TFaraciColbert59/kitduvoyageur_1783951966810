import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Avatar } from '@/ui/avatar';
import { Label } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Countdown } from '@/ui/countdown';
import { BlurredMedia } from '@/ui/blurred-media';
import { EmptyState } from '@/ui/states';
import { ErrorState } from '@/ui/error-state';
import { Kbd } from '@/ui/kbd';
import { Workspace } from '@/components/shell/workspace';
import { DecisionCard } from '@/components/case/decision-card';
import { POLE_LABELS } from '@/components/command/catalog';
import { getInbox, getInboxItem, getReasonCodes } from '@/components/data/admin-rpc';
import { relativeFr } from '@/lib/format';
import type { CaseDetail } from '@/lib/rpc';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  comment: 'Commentaire',
  post: 'Publication',
  story: 'Story',
  carnet: 'Carnet',
  club: 'Club',
  group: 'Groupe',
  crew: 'Tribu',
  place: 'Lieu',
  marketplace: 'Annonce',
  terrain: 'Signalement terrain',
  review: 'Avis',
  message: 'Message',
  sos: 'SOS',
  ticket: 'Ticket',
  request: 'Demande',
  alert: 'Alerte',
  contribution: 'Contribution',
  member: 'Membre'
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

function caseTitle(detail: CaseDetail): string {
  const base = kindLabel(detail.target.kind);
  const reports = detail.reports?.length ?? 0;
  if (reports > 0) return `${base} signalé ${reports} fois`;
  return base;
}

/** Carte de décision d'un cas (maquette `Moderation.dc.html`). */
export default async function CasePage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const { source, id } = await params;
  const [detailResult, codes, inbox] = await Promise.all([getInboxItem(source, id), getReasonCodes(), getInbox()]);
  const now = new Date().toISOString();

  if (!detailResult.data) {
    return (
      <Workspace>
        <Breadcrumb source={source} id={id} />
        <div className={s.card}>
          <ErrorState
            cause={detailResult.failure?.cause ?? 'Ce cas n’est pas accessible.'}
            solution={detailResult.failure?.solution ?? 'Revenez à la file et rouvrez le cas.'}
          />
        </div>
      </Workspace>
    );
  }

  const detail = detailResult.data;
  const items = inbox.data?.items ?? [];
  const index = items.findIndex((item) => item.source === source && item.id === id);
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
  const dueAt = index >= 0 ? (items[index]?.due_at ?? null) : null;

  const reports = detail.reports ?? [];
  const reasonsSummary = reports.reduce<Record<string, number>>((acc, report) => {
    acc[report.reason] = (acc[report.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Workspace
      rail={
        <>
          <Label>Contexte</Label>

          <div className={`${s.card} ${s.railCard}`}>
            {detail.member ? (
              <>
                <div className={s.rowFlex}>
                  <Avatar name={detail.member.name} size={40} />
                  <span className={s.col}>
                    <strong>{detail.member.name}</strong>
                    <span className={s.muted} style={{ fontSize: 12.5 }}>
                      {detail.member.member_since ? `Membre depuis ${detail.member.member_since}` : 'Ancienneté : non renseignée'}
                    </span>
                  </span>
                </div>
                <div className={s.miniGrid}>
                  <span className={s.mini}>
                    <span className={s.muted} style={{ fontSize: 12 }}>Signalements reçus</span>
                    <strong>{detail.member.reports_90d} en 90 jours</strong>
                  </span>
                  <span className={s.mini}>
                    <span className={s.muted} style={{ fontSize: 12 }}>Avertissements actifs</span>
                    <strong>{detail.member.active_strikes}</strong>
                  </span>
                </div>
                <Link href={`/membres/${detail.member.id}`} style={{ fontWeight: 600, fontSize: 13 }}>
                  Ouvrir la fiche complète →
                </Link>
              </>
            ) : (
              <span className={s.muted} style={{ fontSize: 13 }}>
                Auteur : non renseigné pour ce cas.
              </span>
            )}
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Règle concernée</Label>
            {detail.rule ? (
              <>
                <strong>{detail.rule.label}</strong>
                <span className={s.muted} style={{ fontSize: 12.5 }}>Échelle : {detail.rule.scale}</span>
              </>
            ) : (
              <span className={s.muted} style={{ fontSize: 12.5 }}>Règle : non renseignée pour ce cas.</span>
            )}
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Cas liés</Label>
            {detail.linked.length > 0 ? (
              detail.linked.map((link) => (
                <span key={link.id} style={{ fontSize: 13 }}>
                  {link.label}
                </span>
              ))
            ) : (
              <span className={s.muted} style={{ fontSize: 12.5 }}>Aucun cas lié connu.</span>
            )}
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Votre session</Label>
            <span style={{ fontSize: 13 }}>Le cas suivant est préchargé quand vous revenez à la file.</span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Une pause vous est proposée au-delà de 10 cas sensibles.
            </span>
          </div>
        </>
      }
    >
      <div className={s.between}>
        <span className={s.muted} style={{ fontSize: 13 }}>
          <Link href="/">À traiter</Link> › {POLE_LABELS[detail.pole] ?? detail.pole} ›{' '}
          {index >= 0 ? `Cas ${index + 1} sur ${items.length}` : 'Cas'}
        </span>
        <span className={s.rowFlexWrap}>
          <Countdown dueAt={dueAt} initialNow={now} fallback="Délai : non renseigné" />
          {previous ? (
            <Link href={`/cas/${previous.source}/${previous.id}`} className={`${s.btn} ${s.btnSoft} ${s.btnSm}`}>
              Cas précédent <Kbd>J</Kbd>
            </Link>
          ) : null}
          {next ? (
            <Link href={`/cas/${next.source}/${next.id}`} className={`${s.btn} ${s.btnSoft} ${s.btnSm}`}>
              Suivant <Kbd>K</Kbd>
            </Link>
          ) : null}
        </span>
      </div>

      <h1 className={s.titleSm}>{caseTitle(detail)}</h1>

      <div className={s.facts}>
        <div className={s.fact}>
          <span className={s.label}>Quoi</span>
          <span className={s.factValue}>{kindLabel(detail.target.kind)}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>{detail.target.title || 'Titre : non renseigné'}</span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Qui</span>
          <span className={s.factValue}>{detail.target.author_name ?? 'non renseigné'}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>
            {detail.member ? `${detail.member.active_strikes} avertissement(s) actif(s)` : 'Auteur non renseigné'}
          </span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Signalements</span>
          <span className={s.factValue}>{reports.length > 0 ? `${reports.length} membres` : 'Aucun'}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>
            {Object.keys(reasonsSummary).length > 0
              ? Object.entries(reasonsSummary)
                  .map(([reason, count]) => `${reason} ×${count}`)
                  .join(', ')
              : 'Motifs : non renseignés'}
          </span>
        </div>
        <div className={s.fact}>
          <span className={s.label}>Depuis</span>
          <span className={s.factValue}>{relativeFr(detail.target.created_at)}</span>
          <span className={s.muted} style={{ fontSize: 12.5 }}>Délai cible : non renseigné</span>
        </div>
      </div>

      <section className={`${s.card} ${s.padLg}`} aria-label="Contenu signalé">
        <div className={s.colGap}>
          <Label>Contenu signalé</Label>
          {detail.target.body ? (
            <blockquote className={s.quote}>{detail.target.body}</blockquote>
          ) : (
            <EmptyState title="Contenu non renseigné">Le texte de ce contenu n’est pas exposé par la base.</EmptyState>
          )}
          {detail.target.media.length > 0 ? (
            <BlurredMedia src={detail.target.media[0] ?? null} alt="Média joint au contenu signalé" />
          ) : (
            <span className={s.muted} style={{ fontSize: 12.5 }}>Aucun média joint.</span>
          )}
        </div>
      </section>

      <DecisionCard detail={detail} reasonCodes={codes} />

      <section
        className={`${s.card} ${s.padLg}`}
        style={{ background: 'var(--lkv-sage-50)', display: 'flex', gap: 14, alignItems: 'flex-start' }}
        aria-label="Suggestion de l’IA"
      >
        <Chip tone="stone">Suggestion IA</Chip>
        {detail.ai_suggestion ? (
          <span className={s.col} style={{ gap: 4, flex: 1 }}>
            <strong style={{ fontSize: 13.5 }}>
              {detail.ai_suggestion.label} · confiance{' '}
              {detail.ai_suggestion.confidence <= 1
                ? `${Math.round(detail.ai_suggestion.confidence * 100)} %`
                : `${detail.ai_suggestion.confidence} %`}
            </strong>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Visible maintenant que vous avez lu le contenu. L’agent propose ; la décision et le motif restent les vôtres.
            </span>
          </span>
        ) : (
          <span className={s.col} style={{ gap: 4, flex: 1 }}>
            <strong style={{ fontSize: 13.5 }}>Pas de suggestion</strong>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Aucun agent n’a proposé de décision sur ce cas. Votre lecture suffit.
            </span>
          </span>
        )}
      </section>
    </Workspace>
  );
}

function Breadcrumb({ source, id }: { source: string; id: string }) {
  return (
    <span className={s.muted} style={{ fontSize: 13 }}>
      <Link href="/">À traiter</Link> › Cas <span className={s.mono}>{source}:{id}</span>
    </span>
  );
}
