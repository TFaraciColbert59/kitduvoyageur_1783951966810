import s from './crm.module.css';
import { cx } from './cx';

/** Initiales d'un nom affiché (jamais un avatar inventé : un rond + 2 lettres). */
export function initials(name: string | null | undefined): string {
  if (!name) return '—';
  const clean = name.replace(/^@/, '').trim();
  if (!clean) return '—';
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return letters.join('') || clean.slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  size = 40,
  tone = 'sage'
}: {
  name: string | null | undefined;
  size?: number;
  tone?: 'sage' | 'primary';
}) {
  const style =
    tone === 'primary'
      ? { background: 'var(--lkv-primary)', color: 'var(--lkv-surface-card)' }
      : { background: 'var(--sage-100)', color: 'var(--sage-800)' };
  return (
    <span
      className={cx(s.center)}
      aria-hidden="true"
      style={{
        ...style,
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        fontWeight: 700,
        fontSize: Math.round(size / 3),
        display: 'inline-flex'
      }}
    >
      {initials(name)}
    </span>
  );
}
