'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '@/ui/crm.module.css';
import { cx } from '@/ui/cx';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/chip';
import { Label } from '@/ui/card';
import { Banner, EmptyState } from '@/ui/states';
import { IconRobot, IconStop } from '@/ui/icons';
import { useToast } from '@/ui/toast';
import type { Agent, StaffContext } from '@/lib/rpc';
import { POLE_LABELS } from '@/components/command/catalog';
import { errorMessage, runCommand } from '@/components/data/cmd';

const STATUS: Record<Agent['status'], { tone: 'sage' | 'warn' | 'danger'; label: string }> = {
  active: { tone: 'sage', label: 'Actif' },
  paused: { tone: 'warn', label: 'En pause' },
  stopped: { tone: 'danger', label: 'Arrêté' }
};

function percent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value <= 1 ? value * 100 : value)} %`;
}

/** Équipe et agents IA (maquette `Agents.dc.html`) : cartes, arrêt, relecture. */
export function AgentsBoard({
  agents,
  solo,
  ctx
}: {
  agents: Agent[];
  solo: boolean;
  ctx: StaffContext | null;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const stop = async (agent: Agent) => {
    setBusy(agent.id);
    setError(null);
    const result = await runCommand('agent_stop', { target: `agent:${agent.id}`, reason: 'arret_manuel' });
    setBusy(null);
    setConfirmStop(null);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    push({ message: `${agent.name} arrêté. Il ne proposera plus rien jusqu’au redémarrage.`, ttlMs: 8000 });
    router.refresh();
  };

  const stopAll = async () => {
    setBusy('all');
    setError(null);
    const result = await runCommand('agent_stop_all', { reason: 'arret_manuel' });
    setBusy(null);
    setConfirmAll(false);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    push({ message: 'Tous les agents sont arrêtés. La file humaine continue.', ttlMs: 8000 });
    router.refresh();
  };

  const active = agents.filter((agent) => agent.status === 'active').length;

  return (
    <>
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.titleSm} style={{ fontSize: 28 }}>Équipe et agents IA</h1>
          <span className={s.subtitle}>
            1 humain · {active} agent{active > 1 ? 's' : ''} actif{active > 1 ? 's' : ''} · 7 pôles
            {solo ? ' · mode solo actif' : ''}
          </span>
        </div>
        <div className={s.rowFlexWrap}>
          <Button tone="soft" disabled title="L’invitation d’un compte humain est réservée au super admin, via la commande « staff_manage ».">
            Inviter une personne
          </Button>
          <Button tone="pg" onClick={() => router.push('/catalogue?pole=TECH')}>
            Ajouter un agent
          </Button>
        </div>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <section className={`${s.card} ${s.padLg}`} aria-label="Humains" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <Avatar name={ctx?.display_name} size={48} tone="primary" />
        <span className={s.col} style={{ flex: 1, minWidth: 200 }}>
          <strong>{ctx?.display_name ?? 'Session non renseignée'}</strong>
          <span className={s.muted} style={{ fontSize: 13 }}>
            {ctx?.role === 'super_admin' ? 'Super admin · tous les droits' : (ctx?.role ?? 'Rôle non renseigné')}
          </span>
        </span>
        <span className={s.rowFlexWrap}>
          <Chip tone="sage">Tous les pôles</Chip>
          {solo ? <Chip tone="warn">Valide seul (mode solo)</Chip> : <Chip tone="info">Validation à deux</Chip>}
        </span>
      </section>

      <div className={s.between}>
        <Label>Agents IA</Label>
        <span className={s.muted} style={{ fontSize: 12.5 }}>Un agent propose ; il ne valide jamais.</span>
      </div>

      {agents.length === 0 ? (
        <div className={s.card}>
          <EmptyState title="Aucun agent enregistré">
            Les 6 agents du bundle apparaîtront ici dès que `admin.agents_overview()` renverra leurs contrats.
          </EmptyState>
        </div>
      ) : (
        <div className={s.agentGrid}>
          {agents.map((agent) => {
            const status = STATUS[agent.status] ?? { tone: 'stone' as const, label: 'Statut non renseigné' };
            return (
              <article key={agent.id} className={cx(s.card, s.agentCard)}>
                <div className={s.rowFlex}>
                  <span className={s.agentAv} aria-hidden="true">
                    <IconRobot size={20} />
                  </span>
                  <span className={s.col} style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{agent.name}</strong>
                    <span className={s.muted} style={{ fontSize: 12.5 }}>
                      Pôle {POLE_LABELS[agent.pole] ?? agent.pole}
                    </span>
                  </span>
                  <Chip tone={status.tone}>{status.label}</Chip>
                </div>

                <div className={s.statGrid}>
                  <span className={s.stat}>
                    <span className={s.muted} style={{ fontSize: 11.5 }}>24 h</span>
                    <strong className={s.statValue}>{agent.proposals_24h}</strong>
                  </span>
                  <span className={s.stat}>
                    <span className={s.muted} style={{ fontSize: 11.5 }}>Accepté</span>
                    <strong className={s.statValue}>{percent(agent.accepted_rate)}</strong>
                  </span>
                  <span className={s.stat}>
                    <span className={s.muted} style={{ fontSize: 11.5 }}>Plafond/h</span>
                    <strong className={s.statValue}>{agent.hourly_cap}</strong>
                  </span>
                </div>

                <span className={s.muted} style={{ fontSize: 12.5 }}>
                  Outils : {agent.tools.length > 0 ? agent.tools.join(', ') : 'non renseignés'}.
                </span>

                {agent.last_error ? (
                  <span className={s.fieldErr} style={{ fontSize: 12 }}>Dernière erreur : {agent.last_error}</span>
                ) : null}

                <div className={s.rowFlex}>
                  <Button
                    tone="soft"
                    size="sm"
                    style={{ flex: 1 }}
                    onClick={() => router.push(`/catalogue?agent=${agent.id}`)}
                  >
                    Droits et outils
                  </Button>
                  {confirmStop === agent.id ? (
                    <Button tone="bad" size="sm" onClick={() => void stop(agent)} disabled={busy === agent.id}>
                      {busy === agent.id ? 'Arrêt…' : 'Confirmer'}
                    </Button>
                  ) : (
                    <Button
                      tone="bad"
                      size="sm"
                      icon={<IconStop size={14} />}
                      onClick={() => setConfirmStop(agent.id)}
                      disabled={agent.status === 'stopped'}
                    >
                      Arrêter
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className={`${s.card} ${s.padLg}`} aria-label="Contrôle" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        <span className={s.col} style={{ flex: 1, minWidth: 240 }}>
          <strong>Relecture de la semaine</strong>
          <span className={s.muted} style={{ fontSize: 13 }}>
            Décisions d’agents tirées au hasard : non renseigné sur cet écran.
          </span>
        </span>
        <Button tone="soft" onClick={() => router.push('/journal?acteur=agent')}>
          Continuer la relecture
        </Button>
        {confirmAll ? (
          <Button tone="bad" onClick={() => void stopAll()} disabled={busy === 'all'}>
            {busy === 'all' ? 'Arrêt…' : 'Confirmer l’arrêt de tous les agents'}
          </Button>
        ) : (
          <Button tone="bad" onClick={() => setConfirmAll(true)} disabled={agents.length === 0}>
            Arrêter tous les agents
          </Button>
        )}
      </section>
    </>
  );
}
