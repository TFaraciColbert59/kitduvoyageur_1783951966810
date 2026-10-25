import {normalizeGtin} from '../materiel/domain/gtin';
export interface RawOffer {
 merchantId:string;merchantSku:string;gtin:string;price:string;shipping:string;
 currency:string;inStock:boolean;deepLink:string;observedAt:string;expiresAt:string;
}
export interface NormalizedOffer {
 merchantId:string;merchantSku:string;gtin:string;priceCents:number;shippingCents:number;
 currency:'EUR';inStock:boolean;deepLink:string;observedAt:string;expiresAt:string;
}
function cents(value:string):number {
 // Convention du connecteur : decimal point, jamais conversion de devise implicite.
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(value))throw new Error('PRICE_FORMAT');
 const [whole,decimal='']=value.split('.');
 return Number(whole)*100+Number(decimal.padEnd(2,'0'));
}
export function normalizeOffer(raw:RawOffer,allowedHosts:ReadonlySet<string>,nowIso:string):NormalizedOffer {
 const gtin=normalizeGtin(raw.gtin);if(!gtin)throw new Error('GTIN_INVALID');
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(raw.merchantId))throw new Error('MERCHANT_INVALID');
 if(!raw.merchantSku||raw.merchantSku.length>128)throw new Error('SKU_INVALID');
 if(raw.currency!=='EUR')throw new Error('CURRENCY_UNSUPPORTED');
 const url=new URL(raw.deepLink);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!allowedHosts.has(url.hostname))
  throw new Error('LINK_NOT_ALLOWED');
 const observed=Date.parse(raw.observedAt),expires=Date.parse(raw.expiresAt),now=Date.parse(nowIso);
 if(![observed,expires,now].every(Number.isFinite)||observed>now||expires<=now||expires<=observed)
  throw new Error('OFFER_STALE');
 return {merchantId:raw.merchantId,merchantSku:raw.merchantSku,gtin,
  priceCents:cents(raw.price),shippingCents:cents(raw.shipping),currency:'EUR',
  inStock:raw.inStock,deepLink:url.toString(),observedAt:raw.observedAt,expiresAt:raw.expiresAt};
}
export function bestPurchasable(offers:readonly NormalizedOffer[],nowIso:string):NormalizedOffer|null {
 const now=Date.parse(nowIso);if(!Number.isFinite(now))throw new Error('CLOCK_INVALID');
 return [...offers].filter(x=>x.inStock&&Date.parse(x.expiresAt)>now&&Date.parse(x.observedAt)<=now)
  .sort((a,b)=>(a.priceCents+a.shippingCents)-(b.priceCents+b.shippingCents)||
   `${a.merchantId}:${a.merchantSku}`.localeCompare(`${b.merchantId}:${b.merchantSku}`,'en'))[0]??null;
}
