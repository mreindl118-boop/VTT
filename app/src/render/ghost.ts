// Ghosts: a map that is drawn in the valley but is not the active one (render/streamer.ts streams it in, or the camera
// moved on to another place). It looks as it would if it were active, from where the DM looks at it: the same level
// (its ground) and the floors standing on it, the same cutaway, roofs as the active map would show them. What makes
// a map active is not drawn on a ghost: the grid, markers, light rings, labels, tokens, the players' fog of war and
// its lamps (point lights would change the light count and recompile every material).
//
// Each mesh's material is swapped for a ghost material: a plain copy (same colour, surface, shading) that ignores the
// active map's coverage fog, clips at the ghost's own cut, and can fade (the stream-in crossfade over its proxy) and
// take a faint tint of the mist (an inactive map reads as such; the tint glides off before it becomes active). The
// originals stay on `mesh.userData.liveMat` and come back on activation.
import * as THREE from 'three';
import type { BuiltLevel } from './build';
import { classOpacity } from '../core/slider';
import type { SceneFile, Level } from '../core/schema';
import { patchFog, SHELL_ROLES } from './materials';

/** How far a ghost's colours lean toward the mist (0..1). */
export const GHOST_TINT = 0.12;

export interface Ghostable {
  scene: SceneFile;
  root: THREE.Group;
  levels: Map<string, BuiltLevel>;
  labels: { obj: THREE.Object3D }[];
  tokens: Map<string, THREE.Group>;
}

/** What a ghost shows: a level and the floors on it, cut at a height (scene feet) or not at all. */
export interface GhostLook {
  level: string;
  shown: Set<string>;
  cutFt: number | null;
  /** Roof caps over authored walls show with full walls only (as applySlider does). */
  lowWalls: boolean;
  /** Hidden things the players have been shown (object ids). */
  revealed: Set<string>;
  /** Players' side: objects only the DM may see stay hidden (they do anyway on a ghost) */
  restricted: boolean;
}

export class Ghost {
  /** Source material → its ghost. */
  private mats = new Map<THREE.Material, THREE.MeshLambertMaterial | THREE.MeshBasicMaterial>();
  /** The ghost's own cut, in drawn space (WALL_CLIP is the active map's). */
  readonly plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  private cutFt: number | null = null;
  /** What this ghost hid, to show again on restore. */
  private hidden: THREE.Object3D[] = [];
  opacity = 1;
  tint = GHOST_TINT;
  on = false;

  constructor(private mist: THREE.Color) {}

  private ghostOf(src: THREE.Material, clip: boolean): THREE.Material | null {
    if ((src as THREE.ShaderMaterial).isShaderMaterial || (src as THREE.LineBasicMaterial).isLineBasicMaterial) return null;
    let g = this.mats.get(src);
    if (!g) {
      const s = src as THREE.MeshLambertMaterial;
      const p = { color: s.color ?? new THREE.Color('#ffffff'), vertexColors: s.vertexColors, map: s.map ?? null, side: s.side, fog: s.fog, depthWrite: s.depthWrite };
      g = (src as THREE.MeshBasicMaterial).isMeshBasicMaterial ? new THREE.MeshBasicMaterial(p) : new THREE.MeshLambertMaterial({ ...p, emissive: s.emissive ?? new THREE.Color(0), flatShading: s.flatShading });
      g.userData.base = g.color.clone();
      g.userData.srcOpacity = s.transparent ? s.opacity : 1;
      g.userData.srcTransparent = s.transparent;
      g.userData.ghost = true;
      // the same surface (stone, plank, cobble) and the same mist, but never the active map's coverage fog
      if (src.userData.mist) { g.userData.surf = { value: (src.userData.surf as { value: number } | undefined)?.value ?? 0 }; patchFog(g, true); }
      this.mats.set(src, g);
      this.style(g);
    }
    g.clippingPlanes = clip ? [this.plane] : null;
    return g;
  }
  private style(g: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial): void {
    g.color.copy(g.userData.base as THREE.Color).lerp(this.mist, this.tint);
    const o = (g.userData.srcOpacity as number) * this.opacity, transparent = this.opacity < 0.999 || !!g.userData.srcTransparent;
    if (g.transparent !== transparent) { g.transparent = transparent; g.needsUpdate = true; }
    g.opacity = o;
  }
  /** Fade (0 = gone, 1 = drawn) and tint (0 = as active, GHOST_TINT = inactive). */
  set(opacity: number, tint = this.tint): void { this.opacity = opacity; this.tint = tint; for (const g of this.mats.values()) this.style(g); }

