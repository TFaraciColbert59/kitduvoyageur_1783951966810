// Inventaire des ressources GPU de la scène : tout Geometry, Material, Texture et RenderTarget créé passe ici,
// et le décompte repose sur l'événement « dispose » émis par three lui-même (aucune comptabilité parallèle).
import type { BufferGeometry, Material, Texture, WebGLRenderTarget } from 'three';

export interface ResourceCounts {
  readonly geometries: number;
  readonly materials: number;
  readonly textures: number;
  readonly renderTargets: number;
}

interface SharedEntry { readonly geometry: BufferGeometry; refs: number }

export class ResourceTracker {
  private readonly geos = new Set<BufferGeometry>();
  private readonly mats = new Set<Material>();
  private readonly texs = new Set<Texture>();
  private readonly targets = new Set<WebGLRenderTarget>();
  private readonly shared = new Map<string, SharedEntry>();
  private readonly sharedKeyOf = new Map<BufferGeometry, string>();

  geometry<T extends BufferGeometry>(g: T): T {
    this.geos.add(g);
    g.addEventListener('dispose', () => { this.geos.delete(g); });
    return g;
  }

  material<T extends Material>(m: T): T {
    this.mats.add(m);
    m.addEventListener('dispose', () => { this.mats.delete(m); });
    return m;
  }

  texture<T extends Texture>(t: T): T {
    this.texs.add(t);
    t.addEventListener('dispose', () => { this.texs.delete(t); });
    return t;
  }

  renderTarget<T extends WebGLRenderTarget>(r: T): T {
    this.targets.add(r);
    r.addEventListener('dispose', () => { this.targets.delete(r); });
    return r;
  }

  /** Géométrie partagée par clé, comptée par référence : libérée quand la dernière pièce la rend. */
  acquire(key: string, factory: () => BufferGeometry): BufferGeometry {
    const hit = this.shared.get(key);
    if (hit) { hit.refs += 1; return hit.geometry; }
    const geometry = this.geometry(factory());
    this.shared.set(key, { geometry, refs: 1 });
    this.sharedKeyOf.set(geometry, key);
    return geometry;
  }

  /** Rend une géométrie : libère tout de suite si elle est privée, à la dernière référence si elle est partagée. */
  release(g: BufferGeometry): void {
    const key = this.sharedKeyOf.get(g);
    if (key === undefined) { g.dispose(); return; }
    const entry = this.shared.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      this.shared.delete(key);
      this.sharedKeyOf.delete(g);
      g.dispose();
    }
  }

  /** Force la recompilation des matériaux (ex. ombres coupées). */
  markMaterialsDirty(): void {
    for (const m of this.mats) m.needsUpdate = true;
  }

  counts(): ResourceCounts {
    return { geometries: this.geos.size, materials: this.mats.size, textures: this.texs.size, renderTargets: this.targets.size };
  }

  /** Libère tout ce qui est encore vivant. */
  disposeAll(): void {
    for (const g of [...this.geos]) g.dispose();
    for (const m of [...this.mats]) m.dispose();
    for (const t of [...this.texs]) t.dispose();
    for (const r of [...this.targets]) r.dispose();
    this.shared.clear();
    this.sharedKeyOf.clear();
  }
}
