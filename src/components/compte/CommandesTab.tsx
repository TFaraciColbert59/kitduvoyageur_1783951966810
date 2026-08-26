'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/mock/compte-marceline';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface OrderItem {
  name: string;
  slug?: string;
  quantity: number;
  unit_price_eur: number;
  image?: string;
  size?: string;
  color?: string;
  sku?: string;
}

interface OrderDB {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  shipping_address: any;
  items: OrderItem[];
  subtotal_eur: number;
  shipping_eur: number;
  total_eur: number;
  loyalty_points_earned: number;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

type OrderStatus = 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

interface DeliveryAddress {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  isDefault: boolean;
}

interface PaymentCard {
  id: string;
  brand: string;
  last4: string;
  holder: string;
  expiry: string;
}

interface CommandesTabProps {
  profile: UserProfile;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function fmtPrice(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(',00', '');
}

function getStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'confirmed': return { label: 'Confirmée', className: 'glass-pill pill-info' };
    case 'preparing': return { label: 'En préparation', className: 'glass-pill pill-warn' };
    case 'shipped': return { label: 'Expédiée', className: 'glass-pill' };
    case 'delivered': return { label: 'Livrée', className: 'glass-pill' };
    case 'cancelled': return { label: 'Annulée', className: 'glass-pill pill-danger' };
    case 'refunded': return { label: 'Remboursée', className: 'glass-pill pill-info' };
    default: return { label: status, className: 'glass-pill' };
  }
}

function getStatusIndex(status: string): number {
  switch (status) {
    case 'confirmed': return 0;
    case 'preparing': return 1;
    case 'shipped': return 2;
    case 'delivered': return 3;
    default: return 0;
  }
}

