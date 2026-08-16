'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ─── Tokens (refonte mobile Groupes) ────────────────────────────────────── */
const C = {
  paper: '#FAF7F1',
  stone: '#F4F1EB',
  ink900: '#17211D',
  ink700: '#3A463F',
  ink500: '#6B7671',
  ink300: '#B9C0BB',
  forest900: '#0B1F17',
  forest800: '#12352A',
  forest700: '#1E4A3B',
  sage500: '#6E9C7F',
  sage300: '#A9C6B0',
  warm500: '#C9924A',
};

type Group = any;

interface PendingInvite {
  id: string;
  group_id: string;
  name: string;
  owner_id: string;
}

interface Props {
  user: any;
  myGroups: Group[];
  publicGroups: Group[];
  pendingInvites: PendingInvite[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onJoin: (groupId: string) => void;
  onLeave: (groupId: string) => void;
  onDelete: (groupId: string) => void;
  onEdit: (group: Group) => void;
  onAcceptInvite: (groupId: string) => void;
  onDeclineInvite: (groupId: string) => void;
}

const THEMES = ['Trek', 'Van Life', 'Randonnée', 'Expédition', 'Tour du monde', 'Plage', 'Ski', 'Vélo', 'Moto', 'Autre'];
const THEME_EMOJI: Record<string, string> = {
  Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍',
  Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒',
};

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };
const sans = { fontFamily: 'Inter, -apple-system, "Helvetica Neue", Arial, sans-serif' };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace' };

const Ic = {
  search: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  plus: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  close: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>,
  check: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>,
  chev: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  user: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3 4-3s4 1 4 3" /></svg>,
  more: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>,
};

function dayLabel(iso?: string | null) {
  if (!iso) return 'Dates à définir';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Dates à définir';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function durationLabel(a?: string | null, b?: string | null) {
  if (!a || !b) return '';
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return '';
  const days = Math.round((db - da) / 86400000) + 1;
  return days > 0 ? `${days} jours` : '';
}