  /** Swap a map's materials for ghosts and hide what only an active map shows. */
  apply(l: Ghostable, look: GhostLook): void {
    if (this.on) this.restore(l);
    this.on = true;
    this.cutFt = look.cutFt;
    const hide = (o: THREE.Object3D) => { if (o.visible) { o.visible = false; this.hidden.push(o); } };
    for (const [lid, b] of l.levels) {
      const shown = look.shown.has(lid);
      b.root.visible = shown;
      if (!shown) continue;
      const lv = l.scene.levels.find((x) => x.id === lid) as Level;
      // a floor standing above the cut goes, as a stacked site's section shows it
      const above = look.cutFt !== null && look.cutFt < lv.elevationFt + 1;
      hide(b.grid);
      for (const p of b.lights) hide(p);
      for (const r of b.lightRings) hide(r);
      for (const sd of b.secretDoors) { hide(sd.marker); hide(sd.door); sd.panel.visible = true; }
      for (const w of b.secretAsWall) hide(w);
      for (const tg of b.targets) if (classOpacity(tg.vis, 0, look.revealed.has(tg.id)) < 0.999) hide(tg.root);
      b.root.traverse((o) => {
        if (o.userData.role === 'marker' || o.userData.role === 'token' || o.userData.role === 'grid') { hide(o); return; }
        if (o.userData.cap && look.lowWalls && !l.scene.stacked) { hide(o); return; }
        const m = o as THREE.Mesh; if (!m.isMesh || m.userData.liveMat) return;
        if (above && !SHELL_ROLES.has(o.userData.role)) { hide(o); return; }
        const role = o.userData.role as string | undefined;
        const clip = look.cutFt !== null && (role === 'wall' || role === 'door' || (!!l.scene.stacked && SHELL_ROLES.has(role ?? '')));
        const src = m.material, list = Array.isArray(src) ? src : [src];
        const gs = list.map((x) => this.ghostOf(x, clip));
        if (gs.some((x) => !x)) { hide(o); return; }
        m.userData.liveMat = src;
        m.material = Array.isArray(src) ? (gs as THREE.Material[]) : gs[0]!;
      });
    }
    for (const lb of l.labels) hide(lb.obj);
    for (const g of l.tokens.values()) hide(g);
  }
  /** The live materials and everything hidden come back (the app's applySlider then styles the active map). */
  restore(l: Ghostable): void {
    if (!this.on) return;
    this.on = false;
    l.root.traverse((o) => { const m = o as THREE.Mesh; if (m.userData.liveMat) { m.material = m.userData.liveMat as THREE.Material; delete m.userData.liveMat; } });
    for (const o of this.hidden) o.visible = true;
    this.hidden = [];
  }
  /** Re-read where the ghost's cut stands in drawn space (its root moved: a reanchor). */
  place(root: THREE.Object3D): void {
    root.updateWorldMatrix(true, false);
    this.plane.constant = this.cutFt === null ? 1e6 : this.cutFt + root.matrixWorld.elements[13];
  }
  /** Free the ghost materials (the live ones, and any texture they share with them, belong to the map). */
  dispose(): void { for (const g of this.mats.values()) g.dispose(); this.mats.clear(); }
  get materials(): number { return this.mats.size; }
}
