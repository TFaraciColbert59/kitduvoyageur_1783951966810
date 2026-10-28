#!/usr/bin/env node
/**
 * Génère src/components/ui/Icon/instagram.generated.ts.
 *
 * Les glyphes « à la Instagram » sont des traits fins arrondis, une seule couleur (celle du texte).
 * Instagram ne publie pas ses pictogrammes (marque protégée) : on prend les équivalents les plus
 * proches du jeu Lucide (ISC, fork de Feather) — cœur, bulle, avion en papier, signet, maison,
 * boussole, loupe, « + » — et on les résout par tous les noms que `Icon` accepte déjà
 * (noms Heroicons, jetons kebab du jeu SF, alias hérités).
 *
 * Échoue bruyamment si un nom cible n'existe pas dans lucide-react.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const ICON_DIR = path.join(ROOT, 'src/components/ui/Icon');
const require = createRequire(path.join(ROOT, 'package.json'));
const lucide = require('lucide-react');

/** Nom Heroicons / hérité → nom Lucide (kebab). `fill` : variante pleine (états actifs d'Instagram). */
const HERO = {
  HomeIcon: 'house', ChevronDownIcon: 'chevron-down', ChevronUpIcon: 'chevron-up', ChevronLeftIcon: 'chevron-left',
  ChevronRightIcon: 'chevron-right', ArrowDownIcon: 'arrow-down', ArrowUpIcon: 'arrow-up', ArrowLeftIcon: 'arrow-left',
  ArrowRightIcon: 'arrow-right', ArrowRightOnRectangleIcon: 'log-out', ArrowLeftOnRectangleIcon: 'log-in',
  ArrowTrendingUpIcon: 'trending-up', ArrowTrendingDownIcon: 'trending-down', ArrowPathIcon: 'refresh-cw',
  ArrowDownTrayIcon: 'download', ArrowUpOnSquareIcon: 'send', ArrowTopRightOnSquareIcon: 'external-link',
  ArrowsRightLeftIcon: 'arrow-right-left', ArrowsPointingOutIcon: 'maximize-2', PlusIcon: 'plus',
  PlusCircleIcon: 'circle-plus', MinusIcon: 'minus', MinusCircleIcon: 'circle-minus', XMarkIcon: 'x',
  XCircleIcon: 'circle-x', CheckIcon: 'check', CheckCircleIcon: 'circle-check', CheckBadgeIcon: 'badge-check',
  Bars3Icon: 'menu', EllipsisHorizontalIcon: 'ellipsis', EllipsisVerticalIcon: 'ellipsis-vertical',
  FunnelIcon: 'sliders-horizontal', MagnifyingGlassIcon: 'search', UserIcon: 'user', UserCircleIcon: 'circle-user-round',
  UsersIcon: 'users', UserGroupIcon: 'users', UserPlusIcon: 'user-plus', HeartIcon: 'heart', HeartIconSolid: 'heart',
  HeartSolidIcon: 'heart', BookmarkIcon: 'bookmark', BookmarkSolidIcon: 'bookmark', BookmarkIconSolid: 'bookmark',
  ShareIcon: 'send', ChatBubbleLeftIcon: 'message-circle', ChatBubbleLeftRightIcon: 'messages-square',
  ChatBubbleOvalLeftIcon: 'message-circle', BellIcon: 'bell', BellAlertIcon: 'bell-ring', BellSlashIcon: 'bell-off',
  CameraIcon: 'camera', PhotoIcon: 'image', DocumentTextIcon: 'file-text', DocumentDuplicateIcon: 'copy',
  ClipboardDocumentListIcon: 'clipboard-list', BookOpenIcon: 'book-open', CalendarIcon: 'calendar',
  CalendarDaysIcon: 'calendar-days', ClockIcon: 'clock', PencilIcon: 'pencil', PencilSquareIcon: 'square-pen',
  TrashIcon: 'trash-2', ArchiveBoxIcon: 'archive', ArchiveBoxXMarkIcon: 'archive-x', FolderIcon: 'folder',
  LinkIcon: 'link', PaperAirplaneIcon: 'send', EnvelopeIcon: 'mail', EnvelopeOpenIcon: 'mail-open', PhoneIcon: 'phone',
  DevicePhoneMobileIcon: 'smartphone', QrCodeIcon: 'qr-code', ShoppingBagIcon: 'shopping-bag',
  ShoppingCartIcon: 'shopping-cart', CreditCardIcon: 'credit-card', BanknotesIcon: 'banknote', CurrencyEuroIcon: 'euro',
  TagIcon: 'tag', GiftIcon: 'gift', MapIcon: 'map', MapPinIcon: 'map-pin', GlobeAltIcon: 'globe', SunIcon: 'sun',
  MoonIcon: 'moon', CloudIcon: 'cloud', CloudArrowUpIcon: 'cloud-upload', LightBulbIcon: 'lightbulb',
  SparklesIcon: 'sparkles', LockClosedIcon: 'lock', ShieldCheckIcon: 'shield-check', QuestionMarkCircleIcon: 'circle-help',
  InformationCircleIcon: 'info', ExclamationCircleIcon: 'circle-alert', ExclamationTriangleIcon: 'triangle-alert',
  Cog6ToothIcon: 'settings', WrenchScrewdriverIcon: 'wrench', AdjustmentsHorizontalIcon: 'sliders-horizontal',
  ArrowUturnLeftIcon: 'undo-2', BriefcaseIcon: 'briefcase', BuildingOfficeIcon: 'building-2', ChartBarIcon: 'chart-column',
  CubeIcon: 'box', DocumentArrowDownIcon: 'file-down', DocumentChartBarIcon: 'file-chart-column', EyeIcon: 'eye',
  EyeSlashIcon: 'eye-off', FlagIcon: 'flag', HandThumbUpIcon: 'thumbs-up', KeyIcon: 'key-round', NoSymbolIcon: 'ban',
  PrinterIcon: 'printer', RectangleStackIcon: 'layers', Squares2X2Icon: 'layout-grid', StarIcon: 'star',
  TrophyIcon: 'trophy', TruckIcon: 'truck', GlobeIcon: 'globe', LeafIcon: 'leaf', LockIcon: 'lock', MountainIcon: 'mountain',
};

