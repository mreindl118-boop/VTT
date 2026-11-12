// The painted face: eyes, brows, lips, colour and lines drawn as a picture and worn by the head as its skin, the way a
// painted miniature or an animated figure carries its face. The head stays one clean surface; only the nose stands off
// it. Stylised on purpose: large almond eyes under a strong lid line, shaped brows, a drawn mouth, soft colour on the
// cheeks. Original drawing code; nothing here is copied from any book or picture.
import * as THREE from 'three';
import type { FaceSpec } from './faces';

export interface PaintLook { skin: string; hair?: string; eyes?: string; lips?: string; fem?: boolean; /** Crossed-out eyes. */ dead?: boolean; size?: number }

/** The picture covers this much of the head (in the face builder's units, skull radius 0.4), centred on the eye line. */
const SPAN_X = 0.9, SPAN_Y = 1.0;
/** Where a point on the front of the head reads the picture. */
export const faceUV = (x: number, y: number): [number, number] => [x / SPAN_X + 0.5, y / SPAN_Y + 0.5];

const mix = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const rgba = (c: string, a: number) => { const k = new THREE.Color(c); return `rgba(${Math.round(k.r * 255)},${Math.round(k.g * 255)},${Math.round(k.b * 255)},${a})`; };
const cache = new Map<string, THREE.Texture>();

