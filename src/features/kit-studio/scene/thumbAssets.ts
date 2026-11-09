// Actifs réels pour les vignettes des cartes.
//
// Les constructeurs de vignettes sont synchrones (`ThumbBuilder` rend un `Object3D`) alors qu'un
// `.glb` se charge en asynchrone. Ce cache fait le pont : le constructeur demande l'actif, obtient
// `null` la première fois — il sert alors sa silhouette de repli —, et le chargement prévient les
// abonnés à son arrivée pour que la vignette soit redessinée avec le maillage réel.
//
// Rien n'est chargé d'avance : seules les clés réellement demandées déclenchent une requête, pour
// qu'ouvrir le tiroir ne tire pas la vingtaine de corps et de modules d'un coup sur un téléphone.
import type { Object3D, Texture } from 'three';

type Etat = 'absent' | 'en-cours' | 'echec';

interface Entree {
  etat: Etat;
  /** Racine conservée pour cloner ; jamais ajoutée telle quelle à une scène de vignette. */
  racine: Object3D | null;
}

const corps = new Map<string, Entree>();
const modules = new Map<string, Entree>();
/** Cartes de zones des corps texturés, par modèle (voir `zonesDuCorps`). */
const zonesCorps = new Map<string, Texture>();
const abonnes = new Set<(id: string) => void>();

/**
 * Relevé des actifs demandés par le constructeur en cours. Le moteur s'en sert pour savoir quelle
 * vignette dépend de quel maillage, et ne refaire que celles-là : invalider toutes les vignettes à
 * chaque arrivée produisait plus de cent rendus, qui affamaient la scène principale.
 */
let releve: string[] | null = null;

export function commencerReleve(): void {
  releve = [];
}

export function terminerReleve(): readonly string[] {
  const r = releve ?? [];
  releve = null;
  return r;
}

function prevenir(id: string): void {
  for (const f of [...abonnes]) {
    try {
      f(id);
    } catch {
      // Un abonné en échec ne doit pas empêcher les autres d'être prévenus.
    }
  }
}

/**
 * S'abonner à l'arrivée d'un actif. Appelé à chaque maillage chargé ; les vignettes s'en servent
 * pour redemander leur image. Rend la fonction de désabonnement.
 */
export function surActifPret(ecouteur: (id: string) => void): () => void {
  abonnes.add(ecouteur);
  return () => {
    abonnes.delete(ecouteur);
  };
}

/**
 * Deux téléchargements à la fois, pas plus. Un tiroir de vingt cartes lançait sinon vingt
 * requêtes d'un coup : mesuré sur le banc, la scène principale n'obtenait plus son propre maillage
 * et restait bloquée sur « chargement ». La vignette n'est jamais urgente, le sac l'est.
 */
const CHARGEMENTS_SIMULTANES = 1;
let enVol = 0;
const attente: (() => void)[] = [];

/**
 * Tant que la scène n'a pas son propre maillage, aucune vignette ne télécharge quoi que ce soit.
 * Mesuré sur le banc : les cinq masters des corps décodés pour le tiroir retardaient le sac
 * principal de plus de vingt secondes. Le sac d'abord, les vignettes ensuite.
 */
let ouvert = false;
let minuterie: ReturnType<typeof setTimeout> | null = null;
/** Filet : sans scène pour ouvrir la file (fiche isolée, chargement en échec), on finit par servir. */
const DELAI_SECOURS_MS = 25000;

/** Ouvre la file : appelé par la scène quand son maillage est posé. */
export function ouvrirChargementsVignettes(): void {
  if (minuterie) {
    clearTimeout(minuterie);
    minuterie = null;
  }
  if (ouvert) return;
  ouvert = true;
  const enAttente = attente.splice(0, attente.length);
  for (const f of enAttente) {
    if (enVol < CHARGEMENTS_SIMULTANES) f();
    else attente.push(f);
  }
}

