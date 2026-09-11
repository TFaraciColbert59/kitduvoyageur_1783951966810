/**
 * A8 — Contrats B2B futurs (types et catalogue uniquement).
 *
 * Aucune implémentation, aucun endpoint, aucun accès base : seuls les
 * contrats d'interface et leurs descripteurs sont exposés pour préparer
 * l'ouverture API. **Aucune monétisation de données de santé** : les
 * contrats ne comportent aucun champ médical, physiologique ou identifiant.
 * Toute implémentation future passera par une couche serveur dédiée.
 */
import type { Confidence } from './confidence';

export const B2B_CONTRACT_VERSION = 'v1' as const;
export type B2bContractVersion = typeof B2B_CONTRACT_VERSION;

export const B2B_CONTRACT_NAMES = ['difficulty', 'eta', 'conditions'] as const;
export type B2bContractName = (typeof B2B_CONTRACT_NAMES)[number];

export interface DifficultyApiContract {
  version: 'v1';
  getSegmentDifficulty(
    segmentId: number,
    direction: 'forward' | 'reverse'
  ): Promise<{ difficulty: number; confidence: Confidence } | null>;
}

export interface EtaApiContract {
  version: 'v1';
  predictRoute(input: {
    segmentIds: number[];
    profileRef?: string;
  }): Promise<{ etaP50: string; etaP90: string; confidence: Confidence } | null>;
}

export interface ConditionsApiContract {
  version: 'v1';
  getConditions(bbox: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  }): Promise<{ activeEvents: number; confidence: Confidence } | null>;
}

export interface B2bContractMap {
  difficulty: DifficultyApiContract;
  eta: EtaApiContract;
  conditions: ConditionsApiContract;
}

export interface B2bContractField {
  name: string;
  type: string;
}

export interface B2bContractDescriptor {
  name: B2bContractName;
  version: B2bContractVersion;
  methods: string[];
  inputFields: B2bContractField[];
  outputFields: B2bContractField[];
}

export interface B2bVersionCatalog {
  version: B2bContractVersion;
  contracts: B2bContractDescriptor[];
}

/**
 * Catalogue des versions de contrats disponibles. Fabrique pure et statique :
 * elle ne contacte aucun service et ne persiste rien.
 */
export function b2bContractCatalog(): B2bVersionCatalog[] {
  return [
    {
      version: B2B_CONTRACT_VERSION,
      contracts: [
        {
          name: 'difficulty',
          version: B2B_CONTRACT_VERSION,
          methods: ['getSegmentDifficulty'],
          inputFields: [
            { name: 'segmentId', type: 'number' },
            { name: 'direction', type: "'forward' | 'reverse'" },
          ],
          outputFields: [
            { name: 'difficulty', type: 'number' },
            { name: 'confidence', type: 'Confidence' },
          ],
        },
        {
          name: 'eta',
          version: B2B_CONTRACT_VERSION,
          methods: ['predictRoute'],
          inputFields: [
            { name: 'segmentIds', type: 'number[]' },
            { name: 'profileRef', type: 'string?' },
          ],
          outputFields: [
            { name: 'etaP50', type: 'string' },
            { name: 'etaP90', type: 'string' },
            { name: 'confidence', type: 'Confidence' },
          ],
        },
        {
          name: 'conditions',
          version: B2B_CONTRACT_VERSION,
          methods: ['getConditions'],
          inputFields: [
            { name: 'bbox', type: '{ minLat, minLng, maxLat, maxLng }' },
          ],
          outputFields: [
            { name: 'activeEvents', type: 'number' },
            { name: 'confidence', type: 'Confidence' },
          ],
        },
      ],
    },
  ];
}
