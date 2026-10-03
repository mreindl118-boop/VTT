// scene.json level -> three.js graph, with handles the slider and reveal tools drive.
import * as THREE from 'three';
import { OPENABLE_KINDS, type GridLevel, type Level, type SceneObject, type VisClass, type Wall } from '../core/schema';
import { makeOpenable, type OpenHandle } from './openable';
import type { Polygon } from '../core/geometry';
import { baseRingFt, DEFAULT_CEILING_FT } from '../core/units';
import { FLOOR_COLOR, PALETTE, WALL_COLOR } from '../kit/palette';
import { baseRing, merge, pawn, PROP_BUILDERS, segmentBox, slabGeometry, stairsStraight, WALL_T } from '../kit/pieces';
import { mat, matClone, patchFog, wallMat } from './materials';
import { PROPS_V1 } from '../kit/props';
import { CREATURES } from '../kit/creatures';
import '../kit/sites';
import { buildGridOverlay } from './gridOverlay';

/** Kinds whose meshes carry a role of their own (stairs, raised ground, plates): built and placed one by one. */
const UNMERGED = new Set(['stairs-straight', 'prism', 'pressure-plate']);
/** Building shells: their roof, walls and chimney are cut by the section plane like a wall. */
const ROOF_KINDS = new Set(['roof-gable', 'roof-cone', 'onion-dome', 'mill-sails', 'chimney', 'house', 'church-building', 'temple', 'big-tent']);

/** A face range of a merged mesh that belongs to one scene object (so a tap on a merged house still names it). */
export interface MergedRange { start: number; end: number; id: string }
/** The scene object a raycast hit belongs to: merged static props map the face back, anything else walks up the graph. */
export function hitObjectId(h: THREE.Intersection | undefined): string | undefined {
  if (!h) return undefined;
  const ranges = h.object.userData.ranges as MergedRange[] | undefined;
  if (ranges && h.faceIndex != null) {
    const f = h.faceIndex;
    let lo = 0, hi = ranges.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, r = ranges[mid]; if (f < r.start) hi = mid - 1; else if (f >= r.end) lo = mid + 1; else return r.id; }
    return undefined;
  }
  let o: THREE.Object3D | null = h.object;
  while (o) { if (o.userData.objectId) return o.userData.objectId as string; o = o.parent; }
  return undefined;
}

/** Static things a player can always see and never operate (houses, trees, fences, furniture that does not open):
 *  one mesh per material per level instead of thousands of small ones. Anything interactive stays its own object. */
function isStatic(o: SceneObject): boolean {
  if (o.vis !== 'player' || o.size || UNMERGED.has(o.kind) || OPENABLE_KINDS[o.kind] || CREATURES[o.kind]) return false;
  return !!(PROP_BUILDERS[o.kind] || PROPS_V1[o.kind]);
}

export interface LabelSpec { id: string; text: string; sub?: string; page?: number; pos: THREE.Vector3; vis: VisClass; kind: 'key' | 'object' | 'tread' | 'note' | 'door' | 'link'; objectId?: string; wallId?: string; linkId?: string }

export interface SliderTarget {
  id: string;
  vis: VisClass;
  /** Meshes whose private materials take the class opacity. */
  materials: THREE.Material[];
  root: THREE.Object3D;
}

export interface SecretDoorHandle {
  objectId: string;
  wallId: string;
  /** Wall-looking panel; pixel-identical to a normal wall at t = 0. */
  panel: THREE.Mesh;
  /** Door revealed as t rises / when the DM reveals it. */
  door: THREE.Object3D;
  doorMaterials: THREE.Material[];
  marker: THREE.Mesh;
}

