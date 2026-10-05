// Relief: the shape of the ground on an outdoor level. Authored per map by its script as a coarse
// height grid in scene.json (`level.relief`), read here in the level's own plan feet, heights above the level's
// `elevationFt`: the samples joined by flat triangles (exactly what is drawn), lit by the smooth (C1, Catmull-Rom)
// surface through the same samples. Everything that stands on the ground asks this one sampler: the ground mesh, the
// grid, tokens, props, labels, picking, the land beyond the map. Pure: no renderer.
//
// Buildings stand on pads: the ground is flat under a footprint at the highest natural ground beneath it (so the
// uphill wall is never buried) and the building's plinth reaches down by `drop` to the lowest ground round it, so on
// the downhill side its foundation shows. Pads change what things stand on (`at`), never the drawn slope round them.

/** A level's relief as authored in scene.json. */
export interface ReliefData {
  /** Format version. */
  v: 1;
  /** Plan feet of sample (0, 0): the grid's north-west corner on a north = -z map. */
  origin: [number, number];
  /** Feet between samples. */
  cell: number;
  cols: number;
  rows: number;
  /** One string per row (z), `cols` space-separated heights in tenths of a foot above the level's elevationFt. */
  h: string[];
  /** Provenance: the script and the inputs that made it, so a re-run is reproducible. */
  src?: string;
}

/** A building's pad: an oriented footprint (centre, half extents, rotation) flat at `y`; `drop` is how far the ground
 *  falls away below the pad round the footprint (the foundation the building shows on its downhill side). */
export interface Pad { id: string; x: number; z: number; hw: number; hd: number; c: number; s: number; y: number; drop: number }

const PAD_BIN = 64;

export class Relief {
  readonly cell: number; readonly cols: number; readonly rows: number; readonly x0: number; readonly z0: number;
  /** Lowest and highest authored ground (feet above the level's elevation). */
  readonly min: number; readonly max: number;
  private f: Float32Array;
  private pads = new Map<string, Pad>();
  private bins = new Map<number, Pad[]>();

