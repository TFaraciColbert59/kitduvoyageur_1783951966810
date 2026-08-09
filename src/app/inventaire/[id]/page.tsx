// src/app/inventaire/[id]/page.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  fetchGearItem,
  fetchGearImages,
  fetchItemKits,
  fetchItemLoans,
  fetchItemHistory,
  updateGearItem,
} from '@/lib/supabase/queries';
import { GearItemData, MOCK_INVENTAIRE_ITEMS } from '@/lib/mock/inventaire-marceline';

import ItemHero from '@/components/inventaire/ItemHero';
import TechSpecTable from '@/components/inventaire/TechSpecTable';
import KitsList from '@/components/inventaire/KitsList';
import HistoryTimeline from '@/components/inventaire/HistoryTimeline';
import LoansList from '@/components/inventaire/LoansList';
import NotesEditor from '@/components/inventaire/NotesEditor';
import QuickAddCard from '@/components/inventaire/QuickAddCard';
import LocationCard from '@/components/inventaire/LocationCard';
import EditItemModal from '@/components/inventaire/EditItemModal';
import LendItemModal from '@/components/inventaire/LendItemModal';

export default function GearDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const itemId = (params?.id as string) || 'g-1';

  const supabase = useMemo(() => createClient(), []);

  const [gear, setGear] = useState<GearItemData | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'fiche' | 'kits' | 'history' | 'loans' | 'notes'>('fiche');

  // Modals & Toast State
  const [editOpen, setEditOpen] = useState(false);
  const [lendOpen, setLendOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const userId = user?.id || 'guest';

      try {
        const [itemData, img, kitData, loanData, hist] = await Promise.all([
          fetchGearItem(itemId, userId, supabase),
          fetchGearImages(itemId, supabase),
          fetchItemKits(itemId, supabase),
          fetchItemLoans(itemId, supabase),
          fetchItemHistory(itemId, supabase),
        ]);

        // Fallback to MOCK_INVENTAIRE_ITEMS if itemData is null
        const finalItem = itemData || MOCK_INVENTAIRE_ITEMS.find((g) => g.id === itemId) || MOCK_INVENTAIRE_ITEMS[0];

        setGear(finalItem);
        setImages(img.length > 0 ? img : finalItem.images || [finalItem.image]);
        setKits(kitData);
        setLoans(loanData);
        setHistory(hist);
      } catch (err) {
        console.error('Impossible de charger la fiche article', err);
        // Erreur côté serveur : on retombe sur les données mock pour ne pas
        // bloquer l'utilisateur sur un écran vide.
        const fallbackItem = MOCK_INVENTAIRE_ITEMS.find((g) => g.id === itemId) || MOCK_INVENTAIRE_ITEMS[0];
        setGear(fallbackItem);
        setImages(fallbackItem.images || [fallbackItem.image]);
        setKits([]);
        setLoans([]);
        setHistory([]);
      } finally {
        // Toujours sortir de l'état loading, même si une requête rejette.
        setLoading(false);
      }
    };

    load();
  }, [itemId, user, supabase]);

  const handleSave = async (updated: Partial<GearItemData>) => {
    if (!gear) return;
    setGear((prev) => (prev ? ({ ...prev, ...updated } as GearItemData) : prev));

    if (user) {
      await updateGearItem(gear.id, user.id, updated, supabase);
    }
    showToast('Fiche article mise à jour avec succès');
  };

  const handleToggleFavorite = () => {
    if (!gear) return;
    const nextFav = !gear.is_favorite;
    handleSave({ is_favorite: nextFav });
    showToast(nextFav ? 'Ajouté aux favoris' : 'Retiré des favoris');
  };

  const handleSaveNotes = async (newNotes: string) => {
    await handleSave({ notes: newNotes });
  };

  const handleSaveLoan = async (borrowerName: string, returnDate?: string) => {
    if (!gear) return;
    const updated = {
      loan_status: 'prêté',
      loan_to_name: borrowerName,
    };
    await handleSave(updated);
    showToast(`Matériel prêté à ${borrowerName}`);
  };

  const handleQuickAdd = (newItem: Partial<GearItemData>) => {
    showToast(`"${newItem.name}" a été ajouté à votre inventaire !`);
  };

  // ── DESKTOP CONTENT ──

  const desktopLoading = (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#132219]/20 border-t-[#132219] animate-spin" />
        <p className="text-xs font-semibold text-[#132219]/70">Chargement de la fiche article…</p>
      </div>
    </div>
  );

  const desktopNotFound = (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-extrabold text-[#132219]">Article introuvable</h1>
      <p className="mt-2 text-sm text-[#132219]/60">Cet article n&apos;existe pas ou a été supprimé.</p>
      <button
        onClick={() => router.push('/inventaire')}
        className="mt-6 px-6 py-3 bg-[#132219] text-white rounded-full text-xs font-bold"
      >
        Retour à l&apos;inventaire
      </button>
    </div>
  );

  const desktopGearContent = gear ? (
    <div className="min-h-screen bg-[#FAF8F5] text-[#132219] font-sans pt-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-medium text-[#132219]/60 overflow-x-auto pb-1" aria-label="Breadcrumb">
          <Link href="/compte" className="hover:text-[#132219] transition-colors whitespace-nowrap">Mon compte</Link>
          <span>/</span>
          <Link href="/inventaire" className="hover:text-[#132219] transition-colors whitespace-nowrap">Inventaire</Link>
          <span>/</span>
          <span className="capitalize text-[#132219]/80 font-semibold whitespace-nowrap">
            {gear.category === 'vêtement' ? 'Vêtements techniques' : gear.category}
          </span>
          <span>/</span>
          <span className="text-[#132219] font-bold truncate">{gear.name}</span>
        </nav>

        {/* Hero */}
        <ItemHero
          item={gear}
          onEdit={() => setEditOpen(true)}
          onAddToKit={() => setActiveTab('kits')}
          onLend={() => setLendOpen(true)}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Tabs */}
        <div className="border-b border-[#E8E4D8] overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 sm:gap-6 min-w-max pb-0.5">
            {[
              { id: 'fiche', label: 'Fiche technique' },
              { id: 'kits', label: `Kits associés (3)` },
              { id: 'history', label: `Historique (${gear.history_events?.length || 6})` },
              { id: 'loans', label: 'Prêts & échanges' },
              { id: 'notes', label: 'Notes personnelles' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-3 px-3 text-xs sm:text-sm font-extrabold transition-all relative border-b-2 ${isActive ? 'border-[#132219] text-[#132219]' : 'border-transparent text-[#132219]/60 hover:text-[#132219]'}`}>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
          <div className="lg:col-span-8 space-y-8">
            {activeTab === 'fiche' && (
              <>
                <TechSpecTable item={gear} onEdit={() => setEditOpen(true)} />
                <KitsList kits={kits} />
                <HistoryTimeline events={gear.history_events || history} />
              </>
            )}
            {activeTab === 'kits' && <KitsList kits={kits} />}
            {activeTab === 'history' && <HistoryTimeline events={gear.history_events || history} />}
            {activeTab === 'loans' && (
              <div className="space-y-6">
                <LocationCard locationCity={gear.location_city} loanStatus={gear.loan_status} borrowerName={gear.loan_to_name} attachedPack={gear.attached_backpack} onLend={() => setLendOpen(true)} />
                <LoansList loans={loans} />
              </div>
            )}
            {activeTab === 'notes' && <NotesEditor notes={gear.notes || ''} onSave={handleSaveNotes} />}
          </div>
          <aside className="lg:col-span-4 space-y-8">
            <QuickAddCard onAddSuccess={handleQuickAdd} />
            <NotesEditor notes={gear.notes || ''} onSave={handleSaveNotes} />
            <LocationCard locationCity={gear.location_city} loanStatus={gear.loan_status} borrowerName={gear.loan_to_name} attachedPack={gear.attached_backpack} onLend={() => setLendOpen(true)} />
          </aside>
        </div>
      </main>

      {/* Footer banner */}
      <div className="bg-[#132219] text-white py-16 px-6 mt-20">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-display tracking-tight">
            Un objet bien pesé, un voyage mieux <span className="italic font-serif font-normal text-[#82C39B]">préparé.</span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/60 pt-4 border-t border-white/10">
            <span>© 2026 Le Kit du Voyageur — Fiche article de Marceline</span>
            <span>•</span>
            <Link href="/aide" className="hover:text-white transition-colors">Aide & Support</Link>
            <span>•</span>
            <Link href="/inventaire" className="hover:text-white transition-colors">Retour à l&apos;inventaire</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  ) : null;

  // ── MOBILE LOADING ──

  const mobileLoading = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh', padding: '16px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(11,31,23,0.1)', borderTopColor: '#17402C', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: '13px', color: '#6B7A72', marginTop: '12px' }}>Chargement de la fiche article...</p>
    </div>
  );

  const mobileNotFound = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh', padding: '16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Article introuvable</h1>
      <p style={{ fontSize: '14px', color: '#6B7A72', marginBottom: '20px' }}>Cet article n&apos;existe pas ou a ete supprime.</p>
      <button onClick={() => router.push('/inventaire')}
        style={{ padding: '12px 24px', background: '#17402C', color: '#fff', borderRadius: '20px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
        Retour a l&apos;inventaire
      </button>
    </div>
  );

  const mobileGearContent = gear ? (
    <div>
      {/* Simple breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7A72', padding: '12px 16px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <Link href="/inventaire" style={{ color: '#6B7A72', textDecoration: 'none' }}>Inventaire</Link>
        <span>/</span>
        <span style={{ color: '#1C2620', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gear.name}</span>
      </div>

      {/* Compact hero */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '100px', height: '120px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#E8E4D8' }}>
            <img src={images[0] || gear.image} alt={gear.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1C2620', margin: '0 0 4px 0', lineHeight: 1.2 }}>{gear.name}</h1>
            {gear.brand && <p style={{ fontSize: '12px', color: '#6B7A72', margin: '0 0 8px 0' }}>{gear.brand} {gear.model}</p>}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {gear.weight_g > 0 && <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: '#EDF3ED', color: '#17402C', fontFamily: 'ui-monospace, monospace' }}>{gear.weight_g}g</span>}
              <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', background: '#F4F1EA', color: '#6B7A72' }}>{gear.condition}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => setEditOpen(true)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: '#17402C', color: '#fff', border: 'none', cursor: 'pointer' }}>Modifier</button>
              <button onClick={() => setLendOpen(true)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: '#F4F1EA', color: '#6B7A72', border: '1px solid rgba(11,31,23,0.06)', cursor: 'pointer' }}>Preter</button>
              <button onClick={handleToggleFavorite} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: 'transparent', color: '#6B7A72', border: '1px solid rgba(11,31,23,0.06)', cursor: 'pointer' }}>
                {gear.is_favorite ? '★' : '☆'}
              </button>
            </div>
          </div>
        </div>

        {/* Quick specs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Poids', value: gear.weight_g > 0 ? `${gear.weight_g}g` : '—' },
            { label: 'Prix', value: gear.purchase_price > 0 ? `${gear.purchase_price}€` : '—' },
            { label: 'Etat', value: gear.condition || '—' },
            { label: 'Quantite', value: String(gear.quantity || 1) },
          ].map((s) => (
            <div key={s.label} style={{ padding: '10px', borderRadius: '8px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.06)' }}>
              <p style={{ fontSize: '9px', color: '#6B7A72', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>{s.label}</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620', margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {[
            { id: 'fiche', label: 'Fiche' },
            { id: 'kits', label: 'Kits' },
            { id: 'history', label: 'Historique' },
            { id: 'loans', label: 'Prets' },
            { id: 'notes', label: 'Notes' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: activeTab === tab.id ? '#17402C' : '#F4F1EA',
                color: activeTab === tab.id ? '#fff' : '#6B7A72',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'fiche' && (
          <div>
            <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#F4F1EA', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Fiche technique</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {gear.brand && <div><span style={{ fontSize: '11px', color: '#6B7A72' }}>Marque</span><p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', margin: '2px 0 0 0' }}>{gear.brand}</p></div>}
                {gear.model && <div><span style={{ fontSize: '11px', color: '#6B7A72' }}>Modele</span><p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', margin: '2px 0 0 0' }}>{gear.model}</p></div>}
                {gear.purchase_date && <div><span style={{ fontSize: '11px', color: '#6B7A72' }}>Date d&apos;achat</span><p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', margin: '2px 0 0 0' }}>{new Date(gear.purchase_date).toLocaleDateString('fr-FR')}</p></div>}
                <div><span style={{ fontSize: '11px', color: '#6B7A72' }}>Categorie</span><p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', margin: '2px 0 0 0', textTransform: 'capitalize' }}>{gear.category}</p></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kits' && (
          <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#F4F1EA', textAlign: 'center', color: '#6B7A72', fontSize: '13px' }}>
            {kits.length > 0 ? `${kits.length} kit(s) associé(s)` : 'Aucun kit associé'}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#F4F1EA', textAlign: 'center', color: '#6B7A72', fontSize: '13px' }}>
            {(gear.history_events?.length || history.length) > 0
              ? `${gear.history_events?.length || history.length} evenement(s)`
              : 'Aucun historique'}
          </div>
        )}

        {activeTab === 'loans' && (
          <div>
            <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#F4F1EA', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#6B7A72', margin: '0 0 2px 0' }}>Statut du pret</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620', margin: 0 }}>
                    {gear.loan_status === 'prêté' ? `Prete a ${gear.loan_to_name || '...'}` : 'Disponible'}
                  </p>
                </div>
                <button onClick={() => setLendOpen(true)} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#EDF3ED', color: '#17402C', border: 'none', cursor: 'pointer' }}>
                  {gear.loan_status === 'prêté' ? 'Modifier' : 'Preter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            <textarea
              defaultValue={gear.notes || ''}
              onBlur={(e) => handleSaveNotes(e.target.value)}
              placeholder="Ajoutez une note personnelle..."
              style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', background: '#F4F1EA', color: '#1C2620', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ── RENDER ──

  // Determine state
  const showLoading = loading;
  const showNotFound = !loading && !gear;
  const showGear = !loading && gear;

  const desktopRender = showLoading ? desktopLoading : showNotFound ? desktopNotFound : showGear ? desktopGearContent : null;

  const mobileRender = showLoading ? mobileLoading : showNotFound ? mobileNotFound : showGear ? (
    <MobilePageShell>
      {mobileGearContent}
    </MobilePageShell>
  ) : null;

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        {desktopRender}
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        {mobileRender}
      </div>

      {/* Shared Modals & Toasts */}
      <EditItemModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        initialItem={gear}
        onSave={handleSave}
      />

      <LendItemModal
        isOpen={lendOpen}
        onClose={() => setLendOpen(false)}
        item={gear as any}
        onSaveLoan={handleSaveLoan}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#132219] text-white text-xs font-bold px-6 py-3 rounded-full shadow-2xl border border-white/10 animate-bounce">
          {toast}
        </div>
      )}
    </>
  );
}
