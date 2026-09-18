'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassLabSurface } from './GlassLabSurface';
import { resolveGlassEngine, type GlassEngine } from './glassLabPolicy';
import { useGlassCapabilities } from './useGlassCapabilities';
import styles from './glassLab.module.css';

const engines = [{ value: 'standard', label: 'Standard CSS' }, { value: 'rdev', label: 'rdev 1.1.1' }, { value: 'samasante', label: 'samasante 0.1.1' }] as const;
const states = ['normal', 'loading', 'empty', 'error', 'selected', 'disabled'] as const;
type FixtureState = typeof states[number];
const stateLabels: Record<FixtureState, string> = { normal: 'Normal', loading: 'Chargement', empty: 'Vide', error: 'Erreur', selected: 'Sélectionné', disabled: 'Désactivé' };
const fixtures = [
  { key: 'dashboard', name: 'Tableau de bord', title: 'Une journée au grand air', detail: 'Vos essentiels sont prêts. Retrouvez les repères de votre prochaine escapade.', metric: '8 essentiels · 2 étapes' },
  { key: 'voyage', name: 'Voyage sur photographie', title: 'Au bord du lac', detail: 'Un départ matinal, une traversée en forêt et une halte au bord de l’eau.', metric: '12 km · 4 h · 420 m D+' },
  { key: 'map', name: 'Panneau sur carte', title: 'Refuge des mélèzes', detail: 'Un point de passage au calme, à proximité du sentier principal.', metric: 'À 1,2 km · étape 3' },
] as const;

function FixtureContent({ fixture, state, onAction }: { fixture: typeof fixtures[number]; state: FixtureState; onAction: () => void }) {
  return <>
    <p className={styles.eyebrow}>{fixture.name}</p>
    <h2>{fixture.title}</h2>
    <p>{state === 'loading' ? 'Chargement de la démonstration…' : state === 'empty' ? 'Aucun élément pour le moment.' : state === 'error' ? 'Impossible de charger cet exemple. Réessayez.' : fixture.detail}</p>
    <p className={styles.metric}>{fixture.metric}</p>
    <button className="glass-capsule-btn primary" type="button" disabled={state === 'disabled' || state === 'loading'}
      aria-pressed={state === 'selected' ? true : undefined} onClick={onAction}>
      {state === 'error' ? 'Réessayer' : state === 'selected' ? 'Sélectionné' : 'Choisir cet exemple'}
    </button>
  </>;
}

function MapBackdrop() {
  return <svg className={styles.map} viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="600" height="420" fill="var(--lkv-sage-100)" />
    <path d="M-40 100 Q180 0 350 150 T700 100 M-30 260 Q220 120 450 290 T720 180 M0 390 Q250 280 650 390" fill="none" stroke="var(--lkv-sage-200)" strokeWidth="28" />
    <path d="M100 -30 Q300 100 190 240 T310 500" fill="none" stroke="var(--sky-200)" strokeWidth="24" />
    <path d="M40 300 Q100 130 310 220 T560 70" fill="none" stroke="var(--lkv-primary)" strokeWidth="5" strokeDasharray="8 7" />
    <circle cx="310" cy="220" r="14" fill="var(--lkv-primary)" stroke="var(--lkv-surface-card)" strokeWidth="5" />
  </svg>;
}

const viewportWidths: Record<string, string | undefined> = {
  '320': '320px', '390': '390px', '430': '430px', 'tablet': '768px', 'full': undefined
};

