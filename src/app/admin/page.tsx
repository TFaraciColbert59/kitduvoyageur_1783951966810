'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

// ─── Types ─────────────────────────────────────────────────────────────────────
type AdminSection =
  | 'overview' | 'products' | 'kits' | 'categories' |'orders'| 'configurator' | 'countries' | 'toolbox' |'users' | 'moderation' | 'content' | 'audit' | 'rewards';

// ─── Sidebar config ────────────────────────────────────────────────────────────
const SIDEBAR_ITEMS: { id: AdminSection; label: string; icon: string; badge?: string; group?: string }[] = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: 'ChartBarIcon', group: 'Principal' },
  { id: 'products', label: 'Produits', icon: 'ArchiveBoxIcon', group: 'Catalogue' },
  { id: 'kits', label: 'Kits', icon: 'CubeIcon', group: 'Catalogue' },
  { id: 'categories', label: 'Catégories', icon: 'TagIcon', group: 'Catalogue' },
  { id: 'orders', label: 'Commandes', icon: 'ClipboardDocumentListIcon', badge: '3', group: 'Commerce' },
  { id: 'configurator', label: 'Configurateur IA', icon: 'SparklesIcon', group: 'Commerce' },
  { id: 'countries', label: 'Pages Pays', icon: 'GlobeAltIcon', group: 'Contenu' },
  { id: 'toolbox', label: 'Toolbox', icon: 'WrenchScrewdriverIcon', group: 'Contenu' },
  { id: 'content', label: 'Guides', icon: 'BookOpenIcon', group: 'Contenu' },
  { id: 'users', label: 'Utilisateurs', icon: 'UsersIcon', group: 'Gestion' },
  { id: 'moderation', label: 'Modération', icon: 'ShieldCheckIcon', badge: '7', group: 'Gestion' },
  { id: 'rewards', label: 'Récompenses & Sim', icon: 'GiftIcon', group: 'Gestion' },
  { id: 'audit', label: 'Audit & Paramètres', icon: 'Cog6ToothIcon', group: 'Gestion' },
];

// ─── Mock data ─────────────────────────────────────────────────────────────────
const _KPI_DATA = [
  { label: 'CA du jour', value: '3 240€', change: '+18%', up: true, icon: 'CurrencyEuroIcon' },
  { label: 'CA du mois', value: '67 400€', change: '+24.8%', up: true, icon: 'ArrowTrendingUpIcon' },
  { label: 'Commandes en attente', value: '3', change: '-2', up: true, icon: 'ClockIcon' },
  { label: 'Nouveaux comptes', value: '47', change: '+31%', up: true, icon: 'UserPlusIcon' },
  { label: 'Panier moyen', value: '247€', change: '+12%', up: true, icon: 'ShoppingBagIcon' },
  { label: 'Taux config→achat', value: '34.2%', change: '+3.1%', up: true, icon: 'SparklesIcon' },
];

const _PRODUCTS_DATA = [
  { id: 'p1', name: 'Sac Osprey Exos 58L', sku: 'OSP-EX58', price: 299, stock: 14, status: 'publié', category: 'Sacs', weight: 1420 },
  { id: 'p2', name: 'Tente Big Agnes Copper Spur', sku: 'BA-CS2', price: 549, stock: 8, status: 'publié', category: 'Tentes', weight: 1130 },
  { id: 'p3', name: 'Sac de couchage Sea to Summit', sku: 'STS-SP3', price: 189, stock: 0, status: 'rupture', category: 'Couchage', weight: 680 },
  { id: 'p4', name: 'Veste Arc\'teryx Beta AR', sku: 'ARC-BAR', price: 699, stock: 5, status: 'brouillon', category: 'Vêtements', weight: 485 },
  { id: 'p5', name: 'Chaussures Salomon X Ultra', sku: 'SAL-XU4', price: 159, stock: 22, status: 'publié', category: 'Chaussures', weight: 640 },
];

const ORDERS_DATA = [
  { id: '#8821', user: 'Marie L.', email: 'marie.l@email.com', amount: 249, status: 'en_attente', date: '2026-07-08', items: 3 },
  { id: '#8820', user: 'Thomas B.', email: 'thomas.b@email.com', amount: 312, status: 'en_cours', date: '2026-07-08', items: 1 },
  { id: '#8819', user: 'Camille R.', email: 'camille.r@email.com', amount: 198, status: 'livré', date: '2026-07-07', items: 2 },
  { id: '#8818', user: 'Lucas M.', email: 'lucas.m@email.com', amount: 287, status: 'annulé', date: '2026-07-07', items: 1 },
  { id: '#8817', user: 'Sophie D.', email: 'sophie.d@email.com', amount: 224, status: 'livré', date: '2026-07-06', items: 4 },
];

const _USERS_DATA = [
  { id: 'u1', name: 'Marie Laurent', email: 'marie.l@email.com', role: 'client', orders: 8, joined: '2024-03-12', status: 'actif' },
  { id: 'u2', name: 'Thomas Blanc', email: 'thomas.b@email.com', role: 'client', orders: 3, joined: '2025-01-08', status: 'actif' },
  { id: 'u3', name: 'Admin Jean', email: 'jean.admin@kdv.fr', role: 'admin', orders: 0, joined: '2023-06-01', status: 'actif' },
  { id: 'u4', name: 'Modo Claire', email: 'claire.modo@kdv.fr', role: 'moderateur', orders: 0, joined: '2024-09-15', status: 'actif' },
  { id: 'u5', name: 'Lucas Martin', email: 'lucas.m@email.com', role: 'client', orders: 1, joined: '2026-05-20', status: 'suspendu' },
];

const COUNTRIES_DATA = [
  { code: 'np', name: 'Népal', status: 'publié', lastSync: '2026-07-01', danger: 2 },
  { code: 'ar', name: 'Argentine', status: 'publié', lastSync: '2026-06-28', danger: 1 },
  { code: 'is', name: 'Islande', status: 'brouillon', lastSync: '2026-07-05', danger: 1 },
  { code: 'ma', name: 'Maroc', status: 'publié', lastSync: '2026-07-03', danger: 2 },
  { code: 'no', name: 'Norvège', status: 'à_vérifier', lastSync: '2026-06-15', danger: 1 },
];

