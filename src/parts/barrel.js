import * as THREE from 'three';
import { D, IN } from '../dims.js';
import { M } from '../materials.js';
import { mesh, rboxAt, latheX, extrudeXY, picatinny, railTeeth, tube, group, cylZ, DEG } from '../geom.js';
import { decal, stick, font, railNumbers } from '../decals.js';
import { KEY } from './bcg.js';

// Barrel, front sight base / gas block and the Daniel Defense M4A1 FSP RIS II
// (Block II): 12.25 in long, 2.23 in wide, 2.25 in tall, free-floating, with a
// slot in the top rail for the fixed front sight base.
export const RIS = {
  x0: 0.5, x1: 0.5 + 12.25 * IN,
  top: D.railTop, bottom: D.railTop - 2.25 * IN, hw: 2.23 * IN / 2,
};
RIS.cy = (RIS.top + RIS.bottom) / 2;
RIS.baseTop = RIS.top - 6.4; // rail bases (the rails stand 6.4 mm proud)
RIS.baseBot = RIS.bottom + 6.4;
RIS.baseSide = RIS.hw - 6.4;
export const FSB = { x0: 189, x1: 223, slot0: 183, slot1: 229 };
export const SPLIT = 14; // joint between the RIS II halves
const CHAMF = 9;

