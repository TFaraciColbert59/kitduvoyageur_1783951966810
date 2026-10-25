'use client';

// Fiche pays — grammaire Compte (verre Liquid Glass v8).
//
// L'écran est une composition de la grammaire existante : la feuille
// `compte-v8.css` (même fichier que /compte et /clubs), les mêmes classes,
// les mêmes primitives (`AccountBottomBar`, `AccountDrawerHost`, lentille
// liquide partagée). Aucune valeur de matière, de rayon ou de couleur n'est
// écrite ici : tout vient de la feuille de la grammaire.
//
// Géométrie invariante (430 × 932) : `.top` 597,1 / carte 406 × 541,1 à (12,48)
// / `.mapzone` 334,9 / `.tb` 402 × 48 à (14,868). `scrollHeight = innerHeight`.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/components/compte/compte-v8.css';
import '@/components/compte/compte-apple-hig.css';
import { useSearchContext } from '@/contexts/SearchContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import { initLiquidLenses, refreshLiquidLenses } from '@/design/account/liquid-lens';
import type { CountryDetail } from '@/lib/countryDetails';
import { createClient } from '@/lib/supabase/client';

/* ─── Sections : les 8 clés historiques, inchangées ───────────────────────── */

type SectionKey =
  | 'presentation'
  | 'destinations'
  | 'activites'
  | 'culture'
  | 'gastronomie'
  | 'hebergements'
  | 'pratique'
  | 'communaute';

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: 'presentation', label: 'Aperçu', icon: <path d="M12 3 3 10v11h6v-6h6v6h6V10L12 3Z" /> },
  { key: 'destinations', label: 'Incontournables', icon: <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /> },
  { key: 'activites', label: 'Activités', icon: <path d="m3 18 5.5-9 4 6 3-4L21 18H3Z" /> },
  { key: 'culture', label: 'Culture', icon: <path d="M12 4 3 8.5 12 13l9-4.5L12 4ZM5 12v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4" /> },
  { key: 'gastronomie', label: 'Gastronomie', icon: <path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.5 1.5-2 3.5-2 6s.5 3 2 3v9" /> },
  { key: 'hebergements', label: 'Hébergements', icon: <path d="M3 18V9m0 9h18m-18 0v-3h18v3M7 9V6h10v3M3 9h18" /> },
  { key: 'pratique', label: 'Pratique', icon: <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z" /> },
  { key: 'communaute', label: 'Communauté', icon: <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5m2-5.5c2.4.2 4.2 2.2 4.7 5.5" /> },
];

const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label])) as Record<SectionKey, string>;

/* ─── Tuiles / lignes ─────────────────────────────────────────────────────── */

interface Tile {
  key: string;
  title: string;
  sub?: string;
  image?: string;
  badge?: string;
}

interface Row {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
}

interface Weather {
  status: string;
  current?: { temperatureC: number; condition: string; windKmH: number; uvIndex: number };
}

export interface PaysGlassV8Props {
  country: CountryDetail;
  /** Section dont on ouvre le détail complet dans le drawer. */
  detailsSection?: SectionKey | null;
  onOpenDetails?: (section: SectionKey) => void;
  onCloseDetails?: () => void;
  /** Contenu détaillé (vues historiques), monté tel quel dans le drawer. */
  renderDetails?: (section: SectionKey) => React.ReactNode;
}