const PRODUCT_IMAGES: Record<string, string> = {
  'veste-impermeable-001': 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=200&q=80',
  'salomon-x-ultra-4': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
  'therm-a-rest-neoair-xlite': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=200&q=80',
  'pantalon-impermeable-001': 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=200&q=80',
  'couche-intermediaire-001': 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=200&q=80',
  'sous-vetements-tech-001': 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=200&q=80',
  'sac-couchage-001': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=200&q=80',
  'serviette-microfibre-001': 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=200&q=80',
  'lampe-frontale-001': 'https://images.unsplash.com/photo-1508873696983-2df515122519?auto=format&fit=crop&w=200&q=80',
  'batterie-externe-001': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=200&q=80',
  'bonnet-gants-001': 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=200&q=80',
  'lunettes-soleil-001': 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=200&q=80',
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function CommandesTab({ profile }: CommandesTabProps) {
  const supabase = useMemo(() => createClient(), []);

  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyYear, setHistoryYear] = useState<string>('2026');
  
  // State for editable info
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [cards, setCards] = useState<PaymentCard[]>([]);

  // Modal States
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<DeliveryAddress | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // ─── data fetching ────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Only ever show the authenticated user's own orders
      if (!user) {
        setOrders([]);
        return;
      }

      const query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data } = await query;

      if (data && data.length > 0) {
        setOrders(data as OrderDB[]);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('CommandesTab fetch error:', err);
    }
  }, [supabase]);

  const fetchAddressesAndCards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let addrQuery = supabase.from('user_addresses').select('*').order('created_at', { ascending: true });
      let cardQuery = supabase.from('user_payment_methods').select('*').order('created_at', { ascending: true });
      
      if (user) {
        addrQuery = addrQuery.eq('user_id', user.id);
        cardQuery = cardQuery.eq('user_id', user.id);
      }
      
      const [addrRes, cardRes] = await Promise.all([addrQuery, cardQuery]);
      
      if (addrRes.data && addrRes.data.length > 0) {
        setAddresses(addrRes.data.map(a => ({
          id: a.id, label: a.label, name: a.full_name, street: a.street, city: a.city, isDefault: a.is_default
        })));
      }
      if (cardRes.data && cardRes.data.length > 0) {
        setCards(cardRes.data.map(c => ({
          id: c.id, brand: c.brand, last4: c.last4, holder: c.holder_name, expiry: c.expiry
        })));
      }
    } catch(err) {
      console.error('Addresses/Cards fetch error:', err);
    }
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchAddressesAndCards()]);
      setLoading(false);
    };
    init();
  }, [fetchOrders, fetchAddressesAndCards]);

  // ─── derived data ─────────────────────────
  const currentYear = new Date().getFullYear();

  // Assign realistic statuses based on order age
  const enrichedOrders = useMemo(() => {
    return orders.map((o, i) => {
      const daysSinceOrder = Math.floor((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
      let derivedStatus: OrderStatus;
      if (o.status === 'cancelled') derivedStatus = 'cancelled';
      else if (daysSinceOrder > 14) derivedStatus = 'delivered';
      else if (daysSinceOrder > 7) derivedStatus = 'shipped';
      else if (daysSinceOrder > 3) derivedStatus = 'preparing';
      else derivedStatus = 'confirmed';

      // Enrich items with product images
      const enrichedItems = o.items.map(item => ({
        ...item,
        image: item.image || PRODUCT_IMAGES[item.slug || ''] || `https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=200&q=80`,
      }));

      return { ...o, derivedStatus, items: enrichedItems };
    });
  }, [orders]);

  // Active orders (not delivered, not old)
  const activeOrders = enrichedOrders.filter(o => o.derivedStatus !== 'delivered' && o.derivedStatus !== 'cancelled' && (o.derivedStatus as any) !== 'refunded');
  
  // History orders
  const historyOrders = enrichedOrders.filter(o => {
    const year = new Date(o.created_at).getFullYear().toString();
    if (historyYear === 'Toutes') return true;
    return year === historyYear;
  });

  // Stats
  const yearOrders = enrichedOrders.filter(o => new Date(o.created_at).getFullYear() === currentYear);
  const totalCumule = enrichedOrders.reduce((s, o) => s + Number(o.total_eur), 0);
  const panierMoyen = enrichedOrders.length > 0 ? totalCumule / enrichedOrders.length : 0;
  const totalEconomies = enrichedOrders.reduce((s, o) => s + Number(o.shipping_eur === 0 ? 5.9 : 0), 0);

  // ─── actions ──────────────────────────────
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (!error) {
      showToast('Commande annulée');
      fetchOrders();
    } else {
      showToast('Erreur lors de l\'annulation');
    }
  };

  const handleDownloadInvoice = (order: OrderDB) => {
    const content = [
      `FACTURE - ${order.order_number}`,
      `Date: ${formatDate(order.created_at)}`,
      '',
      'Articles:',
      ...order.items.map(i => `  ${i.name} x${i.quantity} — ${fmtPrice(i.unit_price_eur)} €`),
      '',
      `Sous-total: ${fmtPrice(Number(order.subtotal_eur))} €`,
      `Livraison: ${Number(order.shipping_eur) === 0 ? 'Offerte' : fmtPrice(Number(order.shipping_eur)) + ' €'}`,
      `Total: ${fmtPrice(Number(order.total_eur))} €`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture_${order.order_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Facture téléchargée');
  };

  const handleTrackOrder = (order: OrderDB) => {
    showToast(`Suivi du colis ${order.order_number} — ouverture du transporteur`);
  };

  const handleContactSAV = () => {
    showToast('Redirection vers le service client...');
  };

  const handleDownloadAllInvoices = () => {
    yearOrders.forEach(o => handleDownloadInvoice(o));
    showToast(`${yearOrders.length} factures téléchargées`);
  };

  const handleDeleteAddress = async (id: string) => {
    const { error } = await supabase.from('user_addresses').delete().eq('id', id);
    if (!error) {
      setAddresses(prev => prev.filter(a => a.id !== id));
      showToast('Adresse supprimée');
    } else {
      showToast('Erreur lors de la suppression');
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Optimistic UI
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    
    if (user) {
      await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
    } else {
      await supabase.from('user_addresses').update({ is_default: false }).neq('id', 'temp'); // Dummy for anon
    }
    
    await supabase.from('user_addresses').update({ is_default: true }).eq('id', id);
    showToast('Adresse par défaut mise à jour');
  };

  const handleSaveAddress = async (addr: DeliveryAddress) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (addressToEdit) {
      const { error } = await supabase.from('user_addresses').update({
        label: addr.label,
        full_name: addr.name,
        street: addr.street,
        city: addr.city
      }).eq('id', addr.id);
      
      if (!error) {
        setAddresses(prev => prev.map(a => a.id === addr.id ? addr : a));
        showToast('Adresse modifiée avec succès');
      } else {
        showToast('Erreur lors de la modification');
      }
    } else {
      const payload = {
        user_id: user?.id || null,
        label: addr.label,
        full_name: addr.name,
        street: addr.street,
        city: addr.city,
        is_default: addresses.length === 0
      };
      
      const { data, error } = await supabase.from('user_addresses').insert([payload]).select().single();
      
      if (!error && data) {
        setAddresses(prev => [...prev, {
          id: data.id, label: data.label, name: data.full_name, street: data.street, city: data.city, isDefault: data.is_default
        }]);
        showToast('Nouvelle adresse ajoutée');
      } else {
        showToast('Erreur lors de l\'ajout');
      }
    }
    
    setShowAddressModal(false);
    setAddressToEdit(null);
  };

  const handleAddCard = async (card: PaymentCard) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      user_id: user?.id || null,
      brand: card.brand,
      last4: card.last4,
      holder_name: card.holder,
      expiry: card.expiry,
      is_default: cards.length === 0
    };
    
    const { data, error } = await supabase.from('user_payment_methods').insert([payload]).select().single();
    
    if (!error && data) {
      setCards(prev => [...prev, {
        id: data.id, brand: data.brand, last4: data.last4, holder: data.holder_name, expiry: data.expiry
      }]);
      setShowCardModal(false);
      showToast('Nouvelle carte ajoutée');
    } else {
      showToast('Erreur lors de l\'ajout');
    }
  };

  // ─── loading skeleton ─────────────────────
  // ─── loading skeleton ─────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
        <div className="lg:col-span-4 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-16 font-sans text-[#17402C]">
        {/* ════════════════ MAIN COLUMN ════════════════ */}
        <div className="lg:col-span-8 space-y-8">
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[#17402C]/5 pb-5">
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#17402C] tracking-tight">
                Commandes <span className="font-serif italic font-normal text-[#365233]">&amp; abonnements</span>
              </h2>
              <p className="text-xs text-[#5A7064] mt-1 font-mono">
                {enrichedOrders.length} commandes depuis 2023 · {activeOrders.length} en cours · 1 abonnement premium actif · {fmtPrice(totalCumule)}&nbsp;€ cumulés
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownloadAllInvoices}
                className="glass-capsule-btn text-xs font-bold"
              >
                <Icon name="ArrowDownTrayIcon" size={14} />
                <span>Factures {currentYear}</span>
              </button>
              <button
                onClick={handleContactSAV}
                className="glass-capsule-btn primary text-xs font-bold"
              >
                Contacter le SAV
              </button>
            </div>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatPill label={`Commandes ${currentYear}`} value={yearOrders.length} sub={`${activeOrders.length} en cours · ${enrichedOrders.filter(o => o.derivedStatus === 'delivered').length} livrées`} />
            <StatPill label="Total cumulé" value={`${fmtPrice(totalCumule)} €`} sub={`Sur 3 ans · ${fmtPrice(totalEconomies)} € économisés`} />
            <StatPill label="Panier moyen" value={`${fmtPrice(Math.round(panierMoyen))} €`} sub="1 198 € en 2025" />
            <StatPill label="Prochaine facture" value="89 €" sub="Abonnement Guide · 4 fév. 2027" />
          </div>

          {/* ── Active Orders ── */}
          {activeOrders.length > 0 && activeOrders.map((order) => (
            <ActiveOrderCard
              key={order.id}
              order={order}
              onTrack={() => handleTrackOrder(order)}
              onInvoice={() => handleDownloadInvoice(order)}
              onCancel={() => handleCancelOrder(order.id)}
            />
          ))}

          {/* If no active orders but have history */}
          {activeOrders.length === 0 && enrichedOrders.length > 0 && (
            <div className="glass rounded-2xl p-8 text-center space-y-2">
              <p className="text-3xl">📦</p>
              <h4 className="font-display font-bold text-[#17402C] text-lg">Aucune commande en cours</h4>
              <p className="text-xs text-[#5A7064]">Toutes vos commandes ont été livrées.</p>
            </div>
          )}

          {/* ── Historique ── */}
          <div className="glass rounded-[1.25rem] p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#17402C]/5 pb-4">
              <div>
                <h3 className="font-display font-bold text-xl text-[#17402C]">
                  Historique <span className="font-serif italic font-normal text-[#365233]">{historyYear !== 'Toutes' ? historyYear : ''}</span>
                </h3>
                <p className="text-xs text-[#5A7064] mt-0.5">
                  Vos commandes livrées cette année.
                </p>
              </div>
              <div className="glass-capsule-bar">
                <div className="flex items-center gap-1 p-0.5">
                  {['2026', '2025', '2024', 'Toutes'].map((year) => (
                    <button
                      key={year}
                      onClick={() => setHistoryYear(year)}
                      className={`glass-capsule-segment !px-3 !py-1 text-xs ${
                        historyYear === year ? 'active' : ''
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {historyOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-sm text-[#5A7064]">Aucune commande pour cette période.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyOrders.slice(0, 6).map((order) => (
                  <HistoryOrderRow
                    key={order.id}
                    order={order}
                    onInvoice={() => handleDownloadInvoice(order)}
                    onTrack={() => handleTrackOrder(order)}
                  />
                ))}
              </div>
            )}

            {historyOrders.length > 6 && (
              <div className="text-center pt-3">
                <button className="glass-capsule-btn text-xs font-bold">
                  Voir les {historyOrders.length - 6} commandes plus anciennes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════ SIDEBAR ════════════════ */}
        <div className="lg:col-span-4 space-y-6">
          {/* ── Guide annuel Card ── */}
          <div className="bg-[#17402C] rounded-[1.5rem] p-6 text-white relative overflow-hidden border border-white/10 shadow-[0_16px_40px_-20px_rgba(23,64,44,0.35)]">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#5B7F55]/20 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1">Guide annuel</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-4xl text-white">89</span>
                  <span className="text-white/70 text-sm font-semibold">€ / an</span>
                </div>
              </div>
              <span className="glass-pill !bg-white/15 !text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                Actif
              </span>
            </div>

            <ul className="space-y-2 mb-5 relative z-10">
              {[
                'Cartes hors-ligne illimitées',
                'Refuges partenaires réservables',
                '-15% sur la boutique',
                'Livraison DHL Express offerte',
                'Accès aux carnets premium',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-white/85">
                  <Icon name="CheckIcon" size={12} className="text-[#A6C1A0] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-white/50 mb-4 relative z-10 font-mono">
              Renouvellement le <strong className="text-white/80">4 février 2027</strong> · CB Visa ••{cards.length > 0 ? cards[0].last4 : '4291'}
            </p>

            <div className="flex items-center gap-2 relative z-10">
              <button
                onClick={() => showToast('Gestion de l\'abonnement...')}
                className="glass-capsule-btn primary flex-1 text-xs font-bold text-center !py-2"
              >
                Gérer l&apos;abonnement
              </button>
              <button
                onClick={handleDownloadAllInvoices}
                className="glass-capsule-btn text-xs font-bold !py-2"
              >
                Factures
              </button>
            </div>
          </div>

          {/* ── Adresses de livraison ── */}
          <div className="glass rounded-[1.25rem] p-6 space-y-4">
            <div>
              <h4 className="font-display font-bold text-[#17402C] text-lg">
                Adresses <span className="font-serif italic font-normal text-[#365233]">de livraison</span>
              </h4>
              <p className="text-[11px] text-[#5A7064]">
                {addresses.length} adresse{addresses.length !== 1 ? 's' : ''} enregistrée{addresses.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`glass-sub-card rounded-xl p-4 transition-all ${
                    addr.isDefault ? 'border-[#17402C]/30 bg-white/60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-bold text-sm text-[#17402C]">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="glass-pill !bg-[#17402C] !text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                        défaut
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#17402C] font-semibold">{addr.name}</p>
                  <p className="text-xs text-[#5A7064]">{addr.street}</p>
                  {addr.city && <p className="text-xs text-[#5A7064]">{addr.city}</p>}
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#17402C]/5">
                    <button
                      onClick={() => {
                        setAddressToEdit(addr);
                        setShowAddressModal(true);
                      }}
                      className="text-[11px] text-[#365233] hover:text-[#17402C] font-bold transition-colors"
                    >
                      Modifier
                    </button>
                    {addr.isDefault ? (
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-[11px] text-[#A8443A] hover:underline font-bold transition-colors"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="text-[11px] text-[#5A7064] hover:text-[#17402C] font-bold transition-colors"
                      >
                        Définir par défaut
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {addresses.length === 0 && (
                <div className="py-4 text-center text-[#5A7064] text-xs glass-sub-card rounded-xl">
                  Aucune adresse enregistrée.
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setAddressToEdit(null);
                setShowAddressModal(true);
              }}
              className="glass-capsule-btn w-full text-xs font-bold"
            >
              <Icon name="PlusIcon" size={13} />
              <span>Ajouter une adresse</span>
            </button>
          </div>

          {/* ── Moyens de paiement ── */}
          <div className="glass rounded-[1.25rem] p-6 space-y-4">
            <div>
              <h4 className="font-display font-bold text-[#17402C] text-lg">
                Moyens <span className="font-serif italic font-normal text-[#365233]">de paiement</span>
              </h4>
              <p className="text-[11px] text-[#5A7064]">
                {cards.length} carte{cards.length !== 1 ? 's' : ''} enregistrée{cards.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-4 mb-4">
              {cards.map((card) => (
                <div key={card.id} className="w-full aspect-[1.7] bg-gradient-to-br from-[#17402C] to-[#2D5A3D] rounded-2xl p-5 text-white relative overflow-hidden border border-white/10 shadow-md">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                  {/* Chip */}
                  <div className="w-10 h-7 bg-gradient-to-br from-[#D9D5C4] to-[#B3AE9A] rounded-sm mb-5" />

                  {/* Card number */}
                  <div className="font-mono text-base tracking-[0.15em] mb-4 flex items-center gap-3">
                    <span className="text-white/40">••••</span>
                    <span className="text-white/40">••••</span>
                    <span className="text-white/40">••••</span>
                    <span className="text-white">{card.last4}</span>
                  </div>

                  {/* Card bottom */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[8px] font-mono tracking-widest uppercase text-white/50 mb-0.5">Titulaire</p>
                      <p className="text-xs font-bold uppercase">{card.holder}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-mono tracking-widest uppercase text-white/50 mb-0.5">Expire</p>
                      <p className="text-xs font-mono font-bold">{card.expiry.replace('Exp. ', '')}</p>
                    </div>
                    <div className="text-xl font-bold italic text-white/80">{card.brand}</div>
                  </div>
                </div>
              ))}

              {cards.length === 0 && (
                <div className="py-4 text-center text-[#5A7064] text-xs glass-sub-card rounded-xl">
                  Aucune carte enregistrée.
                </div>
              )}
            </div>

            <button
              onClick={() => setShowCardModal(true)}
              className="glass-capsule-btn w-full text-xs font-bold"
            >
              <Icon name="PlusIcon" size={13} />
              <span>Ajouter une carte</span>
            </button>
          </div>
        </div>
      </div>

      {/* ────────────────── MODALS ────────────────── */}
      {showAddressModal && (
        <AddressModal
          onClose={() => {
            setShowAddressModal(false);
            setAddressToEdit(null);
          }}
          onSave={handleSaveAddress}
          initialData={addressToEdit}
        />
      )}

      {showCardModal && (
        <CardModal
          onClose={() => setShowCardModal(false)}
          onSave={handleAddCard}
        />
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-[#17402C] text-white px-6 py-3 rounded-full text-xs font-bold shadow-lg animate-fade-in flex items-center gap-2 border border-white/20">
          <Icon name="CheckIcon" size={14} />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass rounded-[1.25rem] p-5 flex flex-col gap-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[#5A7064]">{label}</p>
      <p className="glass-metric text-3xl sm:text-4xl text-[#17402C] leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#5A7064] font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Active Order Card ──
function ActiveOrderCard({
  order,
  onTrack,
  onInvoice,
  onCancel,
}: {
  order: OrderDB & { derivedStatus: OrderStatus };
  onTrack: () => void;
  onInvoice: () => void;
  onCancel: () => void;
}) {
  const statusInfo = getStatusLabel(order.derivedStatus);
  const statusIdx = getStatusIndex(order.derivedStatus);
  const steps = ['Commandée', 'Préparée', 'Expédiée', 'Livrée'];
  const stepDates = [
    formatDateShort(order.created_at),
    statusIdx >= 1 ? formatDateShort(new Date(new Date(order.created_at).getTime() + 2 * 86400000).toISOString()) : '',
    statusIdx >= 2 ? formatDateShort(new Date(new Date(order.created_at).getTime() + 5 * 86400000).toISOString()) : '',
    statusIdx >= 3 ? formatDateShort(new Date(new Date(order.created_at).getTime() + 10 * 86400000).toISOString()) : '',
  ];

  const displayItems = order.items.slice(0, 2);
  const remainingCount = order.items.length - 2;
  const fidDiscount = Number(order.total_eur) > 200 ? Number(order.subtotal_eur) * 0.15 : 0;

  return (
    <div className="glass rounded-[1.25rem] overflow-hidden">
      {/* Order header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#17402C]/5 bg-white/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-[#17402C]">{order.order_number}</span>
          <span className="text-[#5A7064]/40">·</span>
          <span className="text-xs text-[#5A7064] font-mono">Passée le {formatDate(order.created_at)}</span>
        </div>
        <span className={statusInfo.className}>
          {statusInfo.label}
        </span>
      </div>

      {/* Items */}
      <div className="px-6 py-5">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Products */}
          <div className="flex-1 space-y-3">
            {displayItems.map((item, i) => (
              <div key={i} className="glass-sub-card p-3 rounded-xl flex items-center gap-4">
                <div className="w-14 h-14 bg-white/60 rounded-xl overflow-hidden shrink-0 border border-[#17402C]/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image || '/assets/images/no_image.png'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#17402C] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#5A7064] font-mono">
                    {item.size && `Taille ${item.size} · `}
                    {item.color && `${item.color} · `}
                    {item.sku && `SKU · ${item.sku}`}
                    {!item.size && !item.color && !item.sku && `Qté: ${item.quantity}`}
                  </p>
                </div>
                <p className="font-mono font-bold text-sm text-[#17402C] shrink-0">{fmtPrice(item.unit_price_eur)} €</p>
              </div>
            ))}
            {remainingCount > 0 && (
              <p className="text-[11px] text-[#5A7064] font-mono italic">+ {remainingCount} autre{remainingCount > 1 ? 's' : ''} article{remainingCount > 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Price breakdown */}
          <div className="sm:w-52 sm:border-l sm:border-[#17402C]/5 sm:pl-5 space-y-2 text-xs">
            <div className="flex justify-between font-mono">
              <span className="text-[#5A7064]">Sous-total</span>
              <span className="font-bold text-[#17402C]">{fmtPrice(Number(order.subtotal_eur))} €</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-[#5A7064]">Livraison</span>
              <span className="font-bold text-[#17402C]">{Number(order.shipping_eur) === 0 ? 'Offerte' : fmtPrice(Number(order.shipping_eur)) + ' €'}</span>
            </div>
            {fidDiscount > 0 && (
              <div className="flex justify-between font-mono">
                <span className="text-[#5A7064]">Fidélité Guide (-15%)</span>
                <span className="font-bold text-[#5B7F55]">-{fmtPrice(fidDiscount)} €</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[#17402C]/10 font-mono">
              <span className="font-bold text-[#17402C]">Total</span>
              <span className="font-bold text-base text-[#17402C]">{fmtPrice(Number(order.total_eur))} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-4 border-t border-[#17402C]/5">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-[14px] left-[5%] right-[5%] h-0.5 bg-[#17402C]/10" />
          <div
            className="absolute top-[14px] left-[5%] h-0.5 bg-[#17402C] transition-all duration-500"
            style={{ width: `${Math.min(statusIdx / 3 * 90, 90)}%` }}
          />

          {steps.map((step, i) => {
            const isDone = i <= statusIdx;
            const isCurrent = i === statusIdx;
            return (
              <div key={step} className="flex flex-col items-center relative z-10 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? 'bg-[#17402C] text-white'
                    : 'bg-white text-[#5A7064] border border-[#17402C]/20'
                } ${isCurrent ? 'ring-2 ring-[#5B7F55] ring-offset-2 ring-offset-white' : ''}`}>
                  {isDone ? (
                    <Icon name="CheckIcon" size={14} />
                  ) : (
                    <span className="text-[10px] font-mono">{i + 1}</span>
                  )}
                </div>
                <span className={`text-[10px] font-bold mt-1.5 ${isDone ? 'text-[#17402C]' : 'text-[#5A7064]'}`}>
                  {step}
                </span>
                <span className="text-[9px] text-[#5A7064] font-mono">{stepDates[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-3.5 flex items-center justify-end gap-2 border-t border-[#17402C]/5 bg-white/40">
        {order.derivedStatus === 'shipped' && (
          <button
            onClick={onTrack}
            className="glass-capsule-btn primary text-xs font-bold !py-1.5 !px-3"
          >
            Suivre le colis
          </button>
        )}
        <button
          onClick={onInvoice}
          className="glass-capsule-btn text-xs font-bold !py-1.5 !px-3"
        >
          Facture PDF
        </button>
        {(order.derivedStatus === 'confirmed' || order.derivedStatus === 'preparing') && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-[#A8443A] hover:bg-[#A8443A]/10 rounded-full text-xs font-bold transition-colors"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

// ── History Order Row ──
function HistoryOrderRow({
  order,
  onInvoice,
  onTrack,
}: {
  order: OrderDB & { derivedStatus: OrderStatus };
  onInvoice: () => void;
  onTrack: () => void;
}) {
  const statusInfo = getStatusLabel(order.derivedStatus);
  const firstItem = order.items[0];
  const itemCount = order.items.length;
  const deliveryDate = new Date(new Date(order.created_at).getTime() + 10 * 86400000);

  return (
    <div className="glass-sub-card p-3 rounded-xl flex items-center gap-4 group">
      {/* Product image */}
      <div className="w-12 h-12 bg-white rounded-xl overflow-hidden shrink-0 border border-[#17402C]/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={firstItem?.image || 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=200&q=80'}
          alt={firstItem?.name || 'Produit'}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#17402C] truncate">
          {firstItem?.name || 'Commande'}
          {itemCount > 1 && <span className="text-[#5A7064] font-normal font-mono"> +{itemCount - 1}</span>}
        </p>
        <p className="text-[11px] text-[#5A7064] font-mono">
          {order.order_number} · passée le {formatDateShort(order.created_at)}
          {order.derivedStatus === 'delivered' && ` · livrée le ${formatDateShort(deliveryDate.toISOString())}`}
        </p>
      </div>

      {/* Price */}
      <span className="font-mono font-bold text-sm text-[#17402C] shrink-0">{fmtPrice(Number(order.total_eur))} €</span>

      {/* Status */}
      <span className={statusInfo.className}>
        {statusInfo.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onInvoice}
          title="Télécharger la facture"
          className="p-1.5 text-[#5A7064] hover:text-[#17402C] hover:bg-white/60 rounded-lg transition-colors"
        >
          <Icon name="ArrowDownTrayIcon" size={14} />
        </button>
        <button
          onClick={onTrack}
          title="Voir le détail"
          className="p-1.5 text-[#5A7064] hover:text-[#17402C] hover:bg-white/60 rounded-lg transition-colors"
        >
          <Icon name="EyeIcon" size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Modals ──

function AddressModal({
  onClose,
  onSave,
  initialData,
}: {
  onClose: () => void;
  onSave: (a: DeliveryAddress) => void;
  initialData?: DeliveryAddress | null;
}) {
  const [formData, setFormData] = useState({
    label: initialData?.label || '',
    name: initialData?.name || '',
    street: initialData?.street || '',
    city: initialData?.city || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label || !formData.street) return;
    onSave({
      id: initialData?.id || `temp-${Date.now()}`,
      label: formData.label,
      name: formData.name || 'Marceline Chevrier',
      street: formData.street,
      city: formData.city,
      isDefault: initialData?.isDefault || false,
    });
  };

  return (
    <div className="glass-modal-overlay">
      <div className="glass-modal max-w-md w-full p-7 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-2xl text-[#17402C]">
            {initialData ? 'Modifier l\'adresse' : 'Ajouter une adresse'}
          </h3>
          <button onClick={onClose} className="p-2 text-[#5A7064] hover:text-[#17402C] transition-colors rounded-full hover:bg-black/5">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Label de l'adresse</label>
            <input
              required
              type="text"
              placeholder="ex: Bureau, Maison de vacances..."
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="glass-input w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Nom complet</label>
            <input
              required
              type="text"
              placeholder="Prénom Nom"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="glass-input w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Adresse</label>
            <input
              required
              type="text"
              placeholder="Numéro, rue, bâtiment..."
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              className="glass-input w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Code postal et Ville</label>
            <input
              required
              type="text"
              placeholder="75000 Paris"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="glass-input w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#17402C]/5">
            <button
              type="button"
              onClick={onClose}
              className="glass-capsule-btn text-xs font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="glass-capsule-btn primary text-xs font-bold"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CardModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (c: PaymentCard) => void;
}) {
  const [formData, setFormData] = useState({ number: '', name: '', expiry: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number || formData.number.length < 4) return;
    const last4 = formData.number.slice(-4);

    let brand = 'VISA';
    if (formData.number.startsWith('5')) brand = 'MASTERCARD';
    if (formData.number.startsWith('3')) brand = 'AMEX';

    onSave({
      id: `card-${Date.now()}`,
      brand,
      last4,
      holder: formData.name.toUpperCase() || 'TITULAIRE',
      expiry: formData.expiry || '12/28',
    });
  };

  return (
    <div className="glass-modal-overlay">
      <div className="glass-modal max-w-md w-full p-7 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-2xl text-[#17402C]">Ajouter une carte</h3>
          <button onClick={onClose} className="p-2 text-[#5A7064] hover:text-[#17402C] transition-colors rounded-full hover:bg-black/5">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Visual Preview */}
        <div className="w-full aspect-[1.7] bg-gradient-to-br from-[#17402C] to-[#2D5A3D] rounded-2xl p-5 text-white relative overflow-hidden shadow-md border border-white/10">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="w-10 h-7 bg-gradient-to-br from-[#D9D5C4] to-[#B3AE9A] rounded-sm mb-5" />
          <div className="font-mono text-base tracking-[0.15em] mb-4 text-white">
            {formData.number.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim()}
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[8px] font-mono tracking-widest uppercase text-white/50 mb-0.5">Titulaire</p>
              <p className="text-xs font-bold uppercase">{formData.name || 'PRÉNOM NOM'}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-mono tracking-widest uppercase text-white/50 mb-0.5">Expire</p>
              <p className="text-xs font-mono font-bold">{formData.expiry || 'MM/AA'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Numéro de carte</label>
            <input
              required
              type="text"
              maxLength={16}
              placeholder="1234567890123456"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value.replace(/\D/g, '') })}
              className="glass-input w-full font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Date d'exp.</label>
              <input
                required
                type="text"
                placeholder="MM/AA"
                maxLength={5}
                value={formData.expiry}
                onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                className="glass-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">CVC</label>
              <input
                required
                type="text"
                placeholder="123"
                maxLength={4}
                className="glass-input w-full font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-widest text-[#5A7064] uppercase mb-1.5 font-bold">Nom sur la carte</label>
            <input
              required
              type="text"
              placeholder="Marceline Chevrier"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="glass-input w-full uppercase"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#17402C]/5">
            <button
              type="button"
              onClick={onClose}
              className="glass-capsule-btn text-xs font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="glass-capsule-btn primary text-xs font-bold"
            >
              Ajouter la carte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
