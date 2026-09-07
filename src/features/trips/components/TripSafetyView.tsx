'use client';
import { lkvAlert } from '@/components/ui/dialogs';

import React from 'react';
import { TripFull, TripSafetyCheckpoint } from '../types/trip.types';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Shield, CheckCircle2, Clock, AlertTriangle, PhoneCall, Radio, Plus } from 'lucide-react';
import { LkvButton } from '@/components/ui/LkvButton';

interface TripSafetyViewProps {
  trip: TripFull;
}

const STATUS_CONFIG: Record<
  TripSafetyCheckpoint['status'],
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'En attente',
    bg: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
    text: 'text-amber-700',
    icon: <Clock size={14} />,
  },
  checked: {
    label: 'Validé',
    bg: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20',
    text: 'text-emerald-700',
    icon: <CheckCircle2 size={14} />,
  },
  missed: {
    label: 'En retard',
    bg: 'bg-rose-500/10 text-rose-800 border-rose-500/20',
    text: 'text-rose-700',
    icon: <AlertTriangle size={14} />,
  },
  alert_sent: {
    label: 'Alerte envoyée',
    bg: 'bg-red-500/15 text-red-900 border-red-500/30',
    text: 'text-red-700',
    icon: <Radio size={14} />,
  },
};

export function TripSafetyView({ trip }: TripSafetyViewProps) {
  const checkpoints = trip.safety_checkpoints || [];

  return (
    <div className="space-y-6">
      {/* En-tête Sécurité & Checkpoints */}
      <GlassCard tone="sage" blur="md" className="p-6 rounded-card border border-white/70">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-lkv-primary text-white shadow-md">
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-lkv-secondary uppercase tracking-wider">
                  Sécurité & Prévention
                </span>
              </div>
              <h2 className="text-xl font-bold text-lkv-primary mt-1">
                Points de contrôle & Copilote
              </h2>
              <p className="text-sm text-lkv-secondary mt-1 max-w-2xl leading-relaxed">
                Configurez des jalons horaires sur vos étapes clés afin de suivre votre progression
                et rassurer vos contacts d&apos;urgence.
              </p>
            </div>
          </div>
          {trip.permissions.canEdit && (
            <LkvButton
              variant="secondary"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => {
                lkvAlert('La configuration de nouveaux points de contrôle sera disponible prochainement.');
              }}
            >
              <Plus size={16} />
              Nouveau point
            </LkvButton>
          )}
        </div>
      </GlassCard>

      {/* Liste des checkpoints ou état vide */}
      {checkpoints.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-lkv-primary uppercase tracking-wider px-1">
            Points de passage programmés ({checkpoints.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checkpoints.map(cp => {
              const statusCfg = STATUS_CONFIG[cp.status] || STATUS_CONFIG.pending;
              return (
                <GlassCard
                  key={cp.id}
                  tone="neutral"
                  className="p-4 rounded-lg border border-white/60 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-base text-lkv-primary">{cp.label}</div>
                      <div className="text-xs text-lkv-secondary mt-1 flex items-center gap-1.5">
                        <Clock size={13} />
                        {new Date(cp.scheduled_at).toLocaleString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {cp.contact_name && (
                        <div className="text-xs text-lkv-secondary mt-2 flex items-center gap-1.5">
                          <PhoneCall size={12} />
                          <span>Contact : {cp.contact_name}</span>
                          {cp.contact_phone && <span className="text-lkv-primary font-medium">({cp.contact_phone})</span>}
                        </div>
                      )}
                      {cp.notes && (
                        <p className="text-xs text-lkv-secondary/90 italic mt-2">
                          « {cp.notes} »
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 shrink-0 ${statusCfg.bg}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Radio className="w-8 h-8" />}
          title="Aucun point de contrôle configuré"
          description="Définissez des points de passage clés pour sécuriser votre progression et transmettre vos alertes en cas d'imprévu."
        />
      )}

      {/* Rappels de sécurité & Urgences */}
      <GlassCard tone="neutral" blur="sm" className="p-6 rounded-card border border-white/60 bg-[#FAF8F5]/80">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-lkv-primary/10 text-lkv-primary">
            <PhoneCall size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-lkv-primary">
              Numéros d&apos;urgence & Consignes terrain
            </h3>
            <p className="text-xs sm:text-sm text-lkv-secondary mt-1 leading-relaxed">
              En Europe, composez le <strong>112</strong> en cas d&apos;urgence vitale (accessible même sans réseau de votre opérateur). Pour les alertes par SMS en zone blanche ou silencieuse, envoyez un message au <strong>114</strong>. En montagne, vérifiez toujours les prévisions météo locales avant le départ.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
