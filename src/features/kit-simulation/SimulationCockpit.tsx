"use client";
import {useRef,useState,useEffect} from 'react';
import type {Result,Mode} from './core';
import type {SimulationRequest} from './schema';
import './simulation.css';
type Snapshot=Result&{generatedAt:string};
export function SimulationCockpit({initialInput}:{initialInput:SimulationRequest}) {
  const [mode,setMode]=useState<Mode>(initialInput.mode);
  const [result,setResult]=useState<Snapshot|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [stale,setStale]=useState(false);const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function run(next:Mode) {
    controller.current?.abort();const active=new AbortController();controller.current=active;
    setMode(next);setBusy(true);setError('');setStale(true);
    try {
      const response=await fetch('/api/kit-simulation',{method:'POST',signal:active.signal,
        headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},
        body:JSON.stringify({...initialInput,mode:next})});
      if(!response.ok) throw new Error(`Calcul indisponible (${response.status}). Réessayez.`);
      const data:Snapshot=await response.json();
      if(!active.signal.aborted){setResult(data);setStale(false);}
    } catch(e) {
      if(!active.signal.aborted) setError(e instanceof Error?e.message:'Calcul indisponible.');
    } finally {if(!active.signal.aborted)setBusy(false);}
  }
  const weight=result?.packWeightG??null;
  const progress=weight===null?0:Math.min(100,100*weight/initialInput.maxPackWeightG);
  return <section className="glass simulation" aria-busy={busy}>
    <h2>Votre préparation, expliquée</h2>
    <p>Estimation d’équipement. Aucune garantie médicale ou de sécurité.</p>
    <div role="group" aria-label="Objectif d’optimisation">
      {(['eco','balanced','ul'] as const).map(value=><button key={value} type="button"
        aria-pressed={mode===value} onClick={()=>void run(value)}>
        {value==='eco'?'Budget':value==='ul'?'Poids':'Équilibré'}
      </button>)}
    </div>
    <p role="status" aria-live="polite">{busy?'Calcul en cours…':stale?'Résultat précédent, à actualiser.':
      result?'Calcul disponible.':'Choisissez un objectif pour lancer le calcul.'}</p>
    {error&&<p role="alert">{error}</p>}
    {result&&<>
      <p>Charge au dos : {weight===null?'inconnue':`${(weight/1000).toFixed(2)} kg`}.
        Préférence : {(initialInput.maxPackWeightG/1000).toFixed(1)} kg.</p>
      {weight!==null&&<progress max={100} value={progress} aria-label="Charge comparée à votre préférence"/>}
      <p>Couverture : {result.coverage==='complete'?'slots renseignés':'incomplète'}.
        Contraintes : {result.constraintStatus==='exceeded'?'dépassées':result.constraintStatus==='unknown'?'incertaines':'dans les préférences'}.</p>
      <ul>{result.warnings.map(w=><li key={w}>{w}</li>)}</ul>
      {result.missing.length>0&&<p>À compléter : {result.missing.join(', ')}.</p>}
      <ul>{result.items.map(({option:o,quantity})=><li key={o.id}>
        <strong>{o.spec.name}</strong> — {quantity} unité(s) — {o.source} —
        {new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(o.priceCents*quantity/100)}
      </li>)}</ul>
      <small>Version {result.version} — {new Date(result.generatedAt).toLocaleString('fr-FR')}</small>
    </>}
  </section>;
}
