'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { LkvChip } from '@/components/ui/LkvChip';
import CommunityPostCard, { type CommunityPostItem } from '@/components/communaute/CommunityPostCard';
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

/* Fixtures de posts façon Twitter — données locales de démonstration uniquement. */
const demoPosts: CommunityPostItem[] = [
  {
    id: 'demo-post-1',
    user_id: 'demo-user',
    content:
      'Départ à 5h du matin depuis le refuge, la tête dans le brouillard et le cœur léger. On a suivi la crête jusqu’au col des Mélèzes avant que le soleil ne perce. ' +
      'De là-haut, le lac était encore gelé sur sa rive nord, une lumière incroyable sur les aiguilles. On a partagé un thé brûlant, puis redescendu par la combe nord où la neige tenait encore dans les couloirs. ' +
      'Une journée parfaite, du genre qui reste gravé. Hâte de repartir avec vous tous la semaine prochaine !',
    author: { id: 'demo-user', full_name: 'Claire Berthier', avatar_url: 'https://i.pravatar.cc/150?img=47', loyalty_level: 'EXPERT' },
    image_url: '/assets/images/community-hikers.jpg',
    likes_count: 128,
    comments_count: 24,
    created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    user_liked: false,
    user_saved: false,
  },
  {
    id: 'demo-post-2',
    user_id: 'demo-user-2',
    content: 'Petite pensée du soir pour le sentier des crêtes, sans image mais avec du cœur.',
    author: { id: 'demo-user-2', full_name: 'Marc Dubois', loyalty_level: 'AVENTURIER' },
    image_url: null,
    likes_count: 42,
    comments_count: 7,
    created_at: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
    user_liked: true,
    user_saved: false,
  },
];

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
      <section className={styles.stage} data-fixture="pill" aria-label="Pastille réfractive" style={{ maxWidth: 430, margin: '0 auto' }}>
        <MapBackdrop />
        <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className={styles.eyebrow}>Pastille réfractive · référence rdev</p>
          <h2>Log Out</h2>
          <p>Liseré spéculaire, réfraction du fond et élasticité au pointeur.</p>
          <LkvButton
            variant="glass-pill"
            onClick={increment}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            }
          >
            Se déconnecter
          </LkvButton>
          <LkvButton variant="glass-pill-primary" onClick={increment}>Choisir cet exemple</LkvButton>
        </div>
      </section>
      <section className={styles.stage} data-fixture="controls" aria-label="Tous les contrôles" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className={styles.eyebrow}>Toutes les variantes · même pile optique</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <LkvButton variant="primary" onClick={increment}>primary</LkvButton>
            <LkvButton variant="secondary" onClick={increment}>secondary</LkvButton>
            <LkvButton variant="light" onClick={increment}>light</LkvButton>
            <LkvButton variant="ghost" onClick={increment}>ghost</LkvButton>
            <LkvButton variant="danger" onClick={increment}>danger</LkvButton>
            <LkvButton variant="icon-only" aria-label="icône seule" onClick={increment}>★</LkvButton>
            <LkvButton variant="glass-pill" onClick={increment}>glass-pill</LkvButton>
            <LkvButton variant="glass-pill-primary" onClick={increment}>pill-primary</LkvButton>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <LkvChip label="sage" tone="sage" onClick={increment} />
            <LkvChip label="info" tone="info" onClick={increment} />
            <LkvChip label="danger" tone="danger" onClick={increment} />
            <LkvChip label="glass" tone="glass" onClick={increment} />
            <LkvChip label="active" tone="glass" active onClick={increment} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button type="button" className="glass-capsule-btn">capsule</button>
            <button type="button" className="glass-capsule-btn primary">capsule primary</button>
            <button type="button" className="glass-capsule-btn secondary">capsule secondary</button>
            <button type="button" className="glass-circle-btn" aria-label="cercle">●</button>
          </div>
        </div>
      </section>
      <section className={styles.stage} data-fixture="posts" aria-label="Posts communauté façon Twitter" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className={styles.eyebrow}>Posts communauté · image plein-bord, boutons en verre par-dessus, 200 caractères</p>
          {demoPosts.map((post) => (
            <CommunityPostCard key={post.id} post={post} user={{ id: post.user_id }} />
          ))}
        </div>
      </section>
      <section className={styles.contracts} aria-labelledby="interaction-heading">
        <h2 id="interaction-heading">Contrat clavier et états canoniques</h2>
        <p role="status" data-testid="glass-action-count">Actions : {count}</p>
        <div className={styles.variants}>
          <GlassCard tier="standard" interactive onClick={increment} className={styles.example} aria-label="Action de carte">Activer avec Entrée ou Espace</GlassCard>
          <GlassCard tier="standard" interactive disabled onClick={increment} className={styles.example} aria-label="Carte désactivée">Carte désactivée</GlassCard>
          <GlassCard tier="standard" interactive onClick={increment} className={styles.example} aria-label="Carte avec lien">
            <span>Une action imbriquée ne doit pas activer la carte.</span>
            <a href="#interaction-heading" className={styles.link}>Lien interne de démonstration</a>
            <button type="button" className="glass-capsule-btn" onClick={() => setCount(previous => previous + 10)}>Action imbriquée (+10)</button>
          </GlassCard>
          {(['base', 'elevated', 'selected', 'overlay', 'critical'] as const).map(variant => <GlassCard key={variant} tier="standard" variant={variant} className={styles.example}>{variant}</GlassCard>)}
        </div>
      </section>
      {longList && <section aria-label="Liste longue de test" className={styles.longList}>
        {Array.from({ length: 60 }, (_, index) => <GlassCard key={index} as="article" className={styles.example}><h3>Étape de démonstration {index + 1}</h3><p>Surface standard · contenu dense · sans réfraction supplémentaire.</p></GlassCard>)}
      </section>}
    </main>
  );
}
