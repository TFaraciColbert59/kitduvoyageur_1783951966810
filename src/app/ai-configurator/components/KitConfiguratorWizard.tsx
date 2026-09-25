'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CONFIGURATOR_STEPS } from '@/lib/configuratorData';
import { addToCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { newId } from '@/lib/uuid';
import Icon from '@/components/ui/AppIcon';
import { MapPin, Compass, Zap, Mountain, Users, BookOpen, Package } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { applyConfiguratorKitToTripAction } from '@/app/voyages/kit-actions';
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
  const iconColor = active ? 'text-[var(--lkv-text-primary)]' : 'text-[var(--lkv-text-muted)]';
  const badgeBg = active ? 'bg-[color:var(--btn-tint)] shadow-2xs' : 'bg-[color:var(--glass-subtle-fill)]';

  return (
    <div className={`w-10 h-10 rounded-[var(--lkv-radius-lg)] ${badgeBg} border border-[color:var(--glass-border)] flex items-center justify-center flex-shrink-0 motion-safe:transition-[transform,background-color,border-color] motion-reduce:transition-none`}>
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

export interface TripConfiguratorContext {
  tripId: string;
  tripSlug: string;
  title: string;
  activity?: string;
  difficulty?: string;
  scale?: string;
  destination?: string;
  maxAltitudeM?: number;
  days?: number;
  countryCode?: string;
}

export interface KitConfiguratorWizardProps {
  isMobile?: boolean;
  tripContext?: TripConfiguratorContext;
  onClose?: () => void;
  onApplied?: () => void;
}

function deriveInitialConfig(tripContext?: TripConfiguratorContext) {
  if (!tripContext) {
    return {
      answers: {
        1: 'trek',
        2: '3-5d',
        3: 'frais_brumeux',
        4: 'equilibre',
      },
      stepIndex: 0,
    };
  }

  // 1. Usage / Activité
  let actChoice = 'trek';
  const act = (tripContext.activity || '').toLowerCase();
  if (act.includes('bike') || act.includes('velo') || act.includes('cycl')) {
    actChoice = 'bikepacking';
  } else if (act.includes('alpin') || act.includes('escalad') || act.includes('montagne')) {
    actChoice = 'alpinisme';
  } else if (act.includes('voyage') || act.includes('road') || act.includes('nomad')) {
    actChoice = 'voyage';
  } else if (act.includes('trek') || act.includes('rando') || act.includes('hik')) {
    actChoice = 'trek';
  }

  // 2. Durée / Autonomie
  let durChoice = '3-5d';
  if (tripContext.days) {
    if (tripContext.days <= 2) durChoice = '1-2d';
    else if (tripContext.days <= 5) durChoice = '3-5d';
    else if (tripContext.days <= 14) durChoice = '1-2w';
    else durChoice = '2w+';
  } else if (tripContext.scale) {
    if (tripContext.scale === 'day') durChoice = '1-2d';
    else if (tripContext.scale === 'short') durChoice = '3-5d';
    else if (tripContext.scale === 'long') durChoice = '1-2w';
    else if (tripContext.scale === 'expedition') durChoice = '2w+';
  }

  // 3. Météo attendue
  let weatherChoice = 'frais_brumeux';
  if (tripContext.maxAltitudeM && tripContext.maxAltitudeM > 2200) {
    weatherChoice = 'froid_sec';
  }

  // 4. Style de portage
  let comfortChoice = 'equilibre';
  const diff = (tripContext.difficulty || '').toLowerCase();
  if (diff.includes('facile') || diff.includes('easy')) {
    comfortChoice = 'grand_confort';
  } else if (diff.includes('difficile') || diff.includes('hard') || diff.includes('expert')) {
    comfortChoice = 'ultralight';
  }

  // Sauter les questions déjà résolues par le voyage (Y6.1)
  const hasActivity = Boolean(tripContext.activity);
  const hasDuration = Boolean(tripContext.days || tripContext.scale);
  const stepIndex = hasActivity && hasDuration ? 2 : hasActivity ? 1 : 0;

  return {
    answers: {
      1: actChoice,
      2: durChoice,
      3: weatherChoice,
      4: comfortChoice,
    },
    stepIndex,
  };
}

export default function KitConfiguratorWizard({
  isMobile = false,
  tripContext,
  onClose,
  onApplied,
}: KitConfiguratorWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { triggerHaptic } = useHapticFeedback();

  const groupId = searchParams?.get('groupId');
  const carnetId = searchParams?.get('carnetId');
  const trailName = searchParams?.get('trail');

  const initialConfig = deriveInitialConfig(tripContext);
  const [currentStepIndex, setCurrentStepIndex] = useState(initialConfig.stepIndex);
  const [answers, setAnswers] = useState<Record<number, string>>(initialConfig.answers);

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
  const [appliedToTrip, setAppliedToTrip] = useState(false);
  const [isApplyingToTrip, setIsApplyingToTrip] = useState(false);

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
    } else if (tripContext?.tripId) {
      handleApplyToTrip();
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

  const handleApplyToTrip = async () => {
    if (!report || !tripContext?.tripId) return;
    setIsApplyingToTrip(true);
    triggerHaptic('selection');
    try {
      const itemsToApply = (report.missingItems || []).map((item: any) => ({
        name: item.name || 'Article',
        category: item.category || 'misc',
        weightGrams: item.weightGrams || item.weightG || 0,
        essential: Boolean(item.essential),
      }));

      if (itemsToApply.length === 0) {
        itemsToApply.push({
          name: 'Kit outdoor essentiel',
          category: 'misc',
          weightGrams: Math.round(report.totalWeightKg * 1000),
          essential: true,
        });
      }

      const res = await applyConfiguratorKitToTripAction(
        tripContext.tripId,
        tripContext.tripSlug,
        itemsToApply
      );

      if (res.success) {
        setAppliedToTrip(true);
        triggerHaptic('success');
        onApplied?.();
        setTimeout(() => {
          setAppliedToTrip(false);
          onClose?.();
        }, 1500);
      }
    } catch (_e) {
      // Best effort
    } finally {
      setIsApplyingToTrip(false);
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
      : tripContext?.tripId
      ? 'Appliquer au sac du voyage →'
      : 'Ajouter les manquants au panier →';

  return (
    <div className="w-full h-full flex flex-col font-sans text-[var(--lkv-text-primary)]">
      {/* ── TOP BREADCRUMB BADGES (Liquid Glass) ── */}
      <div className="flex items-center justify-between text-xs text-[var(--lkv-text-muted)] mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {tripContext ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[color:var(--lkv-surface-paper)]/90 text-xs font-bold text-[var(--lkv-text-primary)] border border-[color:var(--glass-border)] shadow-2xs">
              <MapPin size={12} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span className="truncate max-w-[200px]">{tripContext.title}</span>
            </span>
          ) : (
            <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[color:var(--btn-tint)] hover:brightness-[1.05] text-xs font-bold text-[var(--lkv-text-primary)] border border-[color:var(--btn-glass-border)] shadow-2xs motion-safe:transition-[transform,background-color,border-color] motion-reduce:transition-none min-h-[var(--lkv-touch-min)] items-center">
              <Compass size={12} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span>Configurateur IA</span>
            </Link>
          )}

          <span className="glass-pill text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-primary)]">
            Étape {step.id}/5
          </span>

          {tripContext?.activity && (
            <span className="glass-pill inline-flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-secondary)]">
              <Zap size={11} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span>{tripContext.activity}</span>
            </span>
          )}

          {tripContext?.maxAltitudeM && tripContext.maxAltitudeM > 0 ? (
            <span className="glass-pill inline-flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-secondary)]">
              <Mountain size={11} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span>{tripContext.maxAltitudeM} m</span>
            </span>
          ) : null}

          {groupInfo && (
            <span className="glass-pill inline-flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-primary)]">
              <Users size={11} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span>{groupInfo.groupName}</span>
            </span>
          )}

          {carnetData && (
            <span className="glass-pill inline-flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-primary)]">
              <BookOpen size={11} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span>{carnetData.title}</span>
            </span>
          )}

          {userInventory.length > 0 && (
            <span className="glass-pill inline-flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-secondary)]">
              <Package size={11} className="shrink-0 text-[color:var(--glass-label)]" aria-hidden="true" />
              <span>{userInventory.length} matériel(s) détecté(s)</span>
            </span>
          )}
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="text-xs text-[var(--lkv-text-muted)] hover:text-[var(--lkv-text-primary)] transition-colors font-medium px-3 py-1.5 rounded-[var(--lkv-radius-sm)] hover:bg-[color:var(--btn-tint)] min-h-[var(--lkv-touch-min)] min-w-[var(--lkv-touch-min)] flex items-center justify-center cursor-pointer"
            aria-label="Fermer le configurateur"
          >
            Fermer ✕
          </button>
        ) : (
          <Link
            href="/"
            className="text-xs text-[var(--lkv-text-muted)] hover:text-[var(--lkv-text-primary)] transition-colors font-medium px-2 py-1 rounded-[var(--lkv-radius-sm)] hover:bg-[color:var(--btn-tint)] min-h-[var(--lkv-touch-min)] flex items-center"
          >
            Quitter ✕
          </Link>
        )}
      </div>

      {/* ── MAIN 2-COLUMN COCKPIT CARD (Liquid Glass) ── */}
      <div className="glass rounded-[var(--lkv-radius-card)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 border border-[color:var(--glass-border)] shadow-lg">

        {/* ── LEFT PANEL: STEPPER & CHOICES (7 Cols) ── */}
        <div className="lg:col-span-7 flex flex-col p-5 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-[color:var(--glass-border)] overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">

            {/* Stepper Capsules Bar */}
            <div className="flex items-center gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-1">
              {CONFIGURATOR_STEPS.map((s, idx) => {
                const isDone = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      startTransition(() => setCurrentStepIndex(idx));
                    }}
                    aria-label={`Aller à l'étape ${s.id} : ${s.badge}`}
                    aria-current={isActive ? 'step' : undefined}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap motion-safe:transition-[transform,background-color,border-color] motion-reduce:transition-none flex items-center gap-1.5 cursor-pointer border min-h-[var(--lkv-touch-min)] ${
                      isActive
                        ? 'bg-[var(--lkv-text-primary)] text-white border-[var(--lkv-text-primary)] shadow-sm'
                        : isDone
                        ? 'bg-[color:var(--btn-tint)] text-[var(--lkv-text-primary)] border-[color:var(--btn-glass-border)] shadow-2xs'
                        : 'bg-[color:var(--glass-subtle-fill)] hover:bg-[color:var(--btn-tint)] text-[var(--lkv-text-muted)] border-[color:var(--glass-border)] shadow-2xs'
                    }`}
                  >
                    {isDone ? (
                      <span className="w-4 h-4 rounded-full bg-[var(--lkv-text-secondary)] text-white flex items-center justify-center text-[length:var(--lkv-text-caption-2)] font-bold">✓</span>
                    ) : (
                      <span className={`w-4 h-4 rounded-full ${isActive ? 'bg-[color:var(--btn-tint)] text-[var(--lkv-text-primary)]' : 'bg-[var(--lkv-text-primary)]/10 text-[var(--lkv-text-primary)]'} flex items-center justify-center text-[length:var(--lkv-text-caption-2)] font-bold font-mono`}>
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
              <span className="glass-pill text-[length:var(--lkv-text-caption-2)] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
                {step.badge}
              </span>
            </div>

            {/* Hero Question Title with Serif Accent */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-[var(--lkv-text-primary)] tracking-tight mb-2 leading-tight">
              {step.titlePrefix}{' '}
              <span className="font-serif italic font-normal text-[var(--lkv-warning-dark)]">{step.titleItalic}</span>{' '}
              {step.titleSuffix || ''}
            </h1>

            {/* Subtitle */}
            <p className="font-serif italic text-xs sm:text-sm text-[var(--lkv-text-muted)] leading-relaxed max-w-xl mb-6">
              {step.subtitle}
            </p>

            {/* 2x2 Choice Cards Grid (Steps 1 to 4) */}
            {step.options.length > 0 ? (
              <>
                <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4 border-0 m-0 p-0">
                  <legend className="sr-only">{`${step.titlePrefix} ${step.titleItalic} — choisissez une option`}</legend>
                  <div
                    role="radiogroup"
                    aria-label={`${step.titlePrefix} ${step.titleItalic}`}
                    className="contents"
                  >
                  {step.options.map((opt) => {
                    const isSelected = answers[step.id] === opt.id;

                    return (
                      <div
                        key={opt.id}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        aria-label={`${opt.titlePrefix} ${opt.titleItalic} — ${opt.subtext}`}
                        onClick={() => handleSelectOption(opt.id)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleSelectOption(opt.id);
                          }
                        }}
                        className={`glass-sub-card p-4 sm:p-5 rounded-[var(--lkv-radius-lg)] cursor-pointer motion-safe:transition-[transform,background-color,border-color] motion-reduce:transition-none duration-200 flex flex-col justify-between border focus-visible:outline-2 focus-visible:outline-[var(--lkv-primary)] focus-visible:outline-offset-2 ${
                          isSelected
                            ? 'bg-[color:var(--lkv-surface-paper)] border-[var(--lkv-text-primary)] shadow-md ring-2 ring-[var(--lkv-text-primary)]/10'
                            : 'hover:bg-[color:var(--lkv-surface-paper)]/90'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <StepIcon icon={opt.icon} active={isSelected} />
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center motion-safe:transition-[transform,background-color,border-color] motion-reduce:transition-none ${
                            isSelected ? 'bg-[var(--lkv-text-primary)] border-[var(--lkv-text-primary)] text-white' : 'border-[var(--lkv-text-primary)]/20 bg-[color:var(--lkv-surface-paper)]/70'
                          }`}>
                            {isSelected && <span className="text-[length:var(--lkv-text-caption-2)] font-bold">✓</span>}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-display font-bold text-sm text-[var(--lkv-text-primary)] mb-1">
                            {opt.titlePrefix}{' '}
                            <span className="font-serif italic font-normal text-[var(--lkv-warning-dark)]">{opt.titleItalic}</span>
                          </h3>
                          <p className="text-xs text-[var(--lkv-text-muted)] leading-snug">{opt.subtext}</p>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </fieldset>

                {/* Mobile Quick Navigation placed directly after choices */}
                <div className="flex sm:hidden items-center justify-between pb-4">
                  {currentStepIndex > 0 ? (
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Revenir à l'étape précédente"
                      className="glass-capsule-btn text-xs font-bold min-h-[var(--lkv-touch-min)] py-2 px-4"
                    >
                      ‹ Précédent
                    </button>
                  ) : <div />}
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label={nextStepLabel}
                    className="glass-capsule-btn primary text-xs font-bold min-h-[var(--lkv-touch-min)] py-2 px-5 shadow-sm"
                  >
                    <span>{nextStepLabel}</span>
                  </button>
                </div>
              </>
            ) : (
              /* Step 5: Connected 360° Intelligent Report Breakdown */
              report && (
                <div className="space-y-4 mb-6">
                  {/* Preparation Score Banner */}
                  <div className="glass-sub-card p-4 sm:p-5 rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="glass-pill text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-secondary)] mb-1.5 inline-block">
                          SCORE DE PRÉPARATION
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display font-bold text-3xl text-[var(--lkv-text-primary)]">{report.preparationScore}%</span>
                          <span className="text-xs text-[var(--lkv-text-muted)] font-medium">prêt pour le départ</span>
                        </div>
                        <p className="text-xs text-[var(--lkv-text-muted)] mt-1">{report.summary}</p>
                      </div>

                      <div className="w-16 h-16 rounded-[var(--lkv-radius-lg)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] flex flex-col items-center justify-center shadow-xs">
                        <span className="text-xl">🏔️</span>
                        <span className="text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-primary)]">LKDV AI</span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Owned Items (from user's inventory) */}
                  <div className="glass-sub-card p-4 rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--lkv-text-primary)]">
                        🎒 Matériel Déjà Possédé ({report.ownedItems.length} articles)
                      </h4>
                      <span className="glass-pill text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-secondary)]">
                        0 € à débourser
                      </span>
                    </div>

                    {report.ownedItems.length > 0 ? (
                      <div className="space-y-1.5 text-xs">
                        {report.ownedItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-1 border-b border-[var(--lkv-text-primary)]/5 last:border-none">
                            <span className="font-semibold text-[var(--lkv-text-primary)] flex items-center gap-1.5">
                              <span className="text-[var(--lkv-text-secondary)]">✓</span> {item.name} ({item.brand || 'Perso'})
                            </span>
                            <span className="text-[length:var(--lkv-text-caption-2)] text-[var(--lkv-text-muted)] font-mono">{(item.weightGrams / 1000).toFixed(2)} kg</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--lkv-text-muted)] italic">
                        Aucun équipement correspondant dans votre inventaire. Les articles ci-dessous sont recommandés.
                      </p>
                    )}
                  </div>

                  {/* Section: Missing Items */}
                  <div className="glass-sub-card p-4 rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)]">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--lkv-text-primary)]">
                        🛒 Matériel Recommandé ({report.missingItems.length} articles)
                      </h4>
                      <span className="font-bold text-xs font-mono text-[var(--lkv-text-primary)]">
                        Total : {report.totalMissingPriceEur} €
                      </span>
                    </div>

                    <div className="space-y-2">
                      {report.missingItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-[var(--lkv-text-primary)]/5 last:border-none">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image} alt={item.name} className="w-8 h-8 rounded-[var(--lkv-radius-sm)] object-cover flex-shrink-0 border border-[color:var(--glass-border)] shadow-2xs" />
                            <div className="truncate">
                              <p className="font-bold text-[var(--lkv-text-primary)] truncate">{item.name}</p>
                              <p className="text-[length:var(--lkv-text-caption-2)] text-[var(--lkv-text-muted)] truncate">{item.brand} · {item.reason}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold font-mono text-[var(--lkv-text-primary)]">{item.priceEur} €</p>
                            <p className="text-[length:var(--lkv-text-caption-2)] text-[var(--lkv-text-muted)] font-mono">{(item.weightGrams / 1000).toFixed(2)} kg</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section: Weather / Security Alerts */}
                  {report.inadequateAlerts.length > 0 && (
                    <div className="glass-sub-card p-4 rounded-[var(--lkv-radius-lg)] border border-[var(--lkv-warning-bg)] bg-[var(--lkv-warning-bg)]">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--lkv-warning-dark)] mb-2 flex items-center gap-1.5">
                        <span>⚠️</span> Points de vigilance terrain
                      </h4>
                      <div className="space-y-2 text-xs">
                        {report.inadequateAlerts.map((alert, idx) => (
                          <div key={idx} className="p-2.5 rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-paper)]/80 border border-[color:var(--glass-border)] space-y-0.5">
                            <p className="font-bold text-[var(--lkv-text-primary)]">{alert.item}</p>
                            <p className="text-xs text-[var(--lkv-text-muted)]">{alert.issue}</p>
                            <p className="text-[length:var(--lkv-text-caption-2)] text-[var(--lkv-text-secondary)] font-semibold">💡 {alert.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply to Trip Button (Y6.1) */}
                  {tripContext?.tripId && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleApplyToTrip}
                        disabled={isApplyingToTrip}
                        className="w-full glass-capsule-btn primary text-xs font-bold py-3 flex items-center justify-center gap-2 shadow-sm min-h-[var(--lkv-touch-min)] cursor-pointer"
                      >
                        <Icon name="SparklesIcon" size={14} />
                        <span>
                          {appliedToTrip
                            ? '✅ Équipements appliqués au sac de l’expédition !'
                            : isApplyingToTrip
                            ? 'Intégration au voyage...'
                            : `Ajouter au sac de l’expédition (${report?.missingItems?.length || 0} recommandés)`}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Save Configuration Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveConfiguration}
                      disabled={isSaving}
                      className="w-full glass-capsule-btn text-xs font-bold py-2.5 flex items-center justify-center gap-2 shadow-xs min-h-[var(--lkv-touch-min)]"
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
          <div className="flex items-center justify-between pt-4 border-t border-[color:var(--glass-border)] shrink-0">
            {currentStepIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Revenir à l'étape précédente"
                className="glass-capsule-btn text-xs font-bold py-2 px-4 min-h-[var(--lkv-touch-min)]"
              >
                ‹ Étape précédente
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNext}
              aria-label={nextStepLabel}
              className="glass-capsule-btn primary text-xs font-bold py-2 px-5 shadow-sm min-h-[var(--lkv-touch-min)]"
            >
              <span>{nextStepLabel}</span>
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL: LIVE COCKPIT & BACKPACK (5 Cols) ── */}
        <div className="lg:col-span-5 relative p-5 sm:p-8 lg:p-10 flex flex-col justify-between overflow-hidden bg-[color:var(--glass-bg-medium)]">
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4">
            
            {/* Live Status Pill */}
            <div className="flex items-center justify-between">
              <span className="glass-pill text-[length:var(--lkv-text-caption-2)] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-primary)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--lkv-text-secondary)] motion-safe:animate-pulse" />
                VOTRE SAC EN TEMPS RÉEL
              </span>

              {report && (
                <span className="glass-pill text-[length:var(--lkv-text-caption-2)] font-mono font-bold text-[var(--lkv-text-secondary)]">
                  {report.totalWeightKg} KG TOTAL
                </span>
              )}
            </div>

            {/* Header Card */}
            <div className="glass-sub-card p-4 rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] space-y-1">
              <h2 className="font-display font-bold text-xl text-[var(--lkv-text-primary)] leading-tight">
                Composition <span className="font-serif italic font-normal text-[var(--lkv-warning-dark)]">intelligente</span>
              </h2>
              <p className="font-serif italic text-xs text-[var(--lkv-text-muted)] leading-relaxed">
                Le configurateur assemble et calibre le poids de votre portage à chaque étape.
              </p>
            </div>

            {/* Live Breakdown List */}
            {report && (
              <div className="glass-sub-card p-4 rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-[var(--lkv-text-primary)]/5 pb-2">
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
                    CONTENU ({report.ownedItems.length + report.missingItems.length} PIÈCES)
                  </span>
                  <span className="font-bold text-[var(--lkv-text-primary)] font-mono text-xs">
                    {report.totalWeightKg} kg
                  </span>
                </div>

                <div className="space-y-1.5 text-xs max-h-44 overflow-y-auto no-scrollbar pr-0.5">
                  {report.ownedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-3.5 h-3.5 rounded-full bg-[var(--lkv-text-secondary)] text-white flex items-center justify-center text-[length:var(--lkv-text-caption-2)] font-bold shrink-0">✓</span>
                        <span className="truncate text-[var(--lkv-text-primary)] font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono text-[var(--lkv-text-secondary)] shrink-0 text-[length:var(--lkv-text-caption-2)] bg-[color:var(--lkv-surface-paper)]/90 px-1.5 py-0.2 rounded border border-[color:var(--glass-border)]">Possédé</span>
                    </div>
                  ))}

                  {report.missingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-3.5 h-3.5 rounded-full border border-[var(--lkv-text-primary)]/30 bg-[color:var(--btn-tint)] shrink-0" />
                        <span className="truncate text-[var(--lkv-primary-soft)]">{item.name}</span>
                      </div>
                      <span className="font-mono text-[var(--lkv-text-primary)] font-semibold shrink-0 text-xs">{item.priceEur} €</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[var(--lkv-text-primary)]/5 flex items-center justify-between">
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase font-bold text-[var(--lkv-text-muted)]">BUDGET MANQUANT</span>
                  <span className="font-bold font-mono text-base text-[var(--lkv-text-primary)]">{report.totalMissingPriceEur} €</span>
                </div>
              </div>
            )}

            {/* 4 Metadata Cards in Glass */}
            {report && (
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="glass-sub-card p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)]">
                  <p className="text-[length:var(--lkv-text-caption-2)] font-mono text-[var(--lkv-text-muted)] uppercase tracking-wider mb-0.5">DURÉE</p>
                  <p className="font-bold text-[var(--lkv-text-primary)] truncate text-xs">{report.durationLabel}</p>
                </div>
                <div className="glass-sub-card p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)]">
                  <p className="text-[length:var(--lkv-text-caption-2)] font-mono text-[var(--lkv-text-muted)] uppercase tracking-wider mb-0.5">MÉTÉO</p>
                  <p className="font-bold text-[var(--lkv-text-primary)] truncate text-xs">{report.weatherLabel}</p>
                </div>
                <div className="glass-sub-card p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)]">
                  <p className="text-[length:var(--lkv-text-caption-2)] font-mono text-[var(--lkv-text-muted)] uppercase tracking-wider mb-0.5">POIDS ESTIMÉ</p>
                  <p className="font-bold text-[var(--lkv-text-primary)] text-xs">{report.totalWeightKg} kg</p>
                </div>
                <div className="glass-sub-card p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)]">
                  <p className="text-[length:var(--lkv-text-caption-2)] font-mono text-[var(--lkv-text-muted)] uppercase tracking-wider mb-0.5">CO₂ ESTIMÉ</p>
                  <p className="font-bold text-[var(--lkv-text-primary)] text-xs">{report.carbonEstimateKg} kg CO₂</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 shrink-0 pt-3 border-t border-[color:var(--glass-border)] text-[length:var(--lkv-text-caption-2)] font-serif italic text-[var(--lkv-text-muted)] text-center">
            Optimisation intelligente propulsée par le moteur terrain LKDV.
          </div>
        </div>

      </div>

      {/* ── MOBILE STICKY BOTTOM ACTION BAR (Liquid Glass) ── */}
      {report && (
        <div
          className="lg:hidden fixed left-2.5 right-2.5 z-[var(--z-command)] glass border border-[color:var(--glass-border)] p-3 px-4 flex items-center justify-between shadow-xl rounded-[var(--lkv-radius-lg)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
        >
          <div>
            <p className="text-[length:var(--lkv-text-caption-2)] font-mono text-[var(--lkv-text-secondary)] uppercase tracking-wider font-bold">
              {report.totalWeightKg} KG · {report.ownedItems.length + report.missingItems.length} PIÈCES
            </p>
            <p className="text-sm font-bold font-mono text-[var(--lkv-text-primary)]">
              {report.totalMissingPriceEur} € <span className="text-[length:var(--lkv-text-caption-2)] font-normal text-[var(--lkv-text-muted)]">manquants</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleNext}
            aria-label={nextStepLabel}
            className="glass-capsule-btn primary text-xs font-bold py-2.5 px-5 shadow-sm min-h-[var(--lkv-touch-min)]"
          >
            {nextStepLabel}
          </button>
        </div>
      )}
    </div>
  );
}