const MODERATION_QUEUE = [
  { id: 'm1', type: 'avis', content: 'Excellent kit, parfait pour le trek...', user: 'Pierre D.', date: '2026-07-09', product: 'Kit Népal' },
  { id: 'm2', type: 'avis', content: 'Qualité décevante pour le prix...', user: 'Anne M.', date: '2026-07-09', product: 'Tente Big Agnes' },
  { id: 'm3', type: 'forum', content: 'Quelqu\'un a testé le kit Patagonie ?', user: 'Marc T.', date: '2026-07-08', product: 'Forum' },
  { id: 'm4', type: 'avis', content: 'Livraison rapide, produit conforme...', user: 'Julie R.', date: '2026-07-08', product: 'Sac Osprey' },
];

const AUDIT_LOG = [
  { id: 'a1', admin: 'jean.admin', action: 'UPDATE', target: 'product', targetId: 'p2', at: '2026-07-09 14:32' },
  { id: 'a2', admin: 'jean.admin', action: 'CREATE', target: 'kit', targetId: 'k6', at: '2026-07-09 11:15' },
  { id: 'a3', admin: 'claire.modo', action: 'APPROVE', target: 'review', targetId: 'm1', at: '2026-07-08 16:44' },
  { id: 'a4', admin: 'jean.admin', action: 'REFUND', target: 'order', targetId: '#8818', at: '2026-07-08 10:22' },
  { id: 'a5', admin: 'jean.admin', action: 'ROLE_CHANGE', target: 'user', targetId: 'u4', at: '2026-07-07 09:10' },
];

const TOOLBOX_ITEMS = [
  { id: 't1', name: 'Calculateur de poids', slug: 'weight-calculator', active: true, uses: 4821 },
  { id: 't2', name: 'Checklist voyage', slug: 'checklist', active: true, uses: 3204 },
  { id: 't3', name: 'Convertisseur devises', slug: 'currency', active: false, uses: 1102 },
  { id: 't4', name: 'Météo destination', slug: 'weather', active: true, uses: 2890 },
  { id: 't5', name: 'Calculateur carbone', slug: 'carbon', active: true, uses: 987 },
];

const GUIDES_DATA = [
  { id: 'g1', title: 'Comment choisir son sac de trekking', status: 'publié', author: 'Jean Admin', date: '2026-06-20' },
  { id: 'g2', title: 'Guide complet Népal 2026', status: 'publié', author: 'Jean Admin', date: '2026-05-15' },
  { id: 'g3', title: 'Équipement haute montagne : les essentiels', status: 'brouillon', author: 'Jean Admin', date: '2026-07-01' },
];

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  publié: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  brouillon: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  rupture: 'text-red-400 bg-red-400/10 border-red-400/20',
  à_vérifier: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  livré: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  en_attente: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  en_cours: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  annulé: 'text-red-400 bg-red-400/10 border-red-400/20',
  actif: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  suspendu: 'text-red-400 bg-red-400/10 border-red-400/20',
  admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  moderateur: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  client: 'text-white/40 bg-white/5 border-white/10',
};

const ACTION_COLORS: Record<string, string> = {
  UPDATE: 'text-blue-400 bg-blue-400/10',
  CREATE: 'text-emerald-400 bg-emerald-400/10',
  APPROVE: 'text-emerald-400 bg-emerald-400/10',
  REFUND: 'text-amber-400 bg-amber-400/10',
  ROLE_CHANGE: 'text-purple-400 bg-purple-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
};

