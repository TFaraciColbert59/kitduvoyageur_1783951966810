'use client';

import * as React from 'react';

import { Button, Card, Chip, Section } from '@/design';

import { deriveTrajectoire } from '@/features/trajectoire/domain/derive';
import { verifyProvenance } from '@/features/trajectoire/domain/provenance';
import { useModelNarration } from '@/features/trajectoire/narration/useModelNarration';
import { analyzeIntention } from '@/features/trajectoire/domain/intention';
import { DEMO_TRACES, countAtYourScale } from '@/features/trajectoire/domain/traces';
import { ZONES, tAtZoneMiddle, tForZone } from '@/features/trajectoire/domain/scaleAxis';
import { dangerRange, getZone, zoneForT } from '@/features/trajectoire/domain/scaleAxis';
import type { TrajectoireSnapshot } from '@/features/trajectoire/domain/types';
import type { TrajectoirePlanVersion } from '@/features/trajectoire/domain/versioning';
import type { UseModelNarration } from '@/features/trajectoire/narration/useModelNarration';

import { ProvenanceChips } from './ProvenanceChips';
import { ScaleRuler } from './ScaleRuler';
import { narrate } from './narration';
import { shortHash, usePlanVersion } from './usePlanVersion';
import { sceneBackground } from './zonePalette';

import './trajectoire.css';

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 41;
const DEFAULT_INTENTION =
  'Partir cinq jours dans les Dolomites, sans voiture, refuges et passages peu exposés';
const ZONE_TONE = {
  run: 'sage',
  journee: 'sage',
  raid: 'info',
  expedition: 'warn',
  monde: 'info',
} as const;

const GAUGE_TONE = {
  tranquille: 'var(--lkv-success)',
  modere: 'var(--lkv-sage-400)',
  exigeant: 'var(--lkv-warning)',
  engage: 'var(--lkv-danger)',
} as const;

const LEVEL_LABEL = {
  tranquille: 'TRANQUILLE',
  modere: 'MODÉRÉ',
  exigeant: 'EXIGEANT',
  engage: 'ENGAGÉ',
} as const;