function suivant(): void {
  enVol -= 1;
  const prochain = attente.shift();
  if (prochain) prochain();
}

function demander(
  table: Map<string, Entree>,
  id: string,
  charger: () => Promise<Object3D | null>,
): Object3D | null {
  releve?.push(id);
  const connue = table.get(id);
  if (connue) return connue.etat === 'absent' ? connue.racine : null;

  const entree: Entree = { etat: 'en-cours', racine: null };
  table.set(id, entree);

  const lancer = () => {
    enVol += 1;
    void charger().then(
      (racine) => {
        if (racine) {
          entree.etat = 'absent';
          entree.racine = racine;
          suivant();
          prevenir(id);
          return;
        }
        entree.etat = 'echec';
        suivant();
      },
      () => {
        entree.etat = 'echec';
        suivant();
      },
    );
  };

  if (ouvert && enVol < CHARGEMENTS_SIMULTANES) {
    lancer();
  } else {
    attente.push(lancer);
    if (!ouvert && minuterie === null) {
      minuterie = setTimeout(ouvrirChargementsVignettes, DELAI_SECOURS_MS);
    }
  }
  return null;
}

/**
 * Maillage réel d'un corps, prêt à cloner, ou `null` tant qu'il n'est pas là (le chargement est
 * alors lancé). Un corps sans maillage publié reste à `null` définitivement : le repli tient.
 */
export function maillageCorps(modelId: string | null | undefined): Object3D | null {
  if (!modelId) return null;
  return demander(corps, modelId, async () => {
    const { loadBagAsset, chargerTextureDonnee } = await import('./bag/loader');
    const r = await loadBagAsset(modelId);
    if (r.status !== 'ready') return null;
    // La carte de zones dit où est le tissu : sans elle, la teinte d'un coloris repeindrait aussi
    // les boucles et l'écusson, comme à la scène (qui, sans carte, ne teinte rien). Elle est
    // rangée avec le maillage, avant qu'il soit annoncé prêt, pour que la première vignette teintée
    // la trouve. Un seul téléchargement par corps : changer de coloris n'en relance aucun.
    const adresse = r.manifest.texturedSource ? r.manifest.zonesMapUrl : undefined;
    if (adresse) {
      const zones = await chargerTextureDonnee(adresse).catch(() => null);
      if (zones) zonesCorps.set(modelId, zones);
    }
    return r.root;
  });
}

/**
 * Carte de zones du corps (rouge = tissu), ou `null` si le sac n'en a pas ou qu'elle n'est pas
 * arrivée. Lue après `maillageCorps` : elle est rangée avant que le maillage soit annoncé prêt.
 * Appartient au cache : le constructeur de vignette ne la libère pas.
 */
export function zonesDuCorps(modelId: string | null | undefined): Texture | null {
  return modelId ? (zonesCorps.get(modelId) ?? null) : null;
}

/** Maillage réel d'un module, prêt à cloner, ou `null` tant qu'il n'est pas là. */
export function maillageModule(moduleId: string | null | undefined): Object3D | null {
  if (!moduleId) return null;
  return demander(modules, moduleId, async () => {
    const { loadModuleAsset } = await import('./bag/moduleLoader');
    const r = await loadModuleAsset(moduleId);
    if (r.status !== 'ready') return null;
    // La platine n'appartient pas au module : elle est ajoutée par la scène pour le montage, et
    // n'a rien à faire sur la vignette du module seul.
    const platine = r.root.getObjectByName('lkdv-platine');
    if (platine?.parent) platine.parent.remove(platine);
    return r.root;
  });
}

/** Vide le cache (tests). */
export function viderActifsVignettes(): void {
  corps.clear();
  modules.clear();
  for (const t of zonesCorps.values()) t.dispose();
  zonesCorps.clear();
  attente.length = 0;
  enVol = 0;
  ouvert = false;
  if (minuterie) {
    clearTimeout(minuterie);
    minuterie = null;
  }
}
