// src/components/ui/Button.tsx
import React from 'react';
import { theme } from '@/design/tokens';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-5 py-3',
  }[size];

  const variantStyles = {
    primary: `bg-${theme.colors.primary} text-${theme.colors.white} hover:bg-${theme.colors.primary}80 focus:ring-${theme.colors.primary}`,
    secondary: `bg-${theme.colors.surface} text-${theme.colors.primary} border border-${theme.colors.border} hover:bg-${theme.colors.surface}80`,
    danger: `bg-${theme.colors.error} text-${theme.colors.white} hover:bg-${theme.colors.error}80 focus:ring-${theme.colors.error}`,
    ghost: `bg-transparent text-${theme.colors.primary} hover:bg-${theme.colors.surface} focus:ring-${theme.colors.primary}`,
  }[variant];

  const disabledStyles = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      className={clsx(baseStyles, sizeStyles, variantStyles, disabledStyles, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 mr-2 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
