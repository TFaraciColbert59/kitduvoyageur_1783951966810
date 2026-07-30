'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CONFIGURATOR_STEPS } from '@/lib/configuratorData';
import { addToCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
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
  const iconColor = active ? 'text-white' : 'text-[#3A4A3D]';
  const badgeBg = active ? 'bg-[#1C3829]' : 'bg-[#F2EFE8]';

  return (
    <div className={`w-9 h-9 rounded-full ${badgeBg} flex items-center justify-center flex-shrink-0 transition-colors`}>
      {icon === 'sun' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
      {icon === 'cloud-fog' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /><line x1="4" y1="22" x2="20" y2="22" />
        </svg>
      )}
      {icon === 'rain' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        </svg>
      )}
      {icon === 'snowflake' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <line x1="12" y1="2" x2="12" y2="22" /><line x1="20" y1="12" x2="4" y2="12" /><line x1="17.66" y1="17.66" x2="6.34" y2="6.34" /><line x1="6.34" y1="17.66" x2="17.66" y2="6.34" />
        </svg>
      )}
      {icon === 'mountain' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      )}
      {icon === 'bike' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6h-5l-3 7h11.5" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'compass' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )}
      {icon === 'bag' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M6 20h12a2 2 0 0 0 2-2V8H4v10a2 2 0 0 0 2 2z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      )}
      {icon === 'calendar' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )}
      {icon === 'map' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      )}
      {icon === 'globe' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
      {icon === 'zap' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )}
      {icon === 'scale' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        </svg>
      )}
      {icon === 'shield' && (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor} viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
    </div>
  );
}