export default function MobileGroupesV2({
  user, myGroups, publicGroups, pendingInvites, loading, error,
  onRetry, onJoin, onLeave, onDelete, onEdit, onAcceptInvite, onDeclineInvite,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'mes' | 'invites' | 'decouvrir'>('mes');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState('Tous');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const activeGroups = myGroups.filter(g => !g.departure_date || new Date(g.departure_date) >= new Date(new Date().toDateString()));
  const prepCount = activeGroups.length;
  const companions = myGroups.reduce((acc, g) => acc + (g.member_count || 0), 0);

  const featured = myGroups[0] || null;
  const rest = myGroups.slice(1);

  const filteredPublic = publicGroups.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || (g.destination || '').toLowerCase().includes(search.toLowerCase());
    const matchTheme = theme === 'Tous' || g.theme === theme;
    return matchSearch && matchTheme;
  });

  const skeletons = [0, 1, 2];

  return (
    <div style={{ background: C.paper, minHeight: '100dvh' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#fff', borderBottom: `1px solid rgba(11,31,23,0.06)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.forest800, fontSize: 13, fontWeight: 600 }}>
          <svg viewBox="0 0 32 32" width="16" height="16" fill="none">
            <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="24" cy="9" r="1.6" fill="currentColor" />
          </svg>
          <span>Groupes</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setSearchOpen(o => !o)} aria-label="Rechercher" style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink700, background: 'transparent', cursor: 'pointer', border: 'none', opacity: searchOpen ? 0.4 : 1 }}>{Ic.search}</button>
          <button onClick={() => router.push('/nouveau-groupe')} aria-label="Nouveau groupe" style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.forest800, color: '#fff', boxShadow: '0 2px 6px rgba(11,31,23,0.14)', cursor: 'pointer', border: 'none' }}>{Ic.plus}</button>
        </div>
      </div>

      {/* ── SEARCH OVERLAY (filtre public / mes groupes) ── */}
      {searchOpen && (
        <div style={{ padding: '10px 18px 4px', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.stone, borderRadius: 999, border: `1px solid rgba(11,31,23,0.06)`, color: C.ink500 }}>
            {Ic.search}
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un groupe, un massif…"
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13, color: C.ink900, fontFamily: sans.fontFamily }}
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Effacer" style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(11,31,23,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink500, border: 'none', cursor: 'pointer' }}>{Ic.close}</button>
            )}
          </div>
        </div>
      )}

      {/* ── MASTHEAD ── */}
      <div style={{ padding: '18px 20px 14px', background: '#fff', borderBottom: `1px solid rgba(11,31,23,0.06)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: 'rgba(31,74,58,0.08)', color: C.forest800, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.sage500 }} />
          {myGroups.length} groupe{myGroups.length > 1 ? 's' : ''}{myGroups.length > 0 ? ` · ${prepCount} en préparation` : ''}
        </div>
        <h1 style={{ ...sans, fontSize: 31, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 0.98, margin: '0 0 8px', color: C.ink900 }}>
          {myGroups.length === 0 ? <>Le voyage se prépare<br /><em style={{ ...serif, fontStyle: 'italic', color: C.forest800, fontWeight: 400 }}>à plusieurs.</em></> : <>Vos voyages,<br /><em style={{ ...serif, fontStyle: 'italic', color: C.forest800, fontWeight: 400 }}>en préparation.</em></>}
        </h1>
        <p style={{ ...serif, fontSize: 15, lineHeight: 1.4, color: C.ink700, margin: 0 }}>
          {myGroups.length === 0
            ? 'Créez votre premier groupe pour rassembler vos compagnons, planifier les étapes, partager la logistique.'
            : 'Un groupe par traversée. On prépare à plusieurs, on part, puis tout atterrit dans le Carnet.'}
        </p>
      </div>

      {/* ── KPIs ── */}
      {myGroups.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '14px 20px 16px', background: '#fff', borderBottom: `1px solid rgba(11,31,23,0.06)` }}>
          {[
            { v: String(myGroups.length), l: 'Groupes' },
            { v: String(companions), l: 'Compagnons', em: 'pers.' },
            { v: String(prepCount), l: 'À préparer', em: 'actifs' },
          ].map((k, i) => (
            <div key={k.l} style={{ padding: '4px 10px', borderRight: i < 2 ? `1px solid rgba(11,31,23,0.08)` : 'none', textAlign: 'center' }}>
              <div style={{ ...sans, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, color: C.ink900 }}>
                {k.v}
                {k.em && <em style={{ ...serif, fontStyle: 'italic', color: C.forest800, fontWeight: 400, fontSize: 12, marginLeft: 2 }}>&nbsp;{k.em}</em>}
              </div>
              <div style={{ marginTop: 6, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.ink500 }}>{k.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── SEGMENTED TABS ── */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 20px 6px', position: 'sticky', top: 0, zIndex: 5, background: 'rgba(248,250,248,0.94)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {([
          { id: 'mes', l: 'Mes groupes', n: myGroups.length },
          { id: 'invites', l: 'Invitations', n: pendingInvites.length },
          { id: 'decouvrir', l: 'Découvrir', n: publicGroups.length },
        ] as { id: 'mes' | 'invites' | 'decouvrir'; l: string; n: number }[]).map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, height: 36, padding: '0 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: on ? '#fff' : C.ink700, background: on ? C.forest800 : '#fff', border: `1px solid ${on ? C.forest800 : 'rgba(11,31,23,0.06)'}`, boxShadow: '0 1px 3px rgba(11,31,23,0.05)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t.l}
              {t.n > 0 && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, background: on ? 'rgba(255,255,255,0.14)' : C.stone, color: on ? '#fff' : C.ink500 }}>{t.n}</span>}
            </button>
          );
        })}
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div style={{ padding: '12px 20px' }}>
          {skeletons.map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 14, background: '#fff', borderRadius: 18, border: `1px solid rgba(11,31,23,0.05)`, marginBottom: 10 }}>
              <div style={{ width: 68, height: 82, borderRadius: 12, background: 'linear-gradient(90deg,#F4F1EB 0%,#F5F3EE 40%,#F4F1EB 80%)', backgroundSize: '200px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 14, width: '70%', borderRadius: 4, background: 'linear-gradient(90deg,#F4F1EB 0%,#F5F3EE 40%,#F4F1EB 80%)', backgroundSize: '200px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                <div style={{ height: 12, width: '40%', borderRadius: 4, background: 'linear-gradient(90deg,#F4F1EB 0%,#F5F3EE 40%,#F4F1EB 80%)', backgroundSize: '200px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                <div style={{ flex: 1 }} />
                <div style={{ height: 12, width: '55%', borderRadius: 4, background: 'linear-gradient(90deg,#F4F1EB 0%,#F5F3EE 40%,#F4F1EB 80%)', backgroundSize: '200px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '60px 24px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, margin: '0 0 12px' }}>⚠️</p>
          <h3 style={{ ...sans, fontSize: 20, fontWeight: 500, color: C.ink900, margin: '0 0 8px' }}>Erreur de chargement</h3>
          <p style={{ ...serif, fontSize: 13, color: C.ink700, margin: '0 0 20px' }}>{error}</p>
          <button onClick={onRetry} style={{ background: C.forest800, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>Réessayer</button>
        </div>
      ) : tab === 'mes' ? (
        user && myGroups.length === 0 ? (
          <EmptyState onExplore={() => setTab('decouvrir')} onCreate={() => router.push('/nouveau-groupe')} />
        ) : !user ? (
          <div style={{ padding: '60px 24px 40px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>🗺️</p>
            <h3 style={{ ...sans, fontSize: 20, fontWeight: 500, color: C.ink900, margin: '0 0 8px' }}>Connectez-vous</h3>
            <p style={{ ...serif, fontSize: 13, color: C.ink700, margin: '0 0 20px' }}>Retrouvez vos groupes et vos compagnons.</p>
            <Link href="/connexion" style={{ background: C.forest800, color: '#fff', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Se connecter</Link>
          </div>
        ) : (
          <MainList
            featured={featured}
            rest={rest}
            pendingCount={pendingInvites.length}
            showDiscover={myGroups.length <= 1}
            onOpenGroup={(id: string) => router.push(`/groupes/${id}`)}
            menuFor={menuFor}
            setMenuFor={setMenuFor}
            onEdit={onEdit}
            onDelete={onDelete}
            onLeave={onLeave}
            onExplore={() => setTab('decouvrir')}
            goInsInvites={() => setTab('invites')}
            user={user}
          />
        )
      ) : tab === 'invites' ? (
        <InvitesList
          invites={pendingInvites}
          onAccept={onAcceptInvite}
          onDecline={onDeclineInvite}
          user={user}
          goDecouvrir={() => setTab('decouvrir')}
        />
      ) : (
        <DiscoverList
          groups={filteredPublic}
          total={publicGroups.length}
          search={search}
          setSearch={setSearch}
          theme={theme}
          setTheme={setTheme}
          myGroupIds={new Set(myGroups.map(g => g.id))}
          onJoin={onJoin}
          joining={null}
        />
      )}

      {/* Floating CTA (créer un groupe) */}
      {tab !== 'invites' && (
        <button onClick={() => router.push('/nouveau-groupe')} style={{ position: 'fixed', right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 66px)', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 15px 10px 12px', background: C.forest800, color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 500, boxShadow: '0 10px 24px rgba(11,31,23,0.28), 0 2px 4px rgba(11,31,23,0.14)', zIndex: 4, cursor: 'pointer', border: 'none' }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, background: 'rgba(255,255,255,0.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Ic.plus}</span>
          Créer un groupe
        </button>
      )}
    </div>
  );
}

/* ─── Main list (featured + cards) ───────────────────────────────────────── */
function MainList({ featured, rest, pendingCount, showDiscover, onOpenGroup, menuFor, setMenuFor, onEdit, onDelete, onLeave, onExplore, goInsInvites, user }: any) {
  return (
    <div style={{ padding: '8px 20px 120px' }}>
      {featured && (
        <Link href={`/groupes/${featured.id}`} style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: C.forest900, color: '#fff', margin: '8px 0 18px', minHeight: 260, boxShadow: '0 8px 24px rgba(11,31,23,0.08)' }}>
            {featured.cover_url ? (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${featured.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.55 }} />
            ) : null}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,31,23,0.2) 0%, rgba(11,31,23,0.9) 75%)' }} />
            <div style={{ position: 'relative', zIndex: 1, padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 260 }}>
              <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.sage300, boxShadow: '0 0 0 3px rgba(185,208,188,0.25)' }} />
                Cockpit actif · {featured.optimization_score || 0}%
              </div>
              <div style={{ marginTop: 'auto' }}>
                <h2 style={{ ...sans, fontSize: 26, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 6px', color: '#fff' }}>
                  {(featured.name || '').split(' ').slice(0, -1).join(' ')}{' '}
                  <em style={{ ...serif, fontStyle: 'italic', color: C.sage300, fontWeight: 400 }}>{(featured.name || '').split(' ').slice(-1).join(' ')}</em>
                </h2>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
                  {dayLabel(featured.departure_date)}{featured.return_date ? ` – ${dayLabel(featured.return_date)}` : ''}
                  {' · '}{featured.destination || 'Traversée'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', position: 'relative' }}>
                    <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, featured.optimization_score || 0)}%`, background: `linear-gradient(90deg, ${C.sage500}, ${C.sage300})`, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.sage300, fontWeight: 500, letterSpacing: '0.05em' }}>Préparation · {featured.optimization_score || 0}%</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Avatars count={(featured.member_count || 1)} size={22} border="#0B1F17" />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>{featured.member_count || 1} voyageurs</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px 6px 14px', background: '#fff', color: C.forest900, borderRadius: 999, fontSize: 11, fontWeight: 500 }}>Ouvrir{Ic.chev}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {pendingCount > 0 && (
        <button onClick={goInsInvites} style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8, margin: '4px 0 14px', padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
          <div style={{ color: C.forest800, display: 'inline-flex', fontSize: 12, fontWeight: 500 }}>{pendingCount} invitation{pendingCount > 1 ? 's' : ''} à traiter</div>
          <span style={{ color: C.ink300 }}>{Ic.chev}</span>
        </button>
      )}

      {rest.length > 0 && (
        <>
          <SectionHead title="Vos " em="autres groupes" n={`${rest.length} groupe${rest.length > 1 ? 's' : ''}`} />
          {rest.map((g: any) => (
            <GroupRow key={g.id} g={g} user={user} onOpen={() => onOpenGroup(g.id)} menuFor={menuFor} setMenuFor={setMenuFor} onEdit={() => onEdit(g)} onDelete={() => onDelete(g)} onLeave={() => onLeave(g)} />
          ))}
        </>
      )}

      {showDiscover && (
        <DiscoverBlock onExplore={onExplore} />
      )}
    </div>
  );
}

