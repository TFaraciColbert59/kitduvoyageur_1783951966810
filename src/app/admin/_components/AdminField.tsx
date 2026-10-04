'use client';

import React from 'react';

interface AdminFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * Champ de formulaire admin — périmètre back-office uniquement.
 * Styles par tokens (aucune couleur en dur) ; candidat à la promotion
 * en primitive `src/components/ui/` si le besoin se généralise.
 */
export function AdminField({ label, hint, children }: AdminFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-[color:var(--glass-label)]">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[color:var(--glass-label-secondary)]">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL_CLASS =
  'h-[var(--control-height-md)] rounded-2xl border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-3 text-[length:var(--lkv-text-body)] text-[color:var(--glass-label)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CONTROL_CLASS} />;
}

export function AdminSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={CONTROL_CLASS} />;
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} rows={props.rows ?? 3} className={`${CONTROL_CLASS} h-auto py-2`} />
  );
}
