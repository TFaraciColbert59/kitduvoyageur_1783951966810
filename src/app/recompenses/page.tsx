'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { newId } from '@/lib/uuid';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RewardAccount {
  available_points: number;
  pending_points: number;
  invalid_points: number;
  lifetime_points: number;
  eligible_points: number;
  earned_this_period: number;
  redeemed_points: number;
  available_cash: number;
  pending_cash: number;
  status: 'active' | 'suspended' | 'limited' | 'suspect';
}

interface Transaction {
  id: string;
  points: number;
  transaction_type: string;
  created_at: string;
  metadata: any;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected';
  payment_provider: string;
  payment_reference?: string;
  rejection_reason?: string;
  requested_at: string;
}

export default function RecompensesPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // UI State
  const [account, setAccount] = useState<RewardAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentProvider, setPaymentProvider] = useState('bank_transfer');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generate idempotency key for withdrawal session
  const idempotencyKey = useMemo(() => {
    if (typeof window !== 'undefined') {
      return newId();
    }
    return '';
  }, [successMessage]); // Regenerate after a successful submission

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch user reward account
      const { data: raData, error: raErr } = await supabase
        .from('reward_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (raErr) throw raErr;
      setAccount(raData);

      // 2. Fetch user profile (age, trust score, level)
      const { data: pData, error: pErr } = await supabase
        .from('user_profiles')
        .select('created_at, trust_score, level, full_name')
        .eq('id', user.id)
        .single();

      if (pErr) throw pErr;
      setProfile(pData);

      // 3. Fetch config settings
      const { data: cData, error: cErr } = await supabase
        .from('reward_config')
        .select('key, value');

      if (cErr) throw cErr;
      const configMap = cData.reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
      setConfig(configMap);

      // 4. Fetch reward transactions
      const { data: tData, error: tErr } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (tErr) throw tErr;
      setTransactions(tData || []);

      // 5. Fetch withdrawals
      const { data: wData, error: wErr } = await supabase
        .from('reward_withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(10);

      if (wErr) throw wErr;
      setWithdrawals(wData || []);

    } catch (err: any) {
      console.error('Error loading rewards data:', err);
      setError('Impossible de charger les données de récompenses.');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !account) return;

    const amountNum = parseFloat(withdrawAmount);
    const minThreshold = parseFloat(config.cashout_min_threshold || '20.00');

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Veuillez entrer un montant valide.');
      return;
    }

    if (amountNum < minThreshold) {
      setError(`Le montant minimum de retrait est de ${minThreshold.toFixed(2)} €.`);
      return;
    }

    if (amountNum > account.available_cash) {
      setError('Solde insuffisant.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const metadata: any = {};
    if (paymentProvider === 'bank_transfer') {
      metadata.iban = iban.replace(/\s+/g, '');
      metadata.bic = bic.replace(/\s+/g, '');
      if (!metadata.iban || !metadata.bic) {
        setError('Veuillez renseigner vos coordonnées bancaires (IBAN et BIC).');
        setSubmitting(false);
        return;
      }
    } else if (paymentProvider === 'paypal') {
      metadata.paypal_email = paypalEmail.trim();
      if (!metadata.paypal_email) {
        setError('Veuillez spécifier votre adresse email Paypal.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/rewards/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_provider: paymentProvider,
          idempotency_key: idempotencyKey,
          metadata
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erreur lors de la demande de retrait.');
      }

      setSuccessMessage(`Votre demande de retrait de ${amountNum.toFixed(2)} € a bien été enregistrée et est en cours d'examen.`);
      setWithdrawAmount('');
      setIban('');
      setBic('');
      setPaypalEmail('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getContributionRating = () => {
    if (!profile) return '—';
    const trust = profile.trust_score || 50;
    if (trust >= 80) return 'Excellente (Créateur)';
    if (trust >= 65) return 'Très bonne (Reconnu)';
    if (trust >= 50) return 'Bonne (Actif)';
    if (trust >= 35) return 'Moyenne (Nouveau)';
    return 'Suspecte (Limité)';
  };

  const translateTxType = (type: string) => {
    const types: any = {
      LIKE_REWARD: 'Gain pour Like',
      COMMENT_REWARD: 'Gain pour Commentaire',
      POST_REWARD: 'Gain pour Publication',
      JOURNAL_REWARD: 'Gain pour Carnet',
      GROUP_REWARD: 'Gain pour Activité de Groupe',
      QUALITY_BONUS: 'Bonus de Qualité',
      FRAUD_REVERSAL: 'Annulation (Spam / Abus)',
      ADMIN_ADJUSTMENT: 'Ajustement Administrateur',
      REDEMPTION: 'Points convertis en Cash',
      EXPIRATION: 'Points expirés',
      REFERRAL_REWARD: 'Bonus Parrainage'
    };
    return types[type] || type;
  };

  const translateWithdrawalStatus = (status: string) => {
    const states: any = {
      pending: 'En attente',
      under_review: 'En cours d\'examen',
      approved: 'Approuvé',
      processing: 'En cours de transfert',
      paid: 'Versé',
      rejected: 'Rejeté'
    };
    return states[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'pending':
      case 'under_review':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const pageContent = (isMobile: boolean) => {
    const s = (mobile: any, desktop: any) => isMobile ? mobile : desktop;
    const minThreshold = parseFloat(config.cashout_min_threshold || '20.00');

    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <p className="text-5xl mb-4">🔐</p>
          <h2 className="font-display font-800 text-xl text-[#0B1F17] mb-2">Authentification requise</h2>
          <p className="text-xs text-[#6B7A72] mb-6 max-w-sm">Vous devez vous connecter à votre compte Le Kit du Voyageur pour voir et gérer vos récompenses.</p>
          <Link href="/connexion?mode=connexion" className="px-6 py-2.5 bg-[#17402C] text-white rounded-full text-xs font-bold hover:bg-[#2D6B4A] transition-colors">
            Se connecter
          </Link>
        </div>
      );
    }

    if (loading && !account) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-[#6B7A72]">Chargement de votre économie de récompenses...</p>
        </div>
      );
    }

    return (
      <div className={s('px-4 space-y-6', 'max-w-7xl mx-auto px-8 py-12 space-y-8')}>
        {/* Header Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-[#A3C4A3]/25 text-[#17402C] border border-[#A3C4A3]/40 rounded-full">
              Récompenses communautaires
            </span>
          </div>
          <h1 className="font-display font-900 text-2xl sm:text-3xl text-[#0B1F17] tracking-tight">
            Partage de Valeur LKDV
          </h1>
          <p className="text-xs text-[#6B7A72] max-w-2xl">
            La plateforme partage la valeur réelle qu&apos;elle génère. Accumulez des points d&apos;activité chaque mois en faisant vivre la communauté et recevez votre part du Reward Pool.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex gap-2 items-center">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex gap-2 items-center">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Dashboard Grid Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#FBFAF6] border border-stone-200/60 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">Mes points actifs</p>
            <p className="text-xl font-display font-900 text-[#0B1F17] mt-1">
              {account?.eligible_points || 0} pts
            </p>
            <p className="text-[9px] text-[#6B7A72] mt-0.5">Pour la période en cours</p>
          </div>

          <div className="bg-[#FBFAF6] border border-stone-200/60 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">Ma contribution</p>
            <p className="text-sm font-bold text-[#17402C] mt-2 truncate">
              {getContributionRating()}
            </p>
            <p className="text-[9px] text-[#6B7A72] mt-0.5">Score confiance : {profile?.trust_score || 50}/100</p>
          </div>

          <div className="bg-[#FBFAF6] border border-[#A3C4A3]/30 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="absolute right-3 top-3 text-[#17402C]/10 text-2xl font-bold">€</div>
            <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">Disponibles</p>
            <p className="text-xl font-display font-900 text-[#17402C] mt-1">
              {account?.available_cash ? account.available_cash.toFixed(2) : '0.00'} €
            </p>
            <p className="text-[9px] text-[#6B7A72] mt-0.5">Prêts au retrait</p>
          </div>

          <div className="bg-[#FBFAF6] border border-stone-200/60 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-mono tracking-wider text-[#6B7A72] uppercase">En cours / en attente</p>
            <p className="text-xl font-display font-900 text-[#0B1F17]/70 mt-1">
              {account?.pending_cash ? account.pending_cash.toFixed(2) : '0.00'} €
            </p>
            <p className="text-[9px] text-[#6B7A72] mt-0.5">Virement en traitement</p>
          </div>
        </div>

        {/* Withdrawal Section & Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cash-out Form */}
          <div className="lg:col-span-7 bg-[#FBFAF6] border border-stone-200/60 rounded-[0.75rem] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
              <h3 className="font-display font-800 text-[#0B1F17] text-sm tracking-tight flex items-center gap-1.5">
                <Icon name="CurrencyEuroIcon" size={18} className="text-[#17402C]" />
                Demande de retrait de fonds
              </h3>
              <span className="text-[11px] font-mono text-[#6B7A72]">
                Solde : {account?.available_cash ? account.available_cash.toFixed(2) : '0.00'} €
              </span>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-[11px] font-bold text-[#0B1F17] mb-1.5 uppercase tracking-wider">Montant (EUR)</label>
                <div className="relative rounded-xl shadow-sm">
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    id="amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="block w-full rounded-xl border border-stone-200/80 pl-4 pr-12 py-2.5 text-xs text-[#0B1F17] focus:outline-none focus:ring-1 focus:ring-[#17402C] focus:border-[#17402C] bg-[#FBFAF6]"
                    placeholder="20.00"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-[#6B7A72] font-semibold">
                    EUR
                  </div>
                </div>
                <p className="text-[9px] text-[#6B7A72] mt-1">
                  Seuil de retrait minimum : {config.cashout_min_threshold ? parseFloat(config.cashout_min_threshold).toFixed(2) : '20.00'} €
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#0B1F17] mb-1.5 uppercase tracking-wider">Méthode de virement</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentProvider('bank_transfer')}
                    className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                      paymentProvider === 'bank_transfer'
                        ? 'border-[#17402C] bg-[#17402C]/5 text-[#17402C] font-bold'
                        : 'border-stone-200/80 bg-white text-[#6B7A72]'
                    }`}
                  >
                    <span className="text-base mb-1">🏦</span>
                    <span className="text-[10px]">Virement SEPA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentProvider('paypal')}
                    className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                      paymentProvider === 'paypal'
                        ? 'border-[#17402C] bg-[#17402C]/5 text-[#17402C] font-bold'
                        : 'border-stone-200/80 bg-white text-[#6B7A72]'
                    }`}
                  >
                    <span className="text-base mb-1">💳</span>
                    <span className="text-[10px]">Paypal</span>
                  </button>
                </div>
              </div>

              {paymentProvider === 'bank_transfer' && (
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-stone-200/40">
                  <div>
                    <label htmlFor="iban" className="block text-[10px] text-[#6B7A72] mb-1 uppercase font-semibold">IBAN</label>
                    <input
                      type="text"
                      id="iban"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="FR76 3000 6000 0123 4567 8901 234"
                      className="block w-full rounded-lg border border-stone-200 text-[11px] px-3 py-2 text-[#0B1F17] focus:outline-none focus:ring-1 focus:ring-[#17402C] bg-stone-50/50"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="bic" className="block text-[10px] text-[#6B7A72] mb-1 uppercase font-semibold">BIC / SWIFT</label>
                    <input
                      type="text"
                      id="bic"
                      value={bic}
                      onChange={(e) => setBic(e.target.value)}
                      placeholder="BCDEFR2X"
                      className="block w-full rounded-lg border border-stone-200 text-[11px] px-3 py-2 text-[#0B1F17] focus:outline-none focus:ring-1 focus:ring-[#17402C] bg-stone-50/50"
                      required
                    />
                  </div>
                </div>
              )}

              {paymentProvider === 'paypal' && (
                <div className="bg-white p-4 rounded-2xl border border-stone-200/40">
                  <label htmlFor="paypalEmail" className="block text-[10px] text-[#6B7A72] mb-1 uppercase font-semibold">Adresse email Paypal</label>
                  <input
                    type="email"
                    id="paypalEmail"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="block w-full rounded-lg border border-stone-200 text-[11px] px-3 py-2 text-[#0B1F17] focus:outline-none focus:ring-1 focus:ring-[#17402C] bg-stone-50/50"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (account?.available_cash || 0) < minThreshold}
                className="w-full py-3 bg-[#17402C] text-white rounded-full text-xs font-bold hover:bg-[#2D6B4A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  'Demander le virement'
                )}
              </button>
            </form>
          </div>

          {/* Guide Section */}
          <div className="lg:col-span-5 bg-white border border-stone-200/40 rounded-[0.75rem] p-6 shadow-sm space-y-4">
            <h3 className="font-display font-800 text-[#0B1F17] text-sm tracking-tight flex items-center gap-1.5">
              <Icon name="BookOpenIcon" size={18} className="text-[#17402C]" />
              Règles et Fonctionnement
            </h3>
            <div className="text-[11px] text-[#6B7A72] space-y-3 leading-relaxed">
              <p>
                <strong>1. Économie Solvable :</strong> La valeur du point dépend directement des revenus réels du mois (affiliation, ventes, boutique). Plus le volume global d&apos;activité est fort pour un revenu donné, plus le poids du point s&apos;ajuste automatiquement.
              </p>
              <p>
                <strong>2. Score de Qualité :</strong> Vos commentaires, récits et messages sont analysés automatiquement. Le copier-coller en masse ou les commentaires génériques (&quot;super&quot;, &quot;cool&quot;) réduisent le score de qualité à 0 point.
              </p>
              <p>
                <strong>3. Anti-Collusion :</strong> Le fait de liker ou commenter ses propres contenus est banni. Les cercles d&apos;engagement fermés entre les mêmes utilisateurs ou les pics suspects de trafic suspendent automatiquement l&apos;obtention de récompenses.
              </p>
              <p>
                <strong>4. Conditions de retrait :</strong> Votre compte doit être vérifié et avoir au moins 30 jours d&apos;ancienneté. Les transferts sont vérifiés et versés manuellement par les administrateurs sous 5 jours ouvrés.
              </p>
            </div>
          </div>
        </div>

        {/* Ledger & Withdrawals lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Ledger of points transactions */}
          <div className="bg-[#FBFAF6] border border-stone-200/60 rounded-[0.75rem] p-6 shadow-sm space-y-4">
            <h3 className="font-display font-800 text-[#0B1F17] text-sm tracking-tight flex items-center gap-1.5">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-[#17402C]" />
              Historique de points (Ledger)
            </h3>
            <div className="overflow-hidden border border-stone-200/40 rounded-2xl bg-white max-h-96 overflow-y-auto">
              {transactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6B7A72]">Aucune transaction enregistrée.</div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200/60 text-[#6B7A72] uppercase font-mono tracking-wider">
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Points</th>
                      <th className="p-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-stone-50/50">
                        <td className="p-3 text-[#0B1F17] font-semibold">{translateTxType(tx.transaction_type)}</td>
                        <td className={`p-3 text-right font-bold ${tx.points >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {tx.points >= 0 ? `+${tx.points}` : tx.points}
                        </td>
                        <td className="p-3 text-right text-[#6B7A72]">
                          {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* History of Cash-out withdrawals */}
          <div className="bg-[#FBFAF6] border border-stone-200/60 rounded-[0.75rem] p-6 shadow-sm space-y-4">
            <h3 className="font-display font-800 text-[#0B1F17] text-sm tracking-tight flex items-center gap-1.5">
              <Icon name="WrenchScrewdriverIcon" size={18} className="text-[#17402C]" />
              Demandes de virements
            </h3>
            <div className="overflow-hidden border border-stone-200/40 rounded-2xl bg-white max-h-96 overflow-y-auto">
              {withdrawals.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6B7A72]">Aucun virement demandé.</div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200/60 text-[#6B7A72] uppercase font-mono tracking-wider">
                      <th className="p-3">Montant</th>
                      <th className="p-3">Méthode</th>
                      <th className="p-3 text-center">Statut</th>
                      <th className="p-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-stone-50/50">
                        <td className="p-3 text-[#0B1F17] font-semibold">{w.amount.toFixed(2)} €</td>
                        <td className="p-3 text-[#6B7A72] font-mono">
                          {w.payment_provider === 'bank_transfer' ? 'Banque' : 'Paypal'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${getStatusColor(w.status)}`}>
                            {translateWithdrawalStatus(w.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right text-[#6B7A72]">
                          {new Date(w.requested_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F3ED] text-[#0B1F17] selection:bg-[#17402C]/20 font-sans">
      {/* Mobile Shell */}
      <div className="block md:hidden">
        <MobilePageShell background="#F5F3EE">
          <div className="pt-4 pb-20">
            {pageContent(true)}
          </div>
        </MobilePageShell>
      </div>

      {/* Desktop view */}
      <div className="hidden md:block flex flex-col min-h-screen justify-between">
        <Header />
        <main className="pt-24 pb-16 flex-grow">
          {pageContent(false)}
        </main>
        <Footer />
      </div>
    </div>
  );
}
