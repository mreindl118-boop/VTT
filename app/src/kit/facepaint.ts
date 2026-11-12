// The painted face: eyes, brows, lips, colour and lines drawn as a picture and worn by the head as its skin, the way a
// painted miniature or an animated figure carries its face. The head stays one clean surface; only the nose stands off
// it. Stylised on purpose: large almond eyes under a strong lid line, shaped brows, a drawn mouth, soft colour on the
// cheeks. Original drawing code; nothing here is copied from any book or picture.
import * as THREE from 'three';
import type { FaceSpec } from './faces';

/** The cut of the eye. Each reads as a temperament: almond (level, watchful), round (open, innocent), doe (large and
 *  soft), narrow (cold, measuring), cat (upswept, sly), heavy (half-lidded, smouldering or weary), droop (sad, tired),
 *  wide (startled or mad: the whole iris showing). */
export type EyeShape = 'almond' | 'round' | 'doe' | 'narrow' | 'cat' | 'heavy' | 'droop' | 'wide';
const EYES: Record<EyeShape, { w: number; h: number; up: number; lo: number; peak: number; tilt: number; iris: number; wing: number; brow: number }> = {
  almond: { w: 1, h: 1, up: 1, lo: 0.85, peak: 0.1, tilt: 0, iris: 1, wing: 0, brow: 0 },
  round: { w: 0.96, h: 1.12, up: 1.02, lo: 1.0, peak: 0, tilt: -0.02, iris: 1.16, wing: 0, brow: 0.006 },
  doe: { w: 1.04, h: 1.08, up: 1.02, lo: 0.92, peak: 0.08, tilt: 0.04, iris: 1.14, wing: 0.05, brow: 0.004 },
  narrow: { w: 1.08, h: 0.62, up: 0.9, lo: 0.8, peak: 0.15, tilt: 0.05, iris: 0.95, wing: 0, brow: -0.012 },
  cat: { w: 1.08, h: 0.9, up: 1, lo: 0.75, peak: 0.25, tilt: 0.2, iris: 1, wing: 0.14, brow: 0 },
  heavy: { w: 1.04, h: 0.82, up: 0.72, lo: 0.95, peak: 0.1, tilt: 0.02, iris: 1.08, wing: 0.03, brow: 0 },
  droop: { w: 1, h: 0.95, up: 0.92, lo: 0.95, peak: -0.15, tilt: -0.2, iris: 1, wing: -0.08, brow: 0.004 },
  wide: { w: 1, h: 1.14, up: 1.08, lo: 0.98, peak: 0, tilt: 0, iris: 0.9, wing: 0, brow: 0.012 },
};

export interface PaintLook { skin: string; hair?: string; eyes?: string; lips?: string; fem?: boolean; /** Crossed-out eyes. */ dead?: boolean; size?: number }

/** The picture covers this much of the head (in the face builder's units, skull radius 0.4), centred on the eye line. */
const SPAN_X = 0.9, SPAN_Y = 1.0;
/** Where a point on the front of the head reads the picture. */
export const faceUV = (x: number, y: number): [number, number] => [x / SPAN_X + 0.5, y / SPAN_Y + 0.5];

const mix = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const rgba = (c: string, a: number) => { const k = new THREE.Color(c); return `rgba(${Math.round(k.r * 255)},${Math.round(k.g * 255)},${Math.round(k.b * 255)},${a})`; };
/** A colour exactly as a plain fill of it paints (sRGB), for anything that must match the skin around it. (rgba above
 *  reads the linear values, a shade darker, which the painted shading was tuned with.) */
const flat = (c: string, a: number) => { const k = new THREE.Color(c).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace); return `rgba(${Math.round(k.r * 255)},${Math.round(k.g * 255)},${Math.round(k.b * 255)},${a})`; };
const cache = new Map<string, THREE.Texture>();