/** Paint a face. Returns null where there is nothing to draw on (no canvas, as in the test runner). */
export function paintFace(spec: FaceSpec, look: PaintLook): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const key = JSON.stringify([spec, look]); const hit = cache.get(key); if (hit) return hit;
  const S = look.size ?? 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'); if (!c) return null;
  const n = (v: number | undefined) => Math.max(-1, Math.min(1, v ?? 0));
  const fem = !!look.fem, skin = look.skin, shade = mix(skin, '#3a1c22', 0.38), deep = mix(skin, '#160c12', 0.8);
  const lum = new THREE.Color(skin).getHSL({ h: 0, s: 0, l: 0 }).l;
  const lipBase = look.lips ?? mix(skin, '#9a2c40', fem ? 0.6 : 0.5), lipC = lipBase;
  const hairC = spec.browColor ?? look.hair ?? '#3a2a1a', browC = mix(hairC, '#140c0c', 0.25), lashC = mix(hairC, '#0c0808', 0.75);
  const age = Math.max(0, Math.min(1, spec.age ?? 0)), gaunt = n(spec.gaunt);

  c.fillStyle = skin; c.fillRect(0, 0, S, S);
  // head units from here: x to the figure's left, y up, the eye line at 0
  c.setTransform(S / SPAN_X, 0, 0, -S / SPAN_Y, S / 2, S / 2);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const blob = (x: number, y: number, rx: number, ry: number, col: string, a: number, rot = 0) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(rx, ry);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.55, rgba(col, a * 0.55)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.fillRect(-1, -1, 2, 2); c.restore();
  };
  const stroke = (pts: [number, number][], w: number, col: string, a = 1) => {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) c.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else if (pts.length === 4) c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    else for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
    c.lineWidth = w; c.strokeStyle = rgba(col, a); c.stroke();
  };

  // ---- colour under the drawing: the hollow under the cheekbone, the temples, warmth on the cheeks and nose, the
  // shade the brow throws over the eyes
  const ex = 0.128 * (1 + 0.12 * n(spec.eyeSpace)), ew = (fem ? 0.072 : 0.064) * (1 + 0.16 * n(spec.eyeSize));
  const eh = ew * (fem ? 0.5 : 0.4) * (1 - 0.28 * Math.max(0, n(spec.hooded))), tilt = (fem ? 0.14 : 0.08) + 0.2 * n(spec.eyeSlant);
  for (const sx of [-1, 1]) {
    blob(sx * 0.215, -0.17, 0.085, 0.05, shade, 0.15 + 0.2 * Math.max(0, gaunt) + 0.1 * n(spec.cheekbones), sx * -0.5);
    blob(sx * 0.3, 0.1, 0.05, 0.12, shade, 0.16);
    if (!look.dead) blob(sx * 0.19, -0.09, 0.075, 0.055, spec.blush ?? mix(skin, '#d2485a', 0.6), spec.blush ? 0.42 : fem ? 0.24 : 0.1);
    blob(sx * ex, 0.02, ew * 1.55, eh * 2.6, spec.shadow ?? shade, (spec.shadow ? 0.6 : 0.3) + 0.25 * Math.max(0, n(spec.sunken)));
    blob(sx * 0.03, -0.02, 0.02, 0.09, shade, 0.22);                                    // the side of the nose's bridge
    if (n(spec.bags) > 0) stroke([[sx * (ex - ew * 0.7), -eh * 1.5], [sx * ex, -eh * 2.3], [sx * (ex + ew * 0.8), -eh * 1.4]], 0.007, shade, 0.35 + 0.4 * n(spec.bags));
  }
  blob(0, -0.335, 0.06, 0.02, shade, 0.22);                                             // under the lower lip
  blob(0, 0.26, 0.2, 0.09, '#ffffff', lum > 0.2 ? 0.1 : 0.05);                          // light on the forehead

  // ---- the eyes
  const eyeC = look.eyes ?? '#4a3a2a';
  for (const sx of [-1, 1]) {
    c.save(); c.translate(sx * ex, 0); c.scale(sx, 1); c.rotate(tilt);                  // +x now runs to the outer corner
    if (spec.eyepatch && (spec.eyepatch === 'L' ? 1 : -1) === sx) {
      c.beginPath(); c.ellipse(0, 0.005, ew * 1.25, eh * 2.1, 0, 0, Math.PI * 2); c.fillStyle = '#15121a'; c.fill(); c.restore();
      continue;
    }
    if (look.dead) {
      for (const k of [-1, 1]) stroke([[-ew * 0.7, k * eh * 1.1], [ew * 0.7, -k * eh * 1.1]], 0.013, deep);
      c.restore(); continue;
    }
    const almond = () => {
      c.beginPath(); c.moveTo(-ew, -eh * 0.15);
      c.bezierCurveTo(-ew * 0.55, eh * 1.2, ew * 0.4, eh * 1.25, ew, eh * 0.3);
      c.bezierCurveTo(ew * 0.55, -eh * 0.95, -ew * 0.45, -eh * 0.9, -ew, -eh * 0.15); c.closePath();
    };
    almond(); c.fillStyle = '#f3eee6'; c.fill();
    c.save(); almond(); c.clip();
    const ir = eh * 1.02, iy = eh * 0.12;
    c.beginPath(); c.arc(0, iy, ir, 0, Math.PI * 2); c.fillStyle = mix(eyeC, '#000000', 0.35); c.fill();
    const ig = c.createRadialGradient(0, iy - ir * 0.3, ir * 0.1, 0, iy, ir * 0.92); ig.addColorStop(0, mix(eyeC, '#ffffff', 0.35)); ig.addColorStop(0.7, eyeC); ig.addColorStop(1, mix(eyeC, '#000000', 0.3));
    c.beginPath(); c.arc(0, iy, ir * 0.9, 0, Math.PI * 2); c.fillStyle = ig; c.fill();
    c.beginPath(); c.arc(0, iy, ir * 0.42, 0, Math.PI * 2); c.fillStyle = '#0b080c'; c.fill();
    const lg = c.createLinearGradient(0, eh * 1.25, 0, eh * 0.2); lg.addColorStop(0, 'rgba(20,10,16,0.55)'); lg.addColorStop(1, 'rgba(20,10,16,0)');
    c.fillStyle = lg; c.fillRect(-ew, eh * 0.2, ew * 2, eh * 1.1);                      // the lid's shade on the eye
    c.beginPath(); c.arc(-ir * 0.36 * sx, iy + ir * 0.4, ir * 0.2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill();
    c.beginPath(); c.arc(ir * 0.3 * sx, iy - ir * 0.4, ir * 0.1, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    c.restore();
    // the lid line, heavier toward the outer corner and carried past it; the crease above; the lower lashes
    const lw = (fem || spec.lashes ? 0.017 : 0.012);
    stroke([[-ew, -eh * 0.15], [-ew * 0.55, eh * 1.2], [ew * 0.4, eh * 1.25], [ew, eh * 0.3]], lw, lashC);
    stroke([[ew * 0.55, eh * 0.95], [ew * 0.95, eh * 0.55], [ew * (fem || spec.lashes ? 1.32 : 1.12), eh * (fem || spec.lashes ? 0.85 : 0.4)]], lw * 0.8, lashC);
    stroke([[-ew * 0.8, eh * 1.25], [-ew * 0.2, eh * 2.05], [ew * 0.5, eh * 1.95], [ew * 1.05, eh * 1.05]], 0.005, shade, 0.55 + 0.3 * Math.max(0, n(spec.hooded)));
    stroke([[ew, eh * 0.3], [ew * 0.55, -eh * 0.95], [-ew * 0.1, -eh * 0.95]], 0.005, lashC, fem ? 0.6 : 0.4);
    c.restore();
  }

  // ---- the brows: full at the nose, arched, tapering out
  const bt = n(spec.browAngle), th = (fem ? 0.02 : 0.032) * (1 + 0.5 * n(spec.browThick)), by = eh + 0.062 + 0.008 * n(spec.browRidge);
  for (const sx of [-1, 1]) {
    const x0 = 0.04, x1 = ex + ew * 0.25, x2 = ex + ew * 1.2;
    const y0 = by - 0.006 - 0.03 * bt, y1 = by + 0.016 + 0.004 * bt, y2 = by - 0.004 + 0.016 * bt + 0.012 * n(spec.eyeSlant);
    c.beginPath(); c.moveTo(sx * x0, y0 + th * 0.5);
    c.quadraticCurveTo(sx * x1, y1 + th * 0.75, sx * x2, y2);
    c.quadraticCurveTo(sx * x1, y1 - th * 0.2, sx * x0, y0 - th * 0.5); c.closePath();
    c.fillStyle = browC; c.fill();
  }
  if (bt > 0.5) for (const sx of [-1, 1]) stroke([[sx * 0.016, by + 0.05], [sx * 0.022, by - 0.01]], 0.006, shade, 0.7);   // the scowl's furrow

  // ---- the mouth: a bowed upper lip, a fuller lower one, the line between them
  const full = n(spec.lipFull), smile = n(spec.smile) + (fem ? 0.15 : 0.05), my = -0.262;
  const hw = (fem ? 0.068 : 0.074) * (1 + 0.2 * n(spec.mouthW)), uh = (fem ? 0.022 : 0.016) * (1 + 0.35 * full), lh = (fem ? 0.032 : 0.026) * (1 + 0.35 * full);
  const cy = my + 0.016 * smile, midY = my - 0.004 * smile;
  c.beginPath(); c.moveTo(-hw, cy);
  c.bezierCurveTo(-hw * 0.55, my + uh * 0.7, -hw * 0.38, my + uh * 1.15, -hw * 0.2, my + uh);
  c.quadraticCurveTo(0, my + uh * 0.55, hw * 0.2, my + uh);
  c.bezierCurveTo(hw * 0.38, my + uh * 1.15, hw * 0.55, my + uh * 0.7, hw, cy);
  c.quadraticCurveTo(0, midY - 0.004, -hw, cy); c.closePath(); c.fillStyle = mix(lipC, '#2a0c14', 0.22); c.fill();
  c.beginPath(); c.moveTo(-hw, cy); c.quadraticCurveTo(0, midY - 0.004, hw, cy);
  c.bezierCurveTo(hw * 0.6, my - lh * 1.25, -hw * 0.6, my - lh * 1.25, -hw, cy); c.closePath(); c.fillStyle = lipC; c.fill();
  blob(0, my - lh * 0.5, hw * 0.45, lh * 0.4, '#ffffff', fem ? 0.3 : 0.14);
  stroke([[-hw * 1.04, cy + 0.002 * smile], [0, midY - 0.005], [hw * 1.04, cy + 0.002 * smile]], 0.0065, mix(lipC, '#12060a', 0.75));
  if (spec.teeth) { c.fillStyle = '#ebe4d2'; c.fillRect(-hw * 0.55, my - 0.012, hw * 1.1, 0.012); }

  // ---- years and marks
  if (age > 0.3) for (const sx of [-1, 1]) stroke([[sx * 0.055, -0.15], [sx * (hw + 0.03), -0.2], [sx * (hw + 0.028), -0.29]], 0.005 + 0.004 * age, shade, 0.35 + 0.4 * age);
  if (age > 0.5) for (let i = 0; i < 3; i++) stroke([[-0.15 + i * 0.02, 0.2 + i * 0.045], [0, 0.208 + i * 0.045], [0.15 - i * 0.02, 0.2 + i * 0.045]], 0.005, shade, 0.3 + 0.35 * age);
  if (age > 0.45) for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) stroke([[sx * (ex + ew * 1.25), k * 0.008], [sx * (ex + ew * 1.25 + 0.03), k * 0.024]], 0.004, shade, 0.5);
  if (spec.veins) for (const sx of [-1, 1]) stroke([[sx * 0.3, 0.24], [sx * 0.27, 0.16], [sx * 0.285, 0.12], [sx * 0.25, 0.08]], 0.005, spec.veins, 0.7);
  const scarC = mix(skin, '#a04848', 0.55);
  for (const s of spec.scars ?? []) {
    const sx = /L$/.test(s) ? 1 : -1;
    if (s === 'cheekL' || s === 'cheekR') stroke([[sx * 0.26, -0.03], [sx * 0.23, -0.12], [sx * 0.17, -0.22]], 0.011, scarC);
    else if (s === 'browL' || s === 'browR') stroke([[sx * (ex + 0.02), 0.22], [sx * (ex + 0.035), 0.1], [sx * (ex + 0.05), -0.07]], 0.01, scarC);
    else if (s === 'lip') stroke([[0.03, -0.2], [0.04, -0.26], [0.045, -0.33]], 0.009, scarC);
    else stroke([[-0.2, 0.2], [-0.04, 0.03], [0.12, -0.1], [0.2, -0.2]], 0.011, scarC);
  }
  if (spec.mole) { c.beginPath(); c.arc((spec.mole === 'L' ? 1 : -1) * (hw + 0.035), my + 0.04, 0.008, 0, Math.PI * 2); c.fillStyle = '#2a1a16'; c.fill(); }

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
  cache.set(key, tex); return tex;
}

/** Give a shaped head geometry the picture's coordinates: the front reads the face, the back reads plain skin. */
export function wearFace(geo: THREE.BufferGeometry): void {
  const p = geo.attributes.position as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), front = p.getZ(i) > 0.02;
    const [u, v] = front ? faceUV(x, y) : [x < 0 ? 0.01 : 0.99, 0.01];
    uv[i * 2] = Math.max(0.005, Math.min(0.995, u)); uv[i * 2 + 1] = Math.max(0.005, Math.min(0.995, v));
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
