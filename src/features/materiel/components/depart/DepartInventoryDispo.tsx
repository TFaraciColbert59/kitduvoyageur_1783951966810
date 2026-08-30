'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Handshake,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  RotateCcw,
  Scale,
  DollarSign,
  Tag,
  Clock,
  User,
  ShieldAlert,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { addInventoryItem } from '@/features/materiel/actions/addInventoryItem';
import { deleteInventoryItem } from '@/features/materiel/actions/deleteInventoryItem';
import { updateLoanStatus } from '@/features/materiel/actions/updateLoanStatus';
import { createLoan } from '@/features/materiel/actions/createLoan';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import type { LoanItem } from '@/features/materiel/services/getLoans';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

interface DepartInventoryDispoProps {
  inventory: InventoryItem[];
  loans: LoanItem[];
  kitItems?: ChecklistItem[];
}

const CATEGORIES = [
  'Toutes',
  'Bivouac',
  'Couchage',
  'Vêtements',
  'Cuisine',
  'Hydratation',
  'Sécurité',
  'Électronique',
  'Hygiène',
  'Autre',
];

const CONDITION_LABELS: Record<string, { label: string; tone: string }> = {
  neuf: { label: 'Neuf', tone: 'bg-emerald-100 text-emerald-800' },
  tres_bon: { label: 'Très bon', tone: 'bg-emerald-50 text-emerald-900 border border-emerald-200' },
  bon: { label: 'Bon état', tone: 'bg-blue-50 text-blue-900 border border-blue-200' },
  moyen: { label: 'Usé', tone: 'bg-amber-50 text-amber-900 border border-amber-200' },
  a_remplacer: { label: 'À remplacer', tone: 'bg-red-100 text-red-800' },
  pour_pieces: { label: 'Pour pièces', tone: 'bg-slate-100 text-slate-700' },
};

