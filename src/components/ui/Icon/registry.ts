/**
 * Canonical icon registry — single source of truth for glyph resolution.
 *
 * - `PNG_ICON_MAP` : legacy Heroicon-style names → monochrome PNG mask pack.
 * - `SVG_MASK_ICON_NAMES` : SF-inspired semantic kebab tokens → SVG mask pack
 *   in `public/icons/sf/` (generated from MIT-licensed Phosphor Icons).
 */

import { SVG_MASK_ICON_NAMES } from './registry.generated';

export { SVG_MASK_ICON_NAMES };


export const PNG_ICON_MAP: Record<string, string> = {
  // Navigation & Chevrons & Arrows
  HomeIcon: 'Home.png',
  ChevronDownIcon: 'V Arrow Down.png',
  ChevronUpIcon: 'V Arrow Up.png',
  ChevronLeftIcon: 'V Arrow Left.png',
  ChevronRightIcon: 'V Arrow Right.png',
  ArrowDownIcon: 'Arrow Down.png',
  ArrowUpIcon: 'Arrow Up.png',
  ArrowLeftIcon: 'Arrow Left.png',
  ArrowRightIcon: 'Arrow Right.png',
  ArrowRightOnRectangleIcon: 'logout.png',
  ArrowLeftOnRectangleIcon: 'login.png',
  ArrowTrendingUpIcon: 'foward.png',
  ArrowTrendingDownIcon: 'Arrow Down.png',
  ArrowPathIcon: 'Radar.png',
  ArrowDownTrayIcon: 'loading download.png',
  ArrowUpOnSquareIcon: 'share.png',
  ArrowTopRightOnSquareIcon: 'foward.png',
  ArrowsRightLeftIcon: 'foward.png',
  ArrowsPointingOutIcon: 'Radar.png',

  // Actions & Controls
  PlusIcon: 'Plus.png',
  PlusCircleIcon: 'Plus Circle.png',
  MinusIcon: 'Minus.png',
  MinusCircleIcon: 'Minus Circle.png',
  XMarkIcon: 'bubble chat x.png',
  XCircleIcon: 'bubble chat x.png',
  CheckIcon: 'bubble chat check.png',
  CheckCircleIcon: 'bubble chat check.png',
  CheckBadgeIcon: 'bubble chat check.png',
  Bars3Icon: 'Burger.png',
  EllipsisHorizontalIcon: '3 Dot Horizontal.png',
  EllipsisVerticalIcon: '3 Dot Vertical.png',
  FunnelIcon: 'Filter.png',
  MagnifyingGlassIcon: 'search.png',

  // User & Community & Social
  UserIcon: 'user.png',
  UserCircleIcon: 'user circle.png',
  UsersIcon: 'user group.png',
  UserGroupIcon: 'user group.png',
  UserPlusIcon: 'user plus.png',
  HeartIcon: 'whislist.png',
  HeartIconSolid: 'whislist-1.png',
  BookmarkIcon: 'saved.png',
  BookmarkSolidIcon: 'saved-1.png',
  ShareIcon: 'share.png',
  ChatBubbleLeftIcon: 'bubble chat.png',
  ChatBubbleLeftRightIcon: 'group bubble chat.png',
  ChatBubbleOvalLeftIcon: 'bubble chat 3.png',
  BellIcon: 'bell.png',
  BellAlertIcon: 'notification.png',
  BellSlashIcon: 'bell silent.png',

  // Media & Documents & Tools
  CameraIcon: 'galery.png',
  PhotoIcon: 'galery.png',
  DocumentTextIcon: 'Invoice.png',
  DocumentDuplicateIcon: 'Invoice-1.png',
  ClipboardDocumentListIcon: 'Invoice.png',
  BookOpenIcon: 'book.png',
  CalendarIcon: 'calendar.png',
  CalendarDaysIcon: 'calendar.png',
  ClockIcon: 'loading download.png',
  PencilIcon: 'edit.png',
  PencilSquareIcon: 'edit.png',
  TrashIcon: 'Minus Circle.png',
  ArchiveBoxIcon: 'archieve.png',
  ArchiveBoxXMarkIcon: 'archieve.png',
  FolderIcon: 'storage.png',
  LinkIcon: 'Link.png',
  PaperAirplaneIcon: 'foward.png',
  EnvelopeIcon: 'bubble chat notification.png',
  EnvelopeOpenIcon: 'bubble chat.png',
  PhoneIcon: 'phone.png',
  DevicePhoneMobileIcon: 'device.png',
  QrCodeIcon: 'qr code.png',

  // E-Commerce & Finance
  ShoppingBagIcon: 'Cart.png',
  ShoppingCartIcon: 'Cart.png',
  CreditCardIcon: 'Card.png',
  BanknotesIcon: 'Card History.png',
  CurrencyEuroIcon: 'Cards.png',
  TagIcon: 'attachment.png',
  GiftIcon: 'Cards.png',

  // Outdoor & Navigation & Location
  MapIcon: 'Compass.png',
  MapPinIcon: 'Compass.png',
  GlobeAltIcon: 'World.png',
  SunIcon: 'Sun.png',
  MoonIcon: 'Moon.png',
  CloudIcon: 'storage.png',
  CloudArrowUpIcon: 'storage.png',
  LightBulbIcon: 'lamp.png',
  SparklesIcon: 'Emotion.png',
  LockClosedIcon: 'setting.png',
  ShieldCheckIcon: 'setting.png',
  QuestionMarkCircleIcon: 'question mark circle.png',
  InformationCircleIcon: 'question mark circle.png',
  ExclamationCircleIcon: 'Bug.png',
  ExclamationTriangleIcon: 'Bug.png',
  Cog6ToothIcon: 'setting.png',
  WrenchScrewdriverIcon: 'setting.png',
};

/** Canonical semantic tokens backed by the animated local icon set. */
export const ANIMATED_ICON_NAMES = [
  'home',
  'mountain',
  'compass',
  'box',
  'users',
  'user',
  'sparkles',
  'tent',
  'book',
  'bag',
  'doc',
  'search',
  'chevron-left',
  'chevron-right',
  'arrow-right',
  'arrow-left',
  'close',
  'menu',
  'bell',
  'heart',
  'bookmark',
  'map-pin',
  'star',
  'lock',
  'filter',
  'minus',
  'plus',
] as const;

export type AnimatedIconName = (typeof ANIMATED_ICON_NAMES)[number];

/** Resolve a legacy/loose name to a PNG pack filename. */
export function resolvePackFile(name: string): string | undefined {
  let key = name;
  if (!key.endsWith('Icon') && !key.endsWith('IconSolid') && !key.endsWith('SolidIcon')) {
    key = `${name}Icon`;
  }
  return PNG_ICON_MAP[key] || PNG_ICON_MAP[name];
}

/**
 * Resolve any name to a mask asset path relative to `/icons/`.
 * Order: PNG pack (legacy Heroicon names) → SF-inspired SVG pack (kebab tokens).
 */
export function resolveMaskFile(name: string, variant: 'outline' | 'solid' = 'outline'): string | undefined {
  const png = resolvePackFile(name);
  if (png) return png;

  const solidName = variant === 'solid' ? `${name}-fill` : name;
  if (SVG_MASK_ICON_NAMES.has(solidName)) return `sf/${solidName}.svg`;
  if (SVG_MASK_ICON_NAMES.has(name)) return `sf/${name}.svg`;

  return undefined;
}
