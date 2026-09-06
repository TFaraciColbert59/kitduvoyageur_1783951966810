import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  MapPin,
  Calendar,
  Users,
  Package,
  Shield,
  CreditCard,
  FileText,
  Clock,
  Sparkles,
  Mountain,
  Tent,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit3,
  Share2,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  Check,
  X,
  Lock,
  Heart,
  Bookmark,
  Bell,
  Home,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';

export const SEMANTIC_ICONS = {
  // Navigation & Structure
  home: Home,
  compass: Compass,
  mountain: Mountain,
  mapPin: MapPin,
  calendar: Calendar,
  clock: Clock,
  search: Search,
  filter: Filter,
  
  // Expeditions & Team
  users: Users,
  gear: Package,
  safety: Shield,
  budget: CreditCard,
  document: FileText,
  tent: Tent,
  sparkles: Sparkles,
  shop: ShoppingBag,

  // Status & Feedback
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  check: Check,
  close: X,
  lock: Lock,
  heart: Heart,
  bookmark: Bookmark,
  bell: Bell,

  // Actions
  plus: Plus,
  trash: Trash2,
  edit: Edit3,
  share: Share2,
  download: Download,
  print: Printer,
  trendUp: TrendingUp,
  trendDown: TrendingDown,

  // Chevrons & Direction
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
} as const;

export type SemanticIconName = keyof typeof SEMANTIC_ICONS;

/**
 * Récupère l'icône Lucide vectorielle standard pour un nom sémantique.
 */
export function getSemanticIcon(name: SemanticIconName): LucideIcon {
  return SEMANTIC_ICONS[name] || Compass;
}
