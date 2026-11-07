# Modèle de données du Studio

Le moteur ne connaît qu'une forme : `StudioData`. En mode test elle vient de `engine/demo.ts` (copie de la référence) ; en production de `server/getStudioData.ts`. Les deux doivent être indiscernables pour le moteur.

## Types (repris des objets de la référence)

```ts
type ZoneId = 'worn' | 'lid' | 'main' | 'front' | 'sides' | 'hip' | 'back';
type Slot = 'bottom' | 'bottomF' | 'midBack' | 'midFront' | 'top';

interface Item {            // INV, constructeur I(...) de la référence
  id: string; n: string; fam: string; fn: string; sh: string; gl: string;
  g: number | null; L: number; c: string; z: ZoneId[];
  state: 'stock' | 'lent'; loc: string; trips: number;
  vital?: boolean; cons?: 'food' | 'water' | 'fuel'; dry?: number; temp?: string;
  bought?: string; price?: number; care?: string; lentTo?: string; until?: string;
  expired?: string; cabinBan?: boolean; planned?: 'shop' | 'rent'; eur?: number; day?: number; checked?: boolean;
}
interface Kit {             // KITS
  id: string; n: string; days: number; bag: 'b28' | 'b42'; cw: string; body: number; start: string; ctx: string;
  cabin?: { dims: [number, number, number]; kg: number };
  packed: Record<ZoneId, string[]>; slots: Record<string, Slot> | null;
  ghosts: { fn: string; zone: ZoneId; gl: string; sh: string; n: string; why: string }[];
  food: { perDay: number; carry: number } | null;
  lineage: { from: string | null; gen: number; proven: number };
}
interface PartCfg { shape?: string; mat?: string; col: string; fin: string }
interface Cfg { body: PartCfg; lid: PartCfg; front: PartCfg; sides: PartCfg; hip: PartCfg; harness: PartCfg; webbing: PartCfg; accent: string; acc: string[] }
interface StudioData {
  inventory: Item[]; kits: Kit[]; cfg: Record<'b28' | 'b42', Cfg>;
  one: typeof ONE;                         // châssis, corps, modules (prix en euros, points d'attache)
  colorways: Record<string, { n: string; body: string; pocket: string; trim: string; accent: string }>;
  owned: [string, string][];               // [pièce, coloris] possédées
  ordered: [string, string][];             // [pièce, coloris] précommandées
  user: { bodyKg: number };
}
```

## Correspondance avec Supabase

| Champ du moteur | Source | Règle |
| --- | --- | --- |
| `Item.id` | `product_ownership.id` | uuid tel quel ; le lien profond `#id` fonctionne pareil |
| `Item.n`, `fam` | `name`, `gear_functions.family` (via `function_id`) | |
| `Item.fn`, `sh`, `gl` | `gear_functions.id`, `shape_kind`, icône dérivée de `shape_kind` | objet non classé : `fn='other'`, `sh='box'`, `gl='box'` |
| `Item.g`, `L` | `weight_g`, `volume_ml / 1000` | volume absent : 0,6 L (valeur de la référence pour un objet inconnu) |
| `Item.z` | `gear_functions.default_zone` puis les zones compatibles | |
| `Item.state`, `lentTo`, `until` | `is_lent`, prêt en cours | |
| `Item.care`, `expired` | `maintenance_due_at`, `expiry_date` | dates formatées comme la référence |
| `Item.vital` | `gear_functions.is_vital_default` | |
| `Kit` | `materiel_kits` | `days`, `ctx`, `cabin` viennent du voyage lié s'il existe |
| `Kit.packed`, `slots` | `materiel_kit_items.zone`, `slot`, `load_order` | |
| `Kit.lineage` | `forked_from`, `generation`, `field_proven_count` | vocabulaire « lignée », jamais génétique |
| `Kit.bag`, `cfg` | `one_bag_configs.corps_id`, `modules`, `colors` | absent : préréglage Forêt avec couvercle, poche avant, poches latérales |
| `one`, `colorways` | `one_pieces`, `one_colorways` | prix en centimes ÷ 100 |
| `owned`, `ordered` | `one_owned_pieces.state` | |
| `user.bodyKg` | profil (`user_profiles`) | absent : 72 kg, comme la référence |

## Écritures

| Geste | Action serveur | Table |
| --- | --- | --- |
| Ranger, retirer, échanger un objet | `saveKitItemPlacement` | `materiel_kit_items` |
| Changer de corps, clipser un module, changer un coloris | `saveBagConfig` | `one_bag_configs` |
| Confirmer la précommande | `placePreorder` → RPC `one_place_preorder` | `one_preorders`, `one_owned_pieces` |
| Débrief (sorties +1, allègement) | `saveDebrief` | `materiel_kit_items`, `materiel_kits.field_proven_count` |

Toutes les entrées sont validées par zod. En mode test (`?debug=1`), **aucune** écriture réseau : l'état reste local, comme dans la référence.
