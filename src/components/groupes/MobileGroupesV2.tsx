'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
    <div className="bg-stone-50 min-h-screen text-[#17402C]">
      {/* ── HEADER ── */}
      <div className="flex justify-between items-center px-4 py-3 bg-white/80 backdrop-blur-md border-b border-[#17402C]/10">
        <div className="inline-flex items-center gap-2 text-[#17402C] text-xs font-bold">
          <svg viewBox="0 0 32 32" width="16" height="16" fill="none">
            <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="24" cy="9" r="1.6" fill="currentColor" />
          </svg>
          <span>Groupes</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSearchOpen(o => !o)} aria-label="Rechercher" className="glass-capsule-btn p-2">
            <span className="relative z-10">{Ic.search}</span>
          </button>
          <button onClick={() => router.push('/nouveau-groupe')} aria-label="Nouveau groupe" className="glass-capsule-btn primary p-2">
            <span className="relative z-10">{Ic.plus}</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH OVERLAY ── */}
      {searchOpen && (
        <div className="p-3 bg-white border-b border-[#17402C]/10">
          <div className="flex items-center gap-2 relative">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un groupe, un massif…"
              className="glass-input w-full text-xs"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Effacer" className="absolute right-3 text-xs text-[#5C6B5E]">
                {Ic.close}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MASTHEAD ── */}
      <div className="p-5 glass rounded-b-2xl mb-4">
        <div className="glass-pill mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {myGroups.length} groupe{myGroups.length > 1 ? 's' : ''}{myGroups.length > 0 ? ` · ${prepCount} en préparation` : ''}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-tight mb-2 text-[#17402C]">
          {myGroups.length === 0 ? <>Le voyage se prépare<br /><em className="font-serif italic text-[#5C6B5E] font-normal">à plusieurs.</em></> : <>Vos voyages,<br /><em className="font-serif italic text-[#5C6B5E] font-normal">en préparation.</em></>}
        </h1>
        <p className="text-xs text-[#5C6B5E] leading-relaxed">
          {myGroups.length === 0
            ? 'Créez votre premier groupe pour rassembler vos compagnons, planifier les étapes, partager la logistique.'
            : 'Un groupe par traversée. On prépare à plusieurs, on part, puis tout atterrit dans le Carnet.'}
        </p>
      </div>

      {/* ── KPIs ── */}
      {myGroups.length > 0 && (
        <div className="grid grid-cols-3 gap-2 px-4 mb-4">
          {[
            { v: String(myGroups.length), l: 'Groupes' },
            { v: String(companions), l: 'Compagnons', em: 'pers.' },
            { v: String(prepCount), l: 'À préparer', em: 'actifs' },
          ].map((k) => (
            <div key={k.l} className="glass-sub-card p-3 rounded-xl text-center">
              <div className="font-display text-lg font-bold text-[#17402C]">
                {k.v}
                {k.em && <em className="font-serif italic font-normal text-xs text-[#5C6B5E] ml-1">{k.em}</em>}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#5C6B5E] mt-1 font-bold">{k.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── SEGMENTED TABS ── */}
      <div className="px-4 sticky top-0 z-10 mb-4">
        <div className="glass-capsule-bar w-full">
          {([
            { id: 'mes', l: 'Mes groupes', n: myGroups.length },
            { id: 'invites', l: 'Invitations', n: pendingInvites.length },
            { id: 'decouvrir', l: 'Découvrir', n: publicGroups.length },
          ] as { id: 'mes' | 'invites' | 'decouvrir'; l: string; n: number }[]).map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`glass-capsule-segment flex-1 ${on ? 'active' : ''}`}>
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="relative z-10">{t.l}</span>
                  {t.n > 0 && <span className="glass-pill text-[9px] relative z-10">{t.n}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="p-4 space-y-3">
          {skeletons.map(i => (
            <div key={i} className="glass p-4 rounded-2xl animate-pulse h-28" />
          ))}
        </div>
      ) : error ? (
        <div className="glass p-8 m-4 text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <h3 className="font-display font-bold text-lg text-[#17402C] mb-1">Erreur de chargement</h3>
          <p className="text-xs text-[#5C6B5E] mb-4">{error}</p>
          <button onClick={onRetry} className="glass-capsule-btn primary py-2 px-4 text-xs font-bold">
            <span className="relative z-10">Réessayer</span>
          </button>
        </div>
      ) : tab === 'mes' ? (
        user && myGroups.length === 0 ? (
          <EmptyState onExplore={() => setTab('decouvrir')} onCreate={() => router.push('/nouveau-groupe')} />
        ) : !user ? (
          <div className="glass p-8 m-4 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <h3 className="font-display font-bold text-lg text-[#17402C] mb-1">Connectez-vous</h3>
            <p className="text-xs text-[#5C6B5E] mb-4">Retrouvez vos groupes et vos compagnons.</p>
            <Link href="/connexion" className="glass-capsule-btn primary py-2.5 px-6 text-xs font-bold inline-flex">
              <span className="relative z-10">Se connecter</span>
            </Link>
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

      {/* Floating CTA */}
      {tab !== 'invites' && (
        <button onClick={() => router.push('/nouveau-groupe')} className="fixed right-4 bottom-20 glass-capsule-btn primary py-3 px-5 text-xs font-bold z-40">
          <span className="relative z-10 flex items-center gap-1.5">
            {Ic.plus} Créer un groupe
          </span>
        </button>
      )}
    </div>
  );
}

function MainList({ featured, rest, pendingCount, showDiscover, onOpenGroup, menuFor, setMenuFor, onEdit, onDelete, onLeave, onExplore, goInsInvites, user }: any) {
  return (
    <div className="px-4 pb-28 space-y-4">
      {featured && (
        <Link href={`/groupes/${featured.id}`} className="block">
          <div className="glass p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-[#17402C]/90 to-[#17402C]/70 text-white min-h-[220px] flex flex-col justify-between">
            <div className="glass-pill text-white border-white/20 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Cockpit actif · {featured.optimization_score || 0}%
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-white mb-1 leading-tight">
                {featured.name}
              </h2>
              <p className="text-xs text-white/80 font-mono mb-3">
                {dayLabel(featured.departure_date)}{featured.return_date ? ` – ${dayLabel(featured.return_date)}` : ''} · {featured.destination || 'Traversée'}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-white/20">
                <span className="text-xs text-white/80 font-mono">{featured.member_count || 1} voyageurs</span>
                <span className="glass-capsule-btn primary text-xs font-bold py-1.5 px-3">
                  <span className="relative z-10">Ouvrir →</span>
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {pendingCount > 0 && (
        <button onClick={goInsInvites} className="w-full glass-sub-card p-3 rounded-xl flex items-center justify-between text-xs font-semibold text-[#17402C]">
          <span>{pendingCount} invitation{pendingCount > 1 ? 's' : ''} à traiter</span>
          <span>{Ic.chev}</span>
        </button>
      )}

      {rest.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-sm text-[#17402C] mb-3">Vos autres groupes</h3>
          <div className="space-y-3">
            {rest.map((g: any) => (
              <GroupRow key={g.id} g={g} user={user} onOpen={() => onOpenGroup(g.id)} menuFor={menuFor} setMenuFor={setMenuFor} onEdit={() => onEdit(g)} onDelete={() => onDelete(g)} onLeave={() => onLeave(g)} />
            ))}
          </div>
        </div>
      )}

      {showDiscover && (
        <DiscoverBlock onExplore={onExplore} />
      )}
    </div>
  );
}

function GroupRow({ g, user, onOpen, menuFor, setMenuFor, onEdit, onDelete, onLeave }: any) {
  const isOwner = user?.id === g.owner_id;

  return (
    <div onClick={onOpen} className="glass-sub-card p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full glass-sub-card flex items-center justify-center text-xl shrink-0">
          {THEME_EMOJI[g.theme] || '🎒'}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-xs text-[#17402C] truncate">{g.name}</h4>
          <p className="text-[10px] text-[#5C6B5E] font-mono mt-0.5">{g.destination || 'Voyage'} · {g.member_count || 1} pers.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="glass-capsule-btn py-1 px-3 text-xs font-bold">
          <span className="relative z-10">Ouvrir</span>
        </span>
      </div>
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
    <div className="px-4 pb-28 space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {['Tous', ...THEMES].map(t => (
          <button key={t} onClick={() => setTheme(t)} className={`glass-pill cursor-pointer whitespace-nowrap ${theme === t ? 'bg-[#17402C] text-white' : ''}`}>
            {t !== 'Tous' ? `${THEME_EMOJI[t]} ` : ''}{t}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="glass p-8 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="font-bold text-xs text-[#17402C]">Aucun groupe disponible</p>
        </div>
      ) : (
        groups.map(g => {
          const joined = myGroupIds.has(g.id);
          return (
            <div key={g.id} className="glass-sub-card p-3.5 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full glass-sub-card flex items-center justify-center text-xl shrink-0">
                  {THEME_EMOJI[g.theme] || '🎒'}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-[#17402C] truncate">{g.name}</h4>
                  <p className="text-[10px] text-[#5C6B5E] font-mono mt-0.5">{g.destination} · {g.member_count || 1} pers.</p>
                </div>
              </div>
              <div>
                {joined ? (
                  <Link href={`/groupes/${g.id}`} className="glass-capsule-btn py-1.5 px-3 text-xs font-bold">
                    <span className="relative z-10">Déjà membre</span>
                  </Link>
                ) : (
                  <button onClick={() => onJoin(g.id)} className="glass-capsule-btn primary py-1.5 px-3 text-xs font-bold">
                    <span className="relative z-10">Rejoindre</span>
                  </button>
                )}
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
    <div className="glass p-5 rounded-2xl text-center space-y-3">
      <h5 className="font-display font-bold text-base text-[#17402C]">Envie de partir avec quelqu'un ?</h5>
      <p className="text-xs text-[#5C6B5E] leading-relaxed">Rejoignez un groupe existant ou lancez le vôtre en trois minutes.</p>
      <button onClick={onExplore} className="glass-capsule-btn primary py-2 px-4 text-xs font-bold">
        <span className="relative z-10">Découvrir des groupes →</span>
      </button>
    </div>
  );
}

function EmptyState({ onExplore, onCreate }: { onExplore: () => void; onCreate: () => void }) {
  return (
    <div className="px-4 pb-28">
      <div className="glass p-8 text-center space-y-4 rounded-2xl">
        <span className="text-4xl block">🗺️</span>
        <h3 className="font-display font-bold text-xl text-[#17402C]">Rien à préparer pour l'instant.</h3>
        <p className="text-xs text-[#5C6B5E] max-w-xs mx-auto leading-relaxed">Créez un groupe autour d'une traversée, invitez vos compagnons, et le carnet se composera tout seul au retour.</p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={onCreate} className="glass-capsule-btn primary py-2.5 px-6 text-xs font-bold">
            <span className="relative z-10">+ Créer mon premier groupe</span>
          </button>
          <button onClick={onExplore} className="glass-capsule-btn py-2 px-4 text-xs font-semibold">
            <span className="relative z-10">Découvrir des groupes →</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InvitesList({ invites, onAccept, onDecline, user, goDecouvrir }: any) {
  if (!user) {
    return (
      <div className="glass p-8 m-4 text-center">
        <p className="text-4xl mb-3">🗺️</p>
        <h3 className="font-display font-bold text-lg text-[#17402C] mb-1">Connectez-vous</h3>
        <p className="text-xs text-[#5C6B5E] mb-4">Pour voir vos invitations.</p>
        <Link href="/connexion" className="glass-capsule-btn primary py-2.5 px-6 text-xs font-bold inline-flex">
          <span className="relative z-10">Se connecter</span>
        </Link>
      </div>
    );
  }
  if (invites.length === 0) {
    return (
      <div className="glass p-8 m-4 text-center space-y-3">
        <p className="text-4xl">📬</p>
        <h3 className="font-display font-bold text-lg text-[#17402C]">Aucune invitation</h3>
        <p className="text-xs text-[#5C6B5E] max-w-xs mx-auto">Quand quelqu'un vous invitera à rejoindre un groupe, vous le verrez ici.</p>
        <button onClick={goDecouvrir} className="glass-capsule-btn primary py-2 px-4 text-xs font-bold">
          <span className="relative z-10">Découvrir des groupes</span>
        </button>
      </div>
    );
  }
  return (
    <div className="px-4 pb-28 space-y-3">
      {invites.map((inv: any) => (
        <div key={inv.id} className="glass p-4 rounded-2xl flex items-center justify-between gap-3">
          <div>
            <span className="glass-pill text-[9px]">Invitation</span>
            <p className="text-xs font-bold text-[#17402C] mt-1">Rejoindre {inv.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onDecline(inv.group_id)} className="glass-capsule-btn py-1.5 px-3 text-xs font-semibold text-red-600">
              <span className="relative z-10">Refuser</span>
            </button>
            <button onClick={() => onAccept(inv.group_id)} className="glass-capsule-btn primary py-1.5 px-3 text-xs font-bold">
              <span className="relative z-10">Accepter</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
