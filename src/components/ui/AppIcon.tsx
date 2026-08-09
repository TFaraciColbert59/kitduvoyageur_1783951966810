'use client';

import React from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';

type IconVariant = 'outline' | 'solid';

interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'onClick'> {
    name: string;
    variant?: IconVariant;
    size?: number;
    className?: string;
    title?: string;
    onClick?: () => void;
    disabled?: boolean;
}

function Icon({
    name,
    variant = 'outline',
    size = 24,
    className = '',
    onClick,
    disabled = false,
    ...props
}: IconProps) {
    const iconSet = variant === 'solid' ? HeroIconsSolid : HeroIcons;
    const IconComponent = iconSet[name as keyof typeof iconSet] as React.ComponentType<React.SVGProps<SVGSVGElement>>;

    if (!IconComponent) {
        const Fallback = HeroIcons.QuestionMarkCircleIcon as React.ComponentType<React.SVGProps<SVGSVGElement>>;
        return (
            <Fallback
                width={size}
                height={size}
                className={`text-gray-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
                onClick={disabled ? undefined : onClick}
                {...props}
            />
        );
    }

    return (
        <IconComponent
            width={size}
            height={size}
            className={`${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
            onClick={disabled ? undefined : onClick}
            {...props}
        />
    );
}

export default Icon;