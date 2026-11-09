import Link from 'next/link';
import s from '@/ui/crm.module.css';
import { Card, Label } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Banner } from '@/ui/states';
import { Workspace } from '@/components/shell/workspace';
import { ActionButtons } from '@/components/command/action-buttons';
import { getTechniqueStatus } from '@/components/data/admin-rpc';

export const dynamic = 'force-dynamic';

/** Produit et IA : interrupteur d'urgence, quotas, cache, coûts. */
export default async function IaPage() {
  const technique = await getTechniqueStatus();
  const aiBricks = (technique.data?.bricks ?? []).filter((brick) => /nvidia|ia|agent/i.test(`${brick.id} ${brick.label}`));

  return (
    <Workspace
      rail={
        <>
          <Label>Règles</Label>
          <div className={`${s.card} ${s.railCard}`}>
            <span style={{ fontSize: 13 }}>
              Un agent propose ; il ne valide jamais. Il ne peut pas modifier ses permissions, son budget ni ses évals.
            </span>
          </div>
          <div className={`${s.card} ${s.railCard}`}>
            <Label>Fournisseur</Label>
            <span style={{ fontSize: 13 }}>NVIDIA NIM en direct. Aucun autre fournisseur d’IA n’est branché.</span>
          </div>
        </>
      }
    >
      <div className={s.col} style={{ gap: 4 }}>
        <h1 className={s.title}>Produit et IA</h1>
        <span className={s.subtitle}>Interrupteur d’urgence, quotas, cache, consommation</span>
      </div>

      <Banner tone="warn" title="Interrupteur d’urgence">
        Couper l’IA arrête immédiatement les agents. La file humaine continue de fonctionner, sans eux.
      </Banner>

      <div className={s.rowFlexWrap}>
        <ActionButtons
          actions={[
            { command: 'ai_kill_switch', label: 'Couper ou rallumer l’IA', tone: 'danger' },
            { command: 'ai_quota_raise', label: 'Relever un quota' },
            { command: 'ai_cache_clear', label: 'Vider le cache IA' },
            { command: 'ai_job_retry', label: 'Relancer un job IA' },
            { command: 'ai_usage_view', label: 'Voir la consommation' }
          ]}
          target={{ kind: 'ia', id: 'global' }}
          max={5}
        />
      </div>

      <section className={`${s.card} ${s.padLg}`} aria-label="Consommation">
        <div className={s.colGap}>
          <div className={s.between}>
            <Label>Consommation</Label>
            <Chip tone="stone">non renseignée</Chip>
          </div>
          <span className={s.muted} style={{ fontSize: 13 }}>
            Le détail des appels, des coûts et des plafonds n’est pas encore exposé par une RPC de lecture. Rien n’est
            affiché plutôt que d’inventer un chiffre.
          </span>
        </div>
      </section>

      <section className={`${s.card} ${s.padLg}`} aria-label="Briques IA">
        <div className={s.colGap}>
          <Label>Briques IA</Label>
          {aiBricks.length === 0 ? (
            <span className={s.muted} style={{ fontSize: 13 }}>État : non renseigné.</span>
          ) : (
            aiBricks.map((brick) => (
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
          <Label>Coûts</Label>
          <span style={{ fontSize: 13 }}>
            Chaque appel est mesuré et plafonné. Un agent qui dépasse son budget s’arrête et escalade.
          </span>
          <Link href="/equipe" style={{ fontWeight: 600, fontSize: 13 }}>
            Voir les agents et leurs plafonds →
          </Link>
        </div>
      </Card>
    </Workspace>
  );
}