export interface BuiltLevel {
  level: Level;
  root: THREE.Group;
  grid: THREE.Mesh;
  floors: THREE.Mesh[];
  targets: SliderTarget[];
  secretDoors: SecretDoorHandle[];
  labels: LabelSpec[];
  lights: THREE.PointLight[];
  lightRings: THREE.LineLoop[];
  /** Normal-wall debug stand-in for each secret door (test hook). */
  secretAsWall: THREE.Mesh[];
  wallsGroup: THREE.Group;
  doors: Map<string, THREE.Object3D>;
  /** Containers that open (chests, wardrobes, coffins, drawers), by object id. */
  openables: Map<string, OpenHandle>;
}

function centroid(p: Polygon): [number, number] {
  let x = 0, z = 0;
  for (const [a, b] of p) { x += a; z += b; }
  return [x / p.length, z / p.length];
}

/** Replace every mesh material under `o` with a private copy (so opacity can change per object). */
function privatize(o: THREE.Object3D, tint?: THREE.Color): THREE.Material[] {
  const out: THREE.Material[] = [];
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshLambertMaterial;
    const nm = matClone('#' + src.color.getHexString());
    if (tint) nm.color.lerp(tint, 0.25);
    m.material = nm;
    out.push(nm);
  });
  return out;
}

