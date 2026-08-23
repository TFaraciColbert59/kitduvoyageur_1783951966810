import Image from 'next/image';
import { Badge } from './Badge';

export function ProductGlassCard({
  name, imageUrl, price, sponsored = true, href,
}: { name: string; imageUrl: string; price: string; sponsored?: boolean; href: string }) {
  return (
    <a href={href} className="glass interactive block w-[168px] shrink-0 p-3" aria-label={`${name}, ${price}`}>
      <div className="relative h-[120px] w-full rounded-[var(--r-md)] overflow-hidden bg-stone-100">
        <Image src={imageUrl} alt={name} fill sizes="168px" className="object-cover" />
      </div>
      <p className="mt-2 text-sm font-medium text-[color:var(--label)] line-clamp-2">{name}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-display font-semibold text-[15px] text-[color:var(--label)]">{price}</span>
        {sponsored && <Badge tone="stone">Partenaire</Badge>}
      </div>
    </a>
  );
}