  constructor(readonly data: ReliefData) {
    this.cell = data.cell; this.cols = data.cols; this.rows = data.rows; [this.x0, this.z0] = data.origin;
    this.f = new Float32Array(this.cols * this.rows);
    let lo = Infinity, hi = -Infinity;
    for (let r = 0; r < this.rows; r++) {
      const row = (data.h[r] ?? '').trim().split(/\s+/);
      for (let c = 0; c < this.cols; c++) { const v = (Number(row[c]) || 0) / 10; this.f[r * this.cols + c] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    this.min = lo; this.max = hi;
  }

  /** The plan extent the grid covers. */
  get extent(): { minX: number; minZ: number; maxX: number; maxZ: number } {
    return { minX: this.x0, minZ: this.z0, maxX: this.x0 + (this.cols - 1) * this.cell, maxZ: this.z0 + (this.rows - 1) * this.cell };
  }

  /** The authored ground at (x, z), exactly as it is drawn: the samples joined by flat triangles, every cell split on
   *  the same diagonal (from its north-west to its south-east corner). The ground mesh, the floors laid on it, tokens,
   *  props and picking all read this one surface, so nothing floats or sinks by an interpolation's difference.
   *  Beyond the grid the edge's height carries on, so the land beyond the map can blend from the map's edge heights. */
  natural(x: number, z: number): number {
    const gx = Math.min(this.cols - 1, Math.max(0, (x - this.x0) / this.cell)), gz = Math.min(this.rows - 1, Math.max(0, (z - this.z0) / this.cell));
    const c = Math.min(this.cols - 2, Math.floor(gx)), r = Math.min(this.rows - 2, Math.floor(gz)), u = gx - c, v = gz - r;
    const C = this.cols, f = this.f, b = r * C + c, h00 = f[b], h10 = f[b + 1], h01 = f[b + C], h11 = f[b + C + 1];
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
  }

  /** The same ground as a smooth (C1, Catmull-Rom) surface through the samples: its slope lights the ground, so the
   *  flat triangles shade as one rolling surface. */
  smooth(x: number, z: number): number {
    const gx = Math.min(this.cols - 1, Math.max(0, (x - this.x0) / this.cell)), gz = Math.min(this.rows - 1, Math.max(0, (z - this.z0) / this.cell));
    const c1 = Math.min(this.cols - 2, Math.floor(gx)), r1 = Math.min(this.rows - 2, Math.floor(gz));
    const tx = gx - c1, tz = gz - r1, C = this.cols, f = this.f;
    const c0 = Math.max(0, c1 - 1), c2 = c1 + 1, c3 = Math.min(C - 1, c1 + 2);
    let out = 0;
    const wz = weights(tz);
    for (let k = 0; k < 4; k++) {
      const r = Math.min(this.rows - 1, Math.max(0, r1 - 1 + k)), b = r * C;
      out += wz[k] * cr(f[b + c0], f[b + c1], f[b + c2], f[b + c3], tx);
    }
    return out;
  }

  /** The ground things stand on: the natural ground, flat on a building's pad. */
  at(x: number, z: number): number {
    const p = this.padAt(x, z);
    return p ? p.y : this.natural(x, z);
  }

  /** The pad (if any) whose footprint holds (x, z). */
  padAt(x: number, z: number): Pad | undefined {
    const list = this.bins.get(binKey(Math.floor(x / PAD_BIN), Math.floor(z / PAD_BIN)));
    if (!list) return undefined;
    for (const p of list) {
      const dx = x - p.x, dz = z - p.z, u = dx * p.c - dz * p.s, v = dx * p.s + dz * p.c;
      if (Math.abs(u) <= p.hw && Math.abs(v) <= p.hd) return p;
    }
    return undefined;
  }

  /** Slope of the ground (rise per foot along x and along z), read off the smooth surface. */
  gradient(x: number, z: number, e = 1): [number, number] {
    return [(this.smooth(x + e, z) - this.smooth(x - e, z)) / (2 * e), (this.smooth(x, z + e) - this.smooth(x, z - e)) / (2 * e)];
  }

  /** Unit normal of the ground (smooth: for lighting and for laying rings on the slope). */
  normal(x: number, z: number): [number, number, number] {
    const [gx, gz] = this.gradient(x, z), L = Math.hypot(gx, 1, gz);
    return [-gx / L, 1 / L, -gz / L];
  }

  /** Level a building's footprint (centre, width along its own x, depth along its own z, rotation in degrees as
   *  three.js turns it): the pad stands at the highest natural ground under the footprint, `drop` reaches the lowest
   *  ground just outside it. Returns the pad (also kept for `at`). */
  addPad(id: string, x: number, z: number, w: number, d: number, rotYDeg = 0): Pad {
    const a = (rotYDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = w / 2, hd = d / 2;
    // a point of the footprint in plan: local (u, v) turned as three.js turns it
    const P = (u: number, v: number): [number, number] => [x + u * c + v * s, z - u * s + v * c];
    const nu = Math.max(2, Math.ceil(w / 8)), nv = Math.max(2, Math.ceil(d / 8));
    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const [px, pz] = P(-hw + (w * i) / nu, -hd + (d * j) / nv); hi = Math.max(hi, this.natural(px, pz)); }
    // the ground round the footprint, a foot out: where the foundation meets it
    for (let i = 0; i <= nu; i++) for (const v of [-hd - 1, hd + 1]) { const [px, pz] = P(-hw - 1 + ((w + 2) * i) / nu, v); lo = Math.min(lo, this.natural(px, pz)); }
    for (let j = 0; j <= nv; j++) for (const u of [-hw - 1, hw + 1]) { const [px, pz] = P(u, -hd - 1 + ((d + 2) * j) / nv); lo = Math.min(lo, this.natural(px, pz)); }
    // (u, v) of a plan point: the inverse turn, used by padAt
    const pad: Pad = { id, x, z, hw, hd, c, s, y: hi, drop: Math.max(0, hi - Math.min(lo, hi)) };
    this.pads.set(id, pad);
    const r = Math.hypot(hw, hd), b0 = Math.floor((x - r) / PAD_BIN), b1 = Math.floor((x + r) / PAD_BIN), k0 = Math.floor((z - r) / PAD_BIN), k1 = Math.floor((z + r) / PAD_BIN);
    for (let bx = b0; bx <= b1; bx++) for (let bz = k0; bz <= k1; bz++) { const key = binKey(bx, bz), list = this.bins.get(key); if (list) list.push(pad); else this.bins.set(key, [pad]); }
    return pad;
  }
  padOf(id: string): Pad | undefined { return this.pads.get(id); }
  get padCount(): number { return this.pads.size; }

  /** The first point where a ray (level frame: plan feet, y above the level's elevation) meets the ground, as the
   *  distance along the ray in units of `d`; null if it never does. Marches the band between the lowest and highest
   *  ground a quarter cell at a time, then bisects: exact to the sampler, whatever mesh draws it. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT = 1e6): number | null {
    const lo = this.min - 1, hi = this.max + 1;
    let t0 = 0, t1 = maxT;
    if (Math.abs(dy) < 1e-12) { if (oy < lo || oy > hi) return null; }
    else {
      const ta = (hi - oy) / dy, tb = (lo - oy) / dy;
      t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.min(maxT, Math.max(ta, tb));
      if (t1 < t0) return null;
    }
    const f = (t: number) => oy + t * dy - this.at(ox + t * dx, oz + t * dz);
    const horiz = Math.hypot(dx, dz), step = horiz > 1e-9 ? Math.max(0.5, this.cell / 4) / horiz : t1 - t0 || 1;
    let ta = t0, fa = f(t0);
    if (fa <= 0) return t0;
    for (let n = 0; n < 200000; n++) {
      const tb = Math.min(t1, ta + step), fb = f(tb);
      if (fb <= 0) {
        let a = ta, b = tb;
        for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
        return (a + b) / 2;
      }
      if (tb >= t1) return null;
      ta = tb; fa = fb;
    }
    return null;
  }
}

function binKey(i: number, j: number): number { return (i + 32768) * 65536 + (j + 32768); }
function cr(a: number, b: number, c: number, d: number, t: number): number { return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a))); }
const W4: [number, number, number, number] = [0, 0, 0, 0];
/** Catmull-Rom weights of the four samples round t (so one row pass per sample row). */
function weights(t: number): [number, number, number, number] {
  const t2 = t * t, t3 = t2 * t;
  W4[0] = 0.5 * (-t3 + 2 * t2 - t); W4[1] = 0.5 * (3 * t3 - 5 * t2 + 2); W4[2] = 0.5 * (-3 * t3 + 4 * t2 + t); W4[3] = 0.5 * (t3 - t2);
  return W4;
}

/** Kinds that stand on a pad: buildings with a plan footprint. Their footprint is `dims.w × dims.d` (or the fixed
 *  footprint below) turned by `rotY`. */
export const PAD_KINDS: Record<string, { w: number; d: number; dz?: number } | 'dims'> = {
  house: 'dims', cottage: 'dims', 'ruined-cottage': 'dims',
  // the church's nave, west tower and apse (kit/props.ts churchBuilding): 42 × 61 ft, its centre 4.5 ft toward the apse
  'church-building': { w: 42, d: 61, dz: 4.5 }, temple: 'dims',
};
/** Linear things that follow the ground along their length (every vertex rides the ground under it). */
export const DRAPE_KINDS = new Set(['palisade', 'fence', 'field-wall', 'krezk-wall', 'iron-fence', 'berez-iron-fence', 'vine-row', 'washline']);

/** The footprint a pad kind stands on, in plan: centre, width, depth (its own axes), rotation in degrees. */
export function padFootprint(o: { kind: string; pos: [number, number, number]; rotY?: number; dims?: Record<string, number> }): { x: number; z: number; w: number; d: number; rot: number } | undefined {
  const k = PAD_KINDS[o.kind]; if (!k) return undefined;
  const rot = o.rotY ?? 0;
  if (k === 'dims') {
    const w = o.dims?.w ?? (o.kind === 'temple' ? 30 : 20), d = o.dims?.d ?? (o.kind === 'temple' ? 45 : 20);
    return { x: o.pos[0], z: o.pos[2], w: w + 0.8, d: d + 0.8, rot };
  }
  // an offset footprint: its centre turned with the building
  const a = (rot * Math.PI) / 180, dz = k.dz ?? 0;
  return { x: o.pos[0] + dz * Math.sin(a), z: o.pos[2] + dz * Math.cos(a), w: k.w, d: k.d, rot };
}

/** Check a relief block: sizes agree, every height is a number, the grid is not degenerate. */
export function validateRelief(r: ReliefData): string[] {
  const errs: string[] = [];
  if (r.v !== 1) errs.push('relief.v must be 1');
  if (!(r.cell > 0)) errs.push('relief.cell must be > 0');
  if (!(r.cols >= 2 && r.rows >= 2)) errs.push('relief needs at least 2 × 2 samples');
  if (r.h.length !== r.rows) errs.push(`relief has ${r.h.length} rows, expected ${r.rows}`);
  r.h.forEach((row, i) => { const v = row.trim().split(/\s+/); if (v.length !== r.cols) errs.push(`relief row ${i} has ${v.length} values, expected ${r.cols}`); else if (v.some((s) => !/^-?\d+$/.test(s))) errs.push(`relief row ${i} has a non-integer`); });
  return errs;
}
