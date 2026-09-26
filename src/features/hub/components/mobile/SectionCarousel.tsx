import { HapticLink } from '../menu/HapticLink';
import type { MobileSectionTile } from '../../mobile/mobileHubEngine';

export interface SectionCarouselProps {
  tiles: MobileSectionTile[];
  label?: string;
}

export function SectionCarousel({ tiles, label = 'Sections de l’aventure' }: SectionCarouselProps) {
  if (tiles.length === 0) return null;

  return (
    <section aria-label={label} className="min-w-0">
      <ul className="hub-hscroll -mx-4 flex list-none snap-x gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-1">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <li key={tile.key} className="snap-start shrink-0">
              <HapticLink
                href={tile.href}
                ariaLabel={tile.label}
                className={`hub-section-control relative flex h-[7rem] w-[7.75rem] flex-col items-center justify-center gap-1.5 rounded-[var(--lkv-radius-lg)] p-3 text-center transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] sm:h-[8rem] sm:w-[8.5rem] md:h-[8.5rem] md:w-[9rem] ${
                  tile.accent
                    ? 'hub-section-control--accent interactive text-[var(--lkv-text-primary)]'
                    : 'interactive text-[var(--lkv-text-primary)]'
                }`}
              >
                {tile.badge && (
                  <span
                    className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold tabular-nums ${
                      tile.accent
                        ? 'bg-[var(--lkv-primary)]/15 text-[var(--lkv-primary)]'
                        : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                    }`}
                  >
                    {tile.badge}
                  </span>
                )}
                <span className="hub-tile-glyph flex h-12 w-12 items-center justify-center">
                  <Icon size={23} aria-hidden="true" />
                </span>
                <span className="line-clamp-2 text-[12px] font-bold leading-tight">{tile.label}</span>
              </HapticLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default SectionCarousel;
