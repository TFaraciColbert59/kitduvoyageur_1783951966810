'use client';

import React from 'react';

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  /** Associe le libellé au contrôle quand l’appelant fournit un `id`. */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lkdv-form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}

export function MediaInput({
  label = 'Photos / vidéos',
  multiple = true,
  accept = 'image/*,video/mp4,video/quicktime,video/webm',
  onChange,
}: {
  label?: string;
  multiple?: boolean;
  accept?: string;
  onChange: (files: File[]) => void;
}) {
  return (
    <label className="lkdv-form-media">
      <span className="flex-1">{label}</span>
      <span className="lkdv-form-file-btn">Choisir</span>
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        aria-label={label}
        className="sr-only"
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      />
    </label>
  );
}

export function SubmitFooter({
  label,
  busy,
  disabled,
  onClick,
  secondary,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <>
      {secondary}
      <button type="submit" disabled={busy || disabled} onClick={onClick}>
        {busy ? 'Envoi…' : label}
      </button>
    </>
  );
}
