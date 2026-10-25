'use client';

// Fiche pays — grammaire Compte, version du 25/10/2026 (prod Cloudflare).
//
// Composition stricte de la grammaire : trois feuilles (base + finitions +
// épingles globales), ancêtres `.lkdv-compte-v8 > .stage > .pwrap > .phone`,
// lentille liquide partagée, barre basse de la référence, drawer 406 × 708,3.
//
// Invariants 430 × 932 : `.top` 597,1 / carte (12,48) 406 × 541,1 r24 /
// `.mapzone` 334,9 / `.tb` (14,868) 402 × 48. `scrollHeight = innerHeight`.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/components/compte/compte-v8.css';
import '@/components/compte/compte-apple-hig.css';
import { useSearchContext } from '@/contexts/SearchContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { AccountDrawerHost, type DrawerTab } from '@/design/account/AccountDrawerHost';
import { initLiquidLenses, refreshLiquidLenses } from '@/design/account/liquid-lens';
import { CountryMap } from '@/components/pays/CountryMap';
import { createClient } from '@/lib/supabase/client';
import type { CountryDetail } from '@/lib/countryDetails';

/* ─── Sections ────────────────────────────────────────────────────────────── */

type SectionKey =
  | 'presentation'
  | 'destinations'
  | 'activites'
  | 'culture'
  | 'gastronomie'
  | 'hebergements'
  | 'pratique'
  | 'communaute';

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'presentation', label: 'Aperçu', icon: 'M12 3 3 10v11h6v-6h6v6h6V10L12 3Z' },
  { key: 'destinations', label: 'Incontournables', icon: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z' },
  { key: 'activites', label: 'Activités', icon: 'm3 18 5.5-9 4 6 3-4L21 18H3Z' },
  { key: 'culture', label: 'Culture', icon: 'M12 4 3 8.5 12 13l9-4.5L12 4ZM5 12v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4' },
  { key: 'gastronomie', label: 'Gastronomie', icon: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.5 1.5-2 3.5-2 6s.5 3 2 3v9' },
  { key: 'hebergements', label: 'Hébergements', icon: 'M3 18V9m0 9h18m-18 0v-3h18v3M7 9V6h10v3M3 9h18' },
  { key: 'pratique', label: 'Pratique', icon: 'M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z' },
  { key: 'communaute', label: 'Communauté', icon: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5m2-5.5c2.4.2 4.2 2.2 4.7 5.5' },
];

const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label])) as Record<SectionKey, string>;

const ICONS = {
  doc: 'M6 3h8l4 4v14H6V3Zm8 0v4h4M9 13h6M9 17h6',
  shield: 'M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z',
  book: 'M4 5a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2V5Zm12-2h2a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2h-2V3Z',
  share: 'M12 16V4m0 0L8 8m4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v10M9 8h4a2 2 0 0 1 0 4H9h4a2 2 0 0 1 0 4H9',
  spark: 'M12 3.5c.6 4.4 2.5 6.3 6.9 6.9-4.4.6-6.3 2.5-6.9 6.9-.6-4.4-2.5-6.3-6.9-6.9 4.4-.6 6.3-2.5 6.9-6.9Z',
  users: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5',
};

