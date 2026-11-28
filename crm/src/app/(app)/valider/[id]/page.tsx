import Link from 'next/link';
import s from '../../../../ui/crm.module.css';
import { Label } from '../../../../ui/card';
import { Chip } from '../../../../ui/chip';
import { ErrorState } from '../../../../ui/error-state';
import { Workspace } from '../../../../components/shell/workspace';
import { ApprovalPanel } from '../../../../components/approval/approval-panel';
import { requestedCents } from '../../../../components/approval/format';
import { LOCAL_CATALOG, POLE_LABELS } from '../../../../lib/catalog-local';
import { getRequestDetail } from '../../../../components/data/admin-rpc';
import { euros } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

type Article = { label?: unknown; qty?: unknown; amount_cents?: unknown };

/** Lignes d'articles lues dans les paramètres quand l'agent les fournit (aucune invention). */
function articles(params: Record<string, unknown>): { label: string; qty: number | null; cents: number | null }[] {
  const raw = params.items ?? params.articles;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Article => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label : 'Article non nommé',
      qty: typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : null,
      cents: typeof item.amount_cents === 'number' && Number.isFinite(item.amount_cents) ? item.amount_cents : null
    }));
}

/** Demande à valider (maquette `Remboursement.dc.html`). */
export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getRequestDetail(id);

  if (!result.data) {
    return (
      <Workspace>
        <span className={s.muted} style={{ fontSize: 13 }}>
          <Link href="/">À traiter</Link> › À valider
        </span>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'Cette demande n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Revenez à la file : la demande y figure tant qu’elle est en attente.'}
          />
        </div>
      </Workspace>
    );
  }

  const request = result.data;
  const definition = LOCAL_CATALOG.find((command) => command.command === request.command);
  const amount = requestedCents(request);
  const title =
    request.command === 'order_refund' && amount !== null
      ? `Valider un remboursement de ${euros(amount)}`
      : `Valider : ${request.label}`;
  const poleLabel = (definition ? POLE_LABELS[definition.pole] : null) ?? 'Pilotage';
  const orderArticles =
    Array.isArray(request.items) && request.items.length > 0
      ? request.items.map((item) => ({ label: item.label, qty: item.qty, cents: item.amount_cents }))
      : articles(request.params ?? {});
  const risk = request.risk ?? null;
  const riskChip =
    risk === null
      ? { tone: 'stone' as const, label: 'Risque non évalué' }
      : risk.level === 'faible'
        ? { tone: 'sage' as const, label: 'Risque faible' }
        : risk.level === 'moyen'
          ? { tone: 'warn' as const, label: 'Risque moyen' }
          : { tone: 'danger' as const, label: 'Risque élevé' };
  const hasOrder = typeof request.params?.order_id === 'string' && request.params.order_id.trim().length > 0;
  const willHappen =
    request.command === 'order_refund'
      ? [
          'Remboursement Stripe sur la carte d’origine.',
          'Message au membre avec le délai bancaire.',
          'Ligne au journal d’audit, avec l’empreinte validée.'
        ]
      : [
          'L’action préparée est envoyée au serveur après votre validation.',
          'Le membre concerné est prévenu.',
          'Ligne au journal d’audit, avec l’empreinte validée.'
        ];

  const rail = (
    <>
      <Label>{hasOrder ? 'Contexte de la commande' : 'Contexte de la demande'}</Label>

      {orderArticles.length > 0 ? (
        <div className={`${s.card} ${s.railCard}`}>
          <Label>Articles</Label>
          {orderArticles.map((item, index) => (
            <span
              key={`${item.label}-${index}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}
            >
              <span>
                {item.label}
                {item.qty !== null && item.qty > 1 ? ` ×${item.qty}` : ''}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.cents !== null ? euros(item.cents) : 'non renseigné'}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Risque</Label>
        {risk ? (
          risk.facts.map((fact) => (
            <span key={fact} style={{ fontSize: 14 }}>
              {fact}
            </span>
          ))
        ) : (
          <>
            <span style={{ fontSize: 14 }}>
              {request.self_authored ? 'Vous avez préparé cette demande.' : 'Préparée par une autre personne.'}
            </span>
            <span style={{ fontSize: 14 }}>
              {request.second_human_required ? 'Un second humain doit valider.' : 'Validation possible en solo.'}
            </span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Litiges et remboursements antérieurs : non renseignés au contrat.
            </span>
          </>
        )}
        <span>
          <Chip tone={riskChip.tone}>{riskChip.label}</Chip>
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`} data-testid="approval-fingerprint">
        <Label>Empreinte</Label>
        <span className={s.mono} style={{ fontSize: 11.5, overflowWrap: 'anywhere' }}>
          {request.fingerprint || 'non renseignée'}
        </span>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Si une valeur change, l’empreinte change et la validation est refusée.
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Ce qui se passera</Label>
        {willHappen.map((line, index) => (
          <span key={line} style={{ fontSize: 14, lineHeight: 1.45 }}>
            {index + 1}. {line}
          </span>
        ))}
      </div>
    </>
  );

  return (
    <div className={s.work} style={{ flexWrap: 'wrap' }}>
      <main className={s.main}>
        <span className={s.muted} style={{ fontSize: 13 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'underline' }}>
            À traiter
          </Link>{' '}
          › {poleLabel} › À valider
        </span>

        <h1 className={s.titleSm}>{title}</h1>

        <ApprovalPanel request={request} />
      </main>
      <aside className={s.rail} aria-label="Contexte">
        {rail}
      </aside>
    </div>
  );
}