export function buildLevel(level: Level, grid: GridLevel): BuiltLevel {
  const root = new THREE.Group();
  root.name = `level:${level.id}`;
  const y0 = level.elevationFt;
  // Walls stop a hair under the ceiling so their tops sit inside the slab of the floor above on a stacked site.
  const ceiling = (level.ceilingFt ?? DEFAULT_CEILING_FT) - 0.1;
  const labels: LabelSpec[] = [];
  const targets: SliderTarget[] = [];
  const secretDoors: SecretDoorHandle[] = [];
  const secretAsWall: THREE.Mesh[] = [];
  const doors = new Map<string, THREE.Object3D>();
  const openables = new Map<string, OpenHandle>();
  const scatter: { obj: THREE.Object3D; o: SceneObject; p: THREE.Vector3 }[] = [];

  // Floors: one merged mesh per floor material.
  const floors: THREE.Mesh[] = [];
  const byFloor = new Map<string, THREE.BufferGeometry[]>();
  for (const r of level.rooms) {
    const arr = byFloor.get(r.floor) ?? [];
    arr.push(slabGeometry(r.polygon, y0, 1));
    byFloor.set(r.floor, arr);
    const [cx, cz] = centroid(r.polygon);
    labels.push({ id: `key:${r.key}`, text: r.key, sub: r.name, page: r.page, pos: new THREE.Vector3(cx, y0 + 0.5, cz), vis: 'dm-note', kind: 'key' });
  }
  for (const t of level.terrain ?? []) {
    const arr = byFloor.get(t.floor) ?? [];
    // paths and cobbles ride a hair above the grass they cross, so they win the depth test on a big map
    arr.push(slabGeometry(t.polygon, y0 - 0.05 + (t.floor === 'grass' || t.floor === 'snow' || t.floor === 'marsh' ? 0 : 0.12), 1));
    byFloor.set(t.floor, arr);
  }
  for (const [f, gs] of byFloor) {
    const m = new THREE.Mesh(merge(gs), mat(FLOOR_COLOR[f as keyof typeof FLOOR_COLOR]));
    m.userData.role = 'floor';
    m.name = `floor:${f}`;
    floors.push(m);
    root.add(m);
  }

  // Walls: merged per material; doors, windows and secret doors are their own pieces.
  const wallsGroup = new THREE.Group();
  wallsGroup.name = 'walls';
  const byWallMat = new Map<string, THREE.BufferGeometry[]>();
  const panes: THREE.BufferGeometry[] = [];
  const pushWall = (color: string, g: THREE.BufferGeometry) => { const a = byWallMat.get(color) ?? []; a.push(g); byWallMat.set(color, a); };
  const wallColor = (w: Wall) => WALL_COLOR[w.material ?? 'ashlar'];
  const doorTop = Math.min(7, ceiling);
  const FRAME = '#3a2c22';
  const COPING: Record<string, string> = { ashlar: PALETTE.stoneDeep, rubble: PALETTE.stoneDeep, brick: PALETTE.stoneDeep, plaster: '#5d5852', 'half-timber': FRAME, earth: '#4d5a3f' };

  for (const w of level.walls) {
    const f = new Set(w.flags);
    const h = w.heightFt ?? ceiling;
    const color = wallColor(w);
    if (f.has('secret-door')) continue; // handled below with its object
    if (f.has('window')) {
      pushWall(color, segmentBox(w.a, w.b, y0, y0 + 3));
      pushWall(color, segmentBox(w.a, w.b, y0 + 7, y0 + h));
      panes.push(segmentBox(w.a, w.b, y0 + 3, y0 + 7, 0.2, false));   // the glass: one mesh for every window of the level
      // the window's frame: a sill proud of the wall, a head, and leaded mullions across the glass
      pushWall(FRAME, segmentBox(w.a, w.b, y0 + 2.7, y0 + 3.05, WALL_T + 0.5, false));
      pushWall(FRAME, segmentBox(w.a, w.b, y0 + 6.95, y0 + 7.25, WALL_T + 0.3, false));
      pushWall(FRAME, segmentBox(w.a, w.b, y0 + 4.9, y0 + 5.1, 0.32, false));
      { const mx = (w.a[0] + w.b[0]) / 2, mz = (w.a[1] + w.b[1]) / 2, L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L * 0.12, uz = (w.b[1] - w.a[1]) / L * 0.12;
        pushWall(FRAME, segmentBox([mx - ux, mz - uz], [mx + ux, mz + uz], y0 + 3, y0 + 7, 0.32, false)); }
      continue;
    }
    if (f.has('door')) {
      pushWall(color, segmentBox(w.a, w.b, y0 + doorTop, y0 + h));
      const slab = new THREE.Mesh(segmentBox(w.a, w.b, y0, y0 + doorTop, 0.5, false), wallMat(f.has('locked') ? PALETTE.iron : '#9a6a3a'));
      if (f.has('locked')) { const band = new THREE.Mesh(segmentBox(w.a, w.b, y0 + 3, y0 + 3.6, 0.6, false), wallMat(PALETTE.wine)); band.userData.role = 'door'; band.userData.wallId = w.id; wallsGroup.add(band); }
      // the door's frame (jambs and lintel) stays with the wall; iron straps and a ring ride on the leaf
      { const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uz = (w.b[1] - w.a[1]) / L;
        if (L > 1.5) for (const [p, q] of [[w.a, [w.a[0] + ux * 0.45, w.a[1] + uz * 0.45]], [[w.b[0] - ux * 0.45, w.b[1] - uz * 0.45], w.b]] as const) pushWall(FRAME, segmentBox(p as [number, number], q as [number, number], y0, y0 + doorTop, WALL_T + 0.35, false));
        pushWall(FRAME, segmentBox(w.a, w.b, y0 + doorTop - 0.05, y0 + doorTop + 0.55, WALL_T + 0.35, false));
        if (!f.has('locked')) { const strap = new THREE.Mesh(merge([1.4, doorTop - 1.4].map((y) => segmentBox(w.a, w.b, y0 + y, y0 + y + 0.3, 0.62, false))), wallMat(PALETTE.iron)); strap.userData.role = 'door'; slab.add(strap); } }
      slab.userData.role = 'door';
      slab.userData.wallId = w.id;
      slab.visible = !w.open;
      doors.set(w.id, slab);
      wallsGroup.add(slab);
      labels.push({ id: `door:${w.id}`, text: f.has('locked') ? 'locked' : 'door', pos: new THREE.Vector3((w.a[0] + w.b[0]) / 2, y0 + doorTop + 0.5, (w.a[1] + w.b[1]) / 2), vis: 'player', kind: 'door', wallId: w.id });
      continue;
    }
    if (f.has('invisible') || f.has('ethereal')) continue;
    pushWall(color, segmentBox(w.a, w.b, y0, y0 + h));
    // a free-standing wall (garden, yard, parapet) is capped with a coping a little proud of its faces
    if (h < ceiling - 1 && h <= 12 && (w.material ?? 'ashlar') !== 'log') pushWall(COPING[w.material ?? 'ashlar'] ?? color, segmentBox(w.a, w.b, y0 + h, y0 + h + 0.35, WALL_T + 0.35));
  }
  if (panes.length) {
    const pane = new THREE.Mesh(merge(panes), wallMat(PALETTE.stone, { emissive: '#1b2530' }));
    pane.userData.role = 'wall'; pane.userData.window = true;
    wallsGroup.add(pane);
  }
  for (const [color, gs] of byWallMat) {
    const m = new THREE.Mesh(merge(gs), wallMat(color));
    m.userData.role = 'wall';
    wallsGroup.add(m);
  }
  root.add(wallsGroup);

  // Objects.
  const wallById = new Map(level.walls.map((w) => [w.id, w]));
  for (const o of level.objects) {
    const p = new THREE.Vector3(o.pos[0], y0 + o.pos[1], o.pos[2]);
    if (o.vis === 'secret-door') {
      const w = wallById.get(o.wall!)!;
      const h = w.heightFt ?? ceiling;
      const color = wallColor(w);
      const geo = segmentBox(w.a, w.b, y0, y0 + h);
      const panel = new THREE.Mesh(geo, wallMat(color));
      panel.userData.role = 'wall';
      panel.userData.secretDoor = o.id;
      wallsGroup.add(panel);
      const asWall = new THREE.Mesh(geo, wallMat(color));
      asWall.userData.role = 'wall';
      asWall.visible = false;
      wallsGroup.add(asWall);
      secretAsWall.push(asWall);
      const door = new THREE.Mesh(segmentBox(w.a, w.b, y0, y0 + doorTop, WALL_T + 0.3, false), wallMat(PALETTE.wood));
      door.userData.role = 'door';
      wallsGroup.add(door);
      const marker = new THREE.Mesh(segmentBox(w.a, w.b, y0 + h, y0 + h + 0.3, WALL_T + 0.6, false), new THREE.MeshBasicMaterial({ color: PALETTE.violet, transparent: true, opacity: 0 }));
      marker.userData.role = 'marker';
      wallsGroup.add(marker);
      secretDoors.push({ objectId: o.id, wallId: w.id, panel, door, doorMaterials: [door.material as THREE.Material], marker });
      labels.push({ id: `obj:${o.id}`, text: o.label ?? 'Secret door', pos: new THREE.Vector3(p.x, y0 + h + 1.5, p.z), vis: 'dm-note', kind: 'object', objectId: o.id });
      continue;
    }
    if (o.kind === 'note' || o.kind === 'spawn') {
      labels.push({ id: `note:${o.id}`, text: o.label ?? (o.kind === 'spawn' ? 'Spawn' : ''), pos: p, vis: 'dm-note', kind: 'note' });
      continue;
    }
    const obj = buildObject(o, y0, labels);
    const ROOF = ROOF_KINDS.has(o.kind);
    // A roof piece raised on top of authored walls (a cap): it goes when the walls are cut down, or it floats.
    const CAP = (o.kind === 'roof-gable' || o.kind === 'roof-cone' || o.kind === 'onion-dome' || o.kind === 'mill-sails' || o.kind === 'chimney') && (o.dims?.y ?? 10) >= 6;
    if (ROOF) obj.traverse((c) => { c.userData.role = 'roof'; if (CAP) c.userData.cap = true; });
    const openMode = OPENABLE_KINDS[o.kind];
    if (openMode && o.kind !== 'claw-chest-skeleton') openables.set(o.id, makeOpenable(obj, openMode, !!o.container?.open));
    if (isStatic(o)) { scatter.push({ obj, o, p }); continue; }
    obj.position.copy(p);
    if (o.kind === 'stairs-straight' || (o.kind === 'prism' && o.polygon)) obj.position.set(0, y0, 0);
    obj.rotation.y = ((o.rotY ?? 0) * Math.PI) / 180;
    obj.userData.objectId = o.id;
    obj.traverse((c) => { if (!c.userData.role) c.userData.role = o.size ? 'token' : 'prop'; });
    root.add(obj);
    if (o.vis !== 'player' && o.vis !== 'explored' && o.vis !== 'unexplored') {
      const tint = o.vis === 'dm-note' ? undefined : new THREE.Color(PALETTE.violet);
      targets.push({ id: o.id, vis: o.vis, materials: privatize(obj, tint), root: obj });
      if (o.label) labels.push({ id: `obj:${o.id}`, text: o.label, pos: p.clone().setY(p.y + 7), vis: 'dm-note', kind: 'object', objectId: o.id });
    }
  }

  // Static props (houses, trees, fences, furniture that never opens) merge into one mesh per material and role:
  // a town of a thousand houses draws in a dozen calls. Each mesh keeps face ranges back to its objects for picking.
  // Roofs (building shells) keep their role so the section plane slices them like walls; the rest stays a prop.
  if (scatter.length) {
    type Bucket = { gs: THREE.BufferGeometry[]; ranges: MergedRange[]; faces: number };
    const byMat = new Map<string, { material: THREE.Material; role: string; cap: boolean; b: Bucket }>();
    for (const { obj, o, p } of scatter) {
      obj.position.copy(p);
      obj.rotation.y = ((o.rotY ?? 0) * Math.PI) / 180;
      obj.updateMatrixWorld(true);
      obj.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const role = c.userData.role === 'roof' ? 'roof' : 'prop', cap = !!c.userData.cap;
        const material = m.material as THREE.Material;
        const key = `${role}:${cap}:${material.uuid}`;
        let e = byMat.get(key);
        if (!e) { e = { material, role, cap, b: { gs: [], ranges: [], faces: 0 } }; byMat.set(key, e); }
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
        const last = e.b.ranges[e.b.ranges.length - 1];
        if (last && last.id === o.id && last.end === e.b.faces) last.end += n; else e.b.ranges.push({ start: e.b.faces, end: e.b.faces + n, id: o.id });
        e.b.faces += n;
        e.b.gs.push(g);
      });
    }
    for (const { material, role, cap, b } of byMat.values()) {
      const m = new THREE.Mesh(merge(b.gs), material);
      m.userData.role = role; if (cap) m.userData.cap = true;
      m.userData.ranges = b.ranges;
      m.name = role === 'roof' ? 'merged-roofs' : 'scatter';
      root.add(m);
    }
  }

  // Lights: warm point lights; radii rings are dm-notes.
  const lights: THREE.PointLight[] = [];
  const lightRings: THREE.LineLoop[] = [];
  for (const l of level.lights) {
    const pl = new THREE.PointLight(PALETTE.amber, Math.max(40, l.bright * l.bright * 0.9), l.dim * 1.1, 1.6);
    pl.position.set(l.pos[0], y0 + l.pos[1], l.pos[2]);
    root.add(pl);
    lights.push(pl);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), patchFog(new THREE.MeshBasicMaterial({ color: PALETTE.amber })));
    flame.position.copy(pl.position);
    flame.userData.role = 'prop';
    root.add(flame);
    for (const [r, op] of [[l.bright, 0.9], [l.dim, 0.5]] as const) {
      const pts = Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2) * r, 0, Math.sin((i / 64) * Math.PI * 2) * r));
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0, depthWrite: false }));
      ring.position.set(l.pos[0], y0 + 0.1, l.pos[2]);
      ring.userData.baseOpacity = op;
      ring.userData.role = 'marker';
      root.add(ring);
      lightRings.push(ring);
    }
  }

  const gridMesh = buildGridOverlay(grid, y0, !!level.terrain?.length || level.elevationFt <= 0);
  root.add(gridMesh);

  return { level, root, grid: gridMesh, floors, targets, secretDoors, labels, lights, lightRings, secretAsWall, wallsGroup, doors, openables };
}

