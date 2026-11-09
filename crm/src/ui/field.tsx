import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import s from './crm.module.css';
import { cx } from './cx';

/** Libellé + champ + aide + erreur à côté du champ (règle § 5 du design). */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={s.fieldWrap}>
      <label className={s.fieldLabel} htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <span className={s.fieldErr} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={s.fieldHint}>{hint}</span>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx(s.field, invalid && s.fieldError, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function TextArea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx(s.field, invalid && s.fieldError, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx(s.field, invalid && s.fieldError, className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}
