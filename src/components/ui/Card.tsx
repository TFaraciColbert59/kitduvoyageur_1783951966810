import React from 'react';

type CardVariant = 'default' | 'elevated' | 'outlined';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<CardVariant, React.CSSProperties> = {
  default: {
    background: '#FAF8F5',
    border: '1px solid #E8E4D8',
    borderRadius: '8px',
    boxShadow: '0 2px 6px rgba(23,64,44,0.06), 0 4px 12px rgba(23,64,44,0.05)',
  },
  elevated: {
    background: '#FAF8F5',
    border: '1px solid #E8E4D8',
    borderRadius: '8px',
    boxShadow: '0 6px 16px rgba(23,64,44,0.08), 0 12px 32px rgba(23,64,44,0.06)',
  },
  outlined: {
    background: '#FAF8F5',
    border: '1px solid #E8E4D8',
    borderRadius: '8px',
    boxShadow: 'none',
  },
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className,
  children,
  style,
  ...rest
}) => {
  return (
    <div
      style={{ ...VARIANT_STYLES[variant], ...style }}
      className={className}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Card;