function buildObject(o: SceneObject, y0: number, labels: LabelSpec[]): THREE.Object3D {
  if (o.kind === 'stairs-straight') {
    const { mesh, treadLabels } = stairsStraight(o.dims ?? {}, [o.pos[0], o.pos[2]]);
    mesh.userData.role = 'stairs';
    treadLabels.forEach((t, i) => labels.push({ id: `tread:${o.id}:${i}`, text: t.text, pos: t.pos.clone().setY(t.pos.y + y0), vis: 'player', kind: 'tread' }));
    return mesh;
  }
  if (o.kind === 'prism' && o.polygon) {
    // A flat-topped block on the floor with the given plan (raised ground, a deck, a road crown).
    const shape = new THREE.Shape(o.polygon.map(([x, z]) => new THREE.Vector2(x, z)));
    const h = o.dims?.h ?? 1, y = o.dims?.y ?? 0;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, y + h, 0);
    const color = o.dims?.color !== undefined ? '#' + o.dims.color.toString(16).padStart(6, '0') : PALETTE.stone;
    const m = new THREE.Mesh(geo, mat(color)); m.userData.role = 'floor';
    const g = new THREE.Group(); g.add(m); return g;
  }
  if (o.kind === 'pressure-plate') {
    const g = new THREE.Group();
    const w = o.dims?.w ?? 5, d = o.dims?.d ?? 5;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.15, d - 0.6), mat(PALETTE.wine));
    plate.position.y = 0.08;
    g.add(plate);
    return g;
  }
  const b = PROP_BUILDERS[o.kind];
  if (b) return b(o.dims ?? {});
  const v1 = PROPS_V1[o.kind];
  if (v1) return v1(o.dims ?? {});
  // Creatures: a kit figure on a base ring sized by creature size; a pawn if no figure exists yet.
  const base = baseRingFt(o.size ?? 'medium');
  const g = new THREE.Group();
  const fig = CREATURES[o.kind];
  // Figures are modelled at real size; the size category only sets the base ring (a horse is Large for the
  // rules but stands 5 ft at the shoulder). Small and tiny creatures are scaled down from the human figure.
  const scale = { tiny: 0.5, small: 0.75, medium: 1, large: 1, huge: 1, gargantuan: 1 }[o.size ?? 'medium'];
  const body = fig ? fig({ ...(o.dims ?? {}), scale: (o.dims?.scale ?? 1) * scale }) : pawn(PALETTE.mist2, base);
  body.position.y = 0.3;
  g.add(baseRing(base, PALETTE.blood), body);
  return mergeByMaterial(g);
}

