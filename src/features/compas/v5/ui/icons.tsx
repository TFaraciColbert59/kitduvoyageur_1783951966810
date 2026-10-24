import type { SVGProps } from 'react';

/**
 * Icônes du Compas v5 : tracés en ligne (24×24), même famille que la page Compte. Elles sont écrites ici,
 * sans registre de sprites, pour que l'écran v5 ne dépende d'aucun fichier d'icône externe.
 */
const PATHS = {
  x: 'M6 6l12 12M18 6L6 18',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  person: 'M12 8m-4 0a4 4 0 108 0 4 4 0 10-8 0M4 21c0-4 3.6-7 8-7s8 3 8 7',
  people:
    'M9 8m-3.5 0a3.5 3.5 0 107 0 3.5 3.5 0 10-7 0M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 010 7M21 20c0-3-1.8-5.3-4.5-5.9',
  euro: 'M17 6.5A7 7 0 107 17.5 7 7 0 0017 17.5M4 10h9M4 14h9',
  pie: 'M12 3v9h9a9 9 0 11-9-9zM15 3.5A9 9 0 0120.5 9H15z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  bag: 'M8 6V5a4 4 0 018 0v1M5 6h14v15H5zM9 13h6',
  list: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  cloudsun: 'M8 4v1M3.5 6.5l.7.7M2 11h1M12.5 6.5l-.7.7M5.3 10A3 3 0 0111 9M8 19a4 4 0 01-.5-8 5 5 0 019.5 1.5A3.5 3.5 0 0117 19z',
  sun: 'M12 12m-4 0a4 4 0 108 0 4 4 0 10-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  rain: 'M7 15a4 4 0 01-.5-8A5.5 5.5 0 0117 8a3.5 3.5 0 010 7zM9 18l-1 2M13 18l-1 2M17 18l-1 2',
  snow: 'M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7',
  wind: 'M3 9h11a3 3 0 10-3-3M3 15h15a3 3 0 11-3 3M3 12h8',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
  bed: 'M3 18v-8h18v8M3 14h18M7 10V7h4v3',
  car: 'M4 16v-4l2-5h12l2 5v4zM8 16.5m-1.4 0a1.4 1.4 0 102.8 0 1.4 1.4 0 10-2.8 0M16 16.5m-1.4 0a1.4 1.4 0 102.8 0 1.4 1.4 0 10-2.8 0',
  train: 'M9 3h6a3 3 0 013 3v10a3 3 0 01-3 3H9a3 3 0 01-3-3V6a3 3 0 013-3zM6 11h12M9 20l1-4M15 20l-1-4',
  bus: 'M7 4h10a3 3 0 013 3v10H4V7a3 3 0 013-3zM4 11h16M8 20v-3M16 20v-3',
  plane: 'M10.5 13.5L3 11l1-2 8 1 4-5a2 2 0 013 3l-5 4 1 8-2 1-2.5-7.5L10.5 13.5z',
  cart: 'M3 4h2l2.5 11h10l2-8H7M10 19m-1.3 0a1.3 1.3 0 102.6 0 1.3 1.3 0 10-2.6 0M17 19m-1.3 0a1.3 1.3 0 102.6 0 1.3 1.3 0 10-2.6 0',
  drop: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  peak: 'M3 20l7-12 4 6 2-3 5 9z',
  park: 'M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zM10 16V8h3a2.5 2.5 0 010 5h-3',
  thermo: 'M14 14.8V5a2 2 0 00-4 0v9.8a4 4 0 104 0zM12 11v6',
  climb: 'M3 20l6-9 4 5 3-4 5 8zM14 5l3-2 3 2',
  house: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  tent: 'M3 20L12 4l9 16zM12 4v16M9 20l3-5 3 5',
  cross: 'M6 6h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2zM12 9.5v6M9 12.5h6M9 6V4h6v2',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  poles: 'M8 3l-2 18M16 3l2 18M7 7h3M14 7h3',
  jacket: 'M8 3l4 3 4-3 4 4-2 3v11H6V10L4 7zM12 6v15',
  shirt: 'M8 4l-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3a4 4 0 01-8 0z',
  sheet: 'M3 18v-8h18v8M3 14h18M7 10V7h4v3',
  stove: 'M6 14h12v6H6zM9 14V9M15 14V9M8 6c0-2 2-2 2-4M14 6c0-2 2-2 2-4',
  cup: 'M6 8h10v6a5 5 0 01-10 0zM16 10h2a2 2 0 010 4h-2M9 3v2M12 3v2',
  route: 'M6 18m-2 0a2 2 0 104 0 2 2 0 10-4 0M18 6m-2 0a2 2 0 104 0 2 2 0 10-4 0M8 18h6a3 3 0 000-6h-4a3 3 0 010-6h6',
  hike: 'M13 4m-2 0a2 2 0 104 0 2 2 0 10-4 0M7 21l3-6 3 2v4M10 15l1-5 3 2 3 1M6 12l2-3 3-1',
  spark: 'M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
  menu: 'M4 7h16M4 12h16M4 17h10',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  grid: 'M5 4h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM14 4h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5a1 1 0 011-1zM5 13h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5a1 1 0 011-1zM14 13h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5a1 1 0 011-1z',
  timeline: 'M6 6m-2 0a2 2 0 104 0 2 2 0 10-4 0M6 18m-2 0a2 2 0 104 0 2 2 0 10-4 0M6 8v8M11 6h9M11 18h9',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  locate: 'M20 4L4 11l7 2 2 7z',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  globe: 'M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  compass: 'M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0M15.5 8.5l-2 5-5 2 2-5z',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  chat: 'M4 5h16v11H9l-5 4z',
  info: 'M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0M12 11v5M12 8h.01',
  calendar: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M9 3v4M15 3v4',
  clock: 'M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0M12 7v5l3 2',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  user_plus: 'M10 8m-4 0a4 4 0 108 0 4 4 0 10-8 0M3 21c0-3.5 3-6 7-6M18 8v6M15 11h6',
  box: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 14m-3.5 0a3.5 3.5 0 107 0 3.5 3.5 0 10-7 0',
  wifi_off: 'M3 3l18 18M8.5 16.4a5 5 0 017 0M5 12.9a10 10 0 015.2-2.8M2 8.8A15 15 0 019 5.5M12 20h.01',
  sleep: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
} as const;

export type V5IconName = keyof typeof PATHS;

export function V5Icon({
  name,
  size,
  ...rest
}: { name: V5IconName; size?: 's' | 'xs' | 'big' } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      className={`v5-ic${size ? ` ${size}` : ''}${rest.className ? ` ${rest.className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Icône du moyen de transport choisi. */
export function transportIcon(id: string): V5IconName {
  switch (id) {
    case 'car':
      return 'car';
    case 'train':
      return 'train';
    case 'bus':
      return 'bus';
    case 'flight':
      return 'plane';
    case 'carpool':
      return 'people';
    default:
      return 'hike';
  }
}

export function stayIcon(kind: string): V5IconName {
  switch (kind) {
    case 'refuge':
      return 'house';
    case 'camping':
    case 'bivouac':
      return 'tent';
    default:
      return 'bed';
  }
}
