/**
 * Normalise intelligemment la catégorie d'un équipement outdoor à partir
 * de sa catégorie brute ou de son intitulé (reconnaissance lexicale).
 */
export function normalizeItemCategory(category?: string | null, name?: string | null): string {
  if (category && category.trim() && category.trim().toLowerCase() !== 'autre' && category.trim().toLowerCase() !== 'équipement') {
    const c = category.trim().toLowerCase();
    if (c.includes('bivouac') || c.includes('abri') || c.includes('tente')) return 'Bivouac';
    if (c.includes('portage') || c.includes('sac')) return 'Portage';
    if (c.includes('couchage') || c.includes('duvet') || c.includes('matelas')) return 'Couchage';
    if (c.includes('cuisine') || c.includes('popote') || c.includes('rechaud') || c.includes('réchaud')) return 'Cuisine';
    if (c.includes('hydratation') || c.includes('eau') || c.includes('gourde') || c.includes('filtre')) return 'Hydratation';
    if (c.includes('vetement') || c.includes('vêtement') || c.includes('textile') || c.includes('habit')) return 'Vêtements';
    if (c.includes('securite') || c.includes('sécurité') || c.includes('soin') || c.includes('secours') || c.includes('pharmacie')) return 'Sécurité';
    if (c.includes('navigation') || c.includes('orientation') || c.includes('carte') || c.includes('gps')) return 'Navigation';
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  const n = (name || '').toLowerCase();
  if (n.includes('tente') || n.includes('tarp') || n.includes('bivouac') || n.includes('abri') || n.includes('piquet') || n.includes('hauban')) return 'Bivouac';
  if (n.includes('sac à dos') || n.includes('sac a dos') || n.includes('osprey') || n.includes('portage') || n.includes('housse') || n.includes('sacoche')) return 'Portage';
  if (n.includes('duvet') || n.includes('matelas') || n.includes('couchage') || n.includes('oreiller') || n.includes('drap') || n.includes('sac de couchage')) return 'Couchage';
  if (n.includes('réchaud') || n.includes('rechaud') || n.includes('popote') || n.includes('gaz') || n.includes('cuisine') || n.includes('lyophilisé') || n.includes('plat') || n.includes('jetboil') || n.includes('pocketrocket')) return 'Cuisine';
  if (n.includes('filtre') || n.includes('gourde') || n.includes('eau') || n.includes('hydratation') || n.includes('sawyer') || n.includes('flasque') || n.includes('poche à eau') || n.includes('nalgene') || n.includes('katadyn')) return 'Hydratation';
  if (n.includes('veste') || n.includes('doudoune') || n.includes('pantalon') || n.includes('polaire') || n.includes('gants') || n.includes('bonnet') || n.includes('t-shirt') || n.includes('chaussette') || n.includes('vêtement') || n.includes('vetement') || n.includes('gore-tex') || n.includes('arcteryx')) return 'Vêtements';
  if (n.includes('secours') || n.includes('frontale') || n.includes('lampe') || n.includes('sécurité') || n.includes('securite') || n.includes('sifflet') || n.includes('survie') || n.includes('pharmacie') || n.includes('petzl')) return 'Sécurité';
  if (n.includes('boussole') || n.includes('carte') || n.includes('gps') || n.includes('navigation') || n.includes('altimètre') || n.includes('ign')) return 'Navigation';
  
  return 'Équipement';
}

/**
 * Poids de repli standard pour les équipements outdoor lorsque non renseigné en base.
 */
export function getDefaultItemWeight(name: string, category: string): number {
  const n = (name || '').toLowerCase();
  if (n.includes('tente') || n.includes('hubba')) return 1720;
  if (n.includes('sac à dos') || n.includes('osprey')) return 1980;
  if (n.includes('duvet') || n.includes('mirage')) return 770;
  if (n.includes('matelas') || n.includes('neoair')) return 430;
  if (n.includes('réchaud') || n.includes('pocketrocket') || n.includes('jetboil')) return 370;
  if (n.includes('filtre') || n.includes('sawyer')) return 85;
  if (n.includes('gourde') || n.includes('nalgene')) return 175;
  if (n.includes('veste') || n.includes('gore-tex')) return 400;
  if (n.includes('doudoune')) return 340;
  if (n.includes('pantalon')) return 410;
  if (n.includes('secours') || n.includes('soins')) return 250;
  if (n.includes('frontale') || n.includes('lampe') || n.includes('petzl')) return 100;
  
  if (category === 'Bivouac') return 1500;
  if (category === 'Portage') return 1800;
  if (category === 'Couchage') return 800;
  if (category === 'Cuisine') return 400;
  if (category === 'Hydratation') return 200;
  if (category === 'Vêtements') return 400;
  if (category === 'Sécurité') return 250;
  if (category === 'Navigation') return 150;
  
  return 300;
}
