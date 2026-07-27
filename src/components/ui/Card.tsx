// src/components/ui/Card.tsx
import React from 'react';
import { theme } from '@/design/tokens';
import clsx from 'clsx';

type CardVariant = 'default' | 'elevated' | 'outlined';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className,
  children,
  ...rest
}) => {
  const base = 'rounded-lg bg-white border border-transparent transition-shadow';
  const variantStyles = {
    default: `bg-${theme.colors.surface} border-${theme.colors.border} shadow-${theme.shadows.low}`,
    elevated: `bg-${theme.colors.surface} border-${theme.colors.border} shadow-${theme.shadows.medium}`,
    outlined: `bg-${theme.colors.surface} border-${theme.colors.border} shadow-none`,
  }[variant];

  return (
    <div className={clsx(base, variantStyles, className)} {...rest}>
      {children}
    </div>
  );
};

export default Card;