// ─── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1E2B25] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Icon name="ExclamationTriangleIcon" size={18} variant="outline" className="text-red-400" />
          </div>
          <h3 className="font-display font-700 text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
        </div>
        <p className="text-sm text-white/50 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all">
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Overview ─────────────────────────────────────────────────────────
function OverviewSection() {
  const [stats, setStats] = useState({ products: 0, kits: 0, users: 0, posts: 0, clubs: 0, reviews: 0 });
  const [topProducts, setTopProducts] = useState<{ id: string; name: string; price_eur: number; stock: number }[]>([]);
  const [recentUsers, setRecentUsers] = useState<{ id: string; full_name: string; email: string; loyalty_level: string; created_at: string }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const load = async () => {
      setLoadingStats(true);
      try {
        const [
          productsCountResult,
          kitsCountResult,
          usersCountResult,
          postsCountResult,
          clubsCountResult,
          reviewsCountResult,
          productsDataResult,
          usersDataResult,
        ] = await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('kits').select('*', { count: 'exact', head: true }),
          supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('community_posts').select('*', { count: 'exact', head: true }),
          supabase.from('clubs').select('*', { count: 'exact', head: true }),
          supabase.from('product_reviews').select('*', { count: 'exact', head: true }),
          supabase.from('products').select('id, name, price_eur, stock').order('price_eur', { ascending: false }).limit(5),
          supabase.from('user_profiles').select('id, full_name, email, loyalty_level, created_at').order('created_at', { ascending: false }).limit(5),
        ]);
        const productsCount = productsCountResult.count;
        const kitsCount = kitsCountResult.count;
        const usersCount = usersCountResult.count;
        const postsCount = postsCountResult.count;
        const clubsCount = clubsCountResult.count;
        const reviewsCount = reviewsCountResult.count;
        const productsData = productsDataResult.data;
        const usersData = usersDataResult.data;
        setStats({
          products: productsCount ?? 0,
          kits: kitsCount ?? 0,
          users: usersCount ?? 0,
          posts: postsCount ?? 0,
          clubs: clubsCount ?? 0,
          reviews: reviewsCount ?? 0,
        });
        setTopProducts(productsData ?? []);
        setRecentUsers(usersData ?? []);
      } catch (err) {
        console.error('Admin stats error:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    load();
  }, [supabase]);

  const KPI_LIVE = [
    { label: 'Produits', value: stats.products.toString(), icon: 'ArchiveBoxIcon', color: 'text-emerald-400' },
    { label: 'Kits', value: stats.kits.toString(), icon: 'CubeIcon', color: 'text-blue-400' },
    { label: 'Membres', value: stats.users.toString(), icon: 'UsersIcon', color: 'text-purple-400' },
    { label: 'Posts communauté', value: stats.posts.toString(), icon: 'ChatBubbleLeftRightIcon', color: 'text-amber-400' },
    { label: 'Clubs', value: stats.clubs.toString(), icon: 'UserGroupIcon', color: 'text-pink-400' },
    { label: 'Avis produits', value: stats.reviews.toString(), icon: 'StarIcon', color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-5">
      {loadingStats ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4 h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {KPI_LIVE.map(kpi => (
            <div key={kpi.label} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <Icon name={kpi.icon as string} size={16} variant="outline" className={kpi.color} />
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>Live</span>
              </div>
              <div className="font-mono text-xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{kpi.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top products from DB */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Top produits (par prix)</h3>
        {topProducts.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-4">Aucun produit</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/25 w-4" style={{ fontFamily: 'var(--font-mono)' }}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/70 truncate">{p.name}</span>
                    <span className="font-mono text-xs text-[#17402C] ml-2" style={{ fontFamily: 'var(--font-mono)' }}>{p.price_eur}€</span>
                  </div>
                  <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-[#17402C] rounded-full" style={{ width: `${Math.max(20, 100 - i * 18)}%` }} />
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${p.stock > 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                  {p.stock > 0 ? `${p.stock} en stock` : 'Rupture'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent members from DB */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Membres récents</h3>
        {recentUsers.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-4">Aucun membre</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8">
                {['Nom', 'Email', 'Niveau', 'Inscrit le'].map(h => (
                  <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider pb-2 pr-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentUsers.map(u => (
                <tr key={u.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-2 pr-3 text-white/70">{u.full_name || '—'}</td>
                  <td className="py-2 pr-3 text-white/40 truncate max-w-[120px]">{u.email}</td>
                  <td className="py-2 pr-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{u.loyalty_level}</span>
                  </td>
                  <td className="py-2 text-white/30">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Section: Products ─────────────────────────────────────────────────────────
function ProductsSection() {
  return (
    <div className="space-y-4">
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#17402C]/15 flex items-center justify-center mx-auto mb-4">
          <Icon name="ArchiveBoxIcon" size={22} variant="outline" className="text-[#17402C]" />
        </div>
        <h3 className="font-semibold text-white mb-2">Gestion complète des produits</h3>
        <p className="text-sm text-white/40 mb-5 max-w-sm mx-auto">
          Vue liste, formulaire 29 champs, IA Gemini, médias, relations, import/export CSV, logs d&apos;audit.
        </p>
        <Link href="/admin/produits"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17402C] text-white text-sm font-medium hover:bg-[#cc3d10] transition-all">
          <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" />
          Ouvrir la gestion produits
        </Link>
      </div>
    </div>
  );
}

// ─── Section: Orders ───────────────────────────────────────────────────────────
function OrdersSection() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_eur,
          items,
          created_at,
          user_profiles ( full_name, email )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setOrders(data.map((o: any) => {
          let itemsCount = 0;
          try { itemsCount = Array.isArray(o.items) ? o.items.length : JSON.parse(o.items).length; } catch(e){}
          const p = Array.isArray(o.user_profiles) ? o.user_profiles[0] : o.user_profiles;
          return {
            id: o.order_number,
            realId: o.id,
            user: p?.full_name || 'Inconnu',
            email: p?.email || '',
            amount: o.total_eur,
            status: o.status === 'pending' ? 'en_attente' : o.status === 'shipped' ? 'en_cours' : o.status === 'delivered' ? 'livré' : 'annulé',
            date: o.created_at.substring(0, 10),
            items: itemsCount
          };
        }));
      }
      setLoading(false);
    };
    fetchOrders();
  }, [supabase]);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          title="Rembourser la commande"
          message="Cette action déclenchera un remboursement via Stripe. Cette opération est irréversible."
          onConfirm={() => setConfirm(null)}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {['all', 'en_attente', 'en_cours', 'livré', 'annulé'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === s ? 'bg-[#17402C] text-white' : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'}`}
          >
            {s === 'all' ? 'Toutes' : s.replace('_', ' ')}
          </button>
        ))}
        <button className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
          <Icon name="ArrowDownTrayIcon" size={13} variant="outline" />
          Exporter CSV
        </button>
      </div>

      <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/3 border-b border-white/8">
            <tr>
              {['ID', 'Client', 'Email', 'Montant', 'Articles', 'Statut', 'Date', 'Actions'].map(h => (
                <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30">Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30">Aucune commande</td></tr>
            ) : filtered.map(o => (
                <tr key={o.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-mono text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>{o.id}</td>
                  <td className="px-4 py-3 text-white/80 font-medium">{o.user}</td>
                  <td className="px-4 py-3 text-white/35">{o.email}</td>
                  <td className="px-4 py-3 font-mono font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{o.amount}€</td>
                  <td className="px-4 py-3 font-mono text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>{o.items}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[o.status] || 'text-white/40 border-white/10'}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white/35">{o.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all">
                        <Icon name="EyeIcon" size={13} variant="outline" />
                      </button>
                      {o.status !== 'annulé' && (
                        <button onClick={() => setConfirm(o.id)} className="p-1.5 rounded-lg hover:bg-amber-500/15 text-white/40 hover:text-amber-400 transition-all" title="Rembourser">
                          <Icon name="ArrowUturnLeftIcon" size={13} variant="outline" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Countries ────────────────────────────────────────────────────────
function CountriesSection() {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          title="Forcer la resynchronisation"
          message="Cette action va resynchroniser les données de dangerosité depuis la source officielle. Un log sera créé dans country_sync_log."
          onConfirm={() => setConfirm(null)}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{COUNTRIES_DATA.length} pays configurés</p>
        <button className="flex items-center gap-2 bg-[#17402C] hover:bg-[#cc3d10] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
          <Icon name="PlusIcon" size={14} variant="outline" />
          Nouveau pays
        </button>
      </div>
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/3 border-b border-white/8">
            <tr>
              {['Pays', 'Code', 'Statut', 'Dangerosité', 'Dernière sync', 'Actions'].map(h => (
                <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {COUNTRIES_DATA.map(c => (
              <tr key={c.code} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 text-white/80 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-white/40 uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{c.code}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < c.danger ? 'bg-amber-400' : 'bg-white/10'}`} />
                    ))}
                    <span className="font-mono text-white/30 ml-1" style={{ fontFamily: 'var(--font-mono)' }}>{c.danger}/5</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-white/35" style={{ fontFamily: 'var(--font-mono)' }}>{c.lastSync}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all">
                      <Icon name="PencilIcon" size={13} variant="outline" />
                    </button>
                    <button onClick={() => setConfirm(c.code)} className="p-1.5 rounded-lg hover:bg-blue-500/15 text-white/40 hover:text-blue-400 transition-all" title="Forcer resync dangerosité">
                      <Icon name="ArrowPathIcon" size={13} variant="outline" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Users ────────────────────────────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string; loyalty_level: string; trust_score: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('user_profiles').select('id, full_name, email, loyalty_level, trust_score, created_at').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      setUsers(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  const filtered = users.filter((u) => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Icon name="MagnifyingGlassIcon" size={14} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1E2B25] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#17402C]/50 transition-colors"
          />
        </div>
        <span className="text-xs text-white/30 font-mono px-3">{users.length} membres</span>
      </div>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="bg-[#1E2B25] border border-white/8 rounded-xl h-12 animate-pulse" />)}</div>
      ) : (
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                {['Nom', 'Email', 'Niveau', 'Trust', 'Inscrit'].map(h => (
                  <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">Aucun utilisateur trouvé</td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-white/80 font-medium">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-white/35 truncate max-w-[160px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{u.loyalty_level}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#17402C]" style={{ fontFamily: 'var(--font-mono)' }}>{u.trust_score}</td>
                    <td className="px-4 py-3 text-white/35">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section: Moderation ───────────────────────────────────────────────────────
function ModerationSection() {
  const [queue, setQueue] = useState(MODERATION_QUEUE);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 text-[10px] font-mono font-700 flex items-center justify-center" style={{ fontFamily: 'var(--font-mono)' }}>{queue.length}</span>
          <p className="text-sm text-white/60">éléments en attente de modération</p>
        </div>
      </div>
      <div className="space-y-3">
        {queue.map(item => (
          <div key={item.id} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${item.type === 'avis' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : 'text-purple-400 bg-purple-400/10 border-purple-400/20'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.type}
                  </span>
                  <span className="text-xs text-white/30">{item.product}</span>
                  <span className="text-xs text-white/20">·</span>
                  <span className="text-xs text-white/30">{item.user}</span>
                </div>
                <p className="text-sm text-white/65 leading-relaxed">&quot;{item.content}&quot;</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setQueue(q => q.filter(x => x.id !== item.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-medium"
                >
                  <Icon name="CheckIcon" size={12} variant="outline" />
                  Valider
                </button>
                <button
                  onClick={() => setQueue(q => q.filter(x => x.id !== item.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all text-xs font-medium"
                >
                  <Icon name="XMarkIcon" size={12} variant="outline" />
                  Rejeter
                </button>
              </div>
            </div>
          </div>
        ))}
        {queue.length === 0 && (
          <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-8 text-center">
            <Icon name="CheckCircleIcon" size={32} variant="outline" className="text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-white/50">File de modération vide — tout est à jour.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Toolbox ──────────────────────────────────────────────────────────
function ToolboxSection() {
  const [tools, setTools] = useState(TOOLBOX_ITEMS);
  return (
    <div className="space-y-3">
      {tools.map(tool => (
        <div key={tool.id} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4 flex items-center gap-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tool.active ? 'bg-[#17402C]/15' : 'bg-white/5'}`}>
            <Icon name="WrenchScrewdriverIcon" size={16} variant="outline" className={tool.active ? 'text-[#17402C]' : 'text-white/25'} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white/80">{tool.name}</p>
            <p className="text-xs text-white/30 font-mono mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{tool.uses.toLocaleString()} utilisations</p>
          </div>
          <button
            onClick={() => setTools(ts => ts.map(t => t.id === tool.id ? { ...t, active: !t.active } : t))}
            className={`relative w-11 h-6 rounded-full transition-colors ${tool.active ? 'bg-[#17402C]' : 'bg-white/10'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${tool.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Section: Content/Guides ───────────────────────────────────────────────────
function ContentSection() {
  const [editing, setEditing] = useState<string | null>(null);
  const [mdContent, setMdContent] = useState('# Titre de l\'article\n\nContenu en Markdown...');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{GUIDES_DATA.length} guides</p>
        <button onClick={() => setEditing('new')} className="flex items-center gap-2 bg-[#17402C] hover:bg-[#cc3d10] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
          <Icon name="PlusIcon" size={14} variant="outline" />
          Nouvel article
        </button>
      </div>

      {editing ? (
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Éditeur Markdown</h3>
            <button onClick={() => setEditing(null)} className="text-white/40 hover:text-white transition-colors">
              <Icon name="XMarkIcon" size={16} variant="outline" />
            </button>
          </div>
          <input type="text" placeholder="Titre de l'article" className="w-full bg-[#243028] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#17402C]/50" />
          <textarea
            value={mdContent}
            onChange={e => setMdContent(e.target.value)}
            rows={12}
            className="w-full bg-[#243028] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 font-mono placeholder-white/25 focus:outline-none focus:border-[#17402C]/50 resize-none"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-[#17402C] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#cc3d10] transition-all">
              <Icon name="CheckIcon" size={14} variant="outline" />
              Publier
            </button>
            <button className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-all">
              Brouillon
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                {['Titre', 'Auteur', 'Statut', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {GUIDES_DATA.map(g => (
                <tr key={g.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white/80 font-medium">{g.title}</td>
                  <td className="px-4 py-3 text-white/40">{g.author}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[g.status]}`}>{g.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white/35">{g.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(g.id)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all">
                        <Icon name="PencilIcon" size={13} variant="outline" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section: Audit & Settings ─────────────────────────────────────────────────
function AuditSection() {
  return (
    <div className="space-y-5">
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Journal d&apos;audit</h3>
        <div className="space-y-2">
          {AUDIT_LOG.map(log => (
            <div key={log.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-700 ${ACTION_COLORS[log.action]}`} style={{ fontFamily: 'var(--font-mono)' }}>{log.action}</span>
              <span className="text-xs text-white/50 flex-1">{log.target} <span className="text-white/30">#{log.targetId}</span></span>
              <span className="text-xs text-white/30 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{log.admin}</span>
              <span className="text-xs text-white/20 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{log.at}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Paramètres généraux</h3>
          <div className="space-y-3">
            {[
              { label: 'Frais de port standard', value: '4.90€' },
              { label: 'Frais de port express', value: '9.90€' },
              { label: 'Taux TVA', value: '20%' },
              { label: 'Seuil livraison gratuite', value: '75€' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-white/50">{item.label}</span>
                <input
                  defaultValue={item.value}
                  className="bg-[#243028] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono w-24 text-right focus:outline-none focus:border-[#17402C]/50"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Intégrations</h3>
          <div className="space-y-3">
            {[
              { label: 'Stripe Publishable Key', value: 'pk_live_••••••••••••••••••••••••' },
              { label: 'Stripe Secret Key', value: 'sk_live_••••••••••••••••••••••••' },
              { label: 'Supabase URL', value: 'https://••••••.supabase.co' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{item.label}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#243028] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white/40 font-mono truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.value}
                  </code>
                  <button className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white transition-all flex-shrink-0">
                    <Icon name="EyeSlashIcon" size={13} variant="outline" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Configurator ─────────────────────────────────────────────────────
function ConfiguratorSection() {
  const [prompt, setPrompt] = useState(
    'Tu es un expert en équipement outdoor. Analyse la destination, la durée et le profil du voyageur pour composer un kit optimal. Priorise la légèreté et la polyvalence. Retourne un JSON structuré avec les catégories, produits recommandés et justifications.'
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Sessions ce mois', value: '3 241', icon: 'ChatBubbleLeftRightIcon' },
          { label: 'Destinations top', value: 'Népal', icon: 'GlobeAltIcon' },
          { label: 'Taux d\'abandon', value: '28.4%', icon: 'ArrowTrendingDownIcon' },
          { label: 'Config → Achat', value: '34.2%', icon: 'ShoppingBagIcon' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4">
            <Icon name={kpi.icon as string} size={16} variant="outline" className="text-[#17402C] mb-2" />
            <div className="font-mono text-xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{kpi.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#1E2B25] border border-white/8 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Prompt système Claude</h3>
          <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-1 rounded-lg" style={{ fontFamily: 'var(--font-mono)' }}>Stocké en base — jamais en dur</span>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={6}
          className="w-full bg-[#243028] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 font-mono focus:outline-none focus:border-[#17402C]/50 resize-none"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        <div className="flex gap-3 mt-3">
          <button className="flex items-center gap-2 bg-[#17402C] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#cc3d10] transition-all">
            <Icon name="CheckIcon" size={14} variant="outline" />
            Sauvegarder le prompt
          </button>
          <button className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-all">
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Kits ─────────────────────────────────────────────────────────────
function KitsSection() {
  const KITS = [
    { id: 'k1', name: 'Kit Népal Trekking', products: 24, weight: 8400, price: 899, status: 'publié' },
    { id: 'k2', name: 'Kit Patagonie Hiver', products: 31, weight: 11200, price: 1249, status: 'publié' },
    { id: 'k3', name: 'Kit Sahara Désert', products: 19, weight: 6100, price: 649, status: 'publié' },
    { id: 'k4', name: 'Kit Islande Volcans', products: 22, weight: 9200, price: 799, status: 'brouillon' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{KITS.length} kits</p>
        <button className="flex items-center gap-2 bg-[#17402C] hover:bg-[#cc3d10] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
          <Icon name="PlusIcon" size={14} variant="outline" />
          Nouveau kit
        </button>
      </div>
      <div className="bg-[#1E2B25] border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/3 border-b border-white/8">
            <tr>
              {['Kit', 'Produits', 'Poids total', 'Prix', 'Statut', 'Actions'].map(h => (
                <th key={h} className="text-left font-mono text-white/30 uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {KITS.map(k => (
              <tr key={k.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 text-white/80 font-medium">{k.name}</td>
                <td className="px-4 py-3 font-mono text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>{k.products}</td>
                <td className="px-4 py-3 font-mono text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>{(k.weight / 1000).toFixed(1)} kg</td>
                <td className="px-4 py-3 font-mono font-700 text-[#17402C]" style={{ fontFamily: 'var(--font-mono)' }}>{k.price}€</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[k.status]}`}>{k.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all">
                      <Icon name="PencilIcon" size={13} variant="outline" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all">
                      <Icon name="EyeIcon" size={13} variant="outline" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Categories ───────────────────────────────────────────────────────
function CategoriesSection() {
  const CATS = [
    { id: 'c1', name: 'Sacs & Bagages', slug: 'sacs', products: 42, parent: null },
    { id: 'c2', name: 'Tentes & Bivouac', slug: 'tentes', products: 28, parent: null },
    { id: 'c3', name: 'Vêtements techniques', slug: 'vetements', products: 67, parent: null },
    { id: 'c4', name: 'Chaussures', slug: 'chaussures', products: 35, parent: null },
    { id: 'c5', name: 'Couchage', slug: 'couchage', products: 19, parent: null },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{CATS.length} catégories</p>
        <button className="flex items-center gap-2 bg-[#17402C] hover:bg-[#cc3d10] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
          <Icon name="PlusIcon" size={14} variant="outline" />
          Nouvelle catégorie
        </button>
      </div>
      <div className="space-y-2">
        {CATS.map(cat => (
          <div key={cat.id} className="bg-[#1E2B25] border border-white/8 rounded-xl p-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
              <Icon name="TagIcon" size={14} variant="outline" className="text-white/40" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/80">{cat.name}</p>
              <p className="text-xs text-white/30 font-mono mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>/{cat.slug} · {cat.products} produits</p>
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-all">
                <Icon name="PencilIcon" size={13} variant="outline" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RewardsSection() {
  const [config, setConfig] = useState<any>({});
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [suspects, setSuspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Simulator state
  const [simRevenue, setSimRevenue] = useState(25000);
  const [simActiveEarners, setSimActiveEarners] = useState(150);
  const [simPoolPct, setSimPoolPct] = useState(15);
  const [simFraudRate, setSimFraudRate] = useState(5);
  const [simReserve, setSimReserve] = useState(500);

  // Period finalization state
  const [finalizeRevenue, setFinalizeRevenue] = useState('20000');
  const [finalizing, setFinalizing] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: wData } = await supabase
        .from('withdrawals')
        .select('*')
        .in('status', ['pending', 'under_review'])
        .order('requested_at', { ascending: true });
      setWithdrawals(wData || []);

      const { data: sData } = await supabase
        .from('reward_accounts')
        .select('*, user:user_profiles(full_name, email)')
        .in('status', ['suspect', 'limited'])
        .limit(10);
      setSuspects(sData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSwitch = async (key: string, field: string, currentValue: boolean) => {
    try {
      const updatedSwitches = { ...config[key], [field]: !currentValue };
      const response = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          key,
          value: updatedSwitches
        })
      });
      if (!response.ok) throw new Error('Erreur lors de la mise à jour.');
      setSuccess('Kill switch mis à jour avec succès.');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFinalizePeriod = async () => {
    if (!activePeriod) return;
    setFinalizing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize_period',
          period_id: activePeriod.id,
          eligible_revenue: parseFloat(finalizeRevenue)
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Erreur lors de la clôture.');
      setSuccess(`Période ${activePeriod.id} clôturée avec succès et fonds distribués.`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  };

  const handleProcessWithdrawal = async (withdrawalId: string, approve: boolean) => {
    let reference = null;
    let reason = null;

    if (approve) {
      reference = prompt('Entrez la référence de transaction bancaire (ex: TXN123456) :');
      if (reference === null) return;
    } else {
      reason = prompt('Entrez le motif du rejet :');
      if (reason === null) return;
    }

    try {
      const response = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_withdrawal',
          withdrawal_id: withdrawalId,
          approve,
          reference,
          reason
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Erreur lors de la modération.');
      setSuccess(approve ? 'Retrait approuvé et versé.' : 'Retrait rejeté et remboursé.');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const simPoolSize = Math.max(0, Math.min(simRevenue * (simPoolPct / 100), 5000) - simReserve);
  const simFraudValue = simPoolSize * (simFraudRate / 100);
  const simDistributable = Math.max(0, simPoolSize - simFraudValue);
  const simMedianPayout = simActiveEarners > 0 ? (simDistributable / simActiveEarners).toFixed(2) : '0.00';
  const simMarginRemaining = simRevenue - simPoolSize;

  return (
    <div className="space-y-6 text-white">
      {error && (
        <div className="p-4 bg-rose-955/40 border border-rose-800/80 text-rose-200 rounded-xl text-xs">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-955/40 border border-emerald-800/80 text-emerald-200 rounded-xl text-xs">
          ✅ {success}
        </div>
      )}

      {/* Row 1: Kill Switches & Active Period */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Kill Switches */}
        <div className="md:col-span-5 bg-[#1E2B25] border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5">
            <Icon name="WrenchScrewdriverIcon" size={14} className="text-[#A3C4A3]" />
            Arrêt d&apos;urgence (Kill Switches)
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
              <div>
                <p className="text-xs font-bold">Acquisition de Récompenses</p>
                <p className="text-[10px] text-white/40">Génération de points sur les actions</p>
              </div>
              <button
                onClick={() => handleToggleSwitch('kill_switches', 'rewards_active', config.kill_switches?.rewards_active)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                  config.kill_switches?.rewards_active
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {config.kill_switches?.rewards_active ? 'ON / ACTIF' : 'PAUSÉ'}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
              <div>
                <p className="text-xs font-bold">Retraits de Fonds</p>
                <p className="text-[10px] text-white/40">Demandes de cash-out en SEPA/Paypal</p>
              </div>
              <button
                onClick={() => handleToggleSwitch('kill_switches', 'cashout_active', config.kill_switches?.cashout_active)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                  config.kill_switches?.cashout_active
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {config.kill_switches?.cashout_active ? 'ON / ACTIF' : 'PAUSÉ'}
              </button>
            </div>
          </div>
        </div>

        {/* Active Period Finalizer */}
        <div className="md:col-span-7 bg-[#1E2B25] border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5">
            <Icon name="CalendarIcon" size={14} className="text-[#A3C4A3]" />
            Clôture de la période active
          </h3>
          {activePeriod ? (
            <div className="space-y-4">
              <div className="flex justify-between text-xs bg-black/20 p-3 rounded-xl border border-white/5 font-mono">
                <span>Période : {activePeriod.id}</span>
                <span>Début : {new Date(activePeriod.start_date).toLocaleDateString()}</span>
                <span>Fin : {new Date(activePeriod.end_date).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Revenu éligible net (€)</label>
                  <input
                    type="number"
                    value={finalizeRevenue}
                    onChange={(e) => setFinalizeRevenue(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#A3C4A3]"
                    placeholder="15000"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleFinalizePeriod}
                    disabled={finalizing || !finalizeRevenue}
                    className="w-full py-2 bg-[#17402C] hover:bg-[#2D6B4A] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    {finalizing ? 'Finalisation...' : 'Clôturer la Période & Distribuer'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40 py-6 text-center">Aucune période ouverte disponible pour la clôture.</p>
          )}
        </div>
      </div>

      {/* Row 2: Economic Simulator */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-2xl p-6 space-y-6">
        <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5">
          <Icon name="ArrowTrendingUpIcon" size={14} className="text-[#A3C4A3]" />
          Simulateur Économique (Modélisation de scénarios)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sliders */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Revenu éligible net : <strong>{simRevenue} €</strong></span>
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={simRevenue}
                onChange={(e) => setSimRevenue(parseInt(e.target.value))}
                className="w-full accent-[#A3C4A3] bg-black/20 h-1 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Contributeurs rémunérés (earners) : <strong>{simActiveEarners}</strong></span>
              </div>
              <input
                type="range"
                min="10"
                max="2000"
                step="10"
                value={simActiveEarners}
                onChange={(e) => setSimActiveEarners(parseInt(e.target.value))}
                className="w-full accent-[#A3C4A3] bg-black/20 h-1 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] uppercase text-white/40 mb-1">Part Pool (%)</label>
                <input
                  type="number"
                  value={simPoolPct}
                  onChange={(e) => setSimPoolPct(parseInt(e.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/40 mb-1">Taux Fraude (%)</label>
                <input
                  type="number"
                  value={simFraudRate}
                  onChange={(e) => setSimFraudRate(parseInt(e.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-white/40 mb-1">Trésorerie Réserve (€)</label>
                <input
                  type="number"
                  value={simReserve}
                  onChange={(e) => setSimReserve(parseInt(e.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Simulated Outcomes */}
          <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-4 font-mono text-xs">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-white/40">Résultats simulés</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Reward Pool Brut :</span>
                <span className="font-bold text-white">{(simRevenue * (simPoolPct / 100)).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Réserve déduite :</span>
                <span className="text-white/60">-{simReserve.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>Reward Pool Net :</span>
                <span className="font-bold text-amber-400">{simPoolSize.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>Pertes Fraude estimées :</span>
                <span className="text-rose-400">-{simFraudValue.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-400 border-t border-white/5 pt-2">
                <span>Gains Medians / user :</span>
                <span>{simMedianPayout} €</span>
              </div>
              <div className="flex justify-between text-white/40 text-[9px] mt-2">
                <span>Marge brute plateforme :</span>
                <span>{simMarginRemaining.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Pending Withdrawals Moderation */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5">
          <Icon name="WrenchScrewdriverIcon" size={14} className="text-[#A3C4A3]" />
          Demandes de retraits en attente de validation
        </h3>

        <div className="overflow-x-auto">
          {withdrawals.length === 0 ? (
            <p className="text-xs text-white/30 py-8 text-center bg-black/10 rounded-xl">Aucune demande de retrait en attente.</p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase font-mono text-[9px] tracking-wider">
                  <th className="pb-2">Utilisateur</th>
                  <th className="pb-2 text-right">Montant</th>
                  <th className="pb-2 text-center">Méthode</th>
                  <th className="pb-2">Coordonnées</th>
                  <th className="pb-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-white/2">
                    <td className="py-3 font-sans">
                      <p className="font-bold text-white/85">{w.user?.full_name || 'Utilisateur inconnu'}</p>
                      <p className="text-[10px] text-white/40">{w.user?.email || ''} · Confiance : {w.user?.trust_score || 50}/100</p>
                    </td>
                    <td className="py-3 text-right font-bold text-amber-400">{w.amount.toFixed(2)} €</td>
                    <td className="py-3 text-center font-bold text-white/70">
                      {w.payment_provider === 'bank_transfer' ? 'Banque' : 'Paypal'}
                    </td>
                    <td className="py-3 text-white/60 text-[10px]">
                      {w.payment_provider === 'bank_transfer' ? (
                        <>
                          <p>IBAN: {w.metadata?.iban || 'N/A'}</p>
                          <p>BIC: {w.metadata?.bic || 'N/A'}</p>
                        </>
                      ) : (
                        <p>Paypal: {w.metadata?.paypal_email || 'N/A'}</p>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleProcessWithdrawal(w.id, true)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] tracking-wide"
                        >
                          Valider (Payé)
                        </button>
                        <button
                          onClick={() => handleProcessWithdrawal(w.id, false)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] tracking-wide"
                        >
                          Rejeter
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 4: Suspect Users List */}
      <div className="bg-[#1E2B25] border border-white/8 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5">
          <Icon name="ShieldCheckIcon" size={14} className="text-[#A3C4A3]" />
          Utilisateurs sous surveillance (Spam / Triche)
        </h3>

        <div className="overflow-x-auto">
          {suspects.length === 0 ? (
            <p className="text-xs text-white/30 py-8 text-center bg-black/10 rounded-xl">Aucun utilisateur suspect détecté.</p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase font-mono text-[9px] tracking-wider">
                  <th className="pb-2">Utilisateur</th>
                  <th className="pb-2 text-right">Points Actifs</th>
                  <th className="pb-2 text-right">Points Invalides</th>
                  <th className="pb-2 text-center">Statut Compte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {suspects.map((s) => (
                  <tr key={s.user_id} className="hover:bg-white/2">
                    <td className="py-2.5">
                      <p className="font-bold text-white/80">{s.user?.full_name || 'Inconnu'}</p>
                      <p className="text-[10px] text-white/40">{s.user?.email || ''}</p>
                    </td>
                    <td className="py-2.5 text-right font-bold text-white/85">{s.eligible_points} pts</td>
                    <td className="py-2.5 text-right text-rose-400 font-bold">{s.invalid_points} pts</td>
                    <td className="py-2.5 text-center font-bold text-rose-300">
                      <span className="px-2 py-0.5 bg-rose-950/40 border border-rose-800/40 rounded-full text-[9px] uppercase tracking-wide">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<'loading' | 'authorized' | 'denied'>('loading');
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ─── Client-side auth guard (defense-in-depth) ──────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthState('denied');
        router.replace('/connexion?redirect=/admin');
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!profile || profile.role !== 'admin') {
        setAuthState('denied');
        router.replace('/');
        return;
      }
      setAuthState('authorized');
    };
    checkAuth();
  }, [router]);

  if (authState !== 'authorized') {
    return (
      <div className="min-h-screen bg-[#151F1A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const groups = [...new Set(SIDEBAR_ITEMS.map(i => i.group))];

  const SECTION_TITLES: Record<AdminSection, string> = {
    overview: 'Vue d\'ensemble',
    products: 'Produits',
    kits: 'Kits',
    categories: 'Catégories',
    orders: 'Commandes',
    configurator: 'Configurateur IA',
    countries: 'Pages Pays',
    toolbox: 'Toolbox',
    users: 'Utilisateurs',
    moderation: 'Modération',
    content: 'Guides & Contenu',
    audit: 'Audit & Paramètres',
    rewards: 'Gestion des Récompenses & Simulateur Économique',
  };

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#151F1A] text-white flex" style={{ paddingTop: 0 }}>
          {/* Mobile sidebar overlay */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/60 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Fixed Sidebar */}
          <aside
            className={`fixed top-0 left-0 h-full bg-[#1C2620] border-r border-white/8 flex flex-col z-50 transition-all duration-300
              ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              ${sidebarCollapsed ? 'lg:w-14' : 'lg:w-56'} w-64`}
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/8 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-[#17402C] flex items-center justify-center flex-shrink-0">
                <Icon name="ShieldCheckIcon" size={14} variant="outline" className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-[9px] font-mono text-white/30 tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)' }}>Admin</p>
                  <p className="font-display font-700 text-white text-sm leading-tight truncate" style={{ fontFamily: 'var(--font-display)' }}>KDV Dashboard</p>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
              {groups.map(group => (
                <div key={group}>
                  {!sidebarCollapsed && (
                    <p className="text-[9px] font-mono text-white/20 tracking-[0.2em] uppercase px-2 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>{group}</p>
                  )}
                  <div className="space-y-0.5">
                    {SIDEBAR_ITEMS.filter(i => i.group === group).map(item => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                          activeSection === item.id
                            ? 'bg-[#17402C]/15 text-[#17402C]'
                            : 'text-white/45 hover:text-white hover:bg-white/6'
                        }`}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon name={item.icon as string} size={15} variant="outline" className="flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left truncate">{item.label}</span>
                            {item.badge && (
                              <span className="w-4 h-4 rounded-full bg-[#17402C] text-white text-[9px] font-700 flex items-center justify-center flex-shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            {/* Bottom */}
            <div className="border-t border-white/8 p-2 flex-shrink-0 space-y-1">
              <Link
                href="/"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-white/35 hover:text-white hover:bg-white/6 transition-all"
              >
                <Icon name="ArrowLeftIcon" size={14} variant="outline" className="flex-shrink-0" />
                {!sidebarCollapsed && <span>Retour au site</span>}
              </Link>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-white/25 hover:text-white hover:bg-white/6 transition-all"
              >
                <Icon name={sidebarCollapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={14} variant="outline" className="flex-shrink-0" />
                {!sidebarCollapsed && <span>Réduire</span>}
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-14' : 'lg:ml-56'} ml-0`}>
            {/* Top bar */}
            <div className="sticky top-0 z-30 bg-[#151F1A]/95 backdrop-blur-md border-b border-white/6 px-4 sm:px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu toggle */}
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl bg-white/8 text-white/60 hover:text-white transition-colors"
                  aria-label="Ouvrir le menu"
                >
                  <Icon name="Bars3Icon" size={18} variant="outline" />
                </button>
                <div>
                  <h1 className="font-display font-700 text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>
                    {SECTION_TITLES[activeSection]}
                  </h1>
                  <p className="text-[10px] font-mono text-white/25 mt-0.5 hidden sm:block" style={{ fontFamily: 'var(--font-mono)' }}>
                    Admin · Le Kit du Voyageur
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>Live</span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#17402C]/20 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-700 text-[#17402C]" style={{ fontFamily: 'var(--font-mono)' }}>JA</span>
                </div>
              </div>
            </div>

            {/* Section content */}
            <div className="p-4 sm:p-6">
              {activeSection === 'overview' && <OverviewSection />}
              {activeSection === 'products' && <ProductsSection />}
              {activeSection === 'kits' && <KitsSection />}
              {activeSection === 'categories' && <CategoriesSection />}
              {activeSection === 'orders' && <OrdersSection />}
              {activeSection === 'configurator' && <ConfiguratorSection />}
              {activeSection === 'countries' && <CountriesSection />}
              {activeSection === 'toolbox' && <ToolboxSection />}
              {activeSection === 'users' && <UsersSection />}
              {activeSection === 'moderation' && <ModerationSection />}
              {activeSection === 'content' && <ContentSection />}
              {activeSection === 'audit' && <AuditSection />}
              {activeSection === 'rewards' && <RewardsSection />}
            </div>
          </main>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {/* Top bar */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            backgroundColor: '#0B1F17',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(11,31,23,0.06)',
          }}>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: '#EDF3ED',
              fontWeight: 400,
              fontSize: '18px',
              margin: 0,
            }}>
              Admin
            </h1>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(163,196,163,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10px',
                fontWeight: 700,
                color: '#A3C4A3',
              }}>JA</span>
            </div>
          </div>

          {/* Section pills */}
          <div style={{
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            padding: '12px 16px',
            backgroundColor: '#0B1F17',
            borderBottom: '1px solid rgba(11,31,23,0.06)',
            display: 'flex',
            gap: '8px',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}>
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: activeSection === item.id ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: activeSection === item.id ? '#17402C' : '#F4F1EA',
                  color: activeSection === item.id ? '#FFFFFF' : '#6B7A72',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div style={{
            backgroundColor: '#FBFAF6',
            minHeight: 'calc(100vh - 120px)',
            padding: '16px',
          }}>
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'products' && <ProductsSection />}
            {activeSection === 'kits' && <KitsSection />}
            {activeSection === 'categories' && <CategoriesSection />}
            {activeSection === 'orders' && <OrdersSection />}
            {activeSection === 'configurator' && <ConfiguratorSection />}
            {activeSection === 'countries' && <CountriesSection />}
            {activeSection === 'toolbox' && <ToolboxSection />}
            {activeSection === 'users' && <UsersSection />}
            {activeSection === 'moderation' && <ModerationSection />}
            {activeSection === 'content' && <ContentSection />}
            {activeSection === 'audit' && <AuditSection />}
            {activeSection === 'rewards' && <RewardsSection />}
          </div>

          {/* Footer spacer */}
          <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
        </MobilePageShell>
      </div>
    </>
  );
}
