import * as THREE from 'three';
import { D } from '../dims.js';
import { M } from '../materials.js';
import { sweep, mesh, rboxAt, latheX, extrudeXY, picatinny, group, arc } from '../geom.js';

// M4A1 flat-top (A4-style) upper receiver. Origin: bore axis at the front face.
const B = D.parting, W = D.upperHW, T = D.railBase, DECK = 8;
export const PORT = { x0: -112, x1: -46, y0: -7, y1: 9 }; // ejection port (right side)
export const FA = { y: 6, z: 15.5, x0: -162, x1: -126 }; // forward assist housing axis
const HINGE_Y = -9.8;

/** Right half of the receiver cross-section, bottom centre -> top centre, as [z, y]. */
function halfSection() {
  const pts = [[0, B], [4, B], [8, B], [W - 3, B]];
  for (const a of [-60, -30, 0]) pts.push([W - 3 + 3 * Math.cos(a * Math.PI / 180), B + 3 + 3 * Math.sin(a * Math.PI / 180)]);
  for (const y of [PORT.y0, -3, 1, 5, PORT.y1, 12]) pts.push([W, y]);
  for (const a of [18, 36, 54, 72, 90]) {
    const t = a * Math.PI / 180;
    pts.push([DECK + (W - DECK) * Math.cos(t), 12 + (T - 12) * Math.sin(t)]);
  }
  pts.push([4, T], [0, T]);
  return pts;
}
const HALF = halfSection();
const SECTION = [...HALF, ...HALF.slice(1, -1).reverse().map(([z, y]) => [-z, y])];

/** Solid end plate following the section outline (with an optional hole), lying in the YZ plane. */
function endPlate(x, thick, hole) {
  const s = new THREE.Shape(SECTION.map(([z, y]) => new THREE.Vector2(z, y)));
  if (hole) s.holes.push(new THREE.Path(hole.map(([z, y]) => new THREE.Vector2(z, y))));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 20 });
  g.rotateY(-Math.PI / 2); // shape x -> world z, extrusion -> -x
  g.translate(x, 0, 0);
  return g;
}