function SectionHead({ title, em, n }: { title: string; em: string; n: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 4px 12px' }}>
      <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.ink900 }}>
        {title}<em style={{ ...serif, fontStyle: 'italic', color: C.forest800, fontWeight: 400 }}>{em}</em>
      </div>
      <div style={{ fontSize: 11, color: C.ink500 }}>{n}</div>
    </div>
  );
}

function GroupRow({ g, user, onOpen, menuFor, setMenuFor, onEdit, onDelete, onLeave }: any) {
  const isOwner = user?.id === g.owner_id;
  const status = (() => {
    if (!g.departure_date) return { l: 'Brouillon', c: 'rgba(244,241,235,1)' };
    return { l: new Date(g.departure_date) >= new Date(new Date().toDateString()) ? 'Actif' : 'Terminé', c: 'rgba(31,74,58,0.08)' };
  })();

  return (
    <div onClick={onOpen} style={{ display: 'flex', gap: 12, padding: 14, background: '#fff', borderRadius: 18, border: `1px solid rgba(11,31,23,0.05)`, boxShadow: '0 1px 2px rgba(11,31,23,0.04)', marginBottom: 10, cursor: 'pointer', transition: 'transform .15s ease', position: 'relative' }}>
      <div style={{ width: 68, height: 82, borderRadius: 12, overflow: 'hidden', background: g.cover_url ? `url(${g.cover_url}) center/cover` : `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`, position: 'relative', flexShrink: 0 }}>
        {!g.cover_url && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{THEME_EMOJI[g.theme] || '🎒'}</div>}
        <div style={{ position: 'absolute', left: 6, bottom: 6, padding: '2px 6px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 6, fontSize: 9, fontWeight: 500, color: C.forest800, letterSpacing: '0.04em' }}>{g.destination ? g.destination.split(' ')[0] : 'Voyage'}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <h4 style={{ ...sans, fontSize: 15, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.15, margin: 0, color: C.ink900, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            <span>{g.name}</span>
          </h4>
          <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.6, background: status.c, color: status.l === 'Brouillon' ? C.ink500 : C.forest800 }}>{status.l}</span>
        </div>
        <div style={{ fontSize: 11, color: C.ink500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.3 }}>
          <span>{dayLabel(g.departure_date)}</span>{durationLabel(g.departure_date, g.return_date) &&<><span style={{ color: C.ink300 }}>·</span><span>{durationLabel(g.departure_date, g.return_date)}</span></>}
          {g.member_count ? <><span style={{ color: C.ink300 }}>·</span><span>{g.member_count} pers.</span></> : null}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(11,31,23,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatars count={Math.min((g.member_count || 1), 4)} size={18} border="#fff" />
            <span style={{ fontSize: 10, color: C.ink500, marginLeft: 6 }}>{g.member_count || 1}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {g.owner?.full_name ? (
              <span style={{ ...mono, fontSize: 9, color: C.ink500 }}>par {g.owner.full_name.split(' ')[0]}</span>
            ) : null}
            {isOwner && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === g.id ? null : g.id); }}
                aria-label="Options"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.ink500, display: 'flex', padding: 2 }}
              >
                {Ic.more}
              </button>
            )}
          </div>
          {menuFor === g.id && isOwner && (
            <div style={{ position: 'absolute', right: 12, top: 40, background: '#fff', border: '1px solid rgba(11,31,23,0.1)', borderRadius: 12, boxShadow: '0 8px 24px rgba(11,31,23,0.12)', zIndex: 10, minWidth: 130, overflow: 'hidden' }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); setMenuFor(null); onEdit(); }} style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 12, color: C.ink900, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>Modifier</button>
              {user?.id !== g.owner_id && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setMenuFor(null); onLeave(); }} style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 12, color: C.ink700, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>Quitter</button>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); setMenuFor(null); onDelete(); }} style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 12, color: '#B0413E', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>Supprimer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatars({ count, size, border }: { count: number; size: number; border: string }) {
  const arr = Array.from({ length: Math.min(count, 4) });
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {arr.map((_, i) => (
        <div key={i} style={{ width: size, height: size, borderRadius: 999, background: i === 0 ? 'linear-gradient(135deg,#1E4A3B,#12352A)' : 'linear-gradient(135deg,#A9C6B0,#6E9C7F)', border: `${Math.max(1, Math.round(size / 10))}px solid ${border}`, marginLeft: i === 0 ? 0 : -Math.round(size / 3.4), color: '#fff', fontSize: size * 0.42, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {i + 1}
        </div>
      ))}
    </div>
  );
}

interface DiscoverProps {
  groups: any[];
  total: number;
  search: string;
  setSearch: (s: string) => void;
  theme: string;
  setTheme: (t: string) => void;
  myGroupIds: Set<string>;
  onJoin: (id: string) => void;
  joining: string | null;
}
function DiscoverList({ groups, total, search, setSearch, theme, setTheme, myGroupIds, onJoin }: DiscoverProps) {
  return (
    <div style={{ padding: '8px 20px 120px' }}>
      {['Tous', ...THEMES].map(t => (
        <button key={t} onClick={() => setTheme(t)} style={{ margin: '0 6px 6px 0', padding: '0 12px', height: 28, borderRadius: 999, border: `1px solid ${theme === t ? 'rgba(31,74,58,0.3)' : 'rgba(11,31,23,0.1)'}`, fontSize: 11, fontWeight: 500, color: theme === t ? C.forest800 : C.ink700, background: theme === t ? 'rgba(31,74,58,0.06)' : '#fff', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          {t !== 'Tous' ? `${THEME_EMOJI[t]} ` : ''}{t}
        </button>
      ))}
      <div style={{ margin: '12px 0 4px' }}>
        <SectionHead title="Groupes " em="publics" n={`${groups.length} sur ${total}`} />
      </div>
      {search && !groups.length ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: C.ink500 }}>
          <p style={{ fontSize: 26, margin: '0 0 8px' }}>🔍</p>
          <p style={{ ...serif, fontSize: 13, fontStyle: 'italic' }}>Aucun groupe ne correspond à « {search} »</p>
          <button onClick={() => setSearch('')} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'transparent', color: C.forest800, fontSize: 12, fontWeight: 500, boxShadow: 'inset 0 0 0 1px rgba(31,74,58,0.2)', cursor: 'pointer', border: 'none' }}>{Ic.plus} Créer « {search} »</button>
        </div>
      ) : groups.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: C.ink500 }}>
          <p style={{ fontSize: 26, margin: '0 0 8px' }}>✨</p>
          <p style={{ ...serif, fontSize: 13 }}>Aucun groupe public dans cette catégorie.</p>
        </div>
      ) : (
        groups.map(g => {
          const joined = myGroupIds.has(g.id);
          return (
            <div key={g.id} style={{ display: 'flex', gap: 12, padding: 14, background: '#fff', borderRadius: 18, border: `1px solid rgba(11,31,23,0.05)`, boxShadow: '0 1px 2px rgba(11,31,23,0.04)', marginBottom: 10 }}>
              <div style={{ width: 68, height: 82, borderRadius: 12, overflow: 'hidden', background: `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{THEME_EMOJI[g.theme] || '🎒'}</div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ ...sans, fontSize: 15, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.15, margin: 0, color: C.ink900 }}>{g.name}</h4>
                <div style={{ fontSize: 11, color: C.ink500, margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>{g.destination}{g.member_count ? <><span style={{ color: C.ink300 }}>·</span><span>{g.member_count} pers.</span></> : null}</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                  {joined ? (
                    <Link href={`/groupes/${g.id}`} style={{ flex: 1, textAlign: 'center' as const, padding: '8px 10px', background: C.stone, color: C.ink900, borderRadius: 999, fontSize: 11, fontWeight: 500, textDecoration: 'none' }}>Déjà membre — Ouvrir</Link>
                  ) : (
                    <button type="button" onClick={() => onJoin(g.id)} style={{ flex: 1, padding: '8px 10px', background: C.forest800, color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: 'none' }}>Rejoindre</button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function DiscoverBlock({ onExplore }: { onExplore: () => void }) {
  return (
    <div style={{ margin: '24px 0 12px', padding: '22px 18px', borderRadius: 20, background: C.stone, border: '1px dashed rgba(11,31,23,0.12)', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.forest800, marginBottom: 10, boxShadow: '0 1px 3px rgba(11,31,23,0.05)' }}>{Ic.user}</div>
      <h5 style={{ ...sans, fontSize: 16, fontWeight: 500, letterSpacing: '-0.015em', margin: '0 0 6px', color: C.ink900 }}>Envie de partir avec <em style={{ ...serif, fontStyle: 'italic', color: C.forest800, fontWeight: 400 }}>quelqu'un</em> ?</h5>
      <p style={{ ...serif, fontSize: 13, lineHeight: 1.4, color: C.ink700, margin: '0 0 14px' }}>Rejoignez un groupe existant depuis un club, ou lancez le vôtre en trois minutes.</p>
      <button onClick={onExplore} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.forest800, color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none' }}>Découvrir des groupes{Ic.chev}</button>
    </div>
  );
}

function EmptyState({ onExplore, onCreate }: { onExplore: () => void; onCreate: () => void }) {
  return (
    <div style={{ padding: '8px 20px 120px' }}>
      <div style={{ padding: '40px 8px 20px', textAlign: 'center' }}>
        <div style={{ width: 88, height: 88, borderRadius: 24, background: C.stone, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.forest800, marginBottom: 20, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -6, borderRadius: 28, border: '1px dashed rgba(31,74,58,0.15)' }} />
          {Ic.user}
        </div>
        <h3 style={{ ...sans, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 10px', color: C.ink900 }}>Rien à préparer <em style={{ ...serif, fontStyle: 'italic', color: C.forest800, fontWeight: 400 }}>pour l'instant.</em></h3>
        <p style={{ ...serif, fontSize: 14, lineHeight: 1.45, color: C.ink700, margin: '0 auto 20px', maxWidth: 280 }}>Créez un groupe autour d'une traversée, invitez vos compagnons, et le carnet se composera tout seul au retour.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <button onClick={onCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.forest800, color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>{Ic.plus} Créer mon premier groupe</button>
          <button onClick={onExplore} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', color: C.forest800, fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>Ou découvrir des groupes{Ic.chev}</button>
        </div>
      </div>
      <div style={{ padding: '16px 8px' }}>
        <SectionHead title="Comment " em="ça marche" n="" />
        <HowSteps />
      </div>
    </div>
  );
}

function HowSteps() {
  const steps = [
    { n: '1', t: 'Créer un groupe', d: "Un nom, une date, un massif. Le reste peut attendre.", dark: false },
    { n: '2', t: 'Inviter vos compagnons', d: 'Par lien, email, ou depuis un club. Chacun rejoint avec un rôle.', dark: false },
    { n: '3', t: 'Préparer ensemble', d: 'Étapes, hébergements, matériel, dépenses — tout au même endroit.', dark: false },
    { n: '4', t: 'Au retour, tout devient carnet', d: 'Photos, étapes, dépenses — le carnet se compose seul.', dark: true },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map(s => (
        <div key={s.n} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 16, background: s.dark ? C.forest800 : '#fff', color: s.dark ? '#fff' : C.ink900, border: s.dark ? 'none' : `1px solid rgba(11,31,23,0.05)`, alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: s.dark ? 'rgba(255,255,255,0.14)' : C.stone, color: s.dark ? C.sage300 : C.forest800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...serif, fontStyle: 'italic', fontSize: 14, flexShrink: 0 }}>{s.n}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: s.dark ? '#fff' : C.ink900, marginBottom: 2 }}>{s.t}</div>
            <div style={{ fontSize: 12, color: s.dark ? 'rgba(255,255,255,0.7)' : C.ink500, lineHeight: 1.4 }}>{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvitesList({ invites, onAccept, onDecline, user, goDecouvrir }: any) {
  if (!user) {
    return (
      <div style={{ padding: '60px 24px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 40, margin: '0 0 12px' }}>🗺️</p>
        <h3 style={{ ...sans, fontSize: 20, fontWeight: 500, color: C.ink900, margin: '0 0 8px' }}>Connectez-vous</h3>
        <p style={{ ...serif, fontSize: 13, color: C.ink700, margin: '0 0 20px' }}>Pour voir vos invitations.</p>
        <Link href="/connexion" style={{ background: C.forest800, color: '#fff', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Se connecter</Link>
      </div>
    );
  }
  if (invites.length === 0) {
    return (
      <div style={{ padding: '48px 24px 120px', textAlign: 'center' }}>
        <p style={{ fontSize: 34, margin: '0 0 12px' }}>📬</p>
        <h3 style={{ ...sans, fontSize: 20, fontWeight: 500, color: C.ink900, margin: '0 0 8px' }}>Aucune invitation</h3>
        <p style={{ ...serif, fontSize: 13, color: C.ink700, margin: '0 auto 20px', maxWidth: 260 }}>Quand quelqu'un vous invitera à rejoindre un groupe, vous le verrez ici.</p>
        <button onClick={goDecouvrir} style={{ background: C.forest800, color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none' }}>Découvrir des groupes</button>
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 20px 120px' }}>
      {invites.map((inv: any) => (
        <div key={inv.id} style={{ margin: '12px 0 4px', padding: 14, borderRadius: 18, background: `linear-gradient(135deg, ${C.forest700} 0%, #142F24 100%)`, color: '#fff', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(185,208,188,0.14)', filter: 'blur(20px)' }} />
          <div style={{ width: 40, height: 40, borderRadius: 999, background: `linear-gradient(135deg, ${C.sage500}, ${C.forest700})`, border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.forest900, fontWeight: 600 }}>{inv.name?.charAt(0) || '?'}</div>
          <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.sage300, marginBottom: 3 }}>Invitation</div>
            <div style={{ fontSize: 13, lineHeight: 1.35, color: '#fff' }}>
              Rejoindre <strong style={{ fontWeight: 500 }}>{inv.name}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, zIndex: 1, flexShrink: 0 }}>
            <button type="button" onClick={() => onDecline(inv.group_id)} aria-label="Refuser" style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Ic.close}</button>
            <button type="button" onClick={() => onAccept(inv.group_id)} aria-label="Accepter" style={{ width: 32, height: 32, borderRadius: 999, background: C.sage500, border: 'none', cursor: 'pointer', color: C.forest900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Ic.check}</button>
          </div>
        </div>
      ))}
    </div>
  );
}