export function PaysGlassV8({
  country,
  detailsSection = null,
  onOpenDetails,
  onCloseDetails,
  renderDetails,
}: PaysGlassV8Props) {
  const router = useRouter();
  const { openSearch } = useSearchContext();
  const { triggerHaptic } = useHapticFeedback();
  const phoneRef = useRef<HTMLDivElement>(null);

  const [section, setSection] = useState<SectionKey>('presentation');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sheet, setSheet] = useState<null | 'identite' | 'pratique' | 'sources'>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [community, setCommunity] = useState<{ key: string; title: string; sub: string }[] | null>(null);

  // Lentille liquide : une passe au montage, puis à chaque changement de surface.
  useEffect(() => initLiquidLenses(phoneRef.current), []);
  useEffect(() => {
    refreshLiquidLenses(phoneRef.current);
  }, [section, view, sheet]);

  // Lien direct vers une section (`?section=communaute`, ex. depuis le Compas).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('section');
    if (wanted && (SECTIONS as { key: string }[]).some((s) => s.key === wanted)) {
      setSection(wanted as SectionKey);
    }
  }, []);

  // Communauté réelle : mêmes requêtes que les listes historiques (carnets
  // publics du pays, clubs du pays), rendues en lignes de la grammaire.
  useEffect(() => {
    const iso = country.code.toLowerCase();
    const supabase = createClient();
    let alive = true;
    Promise.all([
      supabase
        .from('carnets')
        .select('id,title,likes_count,country_iso,visibility')
        .eq('visibility', 'public')
        .ilike('country_iso', iso)
        .order('likes_count', { ascending: false })
        .limit(4),
      supabase
        .from('clubs')
        .select('id,slug,name,members_count,country_iso')
        .ilike('country_iso', iso)
        .order('members_count', { ascending: false })
        .limit(4),
    ])
      .then(([c, k]) => {
        if (!alive) return;
        const rows: { key: string; title: string; sub: string }[] = [];
        (k.data ?? []).forEach((x: any) => rows.push({ key: `club-${x.id}`, title: x.name, sub: `${x.members_count ?? 0} membres · club` }));
        (c.data ?? []).forEach((x: any) => rows.push({ key: `carnet-${x.id}`, title: x.title, sub: `${x.likes_count ?? 0} j’aime · carnet` }));
        setCommunity(rows);
      })
      .catch(() => alive && setCommunity([]));
    return () => {
      alive = false;
    };
  }, [country.code]);

  // Météo réelle (même route que la fiche historique).
  useEffect(() => {
    let alive = true;
    fetch(`/api/pays/${country.code}/weather`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setWeather(d as Weather);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [country.code]);

  const go = useCallback(
    (path: string) => {
      triggerHaptic('selection');
      router.push(path);
    },
    [router, triggerHaptic]
  );

  const cover = country.hero_image_url || country.destinations?.[0]?.image_url || null;

  /* ── Contenu réel de chaque section ─────────────────────────────────────── */

  const tiles: Tile[] = useMemo(() => {
    switch (section) {
      case 'presentation':
        return (country.highlights ?? []).map((h, i) => ({
          key: `hl-${i}`,
          title: `${h.titre} ${h.sous_titre}`.trim(),
          sub: h.description,
        }));
      case 'destinations':
        return (country.destinations ?? []).map((d, i) => ({
          key: `d-${i}`,
          title: d.titre + (d.titre_em ? ` ${d.titre_em}` : ''),
          sub: d.categorie,
          image: d.image_url,
        }));
      case 'activites':
        return (country.activites ?? []).map((a, i) => ({
          key: `a-${i}`,
          title: a.titre + (a.titre_em ? ` ${a.titre_em}` : ''),
          sub: [a.saison, a.duree].filter(Boolean).join(' · '),
          image: a.image_url,
          badge: a.difficulte,
        }));
      case 'culture':
        return (country.culture?.faits ?? []).map((f, i) => ({
          key: `c-${i}`,
          title: f.valeur || f.cle,
          sub: f.cle,
        }));
      case 'gastronomie':
        return (country.gastronomie ?? []).map((g, i) => ({
          key: `g-${i}`,
          title: g.nom + (g.nom_em ? ` ${g.nom_em}` : ''),
          sub: g.categorie,
          image: g.image_url,
        }));
      case 'pratique':
        return [];
      case 'hebergements':
      case 'communaute':
      default:
        return [];
    }
  }, [section, country]);

  const rows: Row[] = useMemo(() => {
    const p = country.pratique;
    const base: Row[] = [];
    if (section === 'pratique') {
      if (weather?.current) {
        base.push({ key: 'w1', label: 'Météo en direct', value: `${weather.current.temperatureC}°C · ${weather.current.condition}` });
        base.push({ key: 'w2', label: 'Vent · UV', value: `${weather.current.windKmH} km/h · UV ${weather.current.uvIndex}`, mono: true });
      }
      (p?.formalites ?? []).forEach((r, i) => base.push({ key: `f-${i}`, label: r.cle, value: r.val, mono: r.isMono }));
      (p?.transport ?? []).forEach((r, i) => base.push({ key: `t-${i}`, label: r.cle, value: r.val, mono: r.isMono }));
      (p?.budget ?? []).forEach((r, i) => base.push({ key: `b-${i}`, label: r.cle, value: r.val, mono: r.isMono }));
      (p?.sante ?? []).forEach((r, i) => base.push({ key: `s-${i}`, label: r.cle, value: r.val, mono: r.isMono }));
      (p?.electricite_reseau ?? []).forEach((r, i) => base.push({ key: `e-${i}`, label: r.cle, value: r.val, mono: r.isMono }));
      (p?.climat ?? []).forEach((r, i) => base.push({ key: `k-${i}`, label: r.cle, value: r.val, mono: r.isMono }));
    }
    if (section === 'communaute') {
      (community ?? []).forEach((r) => base.push({ key: r.key, label: r.title, value: r.sub }));
    }
    if (section === 'culture') {
      (country.culture?.faits ?? []).forEach((f, i) => base.push({ key: `cf-${i}`, label: f.cle, value: f.valeur }));
    }
    if (section === 'destinations' || section === 'activites' || section === 'gastronomie') {
      const source = section === 'destinations' ? country.destinations : section === 'activites' ? country.activites : country.gastronomie;
      source?.forEach((it: any, i: number) => {
        const title = it.titre ? `${it.titre}${it.titre_em ? ` ${it.titre_em}` : ''}` : `${it.nom ?? ''}${it.nom_em ? ` ${it.nom_em}` : ''}`;
        const sub = it.categorie || it.saison || it.duree || '';
        base.push({ key: `r-${i}`, label: title, value: String(sub) });
      });
    }
    return base;
  }, [section, country, weather, community]);

  const empty = tiles.length === 0 && rows.length === 0;
  const hasPhotos = tiles.some((t) => Boolean(t.image));
  const effectiveView: 'grid' | 'list' = view === 'grid' && hasPhotos ? 'grid' : 'list';

  /* ── Rendu ──────────────────────────────────────────────────────────────── */

  return (
    <div className={`lkdv-compte-v8 lkdv-pays${sheet || detailsSection ? ' sheet-open' : ''}`}>
      <div className="stage">
        <div className="pwrap">
          <div className="phone hasnext" id="phone" ref={phoneRef} aria-label={`${country.nom} — fiche pays`}>
      {cover ? (
        <div className="bg" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />
      ) : (
        <div className="bg" style={{ background: 'linear-gradient(180deg, var(--mint), var(--page))' }} aria-hidden="true" />
      )}

      <section className="top" id="top">
        {/* Barre haute : pilule de retour + 3 boutons ronds (grammaire §3.2) */}
        <div className="ig-top">
          <button
            type="button"
            className="lg ig-handle"
            onClick={() => go('/explorer')}
            aria-label="Retour à l’atlas des pays"
          >
            <span>← Atlas</span>
          </button>
          <div className="ig-top-r">
            <button type="button" className="lg gbtn ig-top-btn" aria-label="Rechercher un pays" onClick={() => { triggerHaptic('light'); openSearch(); }}>
              <svg className="ic s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <button type="button" className="lg gbtn ig-top-btn" aria-label={`Composer mon kit pour ${country.nom}`} onClick={() => go(`/prepare?tab=equipement&country=${country.code}`)}>
              <svg className="ic s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3.5c.6 4.4 2.5 6.3 6.9 6.9-4.4.6-6.3 2.5-6.9 6.9-.6-4.4-2.5-6.3-6.9-6.9 4.4-.6 6.3-2.5 6.9-6.9Z" />
                <path d="M18.5 16.5c.3 2 1.1 2.8 3.1 3.1-2 .3-2.8 1.1-3.1 3.1-.3-2-1.1-2.8-3.1-3.1 2-.3 2.8-1.1 3.1-3.1Z" />
              </svg>
            </button>
            <button type="button" className="lg gbtn ig-top-btn" aria-label="Fiche d’identité et sources" onClick={() => { triggerHaptic('selection'); setSheet('identite'); }}>
              <svg className="ic s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Carte : identité, bio, anneaux de sections, grille (grammaire §3.3) */}
        <div className="card cs" id="card">
          <div className="card-scroll">
            <div className="ig-header">
              <div className="ig-left">
                <button type="button" className="ig-avi-wrap" aria-label={`Drapeau ${country.nom}`} onClick={() => { triggerHaptic('selection'); setSheet('identite'); }}>
                  <span className="ig-avi-in">
                    <span style={{ font: '700 20px var(--sf)', color: 'var(--tint)', letterSpacing: '-.02em' }}>{country.code}</span>
                  </span>
                </button>
              </div>
              <div className="ig-right">
                <div className="ig-stats" role="group" aria-label="Chiffres clés du pays">
                  <button type="button" className="ig-stat" aria-label={`Superficie ${country.superficie_detail}`} onClick={() => setSheet('identite')}>
                    <b className="num">{country.superficie_court}</b>
                    <span>superficie</span>
                  </button>
                  <button type="button" className="ig-stat" aria-label={`Capitale ${country.capitale}`} onClick={() => setSheet('identite')}>
                    <b className="num">{country.capitale}</b>
                    <span>capitale</span>
                  </button>
                  <button type="button" className="ig-stat" aria-label={`Monnaie ${country.monnaie || country.monnaie_nom}`} onClick={() => setSheet('identite')}>
                    <b className="num">{country.monnaie_code || '—'}</b>
                    <span>monnaie</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="ig-bio">
              <div className="ig-bio-top">
                <b className="ig-bio-cc">{country.continent}</b>
                <span className="ig-bio-dot" aria-hidden="true">·</span>
                <span className="ig-bio-stats">
                  {[country.region, country.fuseau, country.langue].filter(Boolean).join(' · ')}
                </span>
              </div>
              {country.slogan ? <p className="ig-bio-text">« {country.slogan} »</p> : null}
            </div>

            {/* Anneaux : les 8 sections, 5 visibles, défilement horizontal */}
            <div className="ig-hl-row" role="region" aria-label="Sections de la fiche">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="ig-hl"
                  aria-current={section === s.key ? 'true' : undefined}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSection(s.key);
                    setView('grid');
                  }}
                >
                  <span className="ig-hl-ring">
                    <span className="ig-hl-in">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tint)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {s.icon}
                      </svg>
                    </span>
                  </span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Grille 3 colonnes / liste — contenu réel de la section */}
            <div className="ig-grid-wrap">
              {empty ? (
                <div className="li" role="status">
                  <div>
                    <div className="ttl">
                      {section === 'hebergements'
                        ? 'Aucun hébergement publié pour ce pays'
                        : section === 'communaute'
                          ? 'Aucun carnet publié pour ce pays'
                          : 'Pas encore de contenu pour cette section'}
                    </div>
                    <div className="s2">
                      {section === 'communaute'
                        ? 'Les carnets et clubs de voyageurs apparaîtront ici dès la première publication.'
                        : 'Les fiches sont enrichies pays par pays : rien n’est inventé pour combler le vide.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mbtn p"
                    onClick={() => go(section === 'communaute' ? '/carnets' : '/explorer')}
                  >
                    {section === 'communaute' ? 'Voir les carnets' : 'Explorer l’atlas'}
                  </button>
                </div>
              ) : effectiveView === 'grid' ? (
                <div className="ig-grid" role="region" aria-label={`${SECTION_LABEL[section]} — grille`}>
                  {tiles.map((t) => (
                    <button key={t.key} type="button" className="ig-tile" aria-label={`${t.title}${t.sub ? ` · ${t.sub}` : ''}`}>
                      {t.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- photo distante, même source que l’éditorial
                        <img src={t.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div role="region" aria-label={`${SECTION_LABEL[section]} — liste`}>
                  {(rows.length ? rows : tiles.map((t) => ({ key: t.key, label: t.title, value: t.sub ?? '' }))).map((r) => (
                    <div className="li" key={r.key}>
                      <div>
                        <div className="ttl">{r.label}</div>
                        {r.value ? <div className="s2">{r.value}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="li"
                style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => onOpenDetails?.(section)}
              >
                <div>
                  <div className="ttl">Tout voir — {SECTION_LABEL[section]}</div>
                  <div className="s2">Détail complet, sources et contenus partenaires</div>
                </div>
                <span className="tg">Ouvrir</span>
              </button>
            </div>
          </div>

          {/* Sélecteur Grille | Liste — 88 × 30, lentille 41,5 (grammaire §3.8) */}
          <div className="ig-tabs-float">
            <div className="ig-tabs" role="tablist" aria-label="Affichage de la section">
              <span className="ig-th" style={{ transform: effectiveView === 'grid' ? 'translateX(0%)' : 'translateX(100%)' }} aria-hidden="true" />
              <button type="button" role="tab" aria-selected={effectiveView === 'grid'} aria-disabled={!hasPhotos} aria-label={hasPhotos ? 'Grille' : 'Grille — aucune photo dans cette section'} onClick={() => { if (!hasPhotos) return; triggerHaptic('light'); setView('grid'); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              <button type="button" role="tab" aria-selected={effectiveView === 'list'} aria-label="Liste" onClick={() => { triggerHaptic('light'); setView('list'); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Zone carte : repères réels du pays, sans tuiles réseau */}
      <section className="mapzone" aria-label={`Repères de ${country.nom}`}>
        <div className="map" style={{ background: 'linear-gradient(180deg, var(--mint), var(--page))' }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            {(country.points_interet_carte ?? []).map((pt) => {
              // Les repères sont donnés en % de la carte historique. La bande
              // basse (64 px) est réservée à la barre : on projette les points
              // dans la zone visible (14 % → 78 %) plutôt que de les laisser
              // passer sous le verre.
              const topPct = 14 + (parseFloat(pt.top) || 50) * 0.64;
              const leftPct = 10 + (parseFloat(pt.left) || 50) * 0.8;
              return (
              <span key={pt.nom} style={{ position: 'absolute', top: `${topPct}%`, left: `${leftPct}%`, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i style={{ width: pt.isCapital ? 9 : 7, height: pt.isCapital ? 9 : 7, borderRadius: 999, background: 'var(--tint)', boxShadow: '0 0 0 3px rgba(255,255,255,.7)' }} />
                <em style={{ font: '600 9.5px/1 var(--sf)', fontStyle: 'normal', color: 'var(--label)', letterSpacing: '-.1px', whiteSpace: 'nowrap' }}>{pt.nom}</em>
              </span>
              );
            })}
          </div>
          <p
            style={{
              position: 'absolute',
              left: 12,
              top: 10,
              font: '600 9.5px/1 var(--sf)',
              color: 'var(--label2)',
              letterSpacing: '-.1px',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,.62)',
              padding: '5px 8px',
              borderRadius: 999,
            }}
          >
            {country.carte_repere || 'Repères'} · {country.carte_echelle || 'échelle non renseignée'}
          </p>
        </div>
      </section>

      <nav className="lkdv-account-bar" aria-label="Navigation principale">
        <AccountBottomBar renderAs="button" />
      </nav>

      <AccountDrawerHost
        open={sheet !== null}
        title={sheet === 'identite' ? `Fiche d’identité — ${country.nom}` : sheet === 'pratique' ? `Pratique — ${country.nom}` : 'Sources'}
        subtitle={sheet === 'identite' ? `${country.code}${country.iso_a3 ? ` · ${country.iso_a3}` : ''}` : undefined}
        onClose={() => setSheet(null)}
      >
        {sheet === 'identite' ? (
          <div>
            {[
              ['Nom officiel', country.nom],
              ['Nom anglais', country.nom_en || '—'],
              ['Continent', country.continent],
              ['Région', country.region || '—'],
              ['Capitale', country.capitale],
              ['Langues', country.langue],
              ['Superficie', country.superficie_detail],
              ['Fuseau horaire', country.fuseau],
              ['Monnaie', country.monnaie || country.monnaie_nom],
              ['Taux de change', country.taux_change || '—'],
            ].map(([label, value]) => (
              <div className="li" key={label}>
                <div>
                  <div className="ttl">{label}</div>
                  <div className="s2">{value}</div>
                </div>
              </div>
            ))}
            {country.sources_list?.length ? (
              <div className="li">
                <div>
                  <div className="ttl">Sources</div>
                  <div className="s2">
                    {country.sources_list.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </AccountDrawerHost>

      <AccountDrawerHost
        open={detailsSection !== null}
        title={detailsSection ? SECTION_LABEL[detailsSection] : ''}
        subtitle={`${country.nom}${country.code ? ` · ${country.code}` : ''}`}
        onClose={() => onCloseDetails?.()}
      >
        {detailsSection && renderDetails ? <div>{renderDetails(detailsSection)}</div> : null}
      </AccountDrawerHost>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaysGlassV8;