export default function KitConfiguratorWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

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
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
  };

  const handleNext = () => {
    if (currentStepIndex < CONFIGURATOR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else if (report) {
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
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!report) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id;

      if (currentUserId) {
        const { data: session } = await supabase
          .from('configurator_sessions')
          .insert({
            user_id: currentUserId,
            destination: carnetData?.destination || trailName || groupInfo?.destination || 'Voyage Outdoor',
            country: 'France',
            season: answers[3] || 'frais_brumeux',
            activity: answers[1] || 'trek',
            level: answers[4] || 'equilibre',
            max_weight_g: Math.round(report.totalWeightKg * 1000),
            budget_eur: report.totalMissingPriceEur,
            climate: report.weatherLabel,
          })
          .select('id')
          .single();

        await supabase.from('kit_reports').insert({
          user_id: currentUserId,
          session_id: session?.id || null,
          destination: carnetData?.destination || trailName || groupInfo?.destination || 'Voyage Outdoor',
          country: 'France',
          season: answers[3] || 'frais_brumeux',
          activity: answers[1] || 'trek',
          level: answers[4] || 'equilibre',
          climate: report.weatherLabel,
          budget_eur: report.totalMissingPriceEur,
          selected_items: report.missingItems,
          total_weight_g: Math.round(report.totalWeightKg * 1000),
          total_price_eur: report.totalMissingPriceEur,
          status: 'active',
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (_e) {
      // Best effort
    } finally {
      setIsSaving(false);
    }
  };

  const nextStepLabel =
    currentStepIndex === 0
      ? 'Continuer vers Durée'
      : currentStepIndex === 1
      ? 'Continuer vers Météo'
      : currentStepIndex === 2
      ? 'Continuer vers Confort'
      : currentStepIndex === 3
      ? 'Voir le récapitulatif 360°'
      : 'Ajouter les manquants au panier →';

  return (
    <div className="w-full max-w-[1360px] mx-auto px-2 sm:px-6 font-sans text-[#1C2620] pb-24 sm:pb-8">
      {/* ── TOP BREADCRUMB BADGES ── */}
      <div className="flex items-center justify-between text-xs text-[#7A8A7D] mb-3 px-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[#1C3829] tracking-tight">Configurateur IA</span>
          <span>Étape {step.id}/5</span>
          {groupInfo && (
            <span className="bg-[#1C3829] text-white px-2.5 py-0.5 rounded-full font-medium">
              👥 Groupe: {groupInfo.groupName}
            </span>
          )}
          {carnetData && (
            <span className="bg-[#1C3829] text-white px-2.5 py-0.5 rounded-full font-medium">
              📖 Carnet: {carnetData.title}
            </span>
          )}
          {userInventory.length > 0 && (
            <span className="bg-[#EAF0EC] text-[#1C3829] border border-[#1C3829]/20 px-2 py-0.5 rounded-full font-medium">
              🎒 {userInventory.length} matériel(s) détecté(s)
            </span>
          )}
        </div>
      </div>

      {/* ── MAIN CONTAINER CARD ── */}
      <div className="bg-white rounded-[28px] border border-[#E2DDD0] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* ── LEFT PANEL (Steps & Selection Cards) ── */}
        <div className="lg:col-span-7 flex flex-col p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-[#EBE7DE] justify-between">
          
          <div>
            {/* Single Header Navbar inside card */}
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#F0ECE1]">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 bg-[#1C3829] rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
                  </svg>
                </div>
                <span className="font-bold text-sm tracking-tight text-[#1C3829]">Le Kit du Voyageur</span>
              </Link>

              <nav className="hidden sm:flex items-center gap-5 text-xs text-[#526356] font-medium">
                <Link href="/explorer" className="hover:text-[#1C3829] transition-colors">Aventures</Link>
                <Link href="/shop" className="hover:text-[#1C3829] transition-colors">Boutique</Link>
                <Link href="/inventaire" className="hover:text-[#1C3829] transition-colors">Mon Inventaire</Link>
              </nav>

              <Link href="/" className="text-xs text-[#7A8A7D] hover:text-[#1C3829] transition-colors font-medium">
                Quitter ✕
              </Link>
            </div>

            {/* Stepper Progress Bar */}
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
              {CONFIGURATOR_STEPS.map((s, idx) => {
                const isDone = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;

                return (
                  <button
                    key={s.id}
                    onClick={() => startTransition(() => setCurrentStepIndex(idx))}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#1C3829] text-white shadow-sm'
                        : isDone
                        ? 'bg-[#EAF0EC] text-[#1C3829] hover:bg-[#DDE7E0]'
                        : 'bg-[#F4F1EA] text-[#8C9C8F] hover:bg-[#EAE6DD]'
                    }`}
                  >
                    {isDone ? (
                      <span className="w-4 h-4 rounded-full bg-[#1C3829] text-white flex items-center justify-center text-[10px]">✓</span>
                    ) : (
                      <span className={`w-4 h-4 rounded-full ${isActive ? 'bg-white text-[#1C3829]' : 'bg-[#D6D0C2] text-white'} flex items-center justify-center text-[10px] font-bold`}>
                        {s.id}
                      </span>
                    )}
                    <span>{s.badge.split('·')[0].replace(/^\d+\s*/, '')}</span>
                  </button>
                );
              })}
            </div>

            {/* Step Badge */}
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#7A8A7D] font-medium mb-2">
              {step.badge}
            </p>

            {/* Hero Question Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1C2620] tracking-tight mb-2 leading-tight">
              {step.titlePrefix}
              <span className="font-serif italic font-normal text-[#1C3829]">{step.titleItalic}</span>
              {step.titleSuffix || ''}
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-[#5C6E60] leading-relaxed max-w-xl mb-6">
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
                      className={`group relative p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-[#1C3829] bg-white shadow-md shadow-[#1C3829]/5'
                          : 'border-[#E2DDD0] bg-[#FAF8F3] hover:border-[#1C3829]/40 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <StepIcon icon={opt.icon} active={isSelected} />
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#1C3829] text-white flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-[#1C2620] mb-1">
                          {opt.titlePrefix}
                          <span className="font-serif italic font-normal text-[#1C3829]">{opt.titleItalic}</span>
                        </h3>
                        <p className="text-xs text-[#6B7A6E] leading-snug">{opt.subtext}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Step 5: Connected 360° Intelligent Report Breakdown */
              report && (
                <div className="space-y-5 mb-6 max-h-[420px] overflow-y-auto pr-1">
                  {/* Preparation Score Banner */}
                  <div className="flex items-center justify-between bg-[#1C3829] text-white p-5 rounded-2xl shadow-lg">
                    <div>
                      <p className="text-xs text-[#B5D4BF] font-mono uppercase">Niveau de préparation</p>
                      <h3 className="text-2xl font-bold font-mono text-white mt-0.5">
                        {report.preparationScore}% PRÊT
                      </h3>
                      <p className="text-xs text-white/80 mt-1">{report.summary}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full border-4 border-[#34D399] flex items-center justify-center font-bold text-lg font-mono">
                      {report.preparationScore}%
                    </div>
                  </div>

                  {/* Section: Owned Items (from user's inventory) */}
                  <div className="bg-[#F4F8F5] p-4 rounded-2xl border border-[#C5DED0]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-[#1C3829] font-bold">
                        🎒 Matériel déjà possédé ({report.ownedItems.length} article(s))
                      </h4>
                      <span className="text-xs text-[#5C6E60] font-medium">0 € dépensés</span>
                    </div>
                    {report.ownedItems.length > 0 ? (
                      <div className="space-y-1.5 text-xs">
                        {report.ownedItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-1 border-b border-[#D8E6DE] last:border-none">
                            <span className="font-semibold text-[#1C3829]">✓ {item.name} ({item.brand || 'Perso'})</span>
                            <span className="text-[11px] text-[#5C6E60] font-mono">{item.weightGrams / 1000} kg</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#7A8A7D] italic">
                        Aucun équipement correspondant trouvé dans votre inventaire. Les articles ci-dessous sont recommandés.
                      </p>
                    )}
                  </div>

                  {/* Section: Missing Items (from real shop_products) */}
                  <div className="bg-white p-4 rounded-2xl border border-[#E2DDD0] shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-[#17402C] font-bold">
                        🛒 Matériel manquant à acquérir ({report.missingItems.length} article(s))
                      </h4>
                      <span className="text-xs font-bold text-[#1C3829] font-mono">
                        Total: {report.totalMissingPriceEur} €
                      </span>
                    </div>
                    <div className="space-y-2">
                      {report.missingItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-[#F0ECE1] last:border-none">
                          <div className="flex items-center gap-3">
                            <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                            <div>
                              <p className="font-bold text-[#1C2620]">{item.name}</p>
                              <p className="text-[11px] text-[#7A8A7D]">{item.brand} · {item.reason}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold font-mono text-[#1C3829]">{item.priceEur} €</p>
                            <p className="text-[10px] text-[#7A8A7D] font-mono">{item.weightGrams / 1000} kg</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section: Weather / Security Alerts */}
                  {report.inadequateAlerts.length > 0 && (
                    <div className="bg-[#FFF8F5] p-4 rounded-2xl border border-[#FCD8C8]">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-[#17402C] font-bold mb-2">
                        ⚠️ Alertes & Points d’attention
                      </h4>
                      <div className="space-y-2 text-xs">
                        {report.inadequateAlerts.map((alert, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-[#FCD8C8]">
                            <p className="font-bold text-[#1C2620] mb-1">{alert.item}</p>
                            <p className="text-[#17402C] mb-1">{alert.issue}</p>
                            <p className="text-[#5C6E60] font-medium">💡 {alert.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save actions */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSaveConfiguration}
                      disabled={isSaving}
                      className="flex-1 py-2.5 rounded-xl border border-[#1C3829] text-[#1C3829] font-bold text-xs hover:bg-[#EAF0EC] transition-colors disabled:opacity-50"
                    >
                      {savedSuccess ? '✅ Configuration enregistrée !' : isSaving ? 'Sauvegarde...' : '💾 Enregistrer la configuration sur mon compte'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Bottom Desktop Actions */}
          <div className="flex items-center justify-between pt-5 border-t border-[#F0ECE1]">
            {currentStepIndex > 0 ? (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#5C6E60] hover:text-[#1C3829] transition-colors"
              >
                ‹ Précédent
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-7 py-3 rounded-full bg-[#1C3829] hover:bg-[#152B1F] text-white font-semibold text-xs transition-all shadow-md shadow-[#1C3829]/20 hover:-translate-y-px"
            >
              <span>{nextStepLabel}</span>
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL (Dark Glassmorphic Live Kit Summary) ── */}
        <div className="lg:col-span-5 relative bg-[#122419] text-white p-6 sm:p-10 flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1E3B2A] via-[#122419] to-[#0A140E] opacity-90" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517649763962-0c623266010b?w=800')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-[11px] font-mono tracking-widest text-[#B5D4BF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <span>VOTRE SAC EN CONSTRUCTION</span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                Un kit <span className="font-serif italic font-normal text-[#B5D4BF]">en cours</span> de composition.
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                On assemble en temps réel. Vous pourrez tout modifier à l’étape finale.
              </p>
            </div>

            {/* Glassmorphic Live Panel */}
            {report && (
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-3">
                  <span className="font-mono uppercase tracking-wider text-white/70">
                    CONTENU · {report.ownedItems.length + report.missingItems.length} PIÈCES
                  </span>
                  <span className="font-bold text-[#B5D4BF] bg-white/10 px-2.5 py-1 rounded-md font-mono">
                    {report.totalWeightKg} KG
                  </span>
                </div>

                <div className="space-y-2 text-xs max-h-48 overflow-y-auto pr-1">
                  {report.ownedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#34D399] text-[#122419] flex items-center justify-center text-[10px] font-bold flex-shrink-0">✓</span>
                        <span className="truncate text-white font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono text-[#B5D4BF] flex-shrink-0 text-[10px] bg-white/10 px-2 py-0.5 rounded">Possédé</span>
                    </div>
                  ))}

                  {report.missingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 rounded-full border border-white/30 flex-shrink-0" />
                        <span className="truncate text-white/70 font-normal">{item.name}</span>
                      </div>
                      <span className="font-mono text-white/80 flex-shrink-0">{item.priceEur} €</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/15 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-white/70">À ACQUÉRIR</span>
                  <span className="text-2xl font-bold font-mono text-white">{report.totalMissingPriceEur} €</span>
                </div>
              </div>
            )}

            {/* Metadata Pills */}
            {report && (
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                  <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">ADAPTÉ POUR</p>
                  <p className="font-semibold text-white truncate">{report.durationLabel}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                  <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">MÉTÉO</p>
                  <p className="font-semibold text-white truncate">{report.weatherLabel}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                  <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">POIDS TOTAL</p>
                  <p className="font-semibold text-white">{report.totalWeightKg} kg</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                  <p className="text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">CO₂ ESTIMÉ</p>
                  <p className="font-semibold text-white">{report.carbonEstimateKg} kg CO₂</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 pt-4 border-t border-white/10 text-[11px] text-white/50">
            Le sac se met à jour à chaque étape. Vous pourrez tout modifier avant paiement.
          </div>
        </div>

      </div>

      {/* ── MOBILE STICKY BOTTOM ACTION BAR ── */}
      {report && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#122419] text-white border-t border-white/10 p-4 flex items-center justify-between shadow-2xl backdrop-blur-lg">
          <div>
            <p className="text-[10px] font-mono text-[#B5D4BF] uppercase tracking-wider">
              VOTRE SAC · {report.ownedItems.length + report.missingItems.length} PIÈCES · {report.totalWeightKg} KG
            </p>
            <p className="text-base font-bold font-mono text-white">
              {report.totalMissingPriceEur} € <span className="text-xs font-normal text-white/60">à acquérir</span>
            </p>
          </div>
          <button
            onClick={handleNext}
            className="px-5 py-2.5 rounded-full bg-[#34D399] text-[#122419] font-bold text-xs hover:bg-[#22C55E] transition-colors shadow-lg"
          >
            {nextStepLabel}
          </button>
        </div>
      )}
    </div>
  );
}
