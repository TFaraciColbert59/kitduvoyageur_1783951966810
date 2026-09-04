'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CONFIGURATOR_STEPS } from '@/lib/configuratorData';
import { addToCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { newId } from '@/lib/uuid';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  fetchUserInventory,
  fetchGroupContext,
  fetchCarnetContext,
  computeConnectedReport,
  OwnedGearItem,
  ConnectedKitReport,
  CarnetContextData,
} from '@/lib/ai/configuratorEngine';

function StepIcon({ icon, active }: { icon: string; active: boolean }) {
  const iconColor = active ? 'text-[#17402C]' : 'text-[#5A7064]';
  const badgeBg = active ? 'bg-white shadow-2xs' : 'bg-white/60';

  return (
    <div className={`w-10 h-10 rounded-2xl ${badgeBg} border border-white/80 flex items-center justify-center flex-shrink-0 transition-all`}>
      {icon === 'sun' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
      {icon === 'cloud-fog' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /><line x1="4" y1="22" x2="20" y2="22" />
        </svg>
      )}
      {icon === 'rain' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        </svg>
      )}
      {icon === 'snowflake' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <line x1="12" y1="2" x2="12" y2="22" /><line x1="20" y1="12" x2="4" y2="12" /><line x1="17.66" y1="17.66" x2="6.34" y2="6.34" /><line x1="6.34" y1="17.66" x2="17.66" y2="6.34" />
        </svg>
      )}
      {icon === 'mountain' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      )}
      {icon === 'bike' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6h-5l-3 7h11.5" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'compass' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )}
      {icon === 'bag' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M6 20h12a2 2 0 0 0 2-2V8H4v10a2 2 0 0 0 2 2z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      )}
      {icon === 'calendar' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )}
      {icon === 'map' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      )}
      {icon === 'globe' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
      {icon === 'zap' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )}
      {icon === 'scale' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        </svg>
      )}
      {icon === 'shield' && (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
    </div>
  );
}

interface KitConfiguratorWizardProps {
  isMobile?: boolean;
}

