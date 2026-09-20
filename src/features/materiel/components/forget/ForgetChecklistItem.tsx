'use client';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';

export function ForgetChecklistItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      aria-pressed={checked}
      className="h-auto w-full justify-start gap-3 rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-surface-muted)] p-2 text-left font-normal"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          checked ? 'bg-[var(--sage-500)]' : 'bg-[color:var(--lkv-surface-muted)]'
        }`}
      >
        {checked && <Icon name="check" size={12} className="text-white" aria-hidden="true" />}
      </span>
      <span
        className={`text-sm ${checked ? 'line-through text-[color:var(--lkv-text-muted)]' : 'text-[color:var(--lkv-text-primary)]'}`}
      >
        {label}
      </span>
    </Button>
  );
}
