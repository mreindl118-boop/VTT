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
import { buildGridOverlay } from './gridOverlay';

const SCATTER = new Set(['pine', 'bush', 'dead-tree', 'boulder', 'gravestone', 'fence', 'timber-brace', 'post', 'column', 'rubble']);

export interface LabelSpec { id: string; text: string; sub?: string; pos: THREE.Vector3; vis: VisClass; kind: 'key' | 'object' | 'tread' | 'note' | 'door' | 'link'; objectId?: string; wallId?: string; linkId?: string }

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
  const ceiling = level.ceilingFt ?? DEFAULT_CEILING_FT;
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
    labels.push({ id: `key:${r.key}`, text: r.key, sub: r.name + (r.page ? ` · p.${r.page}` : ''), pos: new THREE.Vector3(cx, y0 + 0.5, cz), vis: 'dm-note', kind: 'key' });
  }
  for (const t of level.terrain ?? []) {
    const arr = byFloor.get(t.floor) ?? [];
    arr.push(slabGeometry(t.polygon, y0 - 0.05, 1));
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
  const pushWall = (color: string, g: THREE.BufferGeometry) => { const a = byWallMat.get(color) ?? []; a.push(g); byWallMat.set(color, a); };
  const wallColor = (w: Wall) => WALL_COLOR[w.material ?? 'ashlar'];
  const doorTop = Math.min(7, ceiling);

  for (const w of level.walls) {
    const f = new Set(w.flags);
    const h = w.heightFt ?? ceiling;
    const color = wallColor(w);
    if (f.has('secret-door')) continue; // handled below with its object
    if (f.has('window')) {
      pushWall(color, segmentBox(w.a, w.b, y0, y0 + 3));
      pushWall(color, segmentBox(w.a, w.b, y0 + 7, y0 + h));
      const pane = new THREE.Mesh(segmentBox(w.a, w.b, y0 + 3, y0 + 7, 0.2, false), wallMat(PALETTE.stone, { emissive: '#1b2530' }));
      pane.userData.role = 'wall'; pane.userData.window = true;
      wallsGroup.add(pane);
      continue;
    }
    if (f.has('door')) {
      pushWall(color, segmentBox(w.a, w.b, y0 + doorTop, y0 + h));
      const slab = new THREE.Mesh(segmentBox(w.a, w.b, y0, y0 + doorTop, 0.5, false), wallMat(f.has('locked') ? PALETTE.iron : '#9a6a3a'));
      if (f.has('locked')) { const band = new THREE.Mesh(segmentBox(w.a, w.b, y0 + 3, y0 + 3.6, 0.6, false), wallMat(PALETTE.wine)); band.userData.role = 'door'; band.userData.wallId = w.id; wallsGroup.add(band); }
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
    const openMode = OPENABLE_KINDS[o.kind];
    if (openMode && o.kind !== 'claw-chest-skeleton' && !(SCATTER.has(o.kind) && o.vis === 'player')) openables.set(o.id, makeOpenable(obj, openMode, !!o.container?.open));
    if (SCATTER.has(o.kind) && o.vis === 'player') { scatter.push({ obj, o, p }); continue; }
    obj.position.copy(p);
    if (o.kind === 'stairs-straight') obj.position.set(0, y0, 0);
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

  // Scatter props (trees, braces, stones...) merge into one mesh per material: they are never picked or revealed.
  if (scatter.length) {
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const { obj, o, p } of scatter) {
      obj.position.copy(p);
      obj.rotation.y = ((o.rotY ?? 0) * Math.PI) / 180;
      obj.updateMatrixWorld(true);
      obj.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        const arr = byMat.get(m.material as THREE.Material) ?? [];
        arr.push(g);
        byMat.set(m.material as THREE.Material, arr);
      });
    }
    for (const [material, gs] of byMat) {
      const m = new THREE.Mesh(merge(gs), material);
      m.userData.role = 'prop';
      m.name = 'scatter';
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

  const gridMesh = buildGridOverlay(grid, y0);
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
  if (o.kind === 'pressure-plate') {
    const g = new THREE.Group();
    const w = o.dims?.w ?? 5, d = o.dims?.d ?? 5;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.15, d - 0.6), mat(PALETTE.wine));
    plate.position.y = 0.08;
    g.add(plate);
    return g;
  }
  const b = PROP_BUILDERS[o.kind];
  if (b) return b();
  const v1 = PROPS_V1[o.kind];
  if (v1) return v1(o.dims ?? {});
  // Creatures: a kit figure on a base ring sized by creature size; a pawn if no figure exists yet.
  const base = baseRingFt(o.size ?? 'medium');
  const g = new THREE.Group();
  const fig = CREATURES[o.kind];
  const scale = { tiny: 0.5, small: 0.75, medium: 1, large: 1.6, huge: 2.3, gargantuan: 3 }[o.size ?? 'medium'];
  const body = fig ? fig({ ...(o.dims ?? {}), scale: (o.dims?.scale ?? 1) * (o.kind === 'shambling-mound' || o.kind === 'dire-wolf' ? 1 : scale) }) : pawn(PALETTE.mist2, base);
  body.position.y = 0.3;
  g.add(baseRing(base, PALETTE.blood), body);
  return g;
}
