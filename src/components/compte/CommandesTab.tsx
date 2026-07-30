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

function getStatusLabel(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'confirmed': return { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
    case 'preparing': return { label: 'En préparation', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    case 'shipped': return { label: 'Expédiée', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    case 'delivered': return { label: 'Livrée', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    case 'cancelled': return { label: 'Annulée', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
    case 'refunded': return { label: 'Remboursée', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    default: return { label: status, color: 'text-[#5C6B5E]', bg: 'bg-[#EDEAE0] border-[#C8C3B0]' };
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

      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (user) {
        query = query.eq('user_id', user.id);
      }

      const { data } = await query;

      if (data && data.length > 0) {
        setOrders(data as OrderDB[]);
      } else {
        // Fallback: load ALL orders for demo if not logged in or no orders
        const { data: allOrders } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (allOrders) setOrders(allOrders as OrderDB[]);
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
  const activeOrders = enrichedOrders.filter(o => o.derivedStatus !== 'delivered' && o.derivedStatus !== 'cancelled' && o.derivedStatus !== 'refunded');
  
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

  // Function to seed fake orders for testing
  const seedFakeOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('Erreur: Vous devez être connecté pour générer des commandes sur votre compte.');
      return;
    }

    setLoading(true);
    
    // Create some fake data resembling recent purchases
    const newOrders = [
      {
        user_id: user.id,
        order_number: `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: 'confirmed',
        payment_method: 'card',
        shipping_address: { city: "Paris", street: "10 rue Fake" },
        items: [
          { name: "Veste Gore-Tex Arc'teryx Beta AR", slug: "veste-impermeable-001", quantity: 1, unit_price_eur: 389, size: "M", color: "Noir" }
        ],
        subtotal_eur: 389,
        shipping_eur: 0,
        total_eur: 389,
        loyalty_points_earned: 3890,
        notes: "Généré automatiquement"
      },
      {
        user_id: user.id,
        order_number: `KDV-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: 'confirmed', // will be converted to preparing based on created_at override
        payment_method: 'paypal',
        shipping_address: { city: "Paris", street: "10 rue Fake" },
        items: [
          { name: "Frontale Petzl NAO RL 1500 lm", slug: "lampe-frontale-001", quantity: 1, unit_price_eur: 189, sku: "PZ-NAO-1500" }
        ],
        subtotal_eur: 189,
        shipping_eur: 5.9,
        total_eur: 194.9,
        loyalty_points_earned: 1890,
        notes: "Généré automatiquement",
        created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() // 4 days ago -> Preparing
      },
      {
        user_id: user.id,
        order_number: `KDV-2025-${Math.floor(Math.random() * 9000 + 1000)}`,
        status: 'confirmed', // will be delivered because it's old
        payment_method: 'card',
        shipping_address: { city: "Paris", street: "10 rue Fake" },
        items: [
          { name: "Chaussures Salomon Quest 4 GTX", slug: "salomon-x-ultra-4", quantity: 1, unit_price_eur: 219, size: "43" }
        ],
        subtotal_eur: 219,
        shipping_eur: 0,
        total_eur: 219,
        loyalty_points_earned: 2190,
        notes: "Généré automatiquement",
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() // 40 days ago -> Delivered
      }
    ];

    const { error } = await supabase.from('orders').insert(newOrders);
    
    if (error) {
      console.error(error);
      showToast('Erreur lors de la génération.');
      setLoading(false);
    } else {
      showToast('3 fausses commandes ajoutées à votre compte !');
      fetchOrders(); // reload
    }
  };

  // ─── loading skeleton ─────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-[#E8E4D8] h-48 animate-pulse" />
          ))}
        </div>
        <div className="lg:col-span-4 space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-[#E8E4D8] h-52 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ════════════════ MAIN COLUMN ════════════════ */}
        <div className="lg:col-span-8 space-y-8">

          {/* ── Header ── */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-1">
              <div>
                <h2 className="font-display font-800 text-3xl text-[#1C2620] leading-tight">
                  Commandes <em className="font-serif font-normal not-italic text-[#5C6B5E]">& abonnements</em>
                </h2>
                <p className="text-sm text-[#5C6B5E] mt-1">
                  {enrichedOrders.length} commandes depuis 2023 · {activeOrders.length} en cours · 1 abonnement premium actif · {fmtPrice(totalCumule)}&nbsp;€ cumulés.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleDownloadAllInvoices}
                  className="flex items-center gap-2 px-4 py-2.5 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/40 rounded-full text-xs font-700 transition-all"
                >
                  <Icon name="ArrowDownTrayIcon" size={14} />
                  Factures {currentYear}
                </button>
                <button
                  onClick={handleContactSAV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1C2620] hover:bg-[#2A3830] text-white rounded-full text-xs font-700 transition-all shadow-md hover:shadow-lg"
                >
                  Contacter le SAV
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill label={`Commandes ${currentYear}`} value={yearOrders.length} sub={`${activeOrders.length} en cours · ${enrichedOrders.filter(o => o.derivedStatus === 'delivered').length} livrées`} />
            <StatPill label="Total cumulé" value={`${fmtPrice(totalCumule)} €`} sub={`Sur 3 ans · ${fmtPrice(totalEconomies)} € économisés (livrais.)`} />
            <StatPill label="Panier moyen" value={`${fmtPrice(Math.round(panierMoyen))} €`} sub={`1 198 € en 2025`} />
            <StatPill label="Prochaine facture" value="89 €" sub="Abonnement Guide · 4 fév. 2027" />
          </div>

          {/* ── Active Orders ── */}
          {activeOrders.length > 0 && activeOrders.map(order => (
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
            <div className="bg-white border border-dashed border-[#C8C3B0] rounded-2xl p-8 text-center">
              <p className="text-2xl mb-2">📦</p>
              <h4 className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucune commande en cours</h4>
              <p className="text-xs text-[#9CA89E]">Toutes vos commandes ont été livrées.</p>
            </div>
          )}
          
          <button 
            onClick={seedFakeOrders}
            className="w-full py-3 bg-[#EBE8DD] text-[#5C6B5E] hover:text-[#1C2620] hover:bg-[#E2DFD3] rounded-xl text-sm font-600 transition-colors border border-transparent hover:border-[#C8C3B0] flex items-center justify-center gap-2"
          >
            <Icon name="SparklesIcon" size={16} />
            Générer de fausses commandes sur mon compte (Debug)
          </button>

          {/* ── Historique ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display font-700 text-xl text-[#1C2620]">
                Historique <em className="font-serif font-normal not-italic">{historyYear !== 'Toutes' ? historyYear : ''}</em>
              </h3>
              <div className="flex items-center gap-1 bg-[#EDEAE0] rounded-full p-1">
                {['2026', '2025', '2024', 'Toutes'].map(year => (
                  <button
                    key={year}
                    onClick={() => setHistoryYear(year)}
                    className={`px-3 py-1.5 rounded-full text-xs font-600 transition-all whitespace-nowrap ${
                      historyYear === year
                        ? 'bg-white text-[#1C2620] shadow-sm'
                        : 'text-[#9CA89E] hover:text-[#5C6B5E]'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-[#9CA89E] mb-5">
              Vos commandes livrées cette année.
            </p>

            {historyOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-sm text-[#9CA89E]">Aucune commande pour cette période.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E4D8]">
                {historyOrders.slice(0, 6).map(order => (
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
              <div className="text-center mt-5">
                <button className="text-xs text-[#5C6B5E] hover:text-[#1C2620] font-600 transition-colors border border-[#C8C3B0] hover:border-[#1C2620]/30 px-6 py-2.5 rounded-full">
                  Voir les {historyOrders.length - 6} commandes plus anciennes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════ SIDEBAR ════════════════ */}
        <div className="lg:col-span-4 space-y-5">

          {/* ── Guide annuel Card ── */}
          <div className="bg-[#1C2620] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-700/30 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/50 mb-1">Guide annuel</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-800 text-4xl text-white">89</span>
                  <span className="text-white/60 text-sm font-600">€ / an</span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-700 rounded-full uppercase tracking-wider border border-emerald-500/30">
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
                <li key={i} className="flex items-center gap-2 text-xs text-white/80">
                  <Icon name="CheckIcon" size={12} className="text-emerald-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-white/40 mb-4 relative z-10">
              Renouvellement automatique le <strong className="text-white/60">4 février 2027</strong> · CB Visa ••{cards.length > 0 ? cards[0].last4 : '4291'}
            </p>

            <div className="flex items-center gap-2 relative z-10">
              <button
                onClick={() => showToast('Gestion de l\'abonnement...')}
                className="flex-1 px-4 py-2.5 border border-white/20 hover:border-white/40 text-white rounded-full text-xs font-700 transition-all text-center"
              >
                Gérer l&apos;abonnement
              </button>
              <button
                onClick={handleDownloadAllInvoices}
                className="px-4 py-2.5 border border-white/20 hover:border-white/40 text-white rounded-full text-xs font-700 transition-all"
              >
                Factures
              </button>
            </div>
          </div>

          {/* ── Adresses de livraison ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-2xl p-5">
            <h4 className="font-display font-700 text-[#1C2620] text-base mb-0.5">
              Adresses <em className="font-serif font-normal not-italic">de livraison</em>
            </h4>
            <p className="text-[11px] text-[#9CA89E] mb-4">
              {addresses.length} adresse{addresses.length !== 1 ? 's' : ''} enregistrée{addresses.length !== 1 ? 's' : ''}.
            </p>

            <div className="space-y-3">
              {addresses.map(addr => (
                <div
                  key={addr.id}
                  className={`rounded-xl p-4 border transition-colors ${
                    addr.isDefault
                      ? 'bg-[#FFF9F0] border-[#17402C]/20'
                      : 'bg-[#FAFAF7] border-[#E8E4D8]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-700 text-sm text-[#1C2620]">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 bg-[#17402C] text-white text-[9px] font-700 rounded-full uppercase tracking-wider">
                        défaut
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C6B5E] font-600">{addr.name}</p>
                  <p className="text-xs text-[#9CA89E]">{addr.street}</p>
                  {addr.city && <p className="text-xs text-[#9CA89E]">{addr.city}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => {
                        setAddressToEdit(addr);
                        setShowAddressModal(true);
                      }}
                      className="text-[11px] text-[#5C6B5E] hover:text-[#1C2620] font-600 underline-offset-2 hover:underline transition-colors"
                    >
                      Modifier
                    </button>
                    {addr.isDefault ? (
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-[11px] text-[#9CA89E] hover:text-red-500 font-600 underline-offset-2 hover:underline transition-colors"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="text-[11px] text-[#5C6B5E] hover:text-[#17402C] font-600 underline-offset-2 hover:underline transition-colors"
                      >
                        Définir par défaut
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {addresses.length === 0 && (
                <div className="py-4 text-center text-[#9CA89E] text-xs bg-[#FAFAF7] rounded-xl border border-[#E8E4D8] border-dashed">
                  Aucune adresse enregistrée.
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setAddressToEdit(null);
                setShowAddressModal(true);
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-[#C8C3B0] hover:border-[#1C2620]/40 text-[#5C6B5E] hover:text-[#1C2620] rounded-xl text-xs font-600 transition-all"
            >
              <Icon name="PlusIcon" size={13} />
              Ajouter une adresse
            </button>
          </div>

          {/* ── Moyens de paiement ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-2xl p-5">
            <h4 className="font-display font-700 text-[#1C2620] text-base mb-0.5">
              Moyens <em className="font-serif font-normal not-italic">de paiement</em>
            </h4>
            <p className="text-[11px] text-[#9CA89E] mb-4">
              {cards.length} carte{cards.length !== 1 ? 's' : ''} enregistrée{cards.length !== 1 ? 's' : ''}.
            </p>

            <div className="space-y-4 mb-4">
              {cards.map(card => (
                <div key={card.id} className="w-full aspect-[1.7] bg-gradient-to-br from-[#1C2620] to-[#0A100C] rounded-2xl p-5 text-white relative overflow-hidden">
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
                      <p className="text-[8px] font-mono tracking-widest uppercase text-white/40 mb-0.5">Titulaire</p>
                      <p className="text-xs font-600 uppercase">{card.holder}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-mono tracking-widest uppercase text-white/40 mb-0.5">Expire</p>
                      <p className="text-xs font-600 font-mono">{card.expiry.replace('Exp. ', '')}</p>
                    </div>
                    <div className="text-xl font-bold italic text-white/80">{card.brand}</div>
                  </div>
                </div>
              ))}
              
              {cards.length === 0 && (
                <div className="py-4 text-center text-[#9CA89E] text-xs bg-[#FAFAF7] rounded-xl border border-[#E8E4D8] border-dashed">
                  Aucune carte enregistrée.
                </div>
              )}
            </div>

            <button
              onClick={() => setShowCardModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-[#C8C3B0] hover:border-[#1C2620]/40 text-[#5C6B5E] hover:text-[#1C2620] rounded-xl text-xs font-600 transition-all"
            >
              <Icon name="PlusIcon" size={13} />
              Ajouter une carte
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
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-[#1C2620] text-white px-6 py-3 rounded-full text-xs font-extrabold shadow-2xl animate-fade-in-up flex items-center gap-2 border border-white/20">
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
    <div className="bg-white border border-[#E8E4D8] rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#9CA89E]">{label}</p>
      <p className="font-display font-800 text-3xl text-[#1C2620] leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#9CA89E] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Active Order Card ──
function ActiveOrderCard({
  order, onTrack, onInvoice, onCancel,
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

  // Show only first 2 items in the card
  const displayItems = order.items.slice(0, 2);
  const remainingCount = order.items.length - 2;

  const fidDiscount = Number(order.total_eur) > 200 ? Number(order.subtotal_eur) * 0.15 : 0;

  return (
    <div className="bg-white border border-[#E8E4D8] rounded-2xl overflow-hidden">
      {/* Order header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#E8E4D8] bg-[#FAFAF7]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-600 text-[#9CA89E]">{order.order_number}</span>
          <span className="text-[#C8C3B0]">·</span>
          <span className="text-xs text-[#9CA89E]">Passée le {formatDate(order.created_at)}</span>
        </div>
        <span className={`px-3 py-1 text-[10px] font-700 rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Items */}
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Products */}
          <div className="flex-1 space-y-3">
            {displayItems.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#EDEAE0] rounded-xl overflow-hidden flex-shrink-0 border border-[#E8E4D8]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image || '/assets/images/no_image.png'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-[#1C2620] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#9CA89E]">
                    {item.size && `Taille ${item.size} · `}
                    {item.color && `${item.color} · `}
                    {item.sku && `SKU · ${item.sku}`}
                    {!item.size && !item.color && !item.sku && `Qté: ${item.quantity}`}
                  </p>
                </div>
                <p className="font-600 text-sm text-[#1C2620] flex-shrink-0">{fmtPrice(item.unit_price_eur)} €</p>
              </div>
            ))}
            {remainingCount > 0 && (
              <p className="text-[11px] text-[#9CA89E] italic">+ {remainingCount} autre{remainingCount > 1 ? 's' : ''} article{remainingCount > 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Price breakdown */}
          <div className="sm:w-48 sm:border-l sm:border-[#E8E4D8] sm:pl-5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#9CA89E]">Sous-total</span>
              <span className="font-600 text-[#1C2620]">{fmtPrice(Number(order.subtotal_eur))} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA89E]">Livraison</span>
              <span className="font-600 text-[#1C2620]">{Number(order.shipping_eur) === 0 ? 'Offerte' : fmtPrice(Number(order.shipping_eur)) + ' €'}</span>
            </div>
            {fidDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA89E]">Fidélité Guide (-15%)</span>
                <span className="font-600 text-emerald-600">-{fmtPrice(fidDiscount)} €</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[#E8E4D8]">
              <span className="font-700 text-[#1C2620]">Total</span>
              <span className="font-800 text-lg text-[#1C2620]">{fmtPrice(Number(order.total_eur))} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-4 border-t border-[#E8E4D8]">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-[14px] left-[5%] right-[5%] h-0.5 bg-[#EDEAE0]" />
          <div
            className="absolute top-[14px] left-[5%] h-0.5 bg-[#1C2620] transition-all duration-500"
            style={{ width: `${Math.min(statusIdx / 3 * 90, 90)}%` }}
          />
          
          {steps.map((step, i) => {
            const isDone = i <= statusIdx;
            const isCurrent = i === statusIdx;
            return (
              <div key={step} className="flex flex-col items-center relative z-10 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? 'bg-[#1C2620] text-white'
                    : 'bg-[#EDEAE0] text-[#9CA89E]'
                } ${isCurrent ? 'ring-2 ring-[#17402C]/40 ring-offset-2 ring-offset-white' : ''}`}>
                  {isDone ? (
                    <Icon name="CheckIcon" size={14} />
                  ) : (
                    <span className="text-[10px] font-mono">{i + 1}</span>
                  )}
                </div>
                <span className={`text-[10px] font-600 mt-1.5 ${isDone ? 'text-[#1C2620]' : 'text-[#9CA89E]'}`}>
                  {step}
                </span>
                <span className="text-[9px] text-[#9CA89E] font-mono">{stepDates[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-3 flex items-center justify-end gap-2 border-t border-[#E8E4D8] bg-[#FAFAF7]">
        {order.derivedStatus === 'shipped' && (
          <button
            onClick={onTrack}
            className="px-4 py-2 border border-[#1C2620] text-[#1C2620] hover:bg-[#1C2620] hover:text-white rounded-full text-xs font-700 transition-all"
          >
            Suivre le colis
          </button>
        )}
        <button
          onClick={onInvoice}
          className="px-4 py-2 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/40 rounded-full text-xs font-600 transition-all"
        >
          Facture PDF
        </button>
        {(order.derivedStatus === 'confirmed' || order.derivedStatus === 'preparing') && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[#17402C] hover:text-red-600 text-xs font-600 transition-colors"
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
  order, onInvoice, onTrack,
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
    <div className="flex items-center gap-4 py-4 group">
      {/* Product image */}
      <div className="w-12 h-12 bg-[#EDEAE0] rounded-xl overflow-hidden flex-shrink-0 border border-[#E8E4D8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={firstItem?.image || 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=200&q=80'}
          alt={firstItem?.name || 'Produit'}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-600 text-[#1C2620] truncate group-hover:text-[#17402C] transition-colors">
          {firstItem?.name || 'Commande'}
          {itemCount > 1 && <span className="text-[#9CA89E] font-normal"> +{itemCount - 1}</span>}
        </p>
        <p className="text-[11px] text-[#9CA89E]">
          {order.order_number} · passée le {formatDateShort(order.created_at)}
          {order.derivedStatus === 'delivered' && ` · livrée le ${formatDateShort(deliveryDate.toISOString())}`}
        </p>
      </div>

      {/* Price */}
      <span className="font-600 text-sm text-[#1C2620] flex-shrink-0">{fmtPrice(Number(order.total_eur))} €</span>

      {/* Status */}
      <span className={`px-2.5 py-1 text-[10px] font-700 rounded-full border flex-shrink-0 ${statusInfo.bg} ${statusInfo.color}`}>
        {statusInfo.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onInvoice}
          title="Télécharger la facture"
          className="p-1.5 text-[#9CA89E] hover:text-[#1C2620] hover:bg-[#EDEAE0] rounded-lg transition-colors"
        >
          <Icon name="ArrowDownTrayIcon" size={14} />
        </button>
        <button
          onClick={onTrack}
          title="Voir le détail"
          className="p-1.5 text-[#9CA89E] hover:text-[#1C2620] hover:bg-[#EDEAE0] rounded-lg transition-colors"
        >
          <Icon name="EyeIcon" size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Modals ──

function AddressModal({ onClose, onSave, initialData }: { onClose: () => void, onSave: (a: DeliveryAddress) => void, initialData?: DeliveryAddress | null }) {
  const [formData, setFormData] = useState({ 
    label: initialData?.label || '', 
    name: initialData?.name || '', 
    street: initialData?.street || '', 
    city: initialData?.city || '' 
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
      isDefault: initialData?.isDefault || false
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2620]/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#F5F3ED] rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-[#9CA89E] hover:text-[#1C2620] transition-colors rounded-full hover:bg-black/5">
          <Icon name="XMarkIcon" size={20} />
        </button>
        <h3 className="font-display font-800 text-2xl text-[#1C2620] mb-6">
          {initialData ? 'Modifier l\'adresse' : 'Ajouter une adresse'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Label de l'adresse</label>
            <input required type="text" placeholder="ex: Bureau, Maison de vacances..." value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]" />
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Nom complet</label>
            <input required type="text" placeholder="Prénom Nom" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]" />
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Adresse</label>
            <input required type="text" placeholder="Numéro, rue, bâtiment..." value={formData.street} onChange={e => setFormData({ ...formData, street: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]" />
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Code postal et Ville</label>
            <input required type="text" placeholder="75000 Paris" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620]" />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-[#5C6B5E] hover:text-[#1C2620] text-sm font-600 transition-colors">
              Annuler
            </button>
            <button type="submit" className="px-5 py-2.5 bg-[#1C2620] hover:bg-[#2A3830] text-white rounded-xl text-sm font-600 transition-colors">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CardModal({ onClose, onSave }: { onClose: () => void, onSave: (c: PaymentCard) => void }) {
  const [formData, setFormData] = useState({ number: '', name: '', expiry: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number || formData.number.length < 4) return;
    const last4 = formData.number.slice(-4);
    
    // Determine basic brand logic for visual effect
    let brand = 'VISA';
    if (formData.number.startsWith('5')) brand = 'MASTERCARD';
    if (formData.number.startsWith('3')) brand = 'AMEX';

    onSave({
      id: `card-${Date.now()}`,
      brand,
      last4,
      holder: formData.name.toUpperCase() || 'TITULAIRE',
      expiry: formData.expiry || '12/28'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2620]/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#F5F3ED] rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-[#9CA89E] hover:text-[#1C2620] transition-colors rounded-full hover:bg-black/5">
          <Icon name="XMarkIcon" size={20} />
        </button>
        <h3 className="font-display font-800 text-2xl text-[#1C2620] mb-6">Ajouter une carte</h3>
        
        {/* Visual Preview */}
        <div className="w-full aspect-[1.7] bg-gradient-to-br from-[#1C2620] to-[#0A100C] rounded-2xl p-5 text-white relative overflow-hidden mb-6 shadow-md">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="w-10 h-7 bg-gradient-to-br from-[#D9D5C4] to-[#B3AE9A] rounded-sm mb-5" />
          <div className="font-mono text-base tracking-[0.15em] mb-4 text-white">
            {formData.number.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim()}
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[8px] font-mono tracking-widest uppercase text-white/40 mb-0.5">Titulaire</p>
              <p className="text-xs font-600 uppercase">{formData.name || 'PRÉNOM NOM'}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-mono tracking-widest uppercase text-white/40 mb-0.5">Expire</p>
              <p className="text-xs font-600 font-mono">{formData.expiry || 'MM/AA'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Numéro de carte</label>
            <input required type="text" maxLength={16} placeholder="1234567890123456" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value.replace(/\D/g,'') })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Date d'exp.</label>
              <input required type="text" placeholder="MM/AA" maxLength={5} value={formData.expiry} onChange={e => setFormData({ ...formData, expiry: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] font-mono" />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">CVC</label>
              <input required type="text" placeholder="123" maxLength={4} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono tracking-wider text-[#5C6B5E] uppercase mb-1.5">Nom sur la carte</label>
            <input required type="text" placeholder="Marceline Chevrier" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-white border border-[#E8E4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#1C2620] uppercase" />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-[#5C6B5E] hover:text-[#1C2620] text-sm font-600 transition-colors">
              Annuler
            </button>
            <button type="submit" className="px-5 py-2.5 bg-[#1C2620] hover:bg-[#2A3830] text-white rounded-xl text-sm font-600 transition-colors">
              Ajouter la carte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