/** Paint a face. Returns null where there is nothing to draw on (no canvas, as in the test runner). */
export function paintFace(spec: FaceSpec, look: PaintLook): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const key = JSON.stringify([spec, look]); const hit = cache.get(key); if (hit) return hit;
  const S = look.size ?? 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  let c = cv.getContext('2d') as CanvasRenderingContext2D; if (!c) return null;
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
  // the eye's cut, storybook fashion: each shape is a character in itself
  const hoodK = Math.max(0, n(spec.hooded));
  const shapeName: EyeShape = spec.eyeShape ?? (hoodK > 0.45 ? 'heavy' : n(spec.eyeSize) > 0.55 ? 'round' : n(spec.eyeSlant) > 0.45 ? 'cat' : n(spec.eyeSize) < -0.25 ? 'narrow' : fem ? 'doe' : 'almond');
  const E = EYES[shapeName];
  const ex = 0.136 * (1 + 0.12 * n(spec.eyeSpace)), ew = (fem ? 0.078 : 0.07) * E.w * (1 + 0.14 * n(spec.eyeSize));
  const ehBase = ew / E.w * (fem ? 0.5 : 0.43), eh = ehBase * E.h * (1 - 0.2 * hoodK), tilt = (fem ? 0.1 : 0.05) + E.tilt + 0.2 * n(spec.eyeSlant);
  for (const sx of [-1, 1]) {
    blob(sx * 0.215, -0.17, 0.085, 0.05, shade, 0.15 + 0.2 * Math.max(0, gaunt) + 0.1 * n(spec.cheekbones), sx * -0.5);
    blob(sx * 0.3, 0.1, 0.05, 0.12, shade, 0.16);
    if (!look.dead && spec.blush !== false) blob(sx * 0.19, -0.09, 0.075, 0.055, spec.blush || mix(skin, '#d2485a', 0.6), spec.blush ? 0.42 : fem ? 0.24 : 0.1);
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
    const up = E.up, lo = E.lo, lashy = spec.lashes ?? fem;
    const almond = () => {
      c.beginPath(); c.moveTo(-ew, -eh * 0.1);
      c.bezierCurveTo(-ew * 0.6, eh * 1.25 * up, ew * (0.3 + E.peak), eh * 1.35 * up, ew, eh * 0.35);
      c.bezierCurveTo(ew * 0.6, -eh * lo, -ew * 0.45, -eh * lo * 0.95, -ew, -eh * 0.1); c.closePath();
    };
    almond(); c.fillStyle = mix('#efe9e0', skin, 0.12); c.fill();
    c.save(); almond(); c.clip();
    // a large iris, cut by the lid above (and by the lower lid on a narrowed eye): a dark rim, colour deepening upward,
    // a lit crescent below, a wide pupil, two lights
    const ir = ehBase * E.iris, iy = eh * 0.08 + (E.iris < 0.8 ? 0 : ehBase * 0.06), gz = Array.isArray(spec.gaze) ? spec.gaze : [spec.gaze ?? 0, 0], gzx = Math.max(-1, Math.min(1, gz[0])), gzy = Math.max(-1, Math.min(1, gz[1]));
    const gx = gzx * ew * 0.3 * sx, gy = gzy * eh * 0.28;
    c.beginPath(); c.arc(gx, (iy + gy), ir, 0, Math.PI * 2); c.fillStyle = mix(eyeC, '#06040a', 0.55); c.fill();
    const ig = c.createLinearGradient(0, (iy + gy) + ir, 0, (iy + gy) - ir); ig.addColorStop(0, mix(eyeC, '#06040a', 0.45)); ig.addColorStop(0.45, eyeC); ig.addColorStop(1, mix(eyeC, '#ffffff', 0.45));
    c.beginPath(); c.arc(gx, (iy + gy), ir * 0.88, 0, Math.PI * 2); c.fillStyle = ig; c.fill();
    c.beginPath(); c.arc(gx, (iy + gy) + ir * 0.04, ir * 0.46, 0, Math.PI * 2); c.fillStyle = '#08060a'; c.fill();
    c.beginPath(); c.arc(gx, (iy + gy) - ir * 0.5, ir * 0.3, Math.PI * 1.1, Math.PI * 1.9); c.lineWidth = ir * 0.16; c.strokeStyle = rgba(mix(eyeC, '#ffffff', 0.7), 0.7); c.stroke();
    const lg = c.createLinearGradient(0, eh * 1.35 * up, 0, eh * 0.15); lg.addColorStop(0, 'rgba(24,12,20,0.6)'); lg.addColorStop(1, 'rgba(24,12,20,0)');
    c.fillStyle = lg; c.fillRect(-ew, eh * 0.15, ew * 2, eh * 1.3);                     // the lid's shade on the eye
    c.beginPath(); c.arc(gx - ir * 0.34 * sx, (iy + gy) + ir * 0.36, ir * 0.17, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.92)'; c.fill();
    c.beginPath(); c.arc(gx + ir * 0.32 * sx, (iy + gy) - ir * 0.32, ir * 0.07, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    c.restore();
    // the lid line, drawn like a brush stroke: thin at the nose, full over the eye, carried out past the corner; lashes;
    // the crease above; a soft lower line
    const lw = lashy ? 0.019 : 0.013;
    stroke([[-ew, -eh * 0.1], [-ew * 0.6, eh * 1.25 * up], [ew * (0.3 + E.peak), eh * 1.35 * up], [ew, eh * 0.35]], lw * 0.7, lashC);
    stroke([[-ew * 0.35, eh * 0.98 * up], [ew * 0.1, eh * 1.22 * up], [ew * (0.45 + E.peak), eh * 1.2 * up], [ew, eh * 0.35]], lw * 1.25, lashC);
    stroke([[ew * 0.6, eh * 0.95 * up], [ew * 0.98, eh * 0.5], [ew * (lashy ? 1.36 : 1.14), eh * (lashy ? 0.95 : 0.45) + ew * E.wing]], lw * 0.9, lashC);
    if (lashy) for (const k of [0.25, 0.55, 0.85]) stroke([[ew * (0.35 + k * 0.6), eh * (1.2 - k * 0.55) * up], [ew * (0.5 + k * 0.72), eh * (1.55 - k * 0.5) * up + ew * E.wing * k]], 0.007, lashC);
    stroke([[-ew * 0.85, eh * 1.3 * up + 0.012], [-ew * 0.2, eh * 2.0 * up + 0.014], [ew * 0.5, eh * 1.95 * up + 0.014], [ew * 1.05, eh * 1.0 + 0.01]], 0.005, shade, 0.5 + 0.35 * hoodK);
    stroke([[ew, eh * 0.35], [ew * 0.6, -eh * lo], [-ew * 0.15, -eh * lo * 0.97]], 0.0055, lashC, lashy ? 0.7 : 0.5);
    c.restore();
  }

  // ---- the brows: full at the nose, arched, tapering out
  const bt = n(spec.browAngle), th = (fem ? 0.02 : 0.032) * (1 + 0.5 * n(spec.browThick)), by = eh * 1.35 * E.up + 0.05 + 0.008 * n(spec.browRidge) + E.brow;
  for (const sx of [-1, 1]) {
    const x0 = 0.04, x1 = ex + ew * 0.25, x2 = ex + ew * 1.2;
    const y0 = by - 0.006 - 0.03 * bt, y1 = by + 0.016 + 0.004 * bt, y2 = by - 0.004 + 0.016 * bt + 0.012 * n(spec.eyeSlant);
    c.beginPath(); c.moveTo(sx * x0, y0 + th * 0.5);
    c.quadraticCurveTo(sx * x1, y1 + th * 0.75, sx * x2, y2);
    c.quadraticCurveTo(sx * x1, y1 - th * 0.2, sx * x0, y0 - th * 0.5); c.closePath();
    c.fillStyle = browC; c.fill();
  }
  if (bt > 0.5) for (const sx of [-1, 1]) stroke([[sx * 0.016, by + 0.05], [sx * 0.022, by - 0.01]], 0.006, shade, 0.7);   // the scowl's furrow

  // ---- stubble: a shadow of beard over the jaw, the chin and the upper lip, feathered at its edge and stippled. It stays
  // clear of the picture's corners, which the back of the head reads.
  const flen = n(spec.faceLen);
  if (spec.beard === 'stubble') {
    const bc = spec.beardColor ?? look.hair ?? '#2a2018', tint = mix(skin, bc, lum > 0.45 ? 0.42 : 0.3);
    const region = () => {
      c.beginPath(); c.moveTo(-0.318, 0.035);
      c.bezierCurveTo(-0.3, -0.08, -0.25, -0.15, -0.155, -0.19); c.bezierCurveTo(-0.11, -0.205, -0.085, -0.2, -0.06, -0.205);
      c.quadraticCurveTo(0, -0.198, 0.06, -0.205); c.bezierCurveTo(0.085, -0.2, 0.11, -0.205, 0.155, -0.19); c.bezierCurveTo(0.25, -0.15, 0.3, -0.08, 0.318, 0.035);
      c.bezierCurveTo(0.345, -0.15, 0.33, -0.36, 0.25, -0.44); c.quadraticCurveTo(0, -0.5, -0.25, -0.44); c.bezierCurveTo(-0.33, -0.36, -0.345, -0.15, -0.318, 0.035); c.closePath();
    };
    // drawn on a layer of its own, then faded out toward the sides of the jaw (where the picture stops wrapping the head)
    const layer = document.createElement('canvas'); layer.width = layer.height = S; const lc = layer.getContext('2d');
    if (lc) {
      const main = c; c = lc; c.setTransform(S / SPAN_X, 0, 0, -S / SPAN_Y, S / 2, S / 2);
      c.save(); c.filter = `blur(${Math.round(S * 0.012)}px)`; region(); c.fillStyle = rgba(tint, lum > new THREE.Color(bc).getHSL({ h: 0, s: 0, l: 0 }).l ? 0.75 : 0.45); c.fill(); c.restore();
      c.save(); region(); c.clip(); let sd = 3; const r = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
      for (let i = 0; i < S * 3; i++) { const x = (r() - 0.5) * 0.66, y = 0.04 - r() * 0.52; c.beginPath(); c.arc(x, y, 0.0022 + r() * 0.0014, 0, Math.PI * 2); c.fillStyle = rgba(mix(bc, '#000000', 0.2), 0.22 + r() * 0.2); c.fill(); }
      c.restore();
      const fade = c.createLinearGradient(-SPAN_X / 2, 0, SPAN_X / 2, 0);
      for (const [t, a] of [[0, 0], [0.18, 0], [0.29, 1], [0.71, 1], [0.82, 0], [1, 0]] as [number, number][]) fade.addColorStop(t, `rgba(0,0,0,${a})`);
      c.globalCompositeOperation = 'destination-in'; c.fillStyle = fade; c.fillRect(-SPAN_X / 2, -SPAN_Y / 2, SPAN_X, SPAN_Y);
      c = main; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(layer, 0, 0); c.restore();
    }
  }

  // ---- the mouth: a bowed upper lip, a fuller lower one, the line between them
  const full = n(spec.lipFull), smile = n(spec.smile) + (fem ? 0.15 : 0.05), my = -0.262 * (1 + 0.06 * flen);
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
  // the first faint lines (from 0.15): short smile lines, then a crow's foot at each eye
  if (age > 0.15 && age <= 0.3) for (const sx of [-1, 1]) {
    const k = (age - 0.15) / 0.15;
    stroke([[sx * 0.06, -0.155], [sx * (hw + 0.024), -0.195], [sx * (hw + 0.024), -0.245]], 0.0045, shade, 0.14 + 0.2 * k);
    if (age > 0.2) stroke([[sx * (ex + ew * 1.25), 0.002], [sx * (ex + ew * 1.25 + 0.027), 0.014]], 0.0035, shade, 0.22 + 0.16 * k);
  }
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

  // the sides of the picture settle back to plain skin before the head turns away from it, so nothing painted stops at a
  // hard edge where the picture ends on the cheek and temple
  for (const sx of [-1, 1]) {
    const edge = c.createLinearGradient(sx * 0.255, 0, sx * 0.335, 0); edge.addColorStop(0, flat(skin, 0)); edge.addColorStop(1, flat(skin, 1));
    c.fillStyle = edge; c.fillRect(sx > 0 ? 0.255 : -SPAN_X / 2, -SPAN_Y / 2, SPAN_X / 2 - 0.255, SPAN_Y);
  }
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
