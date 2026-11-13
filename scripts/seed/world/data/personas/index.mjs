// Assemblage des 50 résidents + le compte démo.
import { GROUP_A } from './a.mjs';
import { GROUP_B } from './b.mjs';
import { GROUP_C } from './c.mjs';
import { GROUP_D } from './d.mjs';
import { GROUP_E } from './e.mjs';
import { DEMO } from './demo.mjs';
import { PHOTOS } from '../media.mjs';
import { handleFor, personaId, slugify } from '../../lib/ids.mjs';

export const RESIDENTS_RAW = [...GROUP_A, ...GROUP_B, ...GROUP_C, ...GROUP_D, ...GROUP_E];

export const DEMO_RAW = DEMO;

const AVATAR_BASE = 'https://i.pravatar.cc/400?img=';

function enrich(persona, index, isDemo) {
  const cover = persona.cover ?? ['mountain', 0];
  const coverList = PHOTOS[cover[0]] ?? PHOTOS.mountain;
  const coverId = coverList[cover[1] % coverList.length];
  const handle = isDemo ? 'lea.fontaine' : handleFor(persona);
  return {
    ...persona,
    index,
    isDemo,
    // Le compte démo conserve son UUID et son email historiques.
    id: isDemo ? 'd5451f35-db9f-4575-9114-6d3b79550bbc' : personaId(persona.key),
    handle,
    email: isDemo ? 'demo@lkdv.app' : `${handle.replace(/\./g, '.')}@voyageurs.lkdv.app`,
    avatar: isDemo
      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80'
      : `${AVATAR_BASE}${persona.avatarN ?? ((index % 70) + 1)}`,
    coverUrl: `https://images.unsplash.com/photo-${coverId}?auto=format&fit=crop&w=1600&q=80`,
    slug: slugify(`${persona.first}-${persona.last}`),
    links: (persona.links ?? []).map(([label, url]) => ({ label, url })),
    clubs: persona.clubs ?? [],
    affinity: [...new Set(persona.affinity ?? [])].filter((k) => k !== persona.key),
    posts: persona.posts ?? [],
    outings: persona.outings ?? [],
    trips: persona.trips ?? (persona.trip ? [persona.trip] : []),
    carnets: persona.carnets ?? (persona.carnet ? [persona.carnet] : []),
    carnet: persona.carnet ?? null,
  };
}

export const RESIDENTS = RESIDENTS_RAW.map((p, i) => enrich(p, i, false));
export const DEMO_PERSONA = enrich(DEMO_RAW, RESIDENTS.length, true);
export const ALL_PEOPLE = [...RESIDENTS, DEMO_PERSONA];
export const BY_KEY = new Map(ALL_PEOPLE.map((p) => [p.key, p]));

export function validateCasting() {
  const errors = [];
  const keys = new Set();
  const emails = new Set();
  const handles = new Set();
  for (const p of ALL_PEOPLE) {
    if (keys.has(p.key)) errors.push(`clé dupliquée: ${p.key}`);
    keys.add(p.key);
    if (emails.has(p.email)) errors.push(`email dupliqué: ${p.email}`);
    emails.add(p.email);
    if (handles.has(p.handle.toLowerCase())) errors.push(`handle dupliqué: ${p.handle}`);
    handles.add(p.handle.toLowerCase());
    for (const a of p.affinity) {
      if (!BY_KEY.has(a)) errors.push(`${p.key} suit un inconnu: ${a}`);
    }
    for (const c of p.clubs) {
      if (typeof c !== 'string') errors.push(`${p.key} club invalide`);
    }
  }
  if (RESIDENTS.length !== 50) errors.push(`50 résidents attendus, ${RESIDENTS.length} trouvés`);
  return errors;
}