/** Jetons kebab (jeu SF + jetons animés) dont le nom Lucide diffère, ou que l'on veut « à la Instagram ». */
const KEBAB = {
  home: 'house', 'edit2': 'pencil', edit3: 'pen-line', share2: 'send', send: 'send', 'message-square': 'message-circle',
  'message-square-plus': 'message-circle-plus', 'check-circle': 'circle-check', 'check-circle2': 'circle-check',
  'x-circle': 'circle-x', 'alert-circle': 'circle-alert', 'alert-triangle': 'triangle-alert', 'help-circle': 'circle-help',
  'check-square': 'square-check', building2: 'building-2', 'more-horizontal': 'ellipsis', 'more-vertical': 'ellipsis-vertical',
  filter: 'sliders-horizontal', close: 'x', menu: 'menu', doc: 'file-text', bag: 'shopping-bag', box: 'box', tent: 'tent',
  book: 'book-open', 'moon-star': 'moon-star', 'image-plus': 'image-plus', 'user-circle': 'circle-user-round',
  'key-round': 'key-round', 'log-out': 'log-out', 'hand-coins': 'hand-coins', 'flask-conical': 'flask-conical',
  reels: 'clapperboard', explore: 'compass', create: 'square-plus', messages: 'send', grid: 'layout-grid',
  'square-plus': 'square-plus', clapperboard: 'clapperboard', 'circle-user-round': 'circle-user-round',
};

const FILLED = new Set([
  'HeartIconSolid', 'HeartSolidIcon', 'BookmarkSolidIcon', 'BookmarkIconSolid',
]);

const pascal = (kebab) => kebab.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');

const registry = fs.readFileSync(path.join(ICON_DIR, 'registry.generated.ts'), 'utf8');
const sfTokens = [...registry.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
const animated = fs.readFileSync(path.join(ICON_DIR, 'registry.ts'), 'utf8')
  .match(/ANIMATED_ICON_NAMES = \[([\s\S]*?)\]/)[1].match(/'([a-z0-9-]+)'/g).map((s) => s.replace(/'/g, ''));

/** nom accepté par `Icon` → nom Lucide (kebab) */
const table = new Map();
for (const [k, v] of Object.entries(HERO)) table.set(k, v);
for (const t of [...sfTokens, ...animated, ...Object.keys(KEBAB)]) table.set(t, KEBAB[t] ?? t);

const missing = [];
const used = new Map(); // kebab lucide → export Pascal
for (const [, kebab] of table) {
  const exp = pascal(kebab);
  if (!lucide[exp]) { missing.push(`${kebab} (${exp})`); continue; }
  used.set(kebab, exp);
}
if (missing.length) {
  console.error('Icônes Lucide introuvables :\n  ' + [...new Set(missing)].join('\n  '));
  process.exit(1);
}

const exports_ = [...new Set(used.values())].sort();
const lines = [];
lines.push('// AUTO-GENERATED by scripts/icons/build-instagram-map.mjs — do not edit by hand.');
lines.push('//');
lines.push('// Glyphes « à la Instagram » : traits arrondis fins, une couleur (celle du texte), jeu Lucide (ISC).');
lines.push('// Les pictogrammes d\'Instagram eux-mêmes sont une marque protégée : on n\'en copie aucun.');
lines.push('/* eslint-disable */');
lines.push("import type { LucideIcon } from 'lucide-react';");
lines.push('import {');
for (const e of exports_) lines.push(`  ${e},`);
lines.push("} from 'lucide-react';");
lines.push('');
lines.push('export const INSTAGRAM_GLYPHS: Record<string, LucideIcon> = {');
for (const [name, kebab] of [...table.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`  ${JSON.stringify(name)}: ${used.get(kebab)},`);
}
lines.push('};');
lines.push('');
lines.push('/** Noms dont l\'état « actif » d\'Instagram est un glyphe plein (cœur, signet…). */');
lines.push('export const INSTAGRAM_FILLED = new Set<string>([');
for (const f of [...FILLED].sort()) lines.push(`  ${JSON.stringify(f)},`);
lines.push(']);');
lines.push('');
fs.writeFileSync(path.join(ICON_DIR, 'instagram.generated.ts'), lines.join('\n'));
console.log(`✓ instagram.generated.ts : ${table.size} noms → ${exports_.length} glyphes Lucide`);