function Ic({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

interface WeatherPayload {
  status: string;
  current?: { temperatureC: number; condition: string; windKmH: number; uvIndex: number };
}

type DrawerKey = 'fiche' | 'pratique' | 'sources' | 'details' | 'partager';

const DRAWER_TABS: DrawerTab[] = [
  { id: 'fiche', label: 'Fiche d’identité', icon: <Ic d={ICONS.doc} /> },
  { id: 'pratique', label: 'Pratique', icon: <Ic d={ICONS.shield} /> },
  { id: 'sources', label: 'Sources', icon: <Ic d={ICONS.book} /> },
  { id: 'details', label: 'Détails de la section', icon: <Ic d={ICONS.pin} /> },
  { id: 'partager', label: 'Partager', icon: <Ic d={ICONS.share} /> },
];

export interface PaysGlassV8Props {
  country: CountryDetail;
  /** Vues détaillées historiques (Discovery, Klook, pratique IA), montées dans
   *  un volet dédié du drawer : rien ne disparaît au passage. */
  renderDetails?: (section: SectionKey) => React.ReactNode;
}

export function PaysGlassV8({ country, renderDetails }: PaysGlassV8Props) {
  const router = useRouter();
  const { openSearch } = useSearchContext();
  const { triggerHaptic } = useHapticFeedback();
  const phoneRef = useRef<HTMLDivElement>(null);

  const [section, setSection] = useState<SectionKey>('presentation');
  const [sectionMenu, setSectionMenu] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKey | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [community, setCommunity] = useState<{ key: string; title: string; sub: string }[] | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => initLiquidLenses(phoneRef.current), []);
  useEffect(() => {
    refreshLiquidLenses(phoneRef.current);
  }, [section, drawer, sectionMenu]);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('section');
    if (wanted && (SECTIONS as { key: string }[]).some((s) => s.key === wanted)) {
      setSection(wanted as SectionKey);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/pays/${country.code}/weather`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setWeather(d as WeatherPayload))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [country.code]);

  useEffect(() => {
    const iso = country.code.toLowerCase();
    const supabase = createClient();
    let alive = true;
    Promise.all([
      supabase.from('carnets').select('id,title,likes_count,country_iso,visibility').eq('visibility', 'public').ilike('country_iso', iso).order('likes_count', { ascending: false }).limit(4),
      supabase.from('clubs').select('id,slug,name,members_count,country_iso').ilike('country_iso', iso).order('members_count', { ascending: false }).limit(4),
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

  const go = useCallback(
    (path: string) => {
      triggerHaptic('selection');
      router.push(path);
    },
    [router, triggerHaptic]
  );

  const cover = country.hero_image_url || country.destinations?.[0]?.image_url || null;

  const share = useCallback(async () => {
    const url = `${window.location.origin}/pays/${country.code.toLowerCase()}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: country.nom, url });
        return;
      } catch {
        /* annulé */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Lien copié.');
    } catch {
      setShareMsg('Copie impossible : sélectionnez l’adresse du navigateur.');
    }
  }, [country.code, country.nom]);

  /* ── Cartes média / lignes / cartes d'info par section ──────────────────── */

  const mediaCards = useMemo(() => {
    const cards: { key: string; title: string; sub?: string; meta?: string; badge?: string; badge2?: string; image?: string }[] = [];
    if (section === 'presentation') {
      (country.destinations ?? []).slice(0, 2).forEach((d, i) =>
        cards.push({ key: `ap-${i}`, title: `${d.titre}${d.titre_em ? ` ${d.titre_em}` : ''}`, sub: d.categorie, meta: [d.meta_1, d.meta_2].filter(Boolean).join(' · '), badge: d.categorie, image: d.image_url })
      );
    }
    if (section === 'destinations') {
      (country.destinations ?? []).forEach((d, i) =>
        cards.push({
          key: `d-${i}`,
          title: `${d.titre}${d.titre_em ? ` ${d.titre_em}` : ''}`,
          sub: d.categorie,
          meta: [d.meta_1, d.meta_2, d.meta_3].filter(Boolean).join(' · '),
          badge: d.categorie,
          image: d.image_url,
        })
      );
    }
    if (section === 'activites') {
      (country.activites ?? []).forEach((a, i) =>
        cards.push({
          key: `a-${i}`,
          title: `${a.titre}${a.titre_em ? ` ${a.titre_em}` : ''}`,
          sub: [a.saison, a.duree].filter(Boolean).join(' · '),
          meta: [a.duree, a.prix].filter(Boolean).join(' · '),
          badge: a.difficulte,
          badge2: a.saison,
          image: a.image_url,
        })
      );
    }
    if (section === 'gastronomie') {
      (country.gastronomie ?? []).forEach((g, i) =>
        cards.push({
          key: `g-${i}`,
          title: `${g.nom}${g.nom_em ? ` ${g.nom_em}` : ''}`,
          sub: g.categorie,
          meta: g.description,
          badge: g.categorie,
          image: g.image_url,
        })
      );
    }
    return cards;
  }, [country, section]);

  const infoCards = useMemo(() => {
    if (section !== 'presentation') return [];
    return (country.highlights ?? []).map((h, i) => ({
      key: `h-${i}`,
      title: `${h.titre} ${h.sous_titre}`.trim(),
      text: h.description,
    }));
  }, [country, section]);

  const infoRows = useMemo(() => {
    const rows: { key: string; icon: string; label: string; value: string }[] = [];
    const p = country.pratique;
    if (section === 'pratique') {
      if (weather?.current) {
        rows.push({ key: 'w1', icon: ICONS.spark, label: 'Météo en direct', value: `${weather.current.temperatureC}°C · ${weather.current.condition}` });
        rows.push({ key: 'w2', icon: ICONS.clock, label: 'Vent · UV', value: `${weather.current.windKmH} km/h · UV ${weather.current.uvIndex}` });
      }
      (p?.formalites ?? []).forEach((r, i) => rows.push({ key: `f-${i}`, icon: ICONS.shield, label: r.cle, value: r.val }));
      (p?.transport ?? []).forEach((r, i) => rows.push({ key: `t-${i}`, icon: ICONS.pin, label: r.cle, value: r.val }));
      (p?.budget ?? []).forEach((r, i) => rows.push({ key: `b-${i}`, icon: ICONS.coin, label: r.cle, value: r.val }));
      (p?.sante ?? []).forEach((r, i) => rows.push({ key: `s-${i}`, icon: ICONS.shield, label: r.cle, value: r.val }));
      (p?.electricite_reseau ?? []).forEach((r, i) => rows.push({ key: `e-${i}`, icon: ICONS.spark, label: r.cle, value: r.val }));
      (p?.climat ?? []).forEach((r, i) => rows.push({ key: `k-${i}`, icon: ICONS.clock, label: r.cle, value: r.val }));
    }
    if (section === 'culture') {
      (country.culture?.faits ?? []).forEach((f, i) => rows.push({ key: `c-${i}`, icon: ICONS.book, label: f.cle, value: f.valeur }));
    }
    if (section === 'communaute') {
      (community ?? []).forEach((r) => rows.push({ key: r.key, icon: ICONS.users, label: r.title, value: r.sub }));
    }
    return rows;
  }, [country, community, section, weather]);

  const sheetCards = useMemo(() => {
    const cards: { key: string; title: string; pill?: string; hint?: string; rows: { label: string; value: string; icon: string }[]; actions?: { label: string; onClick: () => void }[] }[] = [];
    if (section === 'presentation') {
      cards.push({
        key: 'reperes',
        title: 'Repères',
        pill: country.code,
        rows: [
          { label: 'Superficie', value: country.superficie_detail, icon: ICONS.pin },
          { label: 'Capitale', value: country.capitale, icon: ICONS.pin },
          { label: 'Monnaie', value: country.monnaie || country.monnaie_nom, icon: ICONS.coin },
          { label: 'Fuseau', value: country.fuseau, icon: ICONS.clock },
          { label: 'Langues', value: country.langue, icon: ICONS.book },
        ],
        actions: [{ label: 'Fiche complète', onClick: () => setDrawer('fiche') }],
      });
      (country.highlights ?? []).slice(0, 3).forEach((h, i) =>
        cards.push({
          key: `hl-${i}`,
          title: `${h.titre} ${h.sous_titre}`.trim(),
          rows: [],
          hint: h.description,
        })
      );
    }
    if (section === 'culture') {
      const faits = country.culture?.faits ?? [];
      cards.push({
        key: 'culture',
        title: 'Culture & société',
        pill: `${faits.length} repères`,
        rows: faits.map((f) => ({ label: f.cle, value: f.valeur, icon: ICONS.book })),
        hint: country.culture?.citation ? `${country.culture.citation} — ${country.culture.citation_auteur}` : undefined,
      });
    }
    if (section === 'pratique') {
      const p = country.pratique;
      const groups = [
        { title: 'Formalités', rows: p?.formalites ?? [], icon: ICONS.shield },
        { title: 'Transport', rows: p?.transport ?? [], icon: ICONS.pin },
        { title: 'Budget', rows: p?.budget ?? [], icon: ICONS.coin },
        { title: 'Santé', rows: p?.sante ?? [], icon: ICONS.shield },
        { title: 'Électricité & réseau', rows: p?.electricite_reseau ?? [], icon: ICONS.spark },
        { title: 'Climat', rows: p?.climat ?? [], icon: ICONS.clock },
      ].filter((g) => g.rows.length > 0);
      groups.forEach((g) => cards.push({
        key: g.title,
        title: g.title,
        pill: `${g.rows.length}`,
        rows: g.rows.map((r) => ({ label: r.cle, value: r.val, icon: g.icon })),
      }));
      if (weather?.current) {
        cards.unshift({
          key: 'meteo',
          title: 'Météo en direct',
          pill: `${weather.current.temperatureC}°C`,
          rows: [
            { label: 'Conditions', value: weather.current.condition, icon: ICONS.spark },
            { label: 'Vent', value: `${weather.current.windKmH} km/h`, icon: ICONS.clock },
            { label: 'UV', value: String(weather.current.uvIndex), icon: ICONS.spark },
          ],
        });
      }
    }
    if (section === 'communaute') {
      const clubs = (community ?? []).filter((r) => r.sub.includes('club'));
      const carnets = (community ?? []).filter((r) => r.sub.includes('carnet'));
      if (clubs.length) cards.push({ key: 'clubs', title: 'Clubs outdoor', pill: `${clubs.length}`, rows: clubs.map((c) => ({ label: c.title, value: c.sub, icon: ICONS.users })), actions: [{ label: 'Tous les clubs', onClick: () => go('/clubs') }] });
      if (carnets.length) cards.push({ key: 'carnets', title: 'Carnets d’expédition', pill: `${carnets.length}`, rows: carnets.map((c) => ({ label: c.title, value: c.sub, icon: ICONS.book })), actions: [{ label: 'Tous les carnets', onClick: () => go('/carnets') }] });
    }
    return cards;
  }, [community, country, go, section, weather]);

  const hasMedia = mediaCards.length > 0;
  const isEmpty = !hasMedia && infoRows.length === 0 && infoCards.length === 0;

  const statItems = [
    { key: 'area', label: 'superficie', value: country.superficie_court },
    { key: 'capital', label: 'capitale', value: country.capitale },
    { key: 'currency', label: 'monnaie', value: country.monnaie_code || '—' },
  ];

  const drawerContent = (key: DrawerKey): React.ReactNode => {
    if (key === 'fiche') {
      const groups: { title: string; rows: { label: string; value: string; icon: string }[] }[] = [
        {
          title: 'Géographie',
          rows: [
            { label: 'Nom officiel', value: country.nom, icon: ICONS.doc },
            { label: 'Continent', value: country.continent, icon: ICONS.pin },
            { label: 'Région', value: country.region || '—', icon: ICONS.pin },
            { label: 'Superficie', value: country.superficie_detail, icon: ICONS.pin },
            { label: 'Fuseau horaire', value: country.fuseau, icon: ICONS.clock },
          ],
        },
        {
          title: 'Société',
          rows: [
            { label: 'Capitale', value: country.capitale, icon: ICONS.pin },
            { label: 'Langues', value: country.langue, icon: ICONS.book },
            { label: 'Monnaie', value: country.monnaie || country.monnaie_nom, icon: ICONS.coin },
            { label: 'Taux de change', value: country.taux_change || '—', icon: ICONS.coin },
          ],
        },
      ];
      return groups.map((g) => (
        <div className="lkdv-sheet-group" key={g.title}>
          <h3>{g.title}</h3>
          {g.rows.map((r) => (
            <div className="lkdv-info-row" key={r.label}>
              <span className="lkdv-info-row__ico"><Ic d={r.icon} size={15} /></span>
              <span className="lkdv-info-row__t">{r.label}</span>
              <span className="lkdv-info-row__v">{r.value}</span>
            </div>
          ))}
        </div>
      ));
    }
    if (key === 'pratique') {
      const p = country.pratique;
      const groups = [
        { title: 'Formalités', rows: p?.formalites ?? [], icon: ICONS.shield },
        { title: 'Transport', rows: p?.transport ?? [], icon: ICONS.pin },
        { title: 'Budget', rows: p?.budget ?? [], icon: ICONS.coin },
        { title: 'Santé', rows: p?.sante ?? [], icon: ICONS.shield },
        { title: 'Électricité & réseau', rows: p?.electricite_reseau ?? [], icon: ICONS.spark },
        { title: 'Climat', rows: p?.climat ?? [], icon: ICONS.clock },
      ].filter((g) => g.rows.length > 0);
      return groups.map((g) => (
        <div className="lkdv-sheet-group" key={g.title}>
          <h3>{g.title}</h3>
          {g.rows.map((r, i) => (
            <div className="lkdv-info-row" key={`${g.title}-${i}`}>
              <span className="lkdv-info-row__ico"><Ic d={g.icon} size={15} /></span>
              <span className="lkdv-info-row__t">{r.cle}</span>
              <span className="lkdv-info-row__v">{r.val}</span>
            </div>
          ))}
        </div>
      ));
    }
    if (key === 'sources') {
      const sources = country.sources_list ?? [];
      return (
        <div className="lkdv-sheet-group">
          <h3>Sources & références</h3>
          {sources.length === 0 ? (
            <div className="lkdv-info-row">
              <span className="lkdv-info-row__ico"><Ic d={ICONS.book} size={15} /></span>
              <span className="lkdv-info-row__t">Aucune source documentaire enregistrée pour ce pays.</span>
            </div>
          ) : (
            sources.map((s2, i) => (
              <div className="lkdv-info-row" key={i}>
                <span className="lkdv-info-row__ico"><Ic d={ICONS.book} size={15} /></span>
                <a className="lkdv-info-row__t" href={s2.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tint)', textDecoration: 'none' }}>
                  {s2.label} ↗
                </a>
              </div>
            ))
          )}
        </div>
      );
    }
    if (key === 'details') {
      const extra = renderDetails?.(section);
      if (!extra) {
        return (
          <div className="lkdv-sheet-group">
            <h3>{SECTION_LABEL[section]}</h3>
            <div className="lkdv-info-row">
              <span className="lkdv-info-row__ico"><Ic d={ICONS.spark} size={15} /></span>
              <span className="lkdv-info-row__t">Aucune vue détaillée pour cette section.</span>
            </div>
          </div>
        );
      }
      return <div className="lkdv-legacy-slot">{extra}</div>;
    }
    return (
      <div className="lkdv-sheet-group">
        <h3>Partager et agir</h3>
        <div className="lkdv-info-row">
          <span className="lkdv-info-row__ico"><Ic d={ICONS.share} size={15} /></span>
          <span className="lkdv-info-row__t">Lien de la fiche</span>
          <button type="button" className="lkdv-compte-btn primary" onClick={() => void share()}>Partager</button>
        </div>
        <div className="lkdv-info-row">
          <span className="lkdv-info-row__ico"><Ic d={ICONS.spark} size={15} /></span>
          <span className="lkdv-info-row__t">Composer mon kit</span>
          <button type="button" className="lkdv-compte-btn ghost" onClick={() => go(`/prepare?tab=equipement&country=${country.code}`)}>Ouvrir</button>
        </div>
        {shareMsg ? <p style={{ margin: '2px 4px 0', font: '500 10.5px/1.3 var(--sf)', color: 'var(--label2)' }}>{shareMsg}</p> : null}
      </div>
    );
  };

  return (
    <div className={`lkdv-compte-v8 lkdv-pays${drawer ? ' sheet-open' : ''}`}>
      <div className="stage">
        <div className="pwrap">
          <div className="phone hasnext" id="phone" ref={phoneRef} aria-label={`${country.nom} — fiche pays`}>
            <div className="bg">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- photo du pays, couche 1 de la grammaire
                <img className="bg-img" src={cover} alt="" />
              ) : null}
            </div>

            <section className="top" id="top">
              <div className="ig-top">
                <button type="button" className="lg ig-handle" onClick={() => go('/explorer')} aria-label="Retour à l’atlas des pays">
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
                      <path d={ICONS.spark} />
                    </svg>
                  </button>
                  <button type="button" className="lg gbtn ig-top-btn" aria-label="Fiche d’identité et sources" onClick={() => { triggerHaptic('selection'); setDrawer('fiche'); }}>
                    <svg className="ic s" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                      <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="card cs" id="card">
                <div className="card-scroll">
                  <div className="ig-header">
                    <div className="ig-left">
                      <button type="button" className="ig-avi-wrap" aria-label={`Fiche de ${country.nom}`} onClick={() => setDrawer('fiche')}>
                        <span className="ig-avi-in">
                          <span style={{ font: '700 20px var(--sf)', color: 'var(--tint)', letterSpacing: '-.02em' }}>{country.code}</span>
                        </span>
                      </button>
                    </div>
                    <div className="ig-right">
                      <div className="ig-stats" role="group" aria-label="Chiffres clés du pays">
                        {statItems.map((s) => (
                          <button type="button" className="ig-stat" key={s.key} aria-label={`${s.label} ${s.value}`} onClick={() => setDrawer('fiche')}>
                            <b className="num">{s.value}</b>
                            <span>{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ig-bio">
                    <div className="ig-bio-top">
                      <b className="ig-bio-cc">{country.continent}</b>
                      <span className="ig-bio-dot" aria-hidden="true">·</span>
                      <span className="ig-bio-stats">{[country.region, country.fuseau, country.langue].filter(Boolean).join(' · ')}</span>
                    </div>
                    {country.slogan ? <p className="ig-bio-text">« {country.slogan} »</p> : null}
                  </div>

                  <div className="ig-grid-wrap">
                    {isEmpty ? (
                      <div className="lkdv-sheet-card" role="status">
                        <div className="lkdv-sheet-card__head">
                          <b>{SECTION_LABEL[section]} — rien de publié</b>
                          <span className="lkdv-pill">vide</span>
                        </div>
                        <p className="lkdv-sheet-card__hint">Les fiches sont enrichies pays par pays : aucune donnée n’est inventée pour combler le vide.</p>
                        <div className="lkdv-sheet-card__actions">
                          <button type="button" className="lkdv-compte-btn ghost" onClick={() => go('/explorer')}>Explorer l’atlas</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {mediaCards.map((c) => (
                          <article className="lkdv-media-card" key={c.key}>
                            <div className="lkdv-media-card__media">
                              {c.image ? (
                                // eslint-disable-next-line @next/next/no-img-element -- photo réelle
                                <img src={c.image} alt={c.title} loading="lazy" />
                              ) : null}
                              {c.badge ? <span className="lkdv-media-badge lkdv-media-badge--dark">{c.badge}</span> : null}
                              {c.badge2 ? <span className="lkdv-media-badge lkdv-media-badge--light">{c.badge2}</span> : null}
                            </div>
                            <div className="lkdv-media-card__cap">
                              <b>{c.title}</b>
                              {c.sub ? <span>{c.sub}</span> : null}
                              {c.meta ? <div className="lkdv-media-card__meta">{c.meta}</div> : null}
                            </div>
                          </article>
                        ))}

                        {sheetCards.map((card) => (
                          <section className="lkdv-sheet-card" key={card.key}>
                            <div className="lkdv-sheet-card__head">
                              <b>{card.title}</b>
                              {card.pill ? <span className="lkdv-pill">{card.pill}</span> : null}
                            </div>
                            {card.hint ? <p className="lkdv-sheet-card__hint">{card.hint}</p> : null}
                            {card.rows.map((r) => (
                              <div className="lkdv-info-row" key={r.label}>
                                <span className="lkdv-info-row__ico"><Ic d={r.icon} size={15} /></span>
                                <span className="lkdv-info-row__t">{r.label}</span>
                                <span className="lkdv-info-row__v">{r.value}</span>
                              </div>
                            ))}
                            {card.actions?.length ? (
                              <div className="lkdv-sheet-card__actions">
                                {card.actions.map((a, i) => (
                                  <button key={a.label} type="button" className={`lkdv-compte-btn ${i === 0 ? 'primary' : 'ghost'}`} onClick={a.onClick}>{a.label}</button>
                                ))}
                              </div>
                            ) : null}
                          </section>
                        ))}
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    className="lkdv-info-row"
                    style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => setDrawer('pratique')}
                  >
                    <span className="lkdv-info-row__ico"><Ic d={ICONS.shield} size={15} /></span>
                    <span className="lkdv-info-row__t">Pratique & sources</span>
                    <span className="lkdv-info-row__v">Ouvrir →</span>
                  </button>
                </div>

              </div>

              <div className="lkdv-section-float">
                  <div className="lkdv-section-select">
                    <button
                      type="button"
                      className="lkdv-section-pill"
                      aria-haspopup="menu"
                      aria-expanded={sectionMenu}
                      onClick={() => setSectionMenu((v) => !v)}
                    >
                      <Ic d={SECTIONS.find((x) => x.key === section)?.icon ?? ICONS.pin} size={13} />
                      <span>{SECTION_LABEL[section]}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {sectionMenu ? (
                      <div className="lkdv-section-menu" role="menu" aria-label="Sections de la fiche">
                        {SECTIONS.map((sec) => (
                          <button
                            key={sec.key}
                            type="button"
                            role="menuitemradio"
                            aria-selected={section === sec.key}
                            onClick={() => { setSection(sec.key); setSectionMenu(false); triggerHaptic('selection'); }}
                          >
                            <Ic d={sec.icon} size={14} />
                            <span>{sec.label}</span>
                          </button>
                        ))}
                    </div>
                    ) : null}
                </div>
              </div>
            </section>

            <section className="mapzone" aria-label={`Carte de ${country.nom}`}>
              <CountryMap name={country.nom} latitude={country.latitude} longitude={country.longitude} capital={country.capitale} />
            </section>

            <nav className="lkdv-account-bar" aria-label="Navigation principale">
              <AccountBottomBar renderAs="button" />
            </nav>

            <AccountDrawerHost
              open={drawer !== null}
              title={drawer ? DRAWER_TABS.find((t) => t.id === drawer)?.label ?? '' : ''}
              subtitle={`${country.nom}${country.iso_a3 ? ` · ${country.iso_a3}` : ''}`}
              onClose={() => setDrawer(null)}
              tabs={DRAWER_TABS}
              activeTab={drawer}
              onTabChange={(id) => setDrawer(id as DrawerKey)}
            >
              {drawer ? drawerContent(drawer) : null}
            </AccountDrawerHost>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaysGlassV8;