export default function KitConfiguratorWizard({ isMobile = false }: KitConfiguratorWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { triggerHaptic } = useHapticFeedback();

  const groupId = searchParams?.get('groupId');
  const carnetId = searchParams?.get('carnetId');
  const trailName = searchParams?.get('trail');

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<number, string>>({
    1: 'trek',
    2: '3-5d',
    3: 'frais_brumeux',
    4: 'equilibre',
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [userInventory, setUserInventory] = useState<OwnedGearItem[]>([]);
  const [groupInfo, setGroupInfo] = useState<{
    groupName: string;
    destination: string;
    membersCount: number;
    sharedItems: OwnedGearItem[];
  } | null>(null);
  const [carnetData, setCarnetData] = useState<CarnetContextData | null>(null);
  const [report, setReport] = useState<ConnectedKitReport | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load context on mount
  useEffect(() => {
    async function loadContext() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const inv = await fetchUserInventory(user.id);
        setUserInventory(inv);
      }

      if (groupId) {
        const grp = await fetchGroupContext(groupId);
        setGroupInfo(grp);
      }

      if (carnetId) {
        const carnet = await fetchCarnetContext(carnetId);
        if (carnet) {
          setCarnetData(carnet);
          if (carnet.weather) {
            const lowerWeather = carnet.weather.toLowerCase();
            if (lowerWeather.includes('chaud') || lowerWeather.includes('sec')) {
              setAnswers(prev => ({ ...prev, 3: 'sec_chaud' }));
            } else if (lowerWeather.includes('pluie') || lowerWeather.includes('vent')) {
              setAnswers(prev => ({ ...prev, 3: 'pluvieux_vente' }));
            } else if (lowerWeather.includes('froid') || lowerWeather.includes('neige')) {
              setAnswers(prev => ({ ...prev, 3: 'froid_sec' }));
            }
          }
        }
      }
    }
    loadContext();
  }, [groupId, carnetId]);

  // Compute connected report dynamically
  useEffect(() => {
    async function updateReport() {
      const rep = await computeConnectedReport({
        answers,
        userOwnedGear: userInventory,
        groupMode: Boolean(groupId || groupInfo),
        groupMembersCount: groupInfo?.membersCount ?? 1,
        sharedGroupItems: groupInfo?.sharedItems ?? [],
        carnetContext: carnetData,
      });
      setReport(rep);
    }
    updateReport();
  }, [answers, userInventory, groupInfo, groupId, carnetData]);

  const step = CONFIGURATOR_STEPS[currentStepIndex];

  const handleSelectOption = (optionId: string) => {
    triggerHaptic('selection');
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
  };

  const handleNext = () => {
    triggerHaptic('light');
    if (currentStepIndex < CONFIGURATOR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else if (report) {
      triggerHaptic('success');
      report.missingItems.forEach((item) => {
        addToCart({
          id: item.id,
          slug: item.slug || item.id,
          name: item.name,
          brand: item.brand,
          priceEur: item.priceEur,
          weightG: item.weightGrams,
          image: item.image,
          imageAlt: item.name,
          category: item.category,
        });
      });
      router.push('/panier');
    }
  };

  const handlePrev = () => {
    triggerHaptic('light');
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!report) return;
    setIsSaving(true);
    triggerHaptic('selection');
    try {
      const supabase = createClient();
      const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id;

      if (currentUserId) {
        const dest = carnetData?.destination || trailName || groupInfo?.destination || 'Voyage Outdoor';
        const season = answers[3] || 'frais_brumeux';
        const activity = answers[1] || 'trek';
        const totalWeightG = Math.round(report.totalWeightKg * 1000);

        const { data: session } = await supabase
          .from('configurator_sessions')
          .insert({
            user_id: currentUserId,
            destination: dest,
            country: 'France',
            season: season,
            activity: activity,
            level: answers[4] || 'equilibre',
            max_weight_g: totalWeightG,
            budget_eur: report.totalMissingPriceEur,
            climate: report.weatherLabel,
          })
          .select('id')
          .single();

        // 1. Persistance dans materiel_kits (table vivante unifiée des kits & lignées)
        const normalizedSeason = (() => {
          const s = (season || '').toLowerCase();
          if (s.includes('printemps')) return 'printemps';
          if (s.includes('ete') || s.includes('été')) return 'ete';
          if (s.includes('automne')) return 'automne';
          if (s.includes('hiver')) return 'hiver';
          return 'toute_saison';
        })();

        const { data: newMaterielKit } = await supabase
          .from('materiel_kits')
          .insert({
            user_id: currentUserId,
            name: `Kit ${dest} — ${activity}`,
            description: `Généré automatiquement par le Configurateur IA (${report.weatherLabel})`,
            season: normalizedSeason,
            total_weight_g: totalWeightG,
            origin: 'configurateur',
            is_public: false,
          })
          .select('id')
          .single();

        if (newMaterielKit && report.missingItems && report.missingItems.length > 0) {
          const materielItems = report.missingItems.map((item: any) => ({
            kit_id: newMaterielKit.id,
            user_id: currentUserId,
            name: item.name || 'Article',
            category: item.category || 'Autre',
            weight_g: item.weightG || 0,
            quantity: 1,
            is_checked: false,
          }));
          await supabase.from('materiel_kit_items').insert(materielItems);
        }

        // 2. Rapport de kit lié à materiel_kits.id (Bloqueur N°1 résolu)
        await supabase.from('kit_reports').insert({
          user_id: currentUserId,
          kit_id: newMaterielKit?.id || null,
          session_id: session?.id || null,
          destination: dest,
          country: 'France',
          season: season,
          activity: activity,
          level: answers[4] || 'equilibre',
          climate: report.weatherLabel,
          budget_eur: report.totalMissingPriceEur,
          selected_items: report.missingItems,
          total_weight_g: totalWeightG,
          total_price_eur: report.totalMissingPriceEur,
          status: 'active',
        });

        // 3. Miroir rétrocompatible dans custom_kits
        const { data: newCustomKit } = await supabase
          .from('custom_kits')
          .insert({
            user_id: currentUserId,
            name: `Kit ${dest} — ${activity}`,
            description: `Généré automatiquement par le Configurateur IA (${report.weatherLabel})`,
            for_destination: dest,
            season: season,
            activity: activity,
            total_weight_g: totalWeightG,
            source: 'configurator',
            status: 'active',
          })
          .select('id')
          .single();

        if (newCustomKit && report.missingItems && report.missingItems.length > 0) {
          const kitItemsToInsert = report.missingItems.map((item: any) => ({
            kit_id: newCustomKit.id,
            item_name: item.name || 'Article',
            category: item.category || 'Autre',
            weight_g: item.weightG || 0,
            quantity: 1,
            is_essential: Boolean(item.essential),
          }));
          await supabase.from('custom_kit_items').insert(kitItemsToInsert);
        }
      } else {
        // Mode invité
        try {
          const dest = carnetData?.destination || trailName || groupInfo?.destination || 'Voyage Outdoor';
          const localKey = 'lkdv_guest_kits';
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const newGuestKit = {
            id: newId(),
            user_id: 'guest',
            name: `Kit ${dest} — IA`,
            description: `Généré automatiquement par le Configurateur IA`,
            for_destination: dest,
            season: answers[3] || 'Toutes saisons',
            activity: answers[1] || 'randonnee',
            total_weight_g: Math.round(report.totalWeightKg * 1000),
            source: 'configurator',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_favorite: false,
            items: (report.missingItems || []).map((item: any) => ({
              id: newId(),
              kit_id: 'guest',
              item_name: item.name || 'Article',
              category: item.category || 'Autre',
              weight_g: item.weightG || 0,
              quantity: 1,
              is_essential: Boolean(item.essential),
              is_checked: false,
            })),
          };
          localStorage.setItem(localKey, JSON.stringify([newGuestKit, ...existing]));
        } catch {}
      }
      setSavedSuccess(true);
      triggerHaptic('success');
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (_e) {
      // Best effort
    } finally {
      setIsSaving(false);
    }
  };

  const nextStepLabel =
    currentStepIndex === 0
      ? 'Continuer vers Durée →'
      : currentStepIndex === 1
      ? 'Continuer vers Météo →'
      : currentStepIndex === 2
      ? 'Continuer vers Confort →'
      : currentStepIndex === 3
      ? 'Voir le récapitulatif 360° →'
      : 'Ajouter les manquants au panier →';

  return (
    <div className="w-full h-full flex flex-col font-sans text-[#17402C]">
      {/* ── TOP BREADCRUMB BADGES (Liquid Glass) ── */}
      <div className="flex items-center justify-between text-xs text-[#5A7064] mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 hover:bg-white text-xs font-bold text-[#17402C] border border-white/80 shadow-2xs transition-all">
            <span>🌲</span>
            <span>Configurateur IA</span>
          </Link>

          <span className="glass-pill text-[10px] font-mono font-bold text-[#17402C]">
            Étape {step.id}/5
          </span>

          {groupInfo && (
            <span className="glass-pill text-[10px] font-mono font-bold text-[#17402C]">
              👥 {groupInfo.groupName}
            </span>
          )}

          {carnetData && (
            <span className="glass-pill text-[10px] font-mono font-bold text-[#17402C]">
              📖 {carnetData.title}
            </span>
          )}

          {userInventory.length > 0 && (
            <span className="glass-pill text-[10px] font-mono font-bold text-[#5B7F55]">
              🎒 {userInventory.length} matériel(s) détecté(s)
            </span>
          )}
        </div>

        <Link
          href="/"
          className="text-xs text-[#5A7064] hover:text-[#17402C] transition-colors font-medium px-2 py-1 rounded-lg hover:bg-white/60"
        >
          Quitter ✕
        </Link>
      </div>

      {/* ── MAIN 2-COLUMN COCKPIT CARD (Liquid Glass) ── */}
      <div className="glass rounded-[2rem] overflow-hidden grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 border border-white/60 shadow-lg">

        {/* ── LEFT PANEL: STEPPER & CHOICES (7 Cols) ── */}
        <div className="lg:col-span-7 flex flex-col p-5 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-white/40 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">

            {/* Stepper Capsules Bar */}
            <div className="flex items-center gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-1">
              {CONFIGURATOR_STEPS.map((s, idx) => {
                const isDone = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;

                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      triggerHaptic('light');
                      startTransition(() => setCurrentStepIndex(idx));
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                        : isDone
                        ? 'bg-white text-[#17402C] border-white/90 shadow-2xs'
                        : 'bg-white/70 hover:bg-white text-[#5A7064] border-white/60 shadow-2xs'
                    }`}
                  >
                    {isDone ? (
                      <span className="w-4 h-4 rounded-full bg-[#5B7F55] text-white flex items-center justify-center text-[9px] font-bold">✓</span>
                    ) : (
                      <span className={`w-4 h-4 rounded-full ${isActive ? 'bg-white text-[#17402C]' : 'bg-[#17402C]/10 text-[#17402C]'} flex items-center justify-center text-[9.5px] font-bold font-mono`}>
                        {s.id}
                      </span>
                    )}
                    <span>{s.badge.split('·')[0].replace(/^\d+\s*/, '')}</span>
                  </button>
                );
              })}
            </div>

            {/* Step Badge */}
            <div className="mb-2">
              <span className="glass-pill text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
                {step.badge}
              </span>
            </div>

            {/* Hero Question Title with Serif Accent */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-[#17402C] tracking-tight mb-2 leading-tight">
              {step.titlePrefix}{' '}
              <span className="font-serif italic font-normal text-[#8C6418]">{step.titleItalic}</span>{' '}
              {step.titleSuffix || ''}
            </h1>

            {/* Subtitle */}
            <p className="font-serif italic text-xs sm:text-sm text-[#5A7064] leading-relaxed max-w-xl mb-6">
              {step.subtitle}
            </p>

            {/* 2x2 Choice Cards Grid (Steps 1 to 4) */}
            {step.options.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                {step.options.map((opt) => {
                  const isSelected = answers[step.id] === opt.id;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`glass-sub-card p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between border ${
                        isSelected
                          ? '!bg-white/95 !border-[#17402C] shadow-md ring-2 ring-[#17402C]/10'
                          : 'hover:!bg-white/80'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <StepIcon icon={opt.icon} active={isSelected} />
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[#17402C] border-[#17402C] text-white' : 'border-[#17402C]/20 bg-white/60'
                        }`}>
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-display font-bold text-sm text-[#17402C] mb-1">
                          {opt.titlePrefix}{' '}
                          <span className="font-serif italic font-normal text-[#8C6418]">{opt.titleItalic}</span>
                        </h3>
                        <p className="text-xs text-[#5A7064] leading-snug">{opt.subtext}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Step 5: Connected 360° Intelligent Report Breakdown */
              report && (
                <div className="space-y-4 mb-6">
                  {/* Preparation Score Banner */}
                  <div className="glass-sub-card p-4 sm:p-5 rounded-2xl border border-white/70">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55] mb-1.5 inline-block">
                          SCORE DE PRÉPARATION
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display font-bold text-3xl text-[#17402C]">{report.preparationScore}%</span>
                          <span className="text-xs text-[#5A7064] font-medium">prêt pour le départ</span>
                        </div>
                        <p className="text-xs text-[#5A7064] mt-1">{report.summary}</p>
                      </div>

                      <div className="w-16 h-16 rounded-2xl bg-white border border-white flex flex-col items-center justify-center shadow-xs">
                        <span className="text-xl">🏔️</span>
                        <span className="text-[9px] font-mono font-bold text-[#17402C]">LKDV AI</span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Owned Items (from user's inventory) */}
                  <div className="glass-sub-card p-4 rounded-2xl border border-white/60">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#17402C]">
                        🎒 Matériel Déjà Possédé ({report.ownedItems.length} articles)
                      </h4>
                      <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55]">
                        0 € à débourser
                      </span>
                    </div>

                    {report.ownedItems.length > 0 ? (
                      <div className="space-y-1.5 text-xs">
                        {report.ownedItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-1 border-b border-[#17402C]/5 last:border-none">
                            <span className="font-semibold text-[#17402C] flex items-center gap-1.5">
                              <span className="text-[#5B7F55]">✓</span> {item.name} ({item.brand || 'Perso'})
                            </span>
                            <span className="text-[11px] text-[#5A7064] font-mono">{(item.weightGrams / 1000).toFixed(2)} kg</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#5A7064] italic">
                        Aucun équipement correspondant dans votre inventaire. Les articles ci-dessous sont recommandés.
                      </p>
                    )}
                  </div>

                  {/* Section: Missing Items */}
                  <div className="glass-sub-card p-4 rounded-2xl border border-white/60">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#17402C]">
                        🛒 Matériel Recommandé ({report.missingItems.length} articles)
                      </h4>
                      <span className="font-bold text-xs font-mono text-[#17402C]">
                        Total : {report.totalMissingPriceEur} €
                      </span>
                    </div>

                    <div className="space-y-2">
                      {report.missingItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-[#17402C]/5 last:border-none">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white shadow-2xs" />
                            <div className="truncate">
                              <p className="font-bold text-[#17402C] truncate">{item.name}</p>
                              <p className="text-[10.5px] text-[#5A7064] truncate">{item.brand} · {item.reason}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold font-mono text-[#17402C]">{item.priceEur} €</p>
                            <p className="text-[10px] text-[#5A7064] font-mono">{(item.weightGrams / 1000).toFixed(2)} kg</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section: Weather / Security Alerts */}
                  {report.inadequateAlerts.length > 0 && (
                    <div className="glass-sub-card p-4 rounded-2xl border border-amber-200/60 bg-amber-50/40">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
                        <span>⚠️</span> Points de vigilance terrain
                      </h4>
                      <div className="space-y-2 text-xs">
                        {report.inadequateAlerts.map((alert, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-white/70 border border-white/60 space-y-0.5">
                            <p className="font-bold text-[#17402C]">{alert.item}</p>
                            <p className="text-xs text-[#5A7064]">{alert.issue}</p>
                            <p className="text-[11px] text-[#5B7F55] font-semibold">💡 {alert.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save Configuration Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleSaveConfiguration}
                      disabled={isSaving}
                      className="w-full glass-capsule-btn text-xs font-bold !py-2.5 flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Icon name="BookmarkIcon" size={14} />
                      <span>
                        {savedSuccess
                          ? '✅ Configuration enregistrée dans Mon Matériel !'
                          : isSaving
                          ? 'Sauvegarde...'
                          : 'Enregistrer ce kit dans Mon Matériel'}
                      </span>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Bottom Desktop Actions Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-white/40 shrink-0">
            {currentStepIndex > 0 ? (
              <button
                onClick={handlePrev}
                className="glass-capsule-btn text-xs font-bold !py-2 !px-4"
              >
                ‹ Étape précédente
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              className="glass-capsule-btn primary text-xs font-bold !py-2 !px-5 shadow-sm"
            >
              <span>{nextStepLabel}</span>
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL: LIVE COCKPIT & BACKPACK (5 Cols) ── */}
        <div className="lg:col-span-5 relative p-5 sm:p-8 lg:p-10 flex flex-col justify-between overflow-hidden bg-white/25">
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4">
            
            {/* Live Status Pill */}
            <div className="flex items-center justify-between">
              <span className="glass-pill text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#17402C] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B7F55] animate-pulse" />
                VOTRE SAC EN TEMPS RÉEL
              </span>

              {report && (
                <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55]">
                  {report.totalWeightKg} KG TOTAL
                </span>
              )}
            </div>

            {/* Header Card */}
            <div className="glass-sub-card p-4 rounded-2xl border border-white/70 space-y-1">
              <h2 className="font-display font-bold text-xl text-[#17402C] leading-tight">
                Composition <span className="font-serif italic font-normal text-[#8C6418]">intelligente</span>
              </h2>
              <p className="font-serif italic text-xs text-[#5A7064] leading-relaxed">
                Le configurateur assemble et calibre le poids de votre portage à chaque étape.
              </p>
            </div>

            {/* Live Breakdown List */}
            {report && (
              <div className="glass-sub-card p-4 rounded-2xl border border-white/70 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-[#17402C]/5 pb-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#5A7064]">
                    CONTENU ({report.ownedItems.length + report.missingItems.length} PIÈCES)
                  </span>
                  <span className="font-bold text-[#17402C] font-mono text-xs">
                    {report.totalWeightKg} kg
                  </span>
                </div>

                <div className="space-y-1.5 text-xs max-h-44 overflow-y-auto no-scrollbar pr-0.5">
                  {report.ownedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#5B7F55] text-white flex items-center justify-center text-[8.5px] font-bold shrink-0">✓</span>
                        <span className="truncate text-[#17402C] font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono text-[#5B7F55] shrink-0 text-[9.5px] bg-white/80 px-1.5 py-0.2 rounded border border-white">Possédé</span>
                    </div>
                  ))}

                  {report.missingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-3.5 h-3.5 rounded-full border border-[#17402C]/30 bg-white shrink-0" />
                        <span className="truncate text-[#365233]">{item.name}</span>
                      </div>
                      <span className="font-mono text-[#17402C] font-semibold shrink-0 text-xs">{item.priceEur} €</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#17402C]/5 flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase font-bold text-[#5A7064]">BUDGET MANQUANT</span>
                  <span className="font-bold font-mono text-base text-[#17402C]">{report.totalMissingPriceEur} €</span>
                </div>
              </div>
            )}

            {/* 4 Metadata Cards in Glass */}
            {report && (
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="glass-sub-card p-3 rounded-xl border border-white/60">
                  <p className="text-[9.5px] font-mono text-[#5A7064] uppercase tracking-wider mb-0.5">DURÉE</p>
                  <p className="font-bold text-[#17402C] truncate text-xs">{report.durationLabel}</p>
                </div>
                <div className="glass-sub-card p-3 rounded-xl border border-white/60">
                  <p className="text-[9.5px] font-mono text-[#5A7064] uppercase tracking-wider mb-0.5">MÉTÉO</p>
                  <p className="font-bold text-[#17402C] truncate text-xs">{report.weatherLabel}</p>
                </div>
                <div className="glass-sub-card p-3 rounded-xl border border-white/60">
                  <p className="text-[9.5px] font-mono text-[#5A7064] uppercase tracking-wider mb-0.5">POIDS ESTIMÉ</p>
                  <p className="font-bold text-[#17402C] text-xs">{report.totalWeightKg} kg</p>
                </div>
                <div className="glass-sub-card p-3 rounded-xl border border-white/60">
                  <p className="text-[9.5px] font-mono text-[#5A7064] uppercase tracking-wider mb-0.5">CO₂ ESTIMÉ</p>
                  <p className="font-bold text-[#17402C] text-xs">{report.carbonEstimateKg} kg CO₂</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 shrink-0 pt-3 border-t border-white/40 text-[11px] font-serif italic text-[#5A7064] text-center">
            Optimisation intelligente propulsée par le moteur terrain LKDV.
          </div>
        </div>

      </div>

      {/* ── MOBILE STICKY BOTTOM ACTION BAR (Liquid Glass) ── */}
      {report && (
        <div
          className="lg:hidden fixed left-2.5 right-2.5 z-[90] glass border border-white/80 p-3 px-4 flex items-center justify-between shadow-xl rounded-2xl"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
        >
          <div>
            <p className="text-[9.5px] font-mono text-[#5B7F55] uppercase tracking-wider font-bold">
              {report.totalWeightKg} KG · {report.ownedItems.length + report.missingItems.length} PIÈCES
            </p>
            <p className="text-sm font-bold font-mono text-[#17402C]">
              {report.totalMissingPriceEur} € <span className="text-[11px] font-normal text-[#5A7064]">manquants</span>
            </p>
          </div>

          <button
            onClick={handleNext}
            className="glass-capsule-btn primary text-xs font-bold !py-2.5 !px-5 shadow-sm"
          >
            {nextStepLabel}
          </button>
        </div>
      )}
    </div>
  );
}
