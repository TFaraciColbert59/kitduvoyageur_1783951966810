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
                className={`relative flex h-[8.75rem] w-[7.75rem] flex-col items-center justify-center rounded-[1.4rem] p-3 text-center transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] sm:h-[9.5rem] sm:w-[8.5rem] md:h-[10rem] md:w-[9rem] ${
                  tile.accent
                    ? 'bg-[var(--lkv-primary)] text-white shadow-sm'
                    : 'glass interactive text-[var(--lkv-text-primary)]'
                }`}
              >
                {tile.badge && (
                  <span
                    className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold tabular-nums ${
                      tile.accent
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                    }`}
                  >
                    {tile.badge}
                  </span>
                )}
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-[1.1rem] border ${
                    tile.accent
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/70 bg-white/70 text-[var(--lkv-secondary)] shadow-2xs'
                  }`}
                >
                  <Icon size={26} aria-hidden="true" />
                </span>
              </HapticLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default SectionCarousel;
