'use client';

import React from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';

type IconVariant = 'outline' | 'solid';

export interface IconProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  name: string;
  variant?: IconVariant;
  size?: number;
  color?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
}

// Mapping HeroIcon names to custom icons in /icons/
const MODERN_ICON_MAP: Record<string, string> = {
  // Navigation & Chevrons & Arrows
  'HomeIcon': 'Home.png',
  'ChevronDownIcon': 'V Arrow Down.png',
  'ChevronUpIcon': 'V Arrow Up.png',
  'ChevronLeftIcon': 'V Arrow Left.png',
  'ChevronRightIcon': 'V Arrow Right.png',
  'ArrowDownIcon': 'Arrow Down.png',
  'ArrowUpIcon': 'Arrow Up.png',
  'ArrowLeftIcon': 'Arrow Left.png',
  'ArrowRightIcon': 'Arrow Right.png',
  'ArrowRightOnRectangleIcon': 'logout.png',
  'ArrowLeftOnRectangleIcon': 'login.png',
  'ArrowTrendingUpIcon': 'foward.png',
  'ArrowTrendingDownIcon': 'Arrow Down.png',
  'ArrowPathIcon': 'Radar.png',
  'ArrowDownTrayIcon': 'loading download.png',
  'ArrowUpOnSquareIcon': 'share.png',
  'ArrowTopRightOnSquareIcon': 'foward.png',
  'ArrowsRightLeftIcon': 'foward.png',
  'ArrowsPointingOutIcon': 'Radar.png',

  // Actions & Controls
  'PlusIcon': 'Plus.png',
  'PlusCircleIcon': 'Plus Circle.png',
  'MinusIcon': 'Minus.png',
  'MinusCircleIcon': 'Minus Circle.png',
  'XMarkIcon': 'bubble chat x.png',
  'XCircleIcon': 'bubble chat x.png',
  'CheckIcon': 'bubble chat check.png',
  'CheckCircleIcon': 'bubble chat check.png',
  'CheckBadgeIcon': 'bubble chat check.png',
  'Bars3Icon': 'Burger.png',
  'EllipsisHorizontalIcon': '3 Dot Horizontal.png',
  'EllipsisVerticalIcon': '3 Dot Vertical.png',
  'FunnelIcon': 'Filter.png',
  'MagnifyingGlassIcon': 'search.png',

  // User & Community & Social
  'UserIcon': 'user.png',
  'UserCircleIcon': 'user circle.png',
  'UsersIcon': 'user group.png',
  'UserGroupIcon': 'user group.png',
  'UserPlusIcon': 'user plus.png',
  'HeartIcon': 'whislist.png',
  'HeartIconSolid': 'whislist-1.png',
  'BookmarkIcon': 'saved.png',
  'BookmarkSolidIcon': 'saved-1.png',
  'ShareIcon': 'share.png',
  'ChatBubbleLeftIcon': 'bubble chat.png',
  'ChatBubbleLeftRightIcon': 'group bubble chat.png',
  'ChatBubbleOvalLeftIcon': 'bubble chat 3.png',
  'BellIcon': 'bell.png',
  'BellAlertIcon': 'notification.png',
  'BellSlashIcon': 'bell silent.png',

  // Media & Documents & Tools
  'CameraIcon': 'galery.png',
  'PhotoIcon': 'galery.png',
  'DocumentTextIcon': 'Invoice.png',
  'DocumentDuplicateIcon': 'Invoice-1.png',
  'ClipboardDocumentListIcon': 'Invoice.png',
  'BookOpenIcon': 'book.png',
  'CalendarIcon': 'calendar.png',
  'CalendarDaysIcon': 'calendar.png',
  'ClockIcon': 'loading download.png',
  'PencilIcon': 'edit.png',
  'PencilSquareIcon': 'edit.png',
  'TrashIcon': 'Minus Circle.png',
  'ArchiveBoxIcon': 'archieve.png',
  'ArchiveBoxXMarkIcon': 'archieve.png',
  'FolderIcon': 'storage.png',
  'LinkIcon': 'Link.png',
  'PaperAirplaneIcon': 'foward.png',
  'EnvelopeIcon': 'bubble chat notification.png',
  'EnvelopeOpenIcon': 'bubble chat.png',
  'PhoneIcon': 'phone.png',
  'DevicePhoneMobileIcon': 'device.png',
  'QrCodeIcon': 'qr code.png',

  // E-Commerce & Finance
  'ShoppingBagIcon': 'Cart.png',
  'ShoppingCartIcon': 'Cart.png',
  'CreditCardIcon': 'Card.png',
  'BanknotesIcon': 'Card History.png',
  'CurrencyEuroIcon': 'Cards.png',
  'TagIcon': 'attachment.png',
  'GiftIcon': 'Cards.png',

  // Outdoor & Navigation & Location
  'MapIcon': 'Compass.png',
  'MapPinIcon': 'Compass.png',
  'GlobeAltIcon': 'World.png',
  'SunIcon': 'Sun.png',
  'MoonIcon': 'Moon.png',
  'CloudIcon': 'storage.png',
  'CloudArrowUpIcon': 'storage.png',
  'LightBulbIcon': 'lamp.png',
  'SparklesIcon': 'Emotion.png',
  'LockClosedIcon': 'setting.png',
  'ShieldCheckIcon': 'setting.png',
  'QuestionMarkCircleIcon': 'question mark circle.png',
  'InformationCircleIcon': 'question mark circle.png',
  'ExclamationCircleIcon': 'Bug.png',
  'ExclamationTriangleIcon': 'Bug.png',
  'Cog6ToothIcon': 'setting.png',
  'WrenchScrewdriverIcon': 'setting.png',
};

export default function Icon({
  name,
  variant = 'outline',
  size = 24,
  color,
  className = '',
  onClick,
  disabled = false,
  title,
  style,
  ...props
}: IconProps) {
  let resolvedKey = name;
  if (!resolvedKey.endsWith('Icon') && !resolvedKey.endsWith('IconSolid') && !resolvedKey.endsWith('SolidIcon')) {
    resolvedKey = `${name}Icon`;
  }

  const modernFileName = MODERN_ICON_MAP[resolvedKey] || MODERN_ICON_MAP[name];

  if (modernFileName) {
    const iconSrc = `/icons/${encodeURIComponent(modernFileName)}`;
    return (
      <span
        role="img"
        aria-label={title || name}
        title={title}
        onClick={disabled ? undefined : onClick}
        className={`inline-flex items-center justify-center select-none shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          backgroundColor: color || 'currentColor',
          maskImage: `url("${iconSrc}")`,
          WebkitMaskImage: `url("${iconSrc}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
          ...style,
        }}
        {...props}
      />
    );
  }

  // Fallback to HeroIcons SVG if not in modern pack
  const solidSet = HeroIconsSolid as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
  const outlineSet = HeroIcons as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;
  const iconSet = variant === 'solid' ? solidSet : outlineSet;

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

  if (typeof IconComponent !== 'function') {
    return (
      <span
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color, ...style }}
        className={`shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={disabled ? undefined : onClick}
        {...(props as any)}
      >
        <span style={{ fontSize: size * 0.7 }}>✦</span>
      </span>
    );
  }

  const RenderedComponent = IconComponent;
  return (
    <RenderedComponent
      width={size}
      height={size}
      style={{ color, ...style }}
      className={`${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      onClick={disabled ? undefined : onClick}
      {...(props as any)}
    />
  );
}