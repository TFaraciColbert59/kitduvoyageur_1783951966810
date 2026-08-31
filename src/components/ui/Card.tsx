import React from 'react';
import { GlassCard } from './GlassCard';

type CardVariant = 'default' | 'elevated' | 'outlined';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  interactive = false,
  className,
  children,
  ...rest
}) => {
  const toneMap = {
    default: 'neutral',
    elevated: 'sage',
    outlined: 'neutral',
  } as const;

  return (
    <GlassCard
      tone={toneMap[variant]}
      interactive={interactive}
      className={className}
      {...rest}
    >
      {children}
    </GlassCard>
  );
};

export default Card;
