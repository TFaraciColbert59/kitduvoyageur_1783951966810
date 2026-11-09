import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Card, Label } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/states';
import { ErrorState } from '@/ui/error-state';
import { Workspace } from '@/components/shell/workspace';
import { ActionButtons } from '@/components/command/action-buttons';
import { getTechniqueStatus } from '@/components/data/admin-rpc';
import { relativeFr } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Technique : erreurs, tâches planifiées, briques, temps réel. */
export default async function TechniquePage() {
  const result = await getTechniqueStatus();

  if (!result.data) {
    return (
      <Workspace>
        <h1 className={s.title}>Technique</h1>
        <div className={s.card}>
          <ErrorState
            cause={result.failure?.cause ?? 'L’état technique n’est pas accessible.'}
            solution={result.failure?.solution ?? 'Réessayez dans un instant.'}
          />
        </div>
      </Workspace>
    );
  }

  const { errors, jobs, advisors_hint, bricks, realtime } = result.data;

  return (
    <Workspace
      rail={
        <>
          <Label>Contexte</Label>
          <div className={`${s.card} ${s.railCard}`}>
            <Label>Temps réel</Label>
            <span className={s.rowFlexWrap}>
              <Chip tone={realtime?.connected ? 'sage' : 'stone'}>
                {realtime ? (realtime.connected ? 'Connecté' : 'Déconnecté') : 'non renseigné'}
              </Chip>
              {realtime?.channels?.length ? <Chip tone="stone">{realtime.channels.length} canaux</Chip> : null}
            </span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Canaux privés <span className={s.mono}>admin:*</span> (file, présence). À la reconnexion, les écrans
              rechargent la base.
            </span>
          </div>

          <div className={`${s.card} ${s.railCard}`}>
            <Label>Advisors</Label>
            <span style={{ fontSize: 13 }}>{advisors_hint ?? 'non renseigné'}</span>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Aucune erreur nouvelle exigée après chaque migration.
            </span>
          </div>
        </>
      }
    >
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.title}>Technique</h1>
          <span className={s.subtitle}>Erreurs, tâches planifiées, briques optionnelles</span>
        </div>
        <div className={s.rowFlexWrap}>
          <ActionButtons
            actions={[
              { command: 'cron_run_now', label: 'Lancer une tâche planifiée' },
              { command: 'alert_resolve', label: 'Résoudre une alerte' },
              { command: 'ai_job_retry', label: 'Relancer un job IA' },
              { command: 'errors_view', label: 'Voir les erreurs' }
            ]}
            target={{ kind: 'technique', id: 'global' }}
            max={4}
          />
        </div>
      </div>

      <section className={`${s.card} ${s.tableWrap}`} aria-label="Erreurs récentes">
        <div className={s.pad}>
          <Label>Erreurs récentes</Label>
        </div>
        {errors.length === 0 ? (
          <EmptyState title="Aucune erreur remontée">
            Les erreurs serveur et les échecs de tâches apparaissent ici, avec leur nombre et leur dernière occurrence.
          </EmptyState>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Message</th>
                <th scope="col">Occurrences</th>
                <th scope="col">Dernière</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error) => (
                <tr key={error.id}>
                  <td className={s.mono}>{error.source}</td>
                  <td>{error.message}</td>
                  <td>{error.count}</td>
                  <td>{relativeFr(error.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${s.card} ${s.tableWrap}`} aria-label="Tâches planifiées">
        <div className={s.pad}>
          <Label>Tâches planifiées</Label>
        </div>
        {jobs.length === 0 ? (
          <EmptyState title="Aucune tâche planifiée renseignée">
            Les tâches (compte à rebours SLA, agents, purge) apparaissent ici avec leur dernier passage.
          </EmptyState>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Tâche</th>
                <th scope="col">Dernier passage</th>
                <th scope="col">État</th>
                <th scope="col">Échecs</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className={s.mono}>{job.name}</td>
                  <td>{job.last_run_at ? relativeFr(job.last_run_at) : 'jamais'}</td>
                  <td>
                    <Chip tone={job.status === 'ok' ? 'sage' : job.failures > 0 ? 'danger' : 'stone'}>{job.status}</Chip>
                  </td>
                  <td>{job.failures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${s.card} ${s.padLg}`} aria-label="Briques optionnelles">
        <div className={s.colGap}>
          <Label>Briques optionnelles</Label>
          {bricks.length === 0 ? (
            <span className={s.muted} style={{ fontSize: 13 }}>État des briques : non renseigné.</span>
          ) : (
            bricks.map((brick) => (
              <div key={brick.id} className={s.kv}>
                <span className={s.col} style={{ gap: 2 }}>
                  <strong style={{ fontSize: 13.5 }}>{brick.label}</strong>
                  <span className={s.muted} style={{ fontSize: 12.5 }}>{brick.fallback}</span>
                </span>
                <Chip tone={brick.ready ? 'sage' : 'warn'}>{brick.ready ? 'Prête' : 'En attente'}</Chip>
              </div>
            ))
          )}
        </div>
      </section>

      <Card className={s.padLg} style={{ background: 'var(--lkv-sage-50)' }}>
        <div className={s.colGapSm}>
          <Label>Runbook</Label>
          <span style={{ fontSize: 13 }}>
            Chaque automatisation critique a un runbook : symptômes, diagnostic, retour arrière, contacts, SLO.
          </span>
          <Link href="/journal" style={{ fontWeight: 600, fontSize: 13 }}>
            Voir les dernières actions au journal →
          </Link>
        </div>
      </Card>
    </Workspace>
  );
}