/** Collapse a figure's many small meshes into one mesh per material: the same figure for a fraction of the draw calls
 *  (a figure is twenty-odd boxes and cylinders, but only five or six colours). Labels and other non-mesh children stay. */
export function mergeByMaterial<T extends THREE.Object3D>(root: T): T {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), local = new THREE.Matrix4();
  const buckets = new Map<string, { material: THREE.Material; gs: THREE.BufferGeometry[] }>();
  const drop: THREE.Object3D[] = [];
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || (m as THREE.InstancedMesh).isInstancedMesh || m.geometry.attributes.color) return;
    const mt = m.material as THREE.MeshLambertMaterial;
    const key = [mt.type, mt.color?.getHexString(), mt.emissive?.getHexString(), mt.transparent, mt.opacity, mt.side, (mt.userData.surf as { value: number } | undefined)?.value].join('|');
    let b = buckets.get(key); if (!b) { b = { material: mt, gs: [] }; buckets.set(key, b); }
    b.gs.push(m.geometry.clone().applyMatrix4(local.multiplyMatrices(inv, m.matrixWorld)));
    drop.push(m);
  });
  if (drop.length < 3) return root;
  for (const o of drop) o.removeFromParent();
  for (const { material, gs } of buckets.values()) root.add(new THREE.Mesh(merge(gs), material));
  return root;
}
