"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReportTarget {
  userId: string;
  userName: string;
  groupId?: string;
  groupName?: string;
}

interface Props {
  target: ReportTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const REPORT_CATEGORIES = [
  { id: 'harassment', label: 'Comportement inapproprié / Harcèlement', severity: 'grave' },
  { id: 'sexual', label: 'Contenu à caractère sexuel non sollicité', severity: 'grave' },
  { id: 'scam', label: 'Arnaque financière suspectée', severity: 'grave' },
  { id: 'threat', label: 'Menace ou mise en danger', severity: 'grave' },
  { id: 'fake_profile', label: 'Profil suspect ou faux', severity: 'normal' },
  { id: 'other', label: 'Autre motif', severity: 'normal' },
];

export default function ReportBlockModal({ target, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'report' | 'block'>('report');
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES[0].id);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [actionDoneMsg, setActionDoneMsg] = useState('');

  if (!target) return null;

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const categoryObj = REPORT_CATEGORIES.find(c => c.id === selectedCategory) || REPORT_CATEGORIES[0];

      // 1. Insert report
      const { error: repErr } = await supabase.from('group_reports').insert({
        reporter_id: user.id,
        reported_user_id: target.userId,
        group_id: target.groupId || null,
        category: categoryObj.label,
        reason: reason.trim() || null,
        severity: categoryObj.severity,
      });

      if (repErr) throw repErr;

      // 2. Check auto-suspension if grave category
      if (categoryObj.severity === 'grave') {
        const { data: reports } = await supabase
          .from('group_reports')
          .select('reporter_id')
          .eq('reported_user_id', target.userId)
          .eq('severity', 'grave');

        // Check if 2 or more distinct reporters
        const distinctReporters = new Set(reports?.map(r => r.reporter_id) || []);
        if (distinctReporters.size >= 2 || categoryObj.id === 'sexual' || categoryObj.id === 'threat') {
          await supabase
            .from('user_profiles')
            .update({ 
              is_suspended_groups: true,
              suspended_from_groups_at: new Date().toISOString()
            })
            .eq('id', target.userId);
        }
      }

      // 3. Send confirmation notification to reporter
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'group_report_received',
        title: 'Signalement pris en compte',
        message: 'Votre signalement a été enregistré en priorité par notre équipe de modération. Merci pour votre vigilance.',
        link: '/compte',
      });

      setSubmitted(true);
      setActionDoneMsg('Votre signalement a été enregistré en priorité par notre équipe de modération.');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      alert("Une erreur est survenue lors du signalement.");
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    if (!confirm(`Voulez-vous vraiment bloquer ${target.userName} ? Vous ne verrez plus ses demandes et il ne pourra plus vous contacter.`)) return;

    setLoading(true);
    try {
      // 1. Insert block
      await supabase.from('user_blocks').insert({
        blocker_id: user.id,
        blocked_id: target.userId,
      });

      // 2. Remove any pending membership between them on this group
      if (target.groupId) {
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', target.groupId)
          .eq('user_id', target.userId);
      }

      setSubmitted(true);
      setActionDoneMsg(`L'utilisateur ${target.userName} a été bloqué immédiatement.`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors du blocage.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14231C] border border-white/15 rounded-[24px] max-w-lg w-full p-6 text-white shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-sm font-bold">🛡️</span>
            <div>
              <h3 className="font-bold text-base text-white">Sécurité &amp; Signalement</h3>
              <p className="text-[11px] text-white/50">Membre concerné : <strong className="text-white">{target.userName}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs">✕</button>
        </div>

        {submitted ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#1B4332] text-[#A8C4A2] flex items-center justify-center text-xl mx-auto mb-3">✓</div>
            <h4 className="font-bold text-lg mb-2">Action confirmée</h4>
            <p className="text-sm text-white/70 mb-6 max-w-sm mx-auto">{actionDoneMsg}</p>
            <button onClick={onClose} className="px-6 py-2.5 bg-white text-[#0B1F17] rounded-full font-bold text-xs hover:bg-[#EAE6DF] transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <div>
            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-black/30 rounded-xl mb-5 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'report' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <span>🚩</span> Signaler
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('block')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'block' ? 'bg-red-500/20 text-red-300' : 'text-white/60 hover:text-white'
                }`}
              >
                <span>🚫</span> Bloquer
              </button>
            </div>

            {activeTab === 'report' ? (
              <form onSubmit={handleReport} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/60 mb-2">Motif du signalement</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {REPORT_CATEGORIES.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-[#1B4332] border-[#A8C4A2] text-white'
                            : 'bg-black/20 border-white/10 text-white/70 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="reportCat"
                            value={cat.id}
                            checked={selectedCategory === cat.id}
                            onChange={() => setSelectedCategory(cat.id)}
                            className="text-[#1B4332]"
                          />
                          <span>{cat.label}</span>
                        </div>
                        {cat.severity === 'grave' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                            Priorité haute
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/60 mb-1">Détails (Optionnel mais recommandé)</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Expliquez ce qui s'est passé de manière factuelle..."
                    className="w-full bg-black/25 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#A8C4A2] resize-none"
                  ></textarea>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Envoi...' : 'Transmettre le signalement'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-white/80 space-y-2">
                  <p className="font-bold text-red-300">Effet immédiat du blocage :</p>
                  <ul className="list-disc pl-4 space-y-1 text-white/70">
                    <li>{target.userName} ne pourra plus voir vos bouteilles à la mer ni vous envoyer de demandes.</li>
                    <li>Vous ne verrez plus ses groupes et ses propositions.</li>
                    <li>Toute demande en attente entre vous sera immédiatement annulée.</li>
                  </ul>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Blocage...' : `Confirmer le blocage`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
