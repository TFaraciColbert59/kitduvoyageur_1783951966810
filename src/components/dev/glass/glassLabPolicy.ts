export type GlassEngine = 'standard' | 'rdev' | 'samasante';

export interface GlassCapabilities {
  ready: boolean;
  backdropFilter: boolean;
  reducedMotion?: boolean;
  reducedTransparency?: boolean;
  increasedContrast?: boolean;
  forcedColors?: boolean;
  saveData?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  forceStandard?: boolean;
}

export function canOpenGlassLab(environment: string | undefined, flag: string | undefined) {
  return environment !== 'production' || flag === '1';
}

export function resolveGlassEngine(requested: GlassEngine, capabilities: GlassCapabilities): { engine: GlassEngine; reason: string | null } {
  const weak = (capabilities.hardwareConcurrency !== undefined && capabilities.hardwareConcurrency > 0 && capabilities.hardwareConcurrency <= 4)
    || (capabilities.deviceMemory !== undefined && capabilities.deviceMemory > 0 && capabilities.deviceMemory <= 4);
  const reason = !capabilities.ready ? 'Détection des capacités en cours.'
    : capabilities.forceStandard ? 'Mode sobre activé.'
    : capabilities.reducedMotion || capabilities.reducedTransparency || capabilities.increasedContrast || capabilities.forcedColors
      ? 'Préférences d’accessibilité : rendu standard.'
      : capabilities.saveData ? 'Économie de données : rendu standard.'
        : weak ? 'Capacités matérielles limitées : rendu standard.'
          : !capabilities.backdropFilter ? 'Filtre d’arrière-plan indisponible.' : null;
  return { engine: reason ? 'standard' : requested, reason };
}
