'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

/* ─── Design tokens (refonte mobile /compte) ─────────────────────────────── */
const C = {
  paper: '#F5F3EE',
  stone: '#F4F1EB',
  ink900: '#17211D',
  ink700: '#3A463F',
  ink500: '#6B7671',
  ink300: '#B9C0BB',
  forest900: '#0B1F17',
  forest800: '#17402C',
  sage100: '#E1EBDD',
  sage300: '#A9C6B0',
  warm500: '#C9924A',
};

type ContentKind = 'carnet' | 'groupe' | 'club';
interface ContentItem {
  kind: ContentKind;
  id: string;
  slug?: string;
  title: string;
  sub: string;
  cover?: string | null;
  likes: number;
  meta: string;
  createdAt: string;
}

type Tab = 'tout' | 'carnets' | 'voyages' | 'groupes' | 'clubs';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export default function MobileCompteV2() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tout');
  const [menuOpen, setMenuOpen] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [highlights, setHighlights] = useState<{ id: string; label: string; cover?: string | null }[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const supabase = createClient();

    (async () => {
      try {
        const profileRes = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
        setProfile(profileRes.data);

        const [followersRes, followingRes] = await Promise.all([
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);
        setFollowers(followersRes.count ?? 0);
        setFollowing(followingRes.count ?? 0);

        // Carnets : les miens + les publics (RLS respectée côté Supabase)
        const carnetsRes = await supabase
          .from('carnets')
          .select('id,title,destination,cover_image,likes_count,visibility,author_id,created_at')
          .or(`author_id.eq.${user.id},visibility.eq.public`)
          .order('created_at', { ascending: false })
          .limit(40);

        // Voyages : groupes dont je suis membre
        const membersRes = await supabase.from('group_members').select('group_id, status').eq('user_id', user.id);
        const groupIds = (membersRes.data || []).filter((m: any) => m.status === 'active' || m.status === 'pending').map((m: any) => m.group_id);
        let groups: any[] = [];
        if (groupIds.length) {
          const gRes = await supabase.from('travel_groups').select('id,name,destination,cover_url,created_at').in('id', groupIds).order('created_at', { ascending: false });
          groups = gRes.data || [];
        }

        // Clubs : uniquement ceux dont je suis membre actif
        const clubMembers = await supabase.from('club_members').select('club_id').eq('user_id', user.id).eq('status', 'active');
        const clubIds = (clubMembers.data || []).map((c: any) => c.club_id);
        let clubs: any[] = [];
        if (clubIds.length) {
          const cRes = await supabase.from('clubs').select('id,slug,name,emoji,members_count,cover_image,created_at').in('id', clubIds);
          clubs = cRes.data || [];
        }

        const items: ContentItem[] = [];
        (carnetsRes.data || []).forEach((c: any) => {
          if (c.visibility === 'private') return;
          items.push({
            kind: 'carnet', id: c.id, title: c.title, sub: c.destination || '', cover: c.cover_image,
            likes: c.likes_count || 0, meta: 'Carnet d\'expédition', createdAt: c.created_at || '',
          });
        });
        groups.forEach((g) => {
          items.push({
            kind: 'groupe', id: g.id, title: g.name, sub: g.destination || '', cover: g.cover_url || null,
            likes: 0, meta: 'Voyage de groupe', createdAt: g.created_at || '',
          });
        });
        clubs.forEach((cl) => {
          items.push({
            kind: 'club', id: cl.id, slug: cl.slug, title: cl.name, sub: `${cl.emoji || '◈'} ${cl.members_count || 0} membres`, cover: cl.cover_image || null,
            likes: cl.members_count || 0, meta: 'Club', createdAt: cl.created_at || '',
          });
        });
        items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setContent(items);

        setHighlights(groups.slice(0, 5).map((g) => ({ id: g.id, label: (g.name || 'Voyage').split(' ')[0], cover: g.cover_url || null })));
        setError(null);
      } catch (err) {
        console.error('MobileCompteV2 load error:', err);
        setError('Impossible de charger votre compte.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (tab === 'tout') return content;
    return content.filter(c =>
      tab === 'carnets' ? c.kind === 'carnet'
      : tab === 'voyages' ? c.kind === 'groupe'
      : tab === 'groupes' ? c.kind === 'groupe'
      : c.kind === 'club'
    );
  }, [content, tab]);

  if (!user) {
    return (
      <div style={{ minHeight: '100dvh', background: C.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 42, marginBottom: 12 }}>🗺️</p>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.ink900, margin: '0 0 8px' }}>Connectez-vous</h2>
        <p style={{ fontSize: 13, color: C.ink500, marginBottom: 20 }}>Pour retrouver vos voyages, carnets et clubs.</p>
        <Link href="/connexion?mode=connexion" style={{ background: C.forest800, color: '#fff', padding: '12px 28px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Se connecter</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: C.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${C.sage100}`, borderTopColor: C.forest800, animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.ink500, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Chargement…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: C.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.ink900, margin: '0 0 8px' }}>Erreur de chargement</h2>
        <p style={{ fontSize: 13, color: C.ink500, marginBottom: 20 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ background: C.forest800, color: '#fff', padding: '12px 28px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none' }}>Réessayer</button>
      </div>
    );
  }

  const fullName = profile?.full_name || (user?.user_metadata?.full_name as string) || '';
  const firstName = (fullName.split(' ')[0] || 'Voyageur');
  const handleName = (profile?.full_name || user?.email || 'voyageur').toLowerCase().split(/[@\s]/)[0].replace(/[^a-z0-9]/g, '') || 'voyageur';
  const handle = `@${handleName}`;
  const bio = profile?.bio || '';
  const location = profile?.location || '';
  const level = profile?.level ?? 1;
  const avatar = profile?.avatar_url || (user?.user_metadata?.avatar_url as string) || '';

  const travelCount = content.filter(c => c.kind === 'groupe').length;
  const stats = [
    { n: travelCount, l: 'Voyages' },
    { n: formatCount(followers), l: 'Abonnés' },
    { n: formatCount(following), l: 'Suivis' },
  ];

  const shareProfile = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/profil/${user.id}` : '';
    if (navigator.share) { navigator.share({ title: 'Mon profil voyageur', url }).catch(() => {}); return; }
    if (navigator.clipboard) { navigator.clipboard.writeText(url).catch(() => {}); }
  };

  return (
    <div style={{ background: C.paper, minHeight: '100dvh' }}>
      {/* Nav compacte : handle + cloche (notifications) + menu (secondaire) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px' }}>
        <button onClick={() => setMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif', fontSize: 17, fontWeight: 600, color: C.ink900, background: 'transparent', border: 'none', cursor: 'pointer' }}>
          {handleName}
          <span style={{ color: C.ink500, display: 'flex' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg></span>
        </button>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" style={{ width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink900, background: 'transparent', cursor: 'pointer', border: 'none' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>
        </button>
      </div>

      {/* Identité */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '4px 20px 16px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 82, height: 82, borderRadius: '50%', overflow: 'hidden', background: C.stone, border: `2px solid ${C.sage300}`, boxShadow: '0 2px 8px rgba(11,31,23,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatar ? (
              <div style={{ width: '100%', height: '100%', backgroundImage: `url(${avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ) : (
              <span style={{ fontSize: 26, fontWeight: 600, color: C.forest800 }}>{firstName.charAt(0)}</span>
            )}
          </div>
          <button onClick={() => router.push('/compte/modifier')} aria-label="Modifier la photo" style={{ position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: '50%', background: C.forest800, color: '#fff', border: `2px solid ${C.paper}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, paddingTop: 10 }}>
          {stats.map(s => (
            <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink900, lineHeight: 1 }}>{s.n}</span>
              <span style={{ fontSize: 11, color: C.ink500, marginTop: 4 }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: C.ink900, margin: 0 }}>{fullName || 'Voyageur'}</p>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={C.forest800}><path d="M12 1l2.4 2.2 3.2-.4.8 3.2 3 1.4-1.2 3 1.2 3-3 1.4-.8 3.2-3.2-.4L12 20l-2.4-1.4-3.2.4-.8-3.2-3-1.4 1.2-3-1.2-3 3-1.4.8-3.2 3.2.4L12 1zm-1.2 12.6l6-6-1.4-1.4-4.6 4.6-2-2-1.4 1.4 3.4 3.4z" /></svg>
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: C.ink500, margin: '2px 0 8px' }}>
          {handle} · Niv. {String(level).padStart(2, '0')}
        </div>
        {bio && <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15, lineHeight: 1.45, color: C.ink900, margin: '0 0 8px' }}>{bio}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.ink500, flexWrap: 'wrap' }}>
          {location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
              {location}
            </span>
          )}
          <Link href={`/profil/${user.id}`} style={{ color: C.forest800, fontWeight: 500, textDecoration: 'none' }}>Voir ma page publique</Link>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 20px' }}>
        <button onClick={() => router.push('/compte/modifier')} style={{ flex: 1, height: 38, borderRadius: 999, background: C.forest800, color: '#fff', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', border: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" /></svg>
          Modifier le profil
        </button>
        <button onClick={shareProfile} style={{ flex: 1, height: 38, borderRadius: 999, background: C.stone, color: C.ink900, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', border: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
          Partager
        </button>
      </div>

      {/* Highlights (voyages) */}
      <div style={{ display: 'flex', gap: 16, padding: '0 20px 20px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {highlights.map(h => (
          <Link key={h.id} href={`/groupes/${h.id}`} style={{ flexShrink: 0, width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: h.cover ? `url(${h.cover}) center/cover` : `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, border: `1.5px solid ${C.sage300}` }}>{h.cover ? null : '🏔️'}</div>
            <span style={{ fontSize: 11, color: C.ink700, maxWidth: 64, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.label}</span>
          </Link>
        ))}
        <Link href="/nouveau-groupe" style={{ flexShrink: 0, width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.stone, border: `1.5px dashed ${C.ink300}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink500 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </div>
          <span style={{ fontSize: 11, color: C.ink700 }}>Nouveau</span>
        </Link>
      </div>

      {/* Onglets de filtre */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', borderTop: '1px solid rgba(11,31,23,0.06)', borderBottom: '1px solid rgba(11,31,23,0.06)', position: 'sticky', top: 0, background: 'rgba(250,247,241,0.86)', backdropFilter: 'blur(20px) saturate(1.2)', WebkitBackdropFilter: 'blur(20px) saturate(1.2)', zIndex: 5 }}>
        {([
          { id: 'tout', l: 'Tout' },
          { id: 'carnets', l: 'Carnets' },
          { id: 'voyages', l: 'Voyages' },
          { id: 'groupes', l: 'Groupes' },
          { id: 'clubs', l: 'Clubs' },
        ] as { id: Tab; l: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '13px 4px', fontSize: 13, fontWeight: 500, color: tab === t.id ? C.ink900 : C.ink500, textAlign: 'center', background: 'transparent', cursor: 'pointer', border: 'none', position: 'relative', whiteSpace: 'nowrap' }}>
            {t.l}
            {tab === t.id && <span style={{ position: 'absolute', bottom: -1, left: '22%', right: '22%', height: 1.5, background: C.forest800, borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {/* Grille unifiée */}
      {filtered.length === 0 ? (
        <div style={{ padding: '56px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 36, margin: '0 0 12px' }}>{tab === 'tout' ? '🎒' : '✨'}</p>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: C.ink900, margin: '0 0 6px' }}>
            {tab === 'tout' ? 'Encore vide' : `Aucun ${tab === 'carnets' ? 'carnet' : tab === 'voyages' || tab === 'groupes' ? 'voyage' : 'club'}`}
          </p>
          <p style={{ fontSize: 13, color: C.ink500, margin: 0 }}>Vos contenus apparaîtront ici dès publication ou adhésion.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 2 }}>
          {filtered.map(c => (
            <Link
              key={`${c.kind}-${c.id}`}
              href={c.kind === 'carnet' ? `/carnets/${c.id}` : c.kind === 'groupe' ? `/groupes/${c.id}` : `/clubs/${c.slug || c.id}`}
              style={{ position: 'relative', aspectRatio: '1 / 1', background: c.cover ? `url(${c.cover}) center/cover` : `linear-gradient(135deg, ${C.forest800}, ${C.forest900})`, backgroundColor: C.stone, overflow: 'hidden', display: 'block', textDecoration: 'none', borderRadius: 12 }}
            >
              {!c.cover && (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>
                  {c.kind === 'club' ? '◈' : c.kind === 'groupe' ? '🏔️' : '📖'}
                </span>
              )}
              <span style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 6, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                {c.kind === 'carnet' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 15l4-4 4 4 3-3 5 5" /></svg>
                ) : c.kind === 'groupe' ? '⛺' : '◈'}
              </span>
              {c.likes > 0 && (
                <span style={{ position: 'absolute', bottom: 6, left: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11h-2z" /></svg>
                  {formatCount(c.likes)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink500 }}>
        — fin · {content.length} contenu{content.length !== 1 ? 's' : ''}
      </div>

      {/* Menu secondaire (fonctionnalités avancées) */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
          <button onClick={() => setMenuOpen(false)} aria-label="Fermer" style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,23,0.35)', border: 'none', cursor: 'pointer' }} />
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 76px)', background: C.paper, borderRadius: 24, border: '1px solid rgba(11,31,23,0.08)', boxShadow: '0 20px 48px rgba(11,31,23,0.14)', overflow: 'hidden' }}>
            {([
              { l: 'Mon inventaire', h: '/mon-materiel' },
              { l: 'Mes carnets', h: '/carnets' },
              { l: 'Mes groupes', h: '/groupes' },
              { l: 'Mes clubs', h: '/clubs' },
              { l: 'Fidélité & récompenses', h: '/fidelite' },
              { l: 'Gains & Récompenses', h: '/recompenses' },
              { l: 'Abonnements', h: '/abonnements' },
              { l: 'Boutique & commandes', h: '/boutique' },
              { l: 'Paramètres', h: '/compte/modifier' },
            ] as { l: string; h: string }[]).map(item => (
              <Link key={item.l} href={item.h} onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', fontSize: 14, color: C.ink900, textDecoration: 'none', borderBottom: '1px solid rgba(11,31,23,0.05)' }}>
                <span>{item.l}</span>
                <span style={{ color: C.ink300 }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}