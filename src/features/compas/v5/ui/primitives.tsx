'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { V5Icon, type V5IconName } from './icons';
import type { V5Photo } from '../types';

/** Verre groupé : conteneur de lignes (`Li`) ou de contenu libre. */
export function Grp({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`v5-grp ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

/** Légende de section, avec une valeur à droite. */
export function Cap({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="v5-cap">
      <span>{children}</span>
      {right != null && <span>{right}</span>}
    </div>
  );
}

/** Pastille d'icône d'une ligne : une icône, ou une photo, ou un avatar. */
export function Fi({ icon, photo, alt = '' }: { icon?: V5IconName; photo?: string | null; alt?: string }) {
  return (
    <span className="fi">
      {photo ? <img src={photo} alt={alt} loading="lazy" decoding="async" /> : icon ? <V5Icon name={icon} size="s" /> : null}
    </span>
  );
}

/** Une ligne de liste : icône, texte (titre + détail), valeur ou action à droite. */
export function Li({
  icon,
  photo,
  lead,
  title,
  detail,
  value,
  right,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon?: V5IconName;
  photo?: string | null;
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const body = (
    <>
      {lead ?? (icon || photo ? <Fi icon={icon} photo={photo} /> : null)}
      <span className="t">
        <b>{title}</b>
        {detail != null && <small>{detail}</small>}
      </span>
      {value != null && <span className="v v5-num">{value}</span>}
      {right}
    </>
  );
  return onClick ? (
    <button type="button" className="v5-li" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {body}
    </button>
  ) : (
    <div className="v5-li">{body}</div>
  );
}

export function PBtn({
  children,
  tone,
  className = '',
  ...rest
}: { children: ReactNode; tone?: 'dark' | 'done' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`v5-pbtn${tone ? ` ${tone}` : ''} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function MBtn({
  children,
  primary,
  className = '',
  ...rest
}: { children: ReactNode; primary?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`v5-mbtn${primary ? ' p' : ''} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  pressed,
  tone,
  onClick,
  disabled,
  ...rest
}: {
  children: ReactNode;
  pressed?: boolean;
  tone?: 'warn' | 'good';
  onClick?: () => void;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      className={`v5-chip${tone ? ` ${tone}` : ''}`}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="v5-sw" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Stepper({
  value,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  lessLabel,
  moreLabel,
  disabled,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  lessLabel: string;
  moreLabel: string;
  disabled?: boolean;
}) {
  return (
    <span className="v5-stp">
      <button type="button" aria-label={lessLabel} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <V5Icon name="minus" size="xs" />
      </button>
      <i />
      <button type="button" aria-label={moreLabel} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <V5Icon name="plus" size="xs" />
      </button>
    </span>
  );
}

/** Capsule d'icônes d'un tiroir : jamais de texte (comme la page Compte), un nom accessible par onglet. */
export function Flow({
  tabs,
  selected,
  onSelect,
  label,
}: {
  tabs: ReadonlyArray<{ icon: V5IconName; label: string; badge?: number }>;
  selected: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  return (
    <div className="v5-flow v5-lg" role="tablist" aria-label={label}>
      <span className="th" style={{ width: `calc((100% - 4px) / ${tabs.length})`, transform: `translateX(${selected * 100}%)` }} />
      {tabs.map((tab, i) => (
        <button
          key={tab.label}
          type="button"
          role="tab"
          aria-selected={i === selected}
          aria-label={tab.label}
          title={tab.label}
          onClick={() => onSelect(i)}
        >
          <V5Icon name={tab.icon} />
        </button>
      ))}
    </div>
  );
}

/** Image d'un lieu ou d'un objet ; sans image, une illustration sobre (icône), jamais une photo d'ailleurs. */
export function Pic({ photo, src, icon, alt = '' }: { photo?: V5Photo | null; src?: string | null; icon: V5IconName; alt?: string }) {
  const url = photo?.url ?? src ?? null;
  return url ? <img src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="fb"><V5Icon name={icon} /></span>;
}

/** Crédit d'une photo (auteur, licence, page du fichier). */
export function Credit({ photo }: { photo: V5Photo | null | undefined }) {
  if (!photo) return null;
  return (
    <p className="v5-credit">
      <a href={photo.pageUrl} target="_blank" rel="noopener noreferrer">
        {photo.credit} · {photo.license}
      </a>
    </p>
  );
}

export function Bar({ pct, over }: { pct: number; over?: boolean }) {
  return (
    <div className={`v5-bar${over ? ' over' : ''}`} role="presentation">
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Avatar d'une personne (initiale), pastille « en ligne » facultative. */
export function Avi({ name, online }: { name: string; online?: boolean }) {
  return (
    <span className="v5-avi" aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
      {online && <span className="on" />}
    </span>
  );
}
