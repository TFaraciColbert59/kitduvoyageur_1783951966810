import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Card, Label } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/states';
import { Workspace } from '@/components/shell/workspace';
import { ActionButtons } from '@/components/command/action-buttons';
import { getAgentsOverview, getTechniqueStatus } from '@/components/data/admin-rpc';

export const dynamic = 'force-dynamic';

/** Réglages : briques optionnelles, indicateurs, réglages du produit. */
export default async function ReglagesPage() {
  const [agents, technique] = await Promise.all([getAgentsOverview(), getTechniqueStatus()]);
  const bricks = technique.data?.bricks ?? [];

  return (
    <Workspace
      rail={
        <>
          <Label>Ce qui est réglable</Label>
          <div className={`${s.card} ${s.railCard}`}>
            <span style={{ fontSize: 13 }}>
              Les réglages passent tous par une commande du registre : rien ne s’écrit depuis cet écran sans passer par
              <span className={s.mono}> admin.run_command</span>.
            </span>
          </div>
          <div className={`${s.card} ${s.railCard}`}>
            <Label>Rappel</Label>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              Un agent ne peut pas modifier ses propres permissions, son budget ni ses évals.
            </span>
          </div>
        </>
      }
    >
      <div className={s.col} style={{ gap: 4 }}>
        <h1 className={s.title}>Réglages</h1>
        <span className={s.subtitle}>Briques optionnelles, indicateurs, réglages du produit</span>
      </div>

      <section className={`${s.card} ${s.padLg}`} aria-label="Briques optionnelles">
        <div className={s.colGap}>
          <div className={s.between}>
            <Label>Briques optionnelles</Label>
            <Chip tone={bricks.length === 0 ? 'stone' : bricks.every((brick) => brick.ready) ? 'sage' : 'warn'}>
              {bricks.length === 0
                ? 'non renseigné'
                : `${bricks.filter((brick) => brick.ready).length} / ${bricks.length} prêtes`}
            </Chip>
          </div>
          {bricks.length === 0 ? (
            <EmptyState title="État des briques : non renseigné">
              Il vient de <span className={s.mono}>admin.technique_status()</span>. Tant qu’il n’est pas disponible, rien
              n’est affiché plutôt que d’inventer un état.
            </EmptyState>
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

      <section className={`${s.card} ${s.padLg}`} aria-label="Réglages du produit">
        <div className={s.colGap}>
          <Label>Réglages du produit et de l’IA</Label>
          <div className={s.rowFlexWrap}>
            <ActionButtons
              actions={[
                { command: 'settings_edit', label: 'Modifier les réglages' },
                { command: 'feature_flag_toggle', label: 'Basculer un indicateur' },
                { command: 'feature_cohort_manage', label: 'Gérer une cohorte' },
                { command: 'rate_limit_lift', label: 'Lever une limite de débit' },
                { command: 'staff_manage', label: 'Gérer l’équipe et les agents' }
              ]}
              target={{ kind: 'reglages', id: 'global' }}
              max={5}
            />
          </div>
          <span className={s.muted} style={{ fontSize: 12.5 }}>
            {agents.data?.agents?.length
              ? `${agents.data.agents.length} agents suivis · ${agents.data.agents.filter((agent) => agent.status === 'active').length} actifs`
              : 'Agents : non renseigné'}
            {' · '}
            <Link href="/equipe">Ouvrir l’équipe et les agents IA</Link>
          </span>
        </div>
      </section>

      <Card className={s.padLg} style={{ background: 'var(--lkv-sage-50)' }}>
        <div className={s.colGapSm}>
          <Label>Journal</Label>
          <span style={{ fontSize: 13 }}>
            Toute modification de réglage écrit une ligne au journal, avec le motif et l’avant/après.
          </span>
          <Link href="/journal" style={{ fontWeight: 600, fontSize: 13 }}>
            Ouvrir le journal d’audit →
          </Link>
        </div>
      </Card>
    </Workspace>
  );
}
