/**
 * Hub V5d — Donut budget SVG (décoratif, aria-hidden). Anneau segmenté par
 * catégorie, total au centre. Composant maison léger (pas de recharts),
 * palette = tokens avec opacités décroissantes (antiHex).
 */
export interface BudgetDonutCategory {
  label: string;
  value: number;
}

export function BudgetDonut({
  categories,
  size = 76,
  stroke = 9,
  className,
}: {
  categories: BudgetDonutCategory[];
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const positive = categories.filter((c) => c.value > 0);
  if (positive.length === 0) return null;

  const total = positive.reduce((s, c) => s + c.value, 0);
  const r = (size - stroke) / 2;
  const cxc = size / 2;
  const circumference = 2 * Math.PI * r;

  const palette = [
    'var(--lkv-primary)',
    'var(--lkv-secondary)',
    'var(--lkv-forest-300)',
    'var(--lkv-forest-200)',
  ];

  let offset = circumference * 0.25; // départ à 12h
  const segments = positive.slice(0, 4).map((cat, i) => {
    const frac = cat.value / total;
    const dash = Math.max(frac * circumference - 2, 0.5);
    const seg = {
      key: `${cat.label}-${i}`,
      color: palette[i % palette.length],
      opacity: i < palette.length ? 1 - i * 0.18 : 0.4,
      dasharray: `${dash} ${circumference - dash}`,
      dashoffset: offset,
    };
    offset -= frac * circumference;
    return seg;
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <circle
        cx={cxc}
        cy={cxc}
        r={r}
        fill="none"
        stroke="var(--lkv-forest-100)"
        strokeOpacity="0.6"
        strokeWidth={stroke}
      />
      {segments.map((s) => (
        <circle
          key={s.key}
          cx={cxc}
          cy={cxc}
          r={r}
          fill="none"
          stroke={s.color}
          strokeOpacity={s.opacity}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={s.dasharray}
          strokeDashoffset={s.dashoffset}
        />
      ))}
    </svg>
  );
}

export default BudgetDonut;
