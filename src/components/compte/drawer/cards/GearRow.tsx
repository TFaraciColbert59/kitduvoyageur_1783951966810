'use client';

import React, { useEffect, useState } from 'react';
import { formatEuro, formatWeight } from './format';
import { generatedProductImage } from './productImage';

export type GearViewer = 'owner' | 'visitor';

export interface GearEntry {
  id?: string | null;
  realId?: string | null;
  n?: string | null;
  name?: string | null;
  b?: string | null;
  brand?: string | null;
  c?: string | null;
  category?: string | null;
  w?: number | null;
  weight_g?: number | null;
  paid?: number | null;
  price_cents?: number | null;
  so?: number | null;
  outings_count?: number | null;
  cond?: string | null;
  condition?: string | null;
  lent?: string | null;
  loaned_to?: string | null;
  is_lent?: boolean | null;
  photo_url?: string | null;
  image?: string | null;
}

function firstString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function gearName(item: GearEntry): string {
  return firstString(item.n, item.name) || 'Objet';
}

export function gearCategory(item: GearEntry): string {
  return firstString(item.c, item.category) || 'Autres';
}

export function gearPhoto(item: GearEntry, size = 44): string {
  return (
    firstString(item.photo_url, item.image) || generatedProductImage(gearName(item), size)
  );
}

export function gearLentTo(item: GearEntry): string | null {
  const lent = firstString(item.lent, item.loaned_to);
  if (lent) return lent;
  return item.is_lent ? 'un membre' : null;
}

/**
 * Ligne d'inventaire du drawer Profil : image produit 44 px, nom, marque,
 * poids, état et badge prêt. Le visiteur ne voit ni prix, ni coût par sortie,
 * ni prêt — seuls le nom, la marque, le poids et l'état restent publics.
 */
export function GearRow({ item, viewer = 'owner' }: { item: GearEntry; viewer?: GearViewer }) {
  const name = gearName(item);
  const brand = firstString(item.b, item.brand);
  const weight = firstNumber(item.w, item.weight_g);
  const condition = firstString(item.cond, item.condition);
  const priceCents = firstNumber(item.price_cents);
  const paid = firstNumber(item.paid, priceCents !== null ? priceCents / 100 : null);
  const outings = firstNumber(item.so, item.outings_count);
  const owner = viewer === 'owner';
  const price = owner ? formatEuro(paid) : null;
  const costPerOuting =
    owner && paid !== null && outings !== null && outings > 0
      ? formatEuro(paid / outings)
      : null;
  const lentTo = owner ? gearLentTo(item) : null;
  const source = gearPhoto(item);

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [source]);

  const meta = [
    brand ? { key: 'brand', value: brand } : null,
    weight !== null ? { key: 'weight', value: formatWeight(weight) } : null,
    condition ? { key: 'condition', value: condition } : null,
  ].filter((part): part is { key: string; value: string } => part !== null);

  return (
    <li
      className="lkdv-gear-row"
      data-gear-id={firstString(item.realId, item.id) || undefined}
      data-lent={lentTo ? 'true' : 'false'}
      data-viewer={viewer}
    >
      <img
        className="lkdv-gear-img"
        src={imageFailed ? generatedProductImage(name, 44) : source}
        alt={name}
        width={44}
        height={44}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
      <div className="lkdv-gear-main">
        <p className="lkdv-gear-name">{name}</p>
        {meta.length ? (
          <p className="lkdv-gear-meta">
            {meta.map((part, index) => (
              <React.Fragment key={part.key}>
                {index > 0 ? <span aria-hidden="true"> · </span> : null}
                <span>{part.value}</span>
              </React.Fragment>
            ))}
          </p>
        ) : null}
        {price || costPerOuting ? (
          <p className="lkdv-gear-cost">
            {price}
            {price && costPerOuting ? ' · ' : null}
            {costPerOuting ? `${costPerOuting} / sortie` : null}
          </p>
        ) : null}
      </div>
      {owner ? (
        lentTo ? (
          <span className="lkdv-gear-badge" data-lent="true">
            Prêté à {lentTo}
          </span>
        ) : (
          <span className="lkdv-gear-badge" data-lent="false">
            Prêt
          </span>
        )
      ) : null}
    </li>
  );
}

export const GEAR_ROW_CSS = `
.lkdv-gear-groups{display:flex!important;flex-direction:column!important;gap:10px!important;width:100%!important;min-width:0!important;}
.lkdv-gear-group{display:flex!important;flex-direction:column!important;gap:5px!important;min-width:0!important;}
.lkdv-gear-cat{margin:0!important;font:600 10.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;letter-spacing:.06em!important;text-transform:uppercase!important;color:var(--label2,#56665D)!important;}
.lkdv-gear-list{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:6px!important;min-width:0!important;}
.lkdv-gear-row{display:grid!important;grid-template-columns:44px minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;padding:7px 9px 7px 7px!important;border-radius:16px!important;background:rgba(255,255,255,.52)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.94),0 0 0 .5px rgba(23,43,36,.08)!important;min-height:44px!important;box-sizing:border-box!important;color:var(--label,#17402C)!important;}
.lkdv-gear-img{width:44px!important;height:44px!important;border-radius:11px!important;object-fit:cover!important;display:block!important;background:rgba(236,244,233,.8)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-gear-main{display:flex!important;flex-direction:column!important;gap:1px!important;min-width:0!important;}
.lkdv-gear-name{margin:0!important;font:600 12.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label,#17402C)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-gear-meta{margin:0!important;font:400 10.5px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-gear-cost{margin:0!important;font:600 10.5px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--tint,#17402C)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-gear-badge{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:24px!important;max-width:110px!important;padding:2px 8px!important;border-radius:999px!important;background:rgba(236,244,233,.9)!important;color:var(--tint,#17402C)!important;font:600 9.5px/1.15 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:inset 0 0 0 .5px rgba(91,127,85,.3)!important;}
.lkdv-gear-badge[data-lent="true"]{background:rgba(185,138,46,.14)!important;color:#7A5A17!important;box-shadow:inset 0 0 0 .5px rgba(185,138,46,.32)!important;}
@media (prefers-reduced-motion:reduce){.lkdv-gear-row{transition:none!important;}}
`;

export default GearRow;
