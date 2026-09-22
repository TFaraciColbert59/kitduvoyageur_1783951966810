import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { Badge, Button, Card, Tabs } from '@/components/ui';

interface TabsGroupeProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: any;
  layoutVariant?: 'horizontal' | 'vertical';
}

export default function TabsGroupe({ activeTab, setActiveTab, data, layoutVariant = 'horizontal' }: TabsGroupeProps) {
  const tabs: { id: string; label: string; count?: number | string }[] = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'tasks', label: 'Tâches', count: data?.tasks?.length },
    { id: 'equipment', label: 'Équipement', count: data?.equipment?.length },
    { id: 'expenses', label: 'Dépenses', count: data?.expenses?.total ? `${data.expenses.total}€` : undefined },
    { id: 'decisions', label: 'Décisions', count: data?.decisions?.length },
    { id: 'discussion', label: 'Discussion' },
    { id: 'members', label: 'Membres', count: data?.travelers?.length }
  ];

  if (layoutVariant === 'vertical') {
    return (
      <aside className="flex h-full max-h-full w-full flex-1 select-none flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] font-sans text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)]">
        <div className="shrink-0 space-y-[var(--space-2)]">
          <Card variant="compact" className="flex items-center gap-[var(--space-3)] border-[color:var(--glass-border)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-xl" aria-hidden>
              ⛺
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-tight text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
                Expédition{' '}
                <span className="font-serif text-[length:var(--lkv-text-caption)] font-normal italic text-[color:var(--lkv-secondary)]">
                  LKDV
                </span>
              </h4>
              <p className="mt-[var(--space-1)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                Cockpit Groupe
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-[var(--space-1)]">
            <Link
              href="/groupes"
              className="inline-flex items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
            >
              <Icon name="ArrowLeftIcon" size={12} aria-hidden="true" />
              <span>Groupes</span>
            </Link>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              icon={<Icon name="PrinterIcon" size={12} aria-hidden="true" />}
              className="px-[var(--space-2)]"
            >
              Imprimer
            </Button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-[var(--space-1)] overflow-y-auto py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Cockpit du groupe">
          <p className="mb-[var(--space-1)] px-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
            Cockpit
          </p>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={isActive ? 'primary' : 'secondary'}
                fullWidth
                onClick={() => setActiveTab(tab.id)}
                className="justify-between rounded-[var(--lkv-radius-md)] text-[length:var(--lkv-text-caption)]"
                aria-pressed={isActive}
              >
                <span className="truncate text-left">{tab.label}</span>
                {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-[color:var(--lkv-text-inverted)]/70" aria-hidden />}
              </Button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)] text-center">
          <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
            Le Kit du Voyageur · Expéditions v2.0
          </span>
        </div>
      </aside>
    );
  }

  return (
    <Tabs
      variant="scrollable"
      ariaLabel="Cockpit du groupe"
      value={activeTab}
      onChange={setActiveTab}
      className="mt-[var(--space-6)] border-b border-[color:var(--lkv-primary)]/10 px-[var(--space-3)] py-[var(--space-2)]"
      options={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        badge: tab.count !== undefined ? <Badge className="border-transparent bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset">{tab.count}</Badge> : undefined,
      }))}
    />
  );
}
