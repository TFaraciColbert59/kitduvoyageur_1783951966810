'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card } from '@/components/ui';

interface CarnetDetailRightSidebarProps {
  meta: {
    badge?: string;
    titleLine1: string;
    voyageurs?: number;
    dateRange?: string;
    itineraire?: string;
  };
  stats?: Array<{ label: string; value: string; hidden?: boolean }>;
  onDownloadGPX?: () => void;
  onExport?: () => void;
}

export default function CarnetDetailRightSidebar({
  meta,
  stats = [],
  onDownloadGPX,
  onExport,
}: CarnetDetailRightSidebarProps) {
  const distStat = stats.find(s => s.label.includes('DIST') || s.label.includes('KM'))?.value || '27.4 km';
  const elevStat = stats.find(s => s.label.includes('DÉNIV') || s.label.includes('D+'))?.value || '1620 m D+';

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col gap-[var(--space-4)] overflow-y-auto pb-[var(--space-8)]">
      <Card className="space-y-[var(--space-2)] p-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
            Expédition Certifiée
          </h2>
          <Badge className="font-mono font-bold">✓ LKDV</Badge>
        </div>

        <Card variant="compact" className="flex items-center gap-[var(--space-2)] p-[var(--space-2)]">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]" aria-hidden>
            👤
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-sans text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Membre Explorateur</h4>
            <span className="block text-[length:var(--lkv-text-caption-2)] leading-tight text-[color:var(--lkv-text-muted)]">Guide Certifié LKDV</span>
          </div>
        </Card>

        <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          Récit vérifié et tracé GPS enregistré sur le terrain en conditions réelles.
        </p>
      </Card>

      <Card className="space-y-[var(--space-2)] p-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Fiche Technique</h3>
          <Badge className="font-mono font-bold">Trace 3D</Badge>
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)]">
          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Massif</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">{meta.itineraire || 'Alpes'}</span>
          </Card>

          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Distance</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">{distStat}</span>
          </Card>

          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Dénivelé +</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">{elevStat}</span>
          </Card>

          <Card variant="compact" className="p-[var(--space-2)]">
            <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Période</span>
            <span className="block truncate font-bold text-[color:var(--lkv-text-primary)]">{meta.dateRange || 'Été 2026'}</span>
          </Card>
        </div>
      </Card>

      <Card tone="warn" className="space-y-[var(--space-2)] p-[var(--space-3)] transition-all duration-[var(--motion-control-duration)]">
        <Badge tone="warn" className="font-mono font-bold uppercase tracking-widest">
          🎒 SOUVENIR &amp; MATÉRIEL
        </Badge>

        <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
          Partir sur les mêmes traces ?
        </h3>

        <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
          Téléchargez la trace GPX ou réadaptez la checklist du sac pour votre propre expédition.
        </p>

        <div className="flex flex-col gap-[var(--space-1)] pt-[var(--space-1)]">
          {onDownloadGPX && (
            <Button
              type="button"
              onClick={onDownloadGPX}
              fullWidth
              icon={<Icon name="ArrowDownTrayIcon" size={13} aria-hidden="true" />}
            >
              Télécharger le GPX
            </Button>
          )}

          <Link
            href="/ai-configurator"
            className="inline-flex min-h-[var(--control-height-md)] w-full items-center justify-center gap-[var(--space-1)] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            <span aria-hidden>🤖</span> Configurer mon sac
          </Link>
        </div>
      </Card>
    </aside>
  );
}