function eur(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} €`;
}

/** Barre de charge : ton vert → ambre → orange, cadrée sur le budget de zone. */
function loadTone(pct: number): string {
  if (pct > 75) return 'var(--lkv-danger)';
  if (pct > 50) return 'var(--lkv-warning)';
  return 'var(--lkv-success)';
}

function DangerCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  const range = dangerRange(getZone(snapshot.zone));
  const clamped = Math.min(100, Math.max(0, snapshot.danger.score));
  const offset = GAUGE_CIRCUMFERENCE * (1 - clamped / 100);
  const colour = GAUGE_TONE[snapshot.danger.level];

  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-danger">
      <div className="tj-card__head">
        <h3 id="tj-h-danger">Dangerosité du terrain</h3>
        <ProvenanceChips snapshot={snapshot} location="danger" />
      </div>

      <div className="tj-gauge">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="tj-gauge__track" cx="50" cy="50" r="41" />
          <circle
            className="tj-gauge__arc"
            cx="50"
            cy="50"
            r="41"
            stroke={colour}
            strokeDasharray={GAUGE_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="tj-gauge__value">
          <div className="tj-gauge__num">{snapshot.danger.score}</div>
          <div className="tj-source" style={{ color: colour }}>
            {LEVEL_LABEL[snapshot.danger.level]}
          </div>
        </div>
      </div>

      <p className="tj-source" style={{ marginTop: '0.75rem' }}>
        Zone {Math.round(range.floor)} – {Math.round(range.ceiling)} · /100
      </p>

      <div className="tj-factors">
        {snapshot.danger.factors.map((factor) => (
          <div className="tj-factor" key={factor.id}>
            <span>{factor.label}</span>
            <div className="tj-bar">
              <i style={{ width: `${Math.min(100, factor.score)}%` }} />
            </div>
            <b>{factor.display}</b>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BudgetCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  const { budget } = snapshot;
  const lines = [
    { label: 'Transport', value: budget.transportEur, tag: 'RS' },
    { label: 'Hébergement', value: budget.hebergementEur, tag: 'RS' },
    { label: 'Activités', value: budget.activitesEur, tag: 'VTR' },
    { label: 'Kit manquant', value: budget.kitManquantEur, tag: 'C6' },
  ];

  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-budget">
      <div className="tj-card__head">
        <h3 id="tj-h-budget">Budget consolidé</h3>
        <ProvenanceChips snapshot={snapshot} location="budget" />
      </div>

      <div className="tj-bignum">
        {eur(budget.totalEur).replace(' €', '')}
        <small> €</small>
      </div>

      <div className="tj-lines" style={{ marginTop: '0.875rem' }}>
        {lines.map((line) => (
          <div className="tj-line" key={line.label}>
            <span>
              <span className="tj-source" style={{ marginRight: '0.375rem' }}>
                {line.tag}
              </span>
              {line.label}
            </span>
            <b>{eur(line.value)}</b>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WindowCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  const { window } = snapshot;
  const lines = [
    { label: 'Fenêtre idéale', value: window.ideal },
    { label: 'Prochaine fenêtre à risque', value: window.risk ?? '—' },
    { label: 'Heures de jour', value: window.daylight },
    { label: 'Amplitude thermique', value: window.amplitude },
    { label: 'Eau potable sur trace', value: window.water },
  ];

  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-window">
      <div className="tj-card__head">
        <h3 id="tj-h-window">Fenêtre météo &amp; départ</h3>
        <ProvenanceChips snapshot={snapshot} location="window" />
      </div>
      <div className="tj-lines">
        {lines.map((line) => (
          <div className="tj-line" key={line.label}>
            <span>{line.label}</span>
            <b>{line.value}</b>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlanCard({
  snapshot,
  narration,
  plan,
}: {
  snapshot: TrajectoireSnapshot;
  narration: UseModelNarration;
  plan: TrajectoirePlanVersion;
}) {
  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-plan">
      <div className="tj-card__head">
        <h3 id="tj-h-plan">Le plan vivant</h3>
        <ProvenanceChips snapshot={snapshot} location="plan" />
      </div>
      <div className="tj-narration">
        <p>{narration.headline}</p>
        <ul>
          {narration.lines.map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ul>
        <p className="tj-source tj-origin" style={{ marginTop: '0.75rem' }} aria-live="polite">
          {narration.originLabel}
          {narration.pending ? ' · rédaction en cours…' : ''}
        </p>
        <p className="tj-source tj-plan-version">
          Plan v{plan.version} · {plan.engineVersion} · sources #{shortHash(plan.sourcesHash)}
        </p>
      </div>
    </Card>
  );
}

function StepsCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-steps">
      <div className="tj-card__head">
        <h3 id="tj-h-steps">Étapes générées</h3>
        <ProvenanceChips snapshot={snapshot} location="steps" />
        <Chip tone="sage" icon={<span>{snapshot.grain}</span>}>
          {snapshot.steps.length} étapes
        </Chip>
      </div>
      <ol className="tj-list">
        {snapshot.steps.map((step, index) => (
          <li className="tj-step" key={step.id}>
            <span className="tj-step__index" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <span className="tj-step__title">{step.title}</span>
              <br />
              <span className="tj-step__detail">
                {step.detail}
                {step.distanceKm !== null ? ` · ${step.distanceKm} km` : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function KitCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  const missing = snapshot.kit.filter((item) => !item.owned).length;
  const maxKg =
    snapshot.zone === 'monde'
      ? 18
      : snapshot.zone === 'expedition'
        ? 14
        : snapshot.zone === 'raid'
          ? 9
          : 5;
  const pct = Math.max(5, Math.min(100, Math.round((snapshot.kitLoadKg / maxKg) * 100)));

  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-kit">
      <div className="tj-card__head">
        <h3 id="tj-h-kit">Kit &amp; inventaire</h3>
        <ProvenanceChips snapshot={snapshot} location="kit" />
        <Chip tone={missing > 0 ? 'warn' : 'sage'} icon={<span>C6</span>}></Chip>
      </div>

      <ul className="tj-list">
        <li className="tj-kit">
          {snapshot.kit.map((item) => (
            <Chip
              key={item.id}
              tone={item.owned ? 'sage' : 'warn'}
              icon={<span aria-hidden="true">{item.owned ? '✓' : '+'}</span>}
            >
              {item.label}
              {!item.owned && item.priceEur !== null ? ` · ${eur(item.priceEur)}` : ''}
            </Chip>
          ))}
        </li>
      </ul>

      <div className="tj-factor" style={{ marginTop: '0.875rem' }}>
        <span>Charge</span>
        <div className="tj-bar">
          <i style={{ width: `${pct}%`, background: loadTone(pct) }} />
        </div>
        <b>{snapshot.kitLoadKg.toFixed(1).replace('.', ',')} kg</b>
      </div>
    </Card>
  );
}

function TracesCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  const atScale = countAtYourScale(snapshot.traces);
  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-traces">
      <div className="tj-card__head">
        <h3 id="tj-h-traces">Traces vécues de la tribu</h3>
        <ProvenanceChips snapshot={snapshot} location="traces" />
        <Chip tone="neutral" icon={<span>LKDV</span>}>
          {atScale} à ton échelle
        </Chip>
      </div>
      <div>
        {snapshot.traces.map((trace) => (
          <div className={`tj-trace${trace.atYourScale ? '' : ' tj-trace--dim'}`} key={trace.id}>
            <span className="tj-trace__avatar" aria-hidden="true">
              {trace.initials}
            </span>
            <span className="tj-trace__who">
              <b>{trace.author}</b>
              <span>{trace.context}</span>
            </span>
            {trace.atYourScale ? (
              <Chip tone="sage">≈ à ton échelle</Chip>
            ) : (
              <span className="tj-source">
                {trace.hours >= 48 ? `${Math.round(trace.hours / 24)} j` : `${trace.hours} h`}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function VeilleCard({ snapshot }: { snapshot: TrajectoireSnapshot }) {
  const [on, setOn] = React.useState(false);
  const notApplicable = snapshot.zone === 'run' || snapshot.zone === 'journee';

  return (
    <Card tone="neutral" ariaLabelledBy="tj-h-veille">
      <div className="tj-card__head">
        <h3 id="tj-h-veille">Autopilot de veille</h3>
        <ProvenanceChips snapshot={snapshot} location="veille" />
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Activer l’Autopilot de veille"
          className="tj-switch"
          onClick={() => setOn((previous) => !previous)}
        />
      </div>

      <p className="tj-narration">
        <span className="tj-narration">
          L’agent garde ta trajectoire pendant que tu vis : météo, dangerosité, prix et créneaux
          surveillés en continu — il te repropose le meilleur moment de partir.
        </span>
      </p>

      <div className="tj-lines" style={{ marginTop: '0.875rem' }}>
        {snapshot.veille.map((rule) => {
          const active = on && !notApplicable;
          return (
            <div className="tj-line" key={rule.kind}>
              <span>{rule.label}</span>
              <b style={{ color: active ? 'var(--lkv-success)' : 'var(--lkv-text-muted)' }}>
                {notApplicable ? 'non applicable' : active ? rule.detail : 'inactive'}
              </b>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * TrajectoireBoard — l'île client de la page.
 *
 * Détient l'unique état mutable de la page (la position `t` sur l'axe) et
 * recalcule le snapshot dérivé à chaque mouvement. Aucun appel réseau : le
 * moteur est pur, donc le recalcul est synchrone et inférieur à 2 ms.
 */
export function TrajectoireBoard() {
  const [intent, setIntent] = React.useState(DEFAULT_INTENTION);
  const [committed, setCommitted] = React.useState(DEFAULT_INTENTION);
  const [t, setT] = React.useState(() => tForZone('expedition'));

  const intention = React.useMemo(() => analyzeIntention(committed), [committed]);
  const snapshot = React.useMemo(
    () => deriveTrajectoire({ t, intention, traces: DEMO_TRACES }),
    [t, intention]
  );
  const fallbackNarration = React.useMemo(
    () => narrate(snapshot, intention),
    [snapshot, intention]
  );

  // Le LLM ne fait QUE la narration, et seulement apres le squelette :
  // le curseur reste instantane meme si Nemotron met dix secondes.
  // La narration part de l intention et de la position, jamais du snapshot :
  // c'est le serveur qui re-derive, donc le client n'a pas la main sur les
  // nombres que la porte anti-invention va verifier.
  const narration = useModelNarration(committed, t, fallbackNarration);
  const plan = usePlanVersion(snapshot, committed);
  const zone = zoneForT(t);

  // Gate T2 branche sur le rendu : si une donnee affichee perd sa source,
  // la console le dit immediatement. On ne leve pas ici : une exception de rendu
  // effacerait les 8 cartes, alors que le probleme est une provenance manquante.
  React.useEffect(() => {
    verifyProvenance(snapshot);
  }, [snapshot]);

  return (
    <div className="tj-scene" style={{ ['--tj-scene-bg' as string]: sceneBackground(zone.id) }}>
      <Section
        spacing="md"
        title="Le point de départ"
        description="Décris ton aventure en une phrase, puis déplace l’échelle. Tout se recalcule, sans rien inventer."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setCommitted(intent);
          }}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <label className="tj-source" htmlFor="tj-intent" style={{ flex: '1 1 16rem' }}>
            <span
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clipPath: 'inset(50%)',
              }}
            >
              Ton intention de départ
            </span>
          </label>
          <input
            id="tj-intent"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Décris ton aventure en une phrase…"
            style={{
              flex: '3 1 20rem',
              minHeight: 'var(--lkv-touch-min, 44px)',
              padding: '0 0.875rem',
              borderRadius: 'var(--lkv-radius-control, 12px)',
              border: '1px solid var(--lkv-field-border)',
              background: 'var(--lkv-field-bg)',
              color: 'var(--lkv-text-primary)',
              font: 'inherit',
            }}
          />
          <Button type="submit" size="md">
            Recalculer
          </Button>
        </form>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '1rem',
            flexWrap: 'wrap',
            marginTop: '1.5rem',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--lkv-text-title-sm, 1.25rem)', fontWeight: 700 }}>
              {snapshot.zoneLabel}
            </div>
            <div className="tj-source">
              {snapshot.zoneSub} · rayon {Math.round(snapshot.radiusKm).toLocaleString('fr-FR')} km
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tj-bignum">{snapshot.hours}</div>
            <div className="tj-source">
              {snapshot.hours >= 24
                ? `heures d'aventure (${(snapshot.hours / 24).toFixed(snapshot.hours >= 96 ? 0 : 1)} jours)`
                : "heures d'aventure"}
            </div>
          </div>
        </div>

        <ScaleRuler t={t} hours={snapshot.hours} zoneLabel={snapshot.zoneLabel} onChange={setT} />

        <div
          role="group"
          aria-label="Zones d’échelle"
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}
        >
          {ZONES.map((def) => (
            <Chip
              key={def.id}
              tone={ZONE_TONE[def.id]}
              selected={def.id === zone.id}
              onClick={() => setT(tAtZoneMiddle(def.id))}
            >
              {def.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section spacing="md">
        <div className="tj-grid">
          <div className="tj-span-4">
            <BudgetCard snapshot={snapshot} />
          </div>
          <div className="tj-span-4">
            <DangerCard snapshot={snapshot} />
          </div>
          <div className="tj-span-4">
            <WindowCard snapshot={snapshot} />
          </div>
          {/* Le plan vivant passe en demi-largeur : avec lui, la fenetre meteo
              se retrouvait seule sur sa ligne, avec une demi-ligne vide a droite.
              En demi-largeur, la grille fait trois rangees de deux cartes, puis
              deux cartes pleine largeur. Aucune ligne orpheline. */}
          <div className="tj-span-4">
            <PlanCard snapshot={snapshot} narration={narration} plan={plan} />
          </div>
          <div className="tj-span-4">
            <StepsCard snapshot={snapshot} />
          </div>
          <div className="tj-span-4">
            <KitCard snapshot={snapshot} />
          </div>
          <div className="tj-span-6">
            <TracesCard snapshot={snapshot} />
          </div>
          <div className="tj-span-6">
            <VeilleCard snapshot={snapshot} />
          </div>
        </div>
      </Section>
    </div>
  );
}

export default TrajectoireBoard;
