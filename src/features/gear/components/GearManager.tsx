'use client';

import React, { useState } from 'react';
import { useGearStore } from '../stores/useGearStore';
import { WeightSummaryCard } from './WeightSummaryCard';
import { GearChecklist } from './GearChecklist';
import { ShakedownAuditView } from './ShakedownAuditView';
import { GearCategory, GearStatus } from '../types/gear.types';

export const GearManager: React.FC = () => {
  const items = useGearStore((s) => s.items);
  const categoryFilter = useGearStore((s) => s.categoryFilter);
  const statusFilter = useGearStore((s) => s.statusFilter);
  const setCategoryFilter = useGearStore((s) => s.setCategoryFilter);
  const setStatusFilter = useGearStore((s) => s.setStatusFilter);
  const setItemStatus = useGearStore((s) => s.setItemStatus);
  const toggleItemWorn = useGearStore((s) => s.toggleItemWorn);
  const addItem = useGearStore((s) => s.addItem);
  const removeItem = useGearStore((s) => s.removeItem);
  const getWeightBreakdown = useGearStore((s) => s.getWeightBreakdown);
  const getShakedownReport = useGearStore((s) => s.getShakedownReport);

  const [activeTab, setActiveTab] = useState<'checklist' | 'shakedown'>('checklist');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Item form state
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState(250);
  const [newCategory, setNewCategory] = useState<GearCategory>('misc');
  const [newStatus, setNewStatus] = useState<GearStatus>('packed');
  const [newIsWorn, setNewIsWorn] = useState(false);
  const [newIsConsumable, setNewIsConsumable] = useState(false);
  const [newIsVital, setNewIsVital] = useState(false);

  const breakdown = getWeightBreakdown();
  const report = getShakedownReport();

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addItem({
      name: newName.trim(),
      weightGrams: Number(newWeight) || 0,
      category: newCategory,
      status: newStatus,
      isWorn: newIsWorn,
      isConsumable: newIsConsumable,
      isVital: newIsVital,
      isPrivate: false,
      quantity: 1,
    });

    setNewName('');
    setNewWeight(250);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Visual Weight Summary */}
      <WeightSummaryCard breakdown={breakdown} />

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'checklist'
              ? 'bg-white dark:bg-white/15 text-[#17402C] dark:text-white shadow-sm'
              : 'text-[#5A7064] dark:text-[#9AAD9E]'
          }`}
        >
          <span>🎒</span>
          <span>Inventaire & Sac ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shakedown')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'shakedown'
              ? 'bg-white dark:bg-white/15 text-[#17402C] dark:text-white shadow-sm'
              : 'text-[#5A7064] dark:text-[#9AAD9E]'
          }`}
        >
          <span>🔍</span>
          <span>Shakedown ({report.score}/100)</span>
        </button>
      </div>

      {/* Quick Add CTA Button */}
      {activeTab === 'checklist' && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Ajouter un équipement</span>
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'checklist' ? (
        <GearChecklist
          items={items}
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
          onSetCategoryFilter={setCategoryFilter}
          onSetStatusFilter={setStatusFilter}
          onSetItemStatus={setItemStatus}
          onToggleItemWorn={toggleItemWorn}
          onRemoveItem={removeItem}
        />
      ) : (
        <ShakedownAuditView report={report} />
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <form
            onSubmit={handleCreateItem}
            className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">Ajouter un équipement</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Nom de l'objet</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Tente Ultra-Light 1P"
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#A6C1A0] mb-1 font-mono">Poids (grammes)</label>
                  <input
                    type="number"
                    required
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A6C1A0] mb-1 font-mono">Catégorie</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                  >
                    <option value="shelter">Abri (tente/tarp)</option>
                    <option value="sleep">Couchage</option>
                    <option value="cook">Cuisine / Popote</option>
                    <option value="clothing">Vêtements</option>
                    <option value="water">Eau & Hydratation</option>
                    <option value="safety">Sécurité & Soins</option>
                    <option value="tech">Tech & Énergie</option>
                    <option value="misc">Divers</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#A6C1A0] mb-1 font-mono">Statut de départ</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-black/30 border border-white/20 text-white font-mono"
                >
                  <option value="packed">Dans le sac</option>
                  <option value="owned">Possédé (au camp)</option>
                  <option value="to_buy">À acheter</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsWorn}
                    onChange={(e) => setNewIsWorn(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Porté sur soi (non pesé dans le Base Weight)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsConsumable}
                    onChange={(e) => setNewIsConsumable(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Consommable (eau, nourriture, gaz)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsVital}
                    onChange={(e) => setNewIsVital(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-red-300 font-semibold">Équipement vital de sécurité</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