export function DepartInventoryDispo({
  inventory: initialInventory,
  loans: initialLoans,
  kitItems = [],
}: DepartInventoryDispoProps) {
  const [subTab, setSubTab] = useState<'inventory' | 'loans'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('Toutes');
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(initialInventory);
  const [loanList, setLoanList] = useState<LoanItem[]>(initialLoans);

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedItemForLoan, setSelectedItemForLoan] = useState<InventoryItem | null>(null);

  // Formulaires
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState('Bivouac');
  const [newWeight, setNewWeight] = useState(250);
  const [newCondition, setNewCondition] = useState('tres_bon');
  const [newPriceEur, setNewPriceEur] = useState<number | ''>('');

  const [borrowerContact, setBorrowerContact] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Statistiques
  const totalWeightG = useMemo(
    () => inventoryList.reduce((acc, i) => acc + (i.weight_g || 0), 0),
    [inventoryList]
  );
  const totalInvestEur = useMemo(
    () => Math.round(inventoryList.reduce((acc, i) => acc + (i.price_cents || 0), 0) / 100),
    [inventoryList]
  );
  const activeLoans = useMemo(
    () => loanList.filter((l) => l.status === 'en_cours' || l.status === 'en_retard'),
    [loanList]
  );
  const availableCount = inventoryList.length - activeLoans.length;

  // Filtrage inventaire
  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      if (selectedCat !== 'Toutes' && item.category !== selectedCat) return false;
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [inventoryList, selectedCat, searchQuery]);

  // Actions
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const optimisticItem: InventoryItem = {
      id: `temp-${Date.now()}`,
      name: newName.trim(),
      brand: newBrand.trim() || null,
      category: newCategory,
      weight_g: Number(newWeight) || 0,
      price_cents: newPriceEur ? Number(newPriceEur) * 100 : null,
      condition: newCondition,
      photo_url: null,
      is_lent: false,
      purchase_date: new Date().toISOString().slice(0, 10),
      maintenance_due_at: null,
      expiry_date: null,
      tags: [],
    };

    setInventoryList((prev) => [optimisticItem, ...prev]);
    setIsAddModalOpen(false);
    setNewName('');
    setNewBrand('');
    setNewPriceEur('');

    const res = await addInventoryItem({
      name: optimisticItem.name,
      brand: optimisticItem.brand || undefined,
      category: optimisticItem.category || 'Autre',
      weightG: optimisticItem.weight_g || 0,
      condition: optimisticItem.condition || 'tres_bon',
      priceCents: optimisticItem.price_cents || undefined,
    });

    if (res.success && res.itemId) {
      setInventoryList((prev) =>
        prev.map((i) => (i.id === optimisticItem.id ? { ...i, id: res.itemId! } : i))
      );
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setInventoryList((prev) => prev.filter((i) => i.id !== itemId));
    await deleteInventoryItem(itemId);
  };

  const handleReturnLoan = async (loanId: string, productOwnershipId?: string | null) => {
    setLoanList((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, status: 'rendu', returned_at: new Date().toISOString() } : l))
    );
    if (productOwnershipId) {
      setInventoryList((prev) =>
        prev.map((i) => (i.id === productOwnershipId ? { ...i, is_lent: false } : i))
      );
    }
    await updateLoanStatus(loanId, 'rendu');
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForLoan || !borrowerContact.trim()) return;

    const optimisticLoan: LoanItem = {
      id: `loan-${Date.now()}`,
      product_ownership_id: selectedItemForLoan.id,
      lender_id: 'me',
      borrower_id: null,
      borrower_contact: borrowerContact.trim(),
      status: 'en_cours',
      loaned_at: new Date().toISOString(),
      due_date: dueDate || null,
      returned_at: null,
    };

    setLoanList((prev) => [optimisticLoan, ...prev]);
    setInventoryList((prev) =>
      prev.map((i) => (i.id === selectedItemForLoan.id ? { ...i, is_lent: true } : i))
    );
    setIsLoanModalOpen(false);
    setBorrowerContact('');
    setDueDate('');

    const res = await createLoan({
      productOwnershipId: selectedItemForLoan.id,
      borrowerContact: optimisticLoan.borrower_contact!,
      dueDate: optimisticLoan.due_date,
    });

    if (res.success && res.loanId) {
      setLoanList((prev) =>
        prev.map((l) => (l.id === optimisticLoan.id ? { ...l, id: res.loanId! } : l))
      );
    }
  };

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="inventory-dispo-heading" className="relative">
      <div className="p-4 sm:p-6 space-y-4">
        {/* ════ HEADER SECTION : TITRE & SWITCHER D'ONGLETS ════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-3.5">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-[#2D6B4A]" aria-hidden="true" />
            <div>
              <h2 id="inventory-dispo-heading" className="text-base sm:text-lg font-bold text-[#17402C]">
                Mon Inventaire & Disponibilité des Prêts
              </h2>
              <p className="text-[11px] text-[#5A7064]">
                Gérez tout votre matériel possédé, suivez vos prêts et prévenez les indisponibilités.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/5 dark:bg-white/10 p-1 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSubTab('inventory')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
                subTab === 'inventory' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#5A7064] hover:text-[#17402C]'
              )}
            >
              <Boxes size={13} />
              <span>Inventaire ({inventoryList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('loans')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
                subTab === 'loans' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#5A7064] hover:text-[#17402C]'
              )}
            >
              <Handshake size={13} />
              <span>Prêts & Dispo ({activeLoans.length})</span>
            </button>
          </div>
        </div>

        {/* ════ KPI STRIP DE L'INVENTAIRE ════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-2xl bg-white/40 border border-white/60 text-center">
            <span className="text-[10px] uppercase font-bold text-[#5A7064] block">Objets au Total</span>
            <span className="text-sm sm:text-base font-mono font-bold text-[#17402C]">{inventoryList.length}</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/40 border border-white/60 text-center">
            <span className="text-[10px] uppercase font-bold text-[#5A7064] block">Disponibles</span>
            <span className="text-sm sm:text-base font-mono font-bold text-[#2D6B4A]">{availableCount}</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/40 border border-white/60 text-center">
            <span className="text-[10px] uppercase font-bold text-[#5A7064] block">Poids Global</span>
            <span className="text-sm sm:text-base font-mono font-bold text-[#17402C]">{formatWeight(totalWeightG)}</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/40 border border-white/60 text-center">
            <span className="text-[10px] uppercase font-bold text-[#5A7064] block">Valeur Équipement</span>
            <span className="text-sm sm:text-base font-mono font-bold text-[#17402C]">{totalInvestEur} €</span>
          </div>
        </div>

        {/* ════ VUE 1 : MON INVENTAIRE ════ */}
        {subTab === 'inventory' && (
          <div className="space-y-3">
            {/* Barre de recherche, filtres et bouton d'ajout */}
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A7064]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher tente, duvet, marque..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-white/50 dark:bg-white/10 border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#17402C]/30 text-[#17402C]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A7064] p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filtres par catégorie */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCat(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
                      selectedCat === cat
                        ? 'bg-[#17402C] text-white shadow-2xs'
                        : 'bg-white/40 text-[#5A7064] hover:text-[#17402C]'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="glass-capsule-btn primary text-xs !py-1.5 !px-3 inline-flex items-center gap-1 font-bold shrink-0 shadow-2xs cursor-pointer self-end sm:self-auto"
              >
                <Plus size={13} />
                <span>Ajouter objet</span>
              </button>
            </div>

            {/* Liste des équipements */}
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
              {filteredInventory.length === 0 ? (
                <div className="p-8 text-center bg-white/30 rounded-2xl border border-dashed border-black/10 text-xs text-[#5A7064]">
                  Aucun équipement trouvé. Cliquez sur « Ajouter objet » pour enrichir votre inventaire.
                </div>
              ) : (
                filteredInventory.map((item) => {
                  const cond = CONDITION_LABELS[item.condition || 'tres_bon'] || CONDITION_LABELS.tres_bon;
                  const isLent = item.is_lent;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3',
                        isLent
                          ? 'bg-amber-50/50 border-amber-200/60 text-amber-950'
                          : 'bg-white/60 dark:bg-white/10 border-white/80 text-[#17402C]'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-xs shrink-0 text-[#2D6B4A]">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold truncate">{item.name}</span>
                            {item.brand && (
                              <span className="text-[10.5px] text-[#5A7064] font-medium truncate">
                                ({item.brand})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-[#5A7064] mt-0.5">
                            <span>{item.category || 'Autre'}</span>
                            <span>·</span>
                            <span className="font-mono">{formatWeight(item.weight_g || 0)}</span>
                            {item.price_cents && (
                              <>
                                <span>·</span>
                                <span className="font-mono">{Math.round(item.price_cents / 100)} €</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-[9.5px] font-bold px-2 py-0.5 rounded-lg', cond.tone)}>
                          {cond.label}
                        </span>

                        {isLent ? (
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-amber-200/80 text-amber-900 flex items-center gap-1">
                            <Handshake size={10} />
                            <span>En prêt</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemForLoan(item);
                              setIsLoanModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-xl text-[10.5px] font-bold bg-white/70 hover:bg-white text-[#2D6B4A] border border-black/5 flex items-center gap-1 cursor-pointer"
                            title="Prêter cet objet à un ami"
                          >
                            <Handshake size={11} />
                            <span>Prêter</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded-lg text-[#5A7064]/50 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Supprimer de l'inventaire"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ════ VUE 2 : PRÊTS & DISPONIBILITÉ ════ */}
        {subTab === 'loans' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 flex items-center justify-between text-xs text-[#17402C]">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#2D6B4A] shrink-0" />
                <span>
                  <strong>{availableCount}</strong> objets disponibles sur <strong>{inventoryList.length}</strong> au total ({activeLoans.length} actuellement en prêt).
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {loanList.length === 0 ? (
                <div className="p-8 text-center bg-white/30 rounded-2xl border border-dashed border-black/10 text-xs text-[#5A7064]">
                  Aucun prêt actif. Vous pouvez prêter n'importe quel objet depuis l'onglet Inventaire.
                </div>
              ) : (
                loanList.map((loan) => {
                  const targetItem = inventoryList.find((i) => i.id === loan.product_ownership_id);
                  const isReturned = loan.status === 'rendu';
                  const isOverdue = loan.due_date && new Date(loan.due_date) < new Date() && !isReturned;

                  return (
                    <div
                      key={loan.id}
                      className={cn(
                        'p-3 rounded-2xl border transition-all flex items-center justify-between gap-3',
                        isReturned
                          ? 'bg-black/3 opacity-70 border-black/5'
                          : isOverdue
                          ? 'bg-red-50/70 border-red-200 text-red-950'
                          : 'bg-white/70 border-white/80 text-[#17402C]'
                      )}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate">
                            {targetItem ? targetItem.name : 'Objet d’inventaire'}
                          </span>
                          <span
                            className={cn(
                              'text-[9.5px] font-bold px-2 py-0.5 rounded-lg font-mono',
                              isReturned
                                ? 'bg-black/10 text-[#5A7064]'
                                : isOverdue
                                ? 'bg-red-200 text-red-900'
                                : 'bg-amber-100 text-amber-900'
                            )}
                          >
                            {isReturned ? 'Rendu' : isOverdue ? 'En retard' : 'En prêt'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#5A7064]">
                          <span className="flex items-center gap-1 font-medium text-[#17402C]">
                            <User size={11} />
                            <span>Emprunteur : {loan.borrower_contact}</span>
                          </span>
                          {loan.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              <span>Retour prévu : {new Date(loan.due_date).toLocaleDateString('fr-FR')}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {!isReturned && (
                        <button
                          type="button"
                          onClick={() => handleReturnLoan(loan.id, loan.product_ownership_id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Check size={12} />
                          <span>Marquer rendu</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════ MODAL AJOUT D'OBJET INVENTAIRE ════ */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-5 rounded-3xl max-w-md w-full border border-white/80 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C]">
                  Ajouter à mon Inventaire
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Nom de l’équipement *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Tente Big Agnes Copper Spur 2P"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Marque
                    </label>
                    <input
                      type="text"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="Ex: Sea to Summit, MSR..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Catégorie
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    >
                      {CATEGORIES.filter((c) => c !== 'Toutes').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Poids (g)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newWeight}
                      onChange={(e) => setNewWeight(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      État
                    </label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    >
                      <option value="neuf">Neuf</option>
                      <option value="tres_bon">Très bon</option>
                      <option value="bon">Bon</option>
                      <option value="moyen">Usé</option>
                      <option value="a_remplacer">À remplacer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Prix (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPriceEur}
                      onChange={(e) => setNewPriceEur(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Ex: 180"
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════ MODAL NOUVEAU PRÊT ════ */}
      <AnimatePresence>
        {isLoanModalOpen && selectedItemForLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-5 rounded-3xl max-w-md w-full border border-white/80 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C] flex items-center gap-1.5">
                  <Handshake size={16} className="text-[#2D6B4A]" />
                  <span>Prêter un équipement</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-2.5 rounded-2xl bg-black/5 text-xs font-semibold">
                <span>Objet à prêter : <strong>{selectedItemForLoan.name}</strong></span>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Nom ou contact de l’emprunteur *
                  </label>
                  <input
                    type="text"
                    required
                    value={borrowerContact}
                    onChange={(e) => setBorrowerContact(e.target.value)}
                    placeholder="Ex: Thomas (+33 6 12 34 56 78)"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Date de retour prévue (optionnel)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLoanModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs cursor-pointer"
                  >
                    Confirmer le prêt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
