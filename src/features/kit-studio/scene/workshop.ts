// Décor matériel uniquement : aucun réglage de caméra ou de matière du sac.
import {
  BoxGeometry, CanvasTexture, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, Scene, SRGBColorSpace,
} from 'three';
import { RAW_MATERIALS } from '../domain/palette';
import { INK, LIGHT_RIM, LIGHT_SUN, WOOD_TINT, inkA, rgb } from '../domain/palette.scene';
import type { Vector3 } from 'three';
import type { BagModelRuntimeInfo } from './bag/modelLayer';
import { LKDV_ONE_BAG_BBOXES } from '../domain/bagAnchorsTable';
import { makeColor } from './color';
import { GROUND_Y, TABLE } from './layout';
import type { ResourceTracker } from './resources';
import type { TextureBank } from './textures';

export function createWorkshop(scene: Scene, tr: ResourceTracker, tex: TextureBank, shadows: boolean, environment: boolean) {
  scene.add(new HemisphereLight(makeColor(WOOD_TINT), makeColor(rgb(INK)), 0.28 * Math.PI));
  // Clé à 30° au-dessus du plan, latérale ; pointée vers le centre matériel du sac.
  const sun = new DirectionalLight(makeColor(LIGHT_SUN), (environment ? 0.8 : 1.65) * Math.PI);
  sun.target.position.set(0, GROUND_Y + 0.33, 0);
  sun.position.set(4.26434, GROUND_Y + 0.33 + 2.5, 0.75192);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 0.5, far: 16 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.003;
  scene.add(sun, sun.target);
  const fill = new DirectionalLight(makeColor(LIGHT_RIM), 0.22 * Math.PI);
  fill.position.set(-3.5, 1.1, 2);
  scene.add(fill);

  const wood = tr.material(new MeshStandardMaterial({ map: tex.wood(), color: makeColor(WOOD_TINT), roughness: 0.94, metalness: 0 }));
  const top = new Mesh(tr.geometry(new BoxGeometry(TABLE.w, 0.12, TABLE.d)), wood);
  top.name = 'atelier-plateau';
  top.position.set(TABLE.x, GROUND_Y - 0.06, 0);
  top.receiveShadow = top.castShadow = true;
  scene.add(top);
  // Caisson jusqu'au sol : le chant du plateau reste net, aucune face inférieure suspendue.
  const base = new Mesh(tr.geometry(new BoxGeometry(TABLE.w - 0.12, 1.5, TABLE.d - 0.12)),
    tr.material(new MeshStandardMaterial({ color: makeColor(RAW_MATERIALS['m-7a7365']), roughness: 1 })));
  base.name = 'atelier-caisson';
  base.position.set(TABLE.x, GROUND_Y - 0.12 - 0.75, 0);
  base.receiveShadow = base.castShadow = true;
  scene.add(base);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [at, alpha] of [[0, 0.78], [0.32, 0.68], [0.52, 0.32], [0.75, 0.09], [1, 0]] as const) g.addColorStop(at, inkA(alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const map = tr.texture(new CanvasTexture(canvas));
  map.colorSpace = SRGBColorSpace;
  const contact = new Mesh(tr.geometry(new PlaneGeometry(1, 1)), tr.material(new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false })));
  contact.name = 'atelier-contact';
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, GROUND_Y + 0.001, 0);
  scene.add(contact);
  return { sun, syncContact(scale: Vector3, model: BagModelRuntimeInfo) {
    const bbox = model.status === 'glb' && model.modelId ? LKDV_ONE_BAG_BBOXES[model.modelId] : null;
    contact.scale.set(bbox ? bbox.w * 1.35 : 0.95 * scale.x, bbox ? bbox.d * 1.6 : 0.8 * scale.z, 1);
  } };
}
