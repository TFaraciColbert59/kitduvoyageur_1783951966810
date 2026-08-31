'use client';
import React from 'react';
import { LkvButton, type LkvButtonProps, type LkvButtonVariant } from './LkvButton';

export interface ButtonProps extends Omit<LkvButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | LkvButtonVariant;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', ...props }) => {
  return <LkvButton variant={variant as LkvButtonVariant} {...props} />;
};

export default Button;