export function buildUpper(reg) {
  const add = (name, desc, object, explode, delay, shell = false) => reg.add({ name, desc, cat: 'upper', object, explode, delay, shell });

  // --- Upper receiver ---
  {
    const xs = [D.upperRear, -175, -168, -160, -150, -140, -128, PORT.x0, -100, -86, -72, -58, PORT.x1, -34, -22, -9];
    const rings = xs.map((x) => SECTION.map(([z, y]) => [x, y, z]));
    const shellGeo = sweep(rings, {
      thick: 2.4,
      keep: (i, j, c) => !(c.z > 0 && c.x > PORT.x0 && c.x < PORT.x1 && c.y > PORT.y0 && c.y < PORT.y1),
    });
    const g = group(new THREE.Mesh(shellGeo, [M.anod, M.inside]));
    // integral MIL-STD-1913 rail
    g.add(mesh(picatinny(D.upperRear + 1, -1), M.anod, [0, T, 0]));
    // threaded front collar the barrel nut screws onto
    g.add(mesh(latheX([[-10, 12.6], [-10, 15.1], [0, 15.1], [0, 12.6]], 40), M.anod));
    // front face and rear face (rear is open for the carrier and charging handle)
    g.add(mesh(endPlate(-8.5, 2, arc(0, 0, 12.6, 0, 360, 32).slice(0, -1)), M.anod));
    const rearHole = [[6.5, T - 2.5], [6.5, 11.26], ...arc(0, 0, 13, 60, -240, 24).slice(1, -1), [-6.5, 11.26], [-6.5, T - 2.5]];
    g.add(mesh(endPlate(D.upperRear + 2, 2, rearHole), M.anod));
    // forward assist housing and brass deflector on the right
    g.add(mesh(latheX([[FA.x0, 0], [FA.x0, 7.2], [FA.x0 + 1, 8.2], [FA.x1 - 6, 8.2], [FA.x1, 5], [FA.x1, 0]], 28), M.anod, [0, FA.y, FA.z]));
    g.add(mesh(extrudeXY([[-132, FA.y - 7.5], [-110, 10], [-110, 19], [-132, 21]], 7, { bevel: 1.2, z: W + 2.2 }), M.anod));
    // ejection port hinge lugs
    for (const x of [PORT.x0 - 4, PORT.x1 + 4]) g.add(rboxAt(x - 3, x + 3, HINGE_Y - 3, HINGE_Y + 2.5, W - 1, W + 2.6, 1, M.anod));
    // front pivot lug and rear takedown lug that drop into the lower
    g.add(rboxAt(-22, -12, B - 12, B + 0.5, -6, 6, 2.5, M.anod));
    g.add(rboxAt(-172, -162, B - 11, B + 0.5, -6, 6, 2.5, M.anod));
    add('Upper receiver (M4A1 flat-top)',
      'Machined from a 7075-T6 aluminium forging and hard-coat anodised. The integral MIL-STD-1913 rail on top replaced the A2 carry handle, so optics and a folding rear sight clamp straight on. It houses the bolt carrier and charging handle, and the barrel nut holds the barrel to its threaded front. About 178 mm (7 in) long.',
      g, [0, 130, 0], 0.15, true);
  }

  // --- Charging handle ---
  {
    const y0 = 16.8, y1 = 23.4, x = D.upperRear;
    const top = [ // T-handle outline seen from above, [x, z]
      [x + 3, 6.1], [x - 4, 7], [x - 7, 15], [x - 9, 19.5], [x - 14, 19.5], [x - 15, 15], [x - 15, -15],
      [x - 14, -19.5], [x - 9, -19.5], [x - 7, -15], [x - 4, -7], [x + 3, -6.1],
    ];
    const handle = extrudeXY(top, y1 - y0, { bevel: 1.2 });
    handle.rotateX(Math.PI / 2);
    handle.translate(0, (y0 + y1) / 2, 0);
    // latch on the left side, pivoting on a roll pin
    const latch = extrudeXY([[x - 2, -18], [x - 12, -18], [x - 15, -25], [x - 12, -27], [x - 5, -24]], 4.5, { bevel: 0.8 });
    latch.rotateX(Math.PI / 2);
    latch.translate(0, (y0 + y1) / 2, 0);
    // the arm is a U-channel: the bolt carrier's gas key rides inside it
    const arm = group(
      rboxAt(x + 2, -9, 20.8, y1, -6.1, 6.1, 0.8, M.anod),
      rboxAt(x + 2, -40, 14.4, y1, 4.9, 6.1, 0.5, M.anod),
      rboxAt(x + 2, -40, 14.4, y1, -6.1, -4.9, 0.5, M.anod),
    );
    add('Charging handle',
      'Pulled straight back to cock the rifle and chamber the first round. The latch on its left side clips into the upper so recoil cannot bounce it open, and it stays still while firing: the bolt carrier\'s gas key rides in the channel under its arm.',
      group(mesh(handle, M.anod), mesh(latch, M.anodDark), arm), [-60, 215, 0], 0.4);
  }

  // --- Ejection port cover (dust cover), shown open ---
  {
    const len = PORT.x1 - PORT.x0 + 6, x0 = PORT.x0 - 3;
    const plate = rboxAt(x0, x0 + len, 0.5, 20, 0, 1.3, 0.6, M.anod);
    const rib = rboxAt(x0 + 6, x0 + len - 6, 9, 12.5, 0.6, 2.4, 1, M.anod); // stiffening rib
    const lock = rboxAt(x0 + 2, x0 + 7, 15, 20, -1.8, 1.3, 0.6, M.anod); // catch that snaps into the port
    const knuckles = [x0, x0 + len - 7].map((x) => mesh(latheX([[x, 2], [x + 7, 2]], 14), M.anod));
    const hinge = group(plate, rib, lock, ...knuckles);
    hinge.position.set(0, HINGE_Y, W + 1.4);
    hinge.rotation.x = Math.PI - 0.32;
    const rod = mesh(latheX([[PORT.x0 - 8, 1], [PORT.x1 + 8, 1]], 10), M.steel, [0, HINGE_Y, W + 1.4]);
    add('Ejection port cover',
      'Spring-loaded dust cover that keeps grit out of the action. It pops open by itself the moment the bolt carrier moves and is closed by hand. Shown open, hanging on its hinge rod.',
      group(hinge, rod), [10, 70, 80], 0.55);
  }

  // --- Forward assist ---
  {
    const cap = latheX([
      [FA.x0 - 11, 0], [FA.x0 - 11, 5.5], [FA.x0 - 10, 6.8], [FA.x0 - 1, 6.8], [FA.x0 - 1, 5], [FA.x0 + 20, 5], [FA.x0 + 20, 0],
    ], 28);
    const grip = [0, 1, 2, 3].map((k) => mesh(latheX([[FA.x0 - 9 + k * 2, 7], [FA.x0 - 8.2 + k * 2, 7]], 28), M.anodDark));
    const pawl = rboxAt(FA.x0 + 18, FA.x0 + 30, -3, 3, -6, -1, 1, M.phos);
    const g = group(mesh(cap, M.anod), ...grip, pawl);
    g.position.set(0, FA.y, FA.z);
    add('Forward assist',
      'Plunger on the right rear of the upper. Its pawl engages the serrations on the side of the bolt carrier, so the shooter can push the bolt fully closed if it stops short of locking.',
      g, [-70, 125, 60], 0.5);
  }
}
