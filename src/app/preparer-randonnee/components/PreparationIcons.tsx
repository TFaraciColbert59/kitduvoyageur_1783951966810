import React from 'react';

export const ICONS: Record<string, React.ReactNode> = {
  boot: <><path d="M6 20V9a2 2 0 0 1 2-2h2v13"/><path d="M10 20l10 -1 -2 -6 -8 1"/><path d="M14 11l1 2M17 10l1 2"/></>,
  backpack: <><path d="M7 8a5 5 0 0 1 10 0v12H7z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/><path d="M9 13h6"/></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>,
  shirt: <path d="M6 6l3-3h6l3 3 3 2-2 4-2-1v10H6V11L4 12 2 8z"/>,
  "cloud-rain": <><path d="M7 15a4 4 0 1 1 1-7.9 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/></>,
  poles: <path d="M5 3l4 18M10 3l-1 3M9 6l2 1M19 3l-4 18M14 3l1 3M15 6l-2 1"/>,
  leaf: <><path d="M5 19c0-8 6-14 15-14 0 9-6 15-15 15z"/><path d="M5 19l7-7"/></>,
  map: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></>,
  lamp: <><path d="M8 12h8a4 4 0 0 0 0-8H8a4 4 0 0 0 0 8z"/><path d="M8 12v8h8v-8"/><path d="M2 8h2M20 8h2M4 4l1.5 1.5M18.5 5.5L20 4"/></>,
  cross: <><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M12 10v6M9 13h6"/><path d="M9 6V4h6v2"/></>,
  hand: <path d="M8 11V6a1.5 1.5 0 0 1 3 0v5M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5a1.5 1.5 0 0 1 3 0v6M17 11V7a1.5 1.5 0 0 1 3 0v7c0 4-3 7-6.5 7S8 18 8 15v-2"/>,
  beanie: <><path d="M4 17a8 8 0 0 1 16 0"/><path d="M2 17h20v3H2z"/><path d="M12 4v3"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></>,
  check: <path d="M4 12l5 5L20 6"/>,
  x: <path d="M6 6l12 12M18 6l-12 12"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  swap: <path d="M7 4L4 7l3 3M4 7h13a4 4 0 0 1 0 8h-1M17 20l3-3-3-3M20 17H7a4 4 0 0 1 0-8h1"/>,
  gps: <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></>,
  battery: <><rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4"/><rect x="5" y="9" width="10" height="6" rx="0.5" fill="currentColor" stroke="none"/></>,
  cloud: <path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7z"/>,
  wind: <path d="M4 8h11a3 3 0 1 0-3-3M4 12h15a3 3 0 1 1-3 3M4 16h11"/>,
  temp: <><path d="M12 15V4a2 2 0 1 1 4 0v11a4 4 0 1 1-4 0z"/><circle cx="14" cy="18" r="1.5" fill="currentColor"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  route: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4"/></>,
  mountain: <path d="M3 20l6-14 4 8 3-5 5 11z"/>,
  bookmark: <path d="M6 4h12v17l-6-4-6 4z"/>,
  back: <path d="M15 6l-6 6 6 6"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 8v1M12 12v5"/></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>,
  spark: <path d="M12 3l1.5 5 5 1.5-5 1.5L12 16l-1.5-5-5-1.5 5-1.5z"/>,
  timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 3h6"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  // Fallbacks map for engine labels to icons
  tente: <path d="M3 20l9-15 9 15z" />,
  water: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>,
};

export const getIconForCategory = (label: string): string => {
  const l = label.toLowerCase();
  if (l.includes('eau') || l.includes('hydrat')) return 'drop';
  if (l.includes('chaussure')) return 'boot';
  if (l.includes('sac à dos')) return 'backpack';
  if (l.includes('tente') || l.includes('abri')) return 'tente';
  if (l.includes('couchage')) return 'timer'; // close enough
  if (l.includes('nourriture') || l.includes('repas')) return 'leaf';
  if (l.includes('imperméable') || l.includes('pluie')) return 'cloud-rain';
  if (l.includes('polaire') || l.includes('chaude') || l.includes('couche')) return 'shirt';
  if (l.includes('solaire') || l.includes('soleil')) return 'sun';
  if (l.includes('froid') || l.includes('gant')) return 'hand';
  if (l.includes('bonnet')) return 'beanie';
  if (l.includes('bâton')) return 'poles';
  if (l.includes('frontale') || l.includes('lampe')) return 'lamp';
  if (l.includes('carte') || l.includes('gps')) return 'map';
  if (l.includes('secours') || l.includes('trousse')) return 'cross';
  
  return 'bookmark';
};

export const Icon = ({ name, className }: { name: string, className?: string }) => {
  const content = ICONS[name] || ICONS["bookmark"]; // default
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.7" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {content}
    </svg>
  );
};