export default function GlassLab() {
  const [requested, setRequested] = useState<GlassEngine>('standard');
  const [state, setState] = useState<FixtureState>('normal');
  const [viewport, setViewport] = useState<'320' | '390' | '430' | 'tablet' | 'full'>('full');
  const [forceStandard, setForceStandard] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const [count, setCount] = useState(0);
  const [longList, setLongList] = useState(false);
  const capabilities = useGlassCapabilities(forceStandard || rendererFailed || longList);
  const { engine, reason } = resolveGlassEngine(requested, capabilities);
  const increment = () => setCount(previous => previous + 1);
  return (
    <main className={styles.lab} data-glass-lab="" data-active-engine={engine}>
      <header><p className={styles.eyebrow}>LKDV · laboratoire privé</p><h1>Trois surfaces, un langage</h1>
        <p>Fixtures locales pour comparer les matériaux. Aucune donnée de voyage réelle.</p></header>
      <fieldset className={styles.controls}><legend>Moteur de rendu</legend>
        {engines.map(item => <label key={item.value}><input type="radio" name="engine" value={item.value} checked={requested === item.value}
          onChange={() => { setRendererFailed(false); setRequested(item.value); }} />{item.label}</label>)}
      </fieldset>
      <div className={styles.controls}>
        <label>État <select value={state} onChange={event => setState(event.target.value as FixtureState)}>{states.map(item => <option value={item} key={item}>{stateLabels[item]}</option>)}</select></label>
        <label><input type="checkbox" checked={forceStandard} onChange={event => setForceStandard(event.target.checked)} />Mode sobre</label>
        <label><input type="checkbox" checked={longList} onChange={event => setLongList(event.target.checked)} />Liste longue (CSS)</label>
      </div>
      <div className={styles.controls}>
        <label>Viewport <select value={viewport} onChange={e => setViewport(e.target.value as typeof viewport)}>
          <option value="full">Desktop (plein)</option>
          <option value="tablet">Tablette 768px</option>
          <option value="430">iPhone Plus 430px</option>
          <option value="390">iPhone 15 390px</option>
          <option value="320">iPhone SE 320px</option>
        </select></label>
      </div>
      <p role="status" className={styles.status}>{rendererFailed ? 'Le moteur a échoué : rendu standard conservé.' : reason || `Moteur actif : ${engines.find(item => item.value === engine)?.label}.`}</p>
      <p className={styles.note}>Safari et Firefox : les deux wrappers premium gardent un rendu partiel. Ce laboratoire ne duplique aucun contenu pour simuler la réfraction.</p>
      <div className={styles.grid} style={viewportWidths[viewport] ? { maxWidth: viewportWidths[viewport], margin: '0 auto' } : undefined}>
        {fixtures.map(fixture => <section key={fixture.key} className={styles.stage} data-fixture={fixture.key} aria-label={fixture.name}>
          {fixture.key === 'map' && <MapBackdrop />}
          <GlassLabSurface engine={engine} selected={state === 'selected'} critical={state === 'error'} onError={() => setRendererFailed(true)}>
            <FixtureContent fixture={fixture} state={state} onAction={increment} />
          </GlassLabSurface>
        </section>)}
      </div>
      <section className={styles.contracts} aria-labelledby="interaction-heading">
        <h2 id="interaction-heading">Contrat clavier et états canoniques</h2>
        <p role="status" data-testid="glass-action-count">Actions : {count}</p>
        <div className={styles.variants}>
          <GlassCard interactive onClick={increment} className={styles.example} aria-label="Action de carte">Activer avec Entrée ou Espace</GlassCard>
          <GlassCard interactive disabled onClick={increment} className={styles.example} aria-label="Carte désactivée">Carte désactivée</GlassCard>
          <GlassCard interactive onClick={increment} className={styles.example} aria-label="Carte avec lien">
            <span>Une action imbriquée ne doit pas activer la carte.</span>
            <a href="#interaction-heading" className={styles.link}>Lien interne de démonstration</a>
            <button type="button" className="glass-capsule-btn" onClick={() => setCount(previous => previous + 10)}>Action imbriquée (+10)</button>
          </GlassCard>
          {(['base', 'elevated', 'selected', 'overlay', 'critical'] as const).map(variant => <GlassCard key={variant} variant={variant} className={styles.example}>{variant}</GlassCard>)}
        </div>
      </section>
      {longList && <section aria-label="Liste longue de test" className={styles.longList}>
        {Array.from({ length: 60 }, (_, index) => <GlassCard key={index} as="article" className={styles.example}><h3>Étape de démonstration {index + 1}</h3><p>Surface standard · contenu dense · sans réfraction supplémentaire.</p></GlassCard>)}
      </section>}
    </main>
  );
}
