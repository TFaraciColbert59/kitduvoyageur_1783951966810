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
    const solidSet = HeroIconsSolid as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
    const outlineSet = HeroIcons as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
    const iconSet = variant === 'solid' ? solidSet : outlineSet;

    // Resolve solid-variant names (e.g. "BookmarkSolidIcon", "HeartIconSolid")
    // to the corresponding icon in the requested set, falling back to the other set.
    let IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined;
    if (name.endsWith('SolidIcon')) {
        const base = `${name.slice(0, -'SolidIcon'.length)}Icon`;
        IconComponent = solidSet[base] || outlineSet[base];
    } else if (name.endsWith('IconSolid')) {
        const base = `${name.slice(0, -'IconSolid'.length)}Icon`;
        IconComponent = solidSet[base] || outlineSet[base];
    }
    if (!IconComponent) {
        IconComponent = iconSet[name];
    }
    if (!IconComponent) {
        IconComponent = (variant === 'solid' ? outlineSet : solidSet)[name];
    }

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