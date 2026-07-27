// src/app/inventaire/[id]/page.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#132219]/20 border-t-[#132219] animate-spin" />
          <p className="text-xs font-semibold text-[#132219]/70">Chargement de la fiche article…</p>
        </div>
      </div>
    );
  }

  if (!gear) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-extrabold text-[#132219]">Article introuvable</h1>
        <p className="mt-2 text-sm text-[#132219]/60">Cet article n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => router.push('/inventaire')}
          className="mt-6 px-6 py-3 bg-[#132219] text-white rounded-full text-xs font-bold"
        >
          Retour à l'inventaire
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#132219] font-sans pt-20">
      {/* Site Header Navigation */}
      <Header />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 space-y-6">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs font-medium text-[#132219]/60 overflow-x-auto pb-1" aria-label="Breadcrumb">
          <Link href="/compte" className="hover:text-[#132219] transition-colors whitespace-nowrap">
            Mon compte
          </Link>
          <span>/</span>
          <Link href="/inventaire" className="hover:text-[#132219] transition-colors whitespace-nowrap">
            Inventaire
          </Link>
          <span>/</span>
          <span className="capitalize text-[#132219]/80 font-semibold whitespace-nowrap">
            {gear.category === 'vêtement' ? 'Vêtements techniques' : gear.category}
          </span>
          <span>/</span>
          <span className="text-[#132219] font-bold truncate">{gear.name}</span>
        </nav>

        {/* Hero Product Fiche Card */}
        <ItemHero
          item={gear}
          onEdit={() => setEditOpen(true)}
          onAddToKit={() => setActiveTab('kits')}
          onLend={() => setLendOpen(true)}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Tab Navigation Bar */}
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
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-3 px-3 text-xs sm:text-sm font-extrabold transition-all relative border-b-2 ${
                    isActive
                      ? 'border-[#132219] text-[#132219]'
                      : 'border-transparent text-[#132219]/60 hover:text-[#132219]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
          
          {/* Left Column (65% width) */}
          <div className="lg:col-span-8 space-y-8">
            {activeTab === 'fiche' && (
              <>
                <TechSpecTable item={gear} onEdit={() => setEditOpen(true)} />
                <KitsList kits={kits} />
                <HistoryTimeline events={gear.history_events || history} />
              </>
            )}

            {activeTab === 'kits' && (
              <KitsList kits={kits} />
            )}

            {activeTab === 'history' && (
              <HistoryTimeline events={gear.history_events || history} />
            )}

            {activeTab === 'loans' && (
              <div className="space-y-6">
                <LocationCard
                  locationCity={gear.location_city}
                  loanStatus={gear.loan_status}
                  borrowerName={gear.loan_to_name}
                  attachedPack={gear.attached_backpack}
                  onLend={() => setLendOpen(true)}
                />
                <LoansList loans={loans} />
              </div>
            )}

            {activeTab === 'notes' && (
              <NotesEditor notes={gear.notes || ''} onSave={handleSaveNotes} />
            )}
          </div>

          {/* Right Column / Sidebar (35% width) */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Dark Green Quick Add Card matching mockup */}
            <QuickAddCard onAddSuccess={handleQuickAdd} />

            {/* Personal Notes Card */}
            <NotesEditor notes={gear.notes || ''} onSave={handleSaveNotes} />

            {/* Location & Loan Status Card */}
            <LocationCard
              locationCity={gear.location_city}
              loanStatus={gear.loan_status}
              borrowerName={gear.loan_to_name}
              attachedPack={gear.attached_backpack}
              onLend={() => setLendOpen(true)}
            />
          </aside>

        </div>

      </main>

      {/* Premium Footer Slogan Banner */}
      <div className="bg-[#132219] text-white py-16 px-6 mt-20">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-display tracking-tight">
            Un objet bien pesé, un voyage mieux <span className="italic font-serif font-normal text-[#82C39B]">préparé.</span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/60 pt-4 border-t border-white/10">
            <span>© 2026 Le Kit du Voyageur — Fiche article de Marceline</span>
            <span>•</span>
            <Link href="/aide" className="hover:text-white transition-colors">
              Aide & Support
            </Link>
            <span>•</span>
            <Link href="/inventaire" className="hover:text-white transition-colors">
              Retour à l'inventaire
            </Link>
          </div>
        </div>
      </div>

      {/* Main Site Footer */}
      <Footer />

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        initialItem={gear}
        onSave={handleSave}
      />

      {/* Lend Item Modal */}
      <LendItemModal
        isOpen={lendOpen}
        onClose={() => setLendOpen(false)}
        item={gear}
        onSaveLoan={handleSaveLoan}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#132219] text-white text-xs font-bold px-6 py-3 rounded-full shadow-2xl border border-white/10 animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