/** Octagonal section (z, y), counter-clockwise, `inset` mm inside the rail bases. */
function octagon(inset = 0) {
  const z = RIS.baseSide - inset, y0 = RIS.baseBot + inset, y1 = RIS.baseTop - inset, c = CHAMF - inset * 0.41;
  return [[-z + c, y0], [z - c, y0], [z, y0 + c], [z, y1 - c], [z - c, y1], [-z + c, y1], [-z, y1 - c], [-z, y0 + c]];
}
/** Sutherland-Hodgman clip of a polygon against one half-plane (axis 0 = z, 1 = y). */
function clip(poly, axis, v, keepAbove) {
  const inside = (p) => (keepAbove ? p[axis] >= v : p[axis] <= v);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (v - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
/** The wall of the rail body between two octagons, clipped to one half, as a C-shaped polygon. */
function wall(upper, thick = 2.6) {
  const outer = clip(octagon(0), 1, SPLIT, upper);
  const inner = clip(octagon(thick), 1, SPLIT + (upper ? 0 : 0), upper);
  // walk the outer contour and come back along the inner one
  const cut = (poly) => {
    const i = poly.findIndex((p, k) => Math.abs(p[1] - SPLIT) < 1e-6 && Math.abs(poly[(k + 1) % poly.length][1] - SPLIT) < 1e-6);
    return [...poly.slice(i + 1), ...poly.slice(0, i + 1)]; // starts just after the straight cut edge
  };
  const o = cut(outer), n = cut(inner).reverse();
  return [...o, ...n];
}
/** Extrude a (z, y) polygon along X from x0 to x1. */
function extrudeZY(poly, x0, x1) {
  const s = new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // shape x -> world z, extrusion -> -x
  g.translate(x1, 0, 0);
  return g;
}
/** Picatinny rail placed on one face of the RIS: 'top' | 'right' | 'left' | 'bottom'. */
export function risRail(face, x0, x1, mat) {
  const m = mesh(picatinny(x0, x1), mat);
  placeOnFace(m, face);
  return m;
}
export function placeOnFace(obj, face) {
  if (face === 'top') obj.position.set(0, RIS.baseTop, 0);
  if (face === 'right') { obj.position.set(0, RIS.cy, RIS.baseSide); obj.rotation.x = Math.PI / 2; }
  if (face === 'left') { obj.position.set(0, RIS.cy, -RIS.baseSide); obj.rotation.x = -Math.PI / 2; }
  if (face === 'bottom') { obj.position.set(0, RIS.baseBot, 0); obj.rotation.x = Math.PI; }
  return obj;
}

export function buildBarrel(reg) {
  const add = (name, desc, object, explode, delay, shell = false) => reg.add({ name, desc, cat: 'barrel', object, explode, delay, shell });

  // --- Barrel (with barrel extension) ---
  {
    const thread = D.muzzle - 16;
    const barrel = mesh(latheX([
      [-1, 0], [-1, 15.6], [3, 15.6], [3, 12.8], [40, 12.8], [50, 10.4], [FSB.x0, 10.4], [FSB.x0, 9.5], [FSB.x1, 9.5], [FSB.x1, 10.4],
      [thread - 8, 10.4], [thread - 2, 9], [thread, 9], [thread, 6.35], [D.muzzle - 0.6, 6.35], [D.muzzle, 5.6], [D.muzzle, 0],
    ], 36), M.phos);
    const ext = mesh(latheX([[-25, 0], [-25, 10.5], [-24, 12.4], [-1, 12.4], [-1, 0]], 32), M.steel);
    const pin = rboxAt(-8, -4, 12, 15.5, -1.2, 1.2, 0.4, M.steel); // indexing pin that keys into the upper
    const bore = mesh(new THREE.CircleGeometry(2.85, 20), M.hole, [D.muzzle + 0.05, 0, 0], [0, Math.PI / 2, 0]);
    add('Barrel, 14.5 in',
      'Chrome-lined 4150 steel with a 1:7 in twist, heavy M4A1 (SOCOM) profile, 368 mm long from the bolt face. The barrel extension screwed to its breech carries the locking recesses for the bolt lugs, so the receiver never takes the firing load. Gas is tapped off under the front sight base, about 7.8 in from the bolt face (carbine length).',
      group(barrel, ext, pin, bore), [55, -30, 0], 0.3, true);
  }

  // --- Barrel nut ---
  {
    const nut = mesh(latheX([[-1, 15.1], [-1, 17.6], [22, 17.6], [24, 16.2], [24, 13], [22, 12.8], [-1, 15.1]], 40), M.phos);
    const lugs = [45, 135, 225, 315].map((a) => {
      const g = group(rboxAt(2, 20, -3, 3, 16.8, 18.8, 0.6, M.phos)); g.rotation.x = a * DEG; return g;
    });
    add('Barrel nut',
      'Daniel Defense barrel nut for the RIS II. It clamps the barrel to the upper receiver\'s threads, and the rail bolts onto it rather than touching the barrel, which is what makes the rail free-floating.',
      group(nut, ...lugs), [25, 25, 45], 0.35);
  }

  // --- Gas tube ---
  add('Gas tube',
    'Stainless tube that carries propellant gas from the port under the front sight base back into the upper receiver, where it feeds the bolt carrier\'s gas key (direct impingement). Carbine length, about 9.8 in.',
    group(mesh(tube([[KEY.x1 + 8, KEY.y, 0], [60, KEY.y, 0], [170, KEY.y, 0], [183, 15.6, 0], [FSB.x0 + 8, 14.2, 0]], 2.4, 90, 10, 0.3), M.steel)),
    [30, 60, 0], 0.4);

  // --- Front sight base / gas block ---
  {
    const ring = mesh(latheX([[FSB.x0, 9.5], [FSB.x0, 13.5], [FSB.x0 + 1, 14.5], [FSB.x1 - 1, 14.5], [FSB.x1, 13.5], [FSB.x1, 9.5]], 36), M.phos);
    const tower = mesh(extrudeXY([
      [FSB.x0 + 1, 11], [FSB.x1 - 1, 11], [FSB.x1 - 7, 30], [FSB.x1 - 9, 45], [FSB.x0 + 9, 45], [FSB.x0 + 7, 30],
    ], 11, { bevel: 1 }), M.phos);
    const ears = [-1, 1].map((sd) => mesh(extrudeXY([
      [FSB.x0 + 8, 43], [FSB.x1 - 8, 43], [FSB.x1 - 8, 64], [FSB.x1 - 10, 67.5], [FSB.x0 + 10, 67.5], [FSB.x0 + 8, 64],
    ], 3, { bevel: 0.8, z: sd * 5.2 }), M.phos));
    const detent = rboxAt(FSB.x0 + 10, FSB.x1 - 10, 43, 46, -3.7, 3.7, 0.5, M.phos);
    const pins = [FSB.x0 + 8, FSB.x1 - 8].map((x) => mesh(new THREE.CylinderGeometry(1.4, 1.1, 30, 10), M.steel, [x, 0, 0]));
    const lug = rboxAt(FSB.x1 - 2, FSB.x1 + 22, -19, -10, -4.4, 4.4, 1, M.phos); // bayonet lug
    const swivel = mesh(new THREE.TorusGeometry(5, 1.2, 8, 18), M.steel, [FSB.x0 + 14, -19.5, 0]);
    // "F" stamp: this base takes the taller flat-top front sight post
    const fMark = stick(decal(6, 7, (ctx, px) => { ctx.font = font(5, px, 800); ctx.fillText('F', 3 * px, 3.7 * px); }), '+z', (FSB.x0 + FSB.x1) / 2, 34, 5.56);
    add('Front sight base / gas block',
      'The M4\'s forged "A-frame" front sight base doubles as the gas block: it is pinned to the barrel over the gas port and the gas tube plugs into its back. It also carries the bayonet lug and a sling swivel. The RIS II FSP rail has a slot so it can stay on.',
      group(ring, tower, ...ears, detent, ...pins, lug, swivel, fMark), [85, 105, 0], 0.45, true);
  }

  // --- RIS II upper half ---
  {
    const g = group(
      mesh(extrudeZY(wall(true), RIS.x0, FSB.slot0), M.fdeMetal),
      mesh(extrudeZY(wall(true), FSB.slot1, RIS.x1), M.fdeMetal),
      ...[-1, 1].map((sd) => mesh(extrudeZY(clip(wall(true), 0, sd * 8, sd > 0), FSB.slot0, FSB.slot1), M.fdeMetal)),
      risRail('top', RIS.x0, FSB.slot0 - 2, M.fdeMetal),
      risRail('top', FSB.slot1 + 2, RIS.x1, M.fdeMetal),
      railNumbers(railTeeth(RIS.x0, FSB.slot0 - 2), RIS.top, { first: 1, color: 0xd8d2c6 }),
      railNumbers(railTeeth(FSB.slot1 + 2, RIS.x1), RIS.top, { first: 1 + railTeeth(RIS.x0, FSB.slot0 - 2).length + 5, color: 0xd8d2c6 }),
    );
    add('RIS II rail, upper half',
      'Daniel Defense M4A1 FSP RIS II in flat dark earth, the Block II rail. The top MIL-STD-1913 rail lines up with the receiver\'s, giving one continuous rail for optics and lasers, and is slotted around the front sight base. 6061-T6 aluminium, 12.25 in (311 mm) long.',
      g, [55, 190, 0], 0.35, true);
  }

  // --- RIS II lower half ---
  {
    const bolts = [];
    for (const x of [RIS.x0 + 18, RIS.x1 - 18]) for (const sd of [-1, 1]) {
      bolts.push(mesh(cylZ(3.3, 3.3, 1.6, 6), M.phosDark, [x, SPLIT - 4.5, sd * (RIS.baseSide + 0.8)]));
    }
    const g = group(
      mesh(extrudeZY(wall(false), RIS.x0, RIS.x1), M.fdeMetal),
      risRail('right', RIS.x0, RIS.x1, M.fdeMetal),
      risRail('left', RIS.x0, RIS.x1, M.fdeMetal),
      risRail('bottom', RIS.x0, RIS.x1, M.fdeMetal),
      ...bolts,
    );
    add('RIS II rail, lower half',
      'Carries the side and bottom rails at 3, 6 and 9 o\'clock for the light, laser switch and vertical grip. The two halves bolt together around the barrel nut and never touch the barrel, so the rail is free-floating and zero does not shift when you load it.',
      g, [55, -150, 0], 0.3, true);
  }

  // --- Rail panels (FDE) ---
  {
    const panel = (face, x0, x1) => {
      const g = group(rboxAt(x0, x1, 1.2, 8.6, -12.4, 12.4, 2.2, M.fde));
      for (let x = x0 + 5; x < x1 - 4; x += 6) g.add(rboxAt(x, x + 2.4, 8.3, 9.4, -9.5, 9.5, 0.6, M.fde));
      return placeOnFace(g, face);
    };
    add('Rail panels (FDE)',
      'Polymer covers that clip over the unused rail sections. They protect the hand from the sharp rail teeth and the heat of a hot barrel, and keep the flat dark earth look.',
      group(panel('left', RIS.x0 + 6, 150), panel('left', 156, RIS.x1 - 6), panel('right', RIS.x0 + 6, 150), panel('bottom', RIS.x0 + 6, 100)),
      [55, -215, 0], 0.4);
  }

  // --- Flash hider (KAC NT4 QD) ---
  {
    const x0 = D.muzzle - 15, x1 = D.tip;
    const fh = mesh(latheX([
      [x0, 6.4], [x0, 12.6], [x0 + 11, 12.6], [x0 + 11, 11.2], [x1 - 2, 11.2], [x1, 10.2], [x1, 7.8], [x1 - 6, 6.4],
    ], 36), M.phosDark);
    const teeth = Array.from({ length: 12 }, (_, k) => {
      const g = group(rboxAt(x0 + 1, x0 + 10, -1.1, 1.1, 12.2, 13.4, 0.3, M.phos)); g.rotation.x = k * 30 * DEG; return g;
    });
    const slots = Array.from({ length: 4 }, (_, k) => {
      const g = group(rboxAt(x1 - 26, x1 - 4, -1.6, 1.6, 10.8, 11.3, 0.4, M.hole)); g.rotation.x = (45 + k * 90) * DEG; return g;
    });
    add('Flash hider (KAC NT4)',
      'Knight\'s Armament NT4 flash hider on the 1/2-28 muzzle thread. Its slotted front breaks up muzzle flash, and the ratchet ring at the back is where the QDSS-NT4 suppressor locks on.',
      group(fh, ...teeth, ...slots), [105, -20, 0], 0.5, true);
  }
}
