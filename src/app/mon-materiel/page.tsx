'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Link from 'next/link';

interface GearItem {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  weight_g: number | null;
  source: string | null;
  acquired_at: string | null;
  is_listed_for_sale: boolean;
}

interface AssistantState {
  question: string;
  answer: string | null;
  tips: string[];
  loading: boolean;
}

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'Tout', icon: '📦' },
  { key: 'vêtements', label: 'Vêtements', icon: '👕' },
  { key: 'chaussures', label: 'Chaussures', icon: '👟' },
  { key: 'couchage', label: 'Couchage', icon: '🛏' },
  { key: 'navigation', label: 'Navigation', icon: '🗺️' },
  { key: 'sécurité', label: 'Sécurité', icon: '🚨' },
  { key: 'cuisine', label: 'Cuisine', icon: '🍳' },
  { key: 'autre', label: 'Autre', icon: '🔧' },
];

function categoryIcon(cat: string | null): string {
  const found = CATEGORIES.find((c) => c.key === (cat?.toLowerCase() || ''));
  return found ? found.icon : '🔧';
}

function formatWeight(g: number | null): string {
  if (g == null) return '';
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function MonMaterielPage() {
  const [gear, setGear] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistant, setAssistant] = useState<AssistantState>({
    question: '', answer: null, tips: [], loading: false,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('gear_items')
      .select('id, name, brand, category, weight_g, source, acquired_at, is_listed_for_sale')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    setGear(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteItem = useCallback(async (id: string) => {
    if (!confirm('Supprimer cet équipement ?')) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('gear_items').delete().eq('id', id);
    setGear((prev) => prev.filter((g) => g.id !== id));
    setDeletingId(null);
  }, []);

  const askAssistant = useCallback(async () => {
    if (!assistant.question.trim()) return;
    setAssistant((prev) => ({ ...prev, loading: true, answer: null, tips: [] }));
    try {
      const res = await fetch('/api/trip-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: assistant.question }),
      });
      const data = await res.json();
      setAssistant((prev) => ({
        ...prev,
        loading: false,
        answer: data.answer || null,
        tips: data.tips || [],
      }));
    } catch {
      setAssistant((prev) => ({
        ...prev,
        loading: false,
        answer: 'Erreur lors de la consultation de l\'assistant.',
        tips: [],
      }));
    }
  }, [assistant.question]);

  const filtered = activeCategory === 'all'
    ? gear
    : gear.filter((g) => (g.category?.toLowerCase() || 'autre') === activeCategory);

  const totalWeight = filtered.reduce((sum, g) => sum + (g.weight_g || 0), 0);

  return (
    <MobilePageShell>
      <div className="min-h-screen bg-[#F8F5EE]">

        {/* Header */}
        <div className="bg-[#1C2620] px-4 pt-8 pb-5">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/profil"
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Retour"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-white">Mon Matériel</h1>
          </div>
          <p className="text-white/50 text-sm ml-11">
            {gear.length} article{gear.length > 1 ? 's' : ''} · {formatWeight(gear.reduce((s, g) => s + (g.weight_g || 0), 0))} total
          </p>
        </div>

        {/* Assistant IA */}
        <div className="mx-4 mt-4">
          {!showAssistant ? (
            <button
              id="toggle-assistant-btn"
              onClick={() => setShowAssistant(true)}
              className="w-full flex items-center gap-3 bg-white rounded-2xl border border-[#E8E4D8] p-4 hover:bg-[#FAFAF7] transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#EDF7F0] flex items-center justify-center flex-shrink-0 text-lg">
                ✨
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1C2620]">Assistant préparation IA</p>
                <p className="text-xs text-[#7A8A7D]">Pose une question sur ton matériel ou ta randonnée</p>
              </div>
              <svg width="16" height="16" fill="none" stroke="#C8C0A8" strokeWidth="2" viewBox="0 0 24 24" className="ml-auto flex-shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E4D8] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#1C2620]">✨ Assistant IA</p>
                <button onClick={() => setShowAssistant(false)} className="text-[#A0A89D] hover:text-[#1C2620]">✕</button>
              </div>

              <div className="flex gap-2">
                <input
                  id="assistant-input"
                  type="text"
                  value={assistant.question}
                  onChange={(e) => setAssistant((p) => ({ ...p, question: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && askAssistant()}
                  placeholder="Ex : Ai-je besoin de guêtres pour Chartreuse en octobre ?"
                  className="flex-1 bg-[#F8F5EE] border border-[#E8E4D8] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] placeholder:text-[#A0A89D] outline-none focus:border-[#2D5A27]"
                />
                <button
                  id="ask-assistant-btn"
                  onClick={askAssistant}
                  disabled={assistant.loading || !assistant.question.trim()}
                  className="px-3 py-2.5 bg-[#1C2620] text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-[#2D3F35] transition-colors"
                >
                  {assistant.loading ? '⏳' : '→'}
                </button>
              </div>

              {assistant.answer && (
                <div className="mt-3">
                  <p className="text-sm text-[#1C2620] leading-relaxed">{assistant.answer}</p>
                  {assistant.tips.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {assistant.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-[#5A6A5D] flex items-start gap-1.5">
                          <span className="flex-shrink-0 mt-0.5">💡</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtres catégories */}
        <div className="px-4 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === cat.key
                    ? 'bg-[#1C2620] text-white'
                    : 'bg-white text-[#5A6A5D] border border-[#E8E4D8] hover:bg-[#F5F2EA]'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Poids filtré */}
        {activeCategory !== 'all' && totalWeight > 0 && (
          <div className="mx-4 mt-3 px-4 py-2 bg-[#EDF7F0] rounded-xl border border-[#B7E4C7] flex items-center justify-between">
            <span className="text-xs text-[#2D6A4F] font-semibold">Poids {CATEGORIES.find(c => c.key === activeCategory)?.label}</span>
            <span className="text-xs font-bold text-[#2D6A4F]">{formatWeight(totalWeight)}</span>
          </div>
        )}

        {/* Liste matériel */}
        <div className="px-4 py-4 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E8E4D8] p-4 animate-pulse">
                <div className="h-4 bg-[#E8E4D8] rounded w-2/3 mb-1.5" />
                <div className="h-3 bg-[#E8E4D8] rounded w-1/3" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-3">🎒</p>
              <p className="text-sm font-semibold text-[#1C2620] mb-1">
                {activeCategory === 'all' ? 'Aucun équipement' : 'Aucun équipement dans cette catégorie'}
              </p>
              <p className="text-xs text-[#7A8A7D]">
                Ajoute du matériel via le configurateur de kit.
              </p>
              <Link
                href="/configurateur"
                className="inline-block mt-4 px-5 py-2.5 bg-[#1C2620] text-white text-sm font-semibold rounded-xl"
              >
                Ouvrir le configurateur
              </Link>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E8E4D8] overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F2EA] flex items-center justify-center flex-shrink-0 text-base">
                      {categoryIcon(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C2620] leading-tight">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.brand && (
                          <span className="text-xs text-[#7A8A7D]">{item.brand}</span>
                        )}
                        {item.category && (
                          <span className="text-xs text-[#A0A89D] capitalize">{item.category}</span>
                        )}
                        {item.weight_g && (
                          <span className="text-xs font-medium text-[#2D6A4F]">{formatWeight(item.weight_g)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      id={`delete-gear-${item.id}`}
                      onClick={() => deleteItem(item.id)}
                      disabled={deletingId === item.id}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-50"
                      aria-label="Supprimer"
                    >
                      {deletingId === item.id ? (
                        <span className="text-xs animate-spin">⏳</span>
                      ) : (
                        <span className="text-xs text-red-400">🗑</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Note bas de page */}
        <div className="px-4 pb-24">
          <p className="text-[11px] text-[#A0A89D] text-center">
            Le matériel est synchronisé depuis ton configurateur de kit.
          </p>
        </div>
      </div>
    </MobilePageShell>
  );
}
