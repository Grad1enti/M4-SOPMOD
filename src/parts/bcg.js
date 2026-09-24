import * as THREE from 'three';
import { D } from '../dims.js';
import { M } from '../materials.js';
import { mesh, rboxAt, latheX, extrudeXY, group, cylZ, DEG } from '../geom.js';

// M16 / M4A1 full-auto bolt carrier group, in battery (bolt locked).
const BF = D.boltFace; // bolt face
export const CARRIER = { front: BF - 8, rear: BF - 8 - 160, r: 12.45 };
const CAM_X = -47;
export const KEY = { x0: -114, x1: -66, y: 16.5 }; // gas key and the gas tube bore it receives

/** Something sitting on the carrier surface at `angle` degrees from 3 o'clock (right side) towards the top. */
function onSurface(obj, angle) {
  const g = group(obj);
  g.rotation.x = -angle * DEG;
  return g;
}

export function buildBCG(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'bcg', object, explode, delay });
  const { front: CF, rear: CR, r: R } = CARRIER;

  // --- Bolt carrier ---
  {
    const body = mesh(latheX([
      [CR, 0], [CR, 10.8], [CR + 1.5, R], [CF - 22, R], [CF - 20, R - 0.8], [CF - 14, R - 0.8], [CF - 12, R], [CF - 2, R], [CF, R - 1.4], [CF, 0],
    ], 40), M.phos);
    // forward-assist serrations on the right side
    const serr = Array.from({ length: 11 }, (_, k) => rboxAt(-118 + k * 3.4, -116.8 + k * 3.4, -3, 3, R - 1.2, R + 0.2, 0.3, M.phosDark));
    // gas vents on the right, cam-pin track on top, retaining-pin hole on the left
    const vents = [-70, -78].map((x) => mesh(new THREE.CircleGeometry(1.6, 14), M.hole, [x, 0, R + 0.05]));
    const slot = rboxAt(CAM_X - 8, CAM_X + 10, R - 1, R + 0.1, -3.4, 3.4, 0.5, M.hole);
    const pinHole = mesh(new THREE.CircleGeometry(1.2, 12), M.hole, [-98, 3, -R - 0.05]);
    // chrome-lined bore visible at the front
    const bore = mesh(new THREE.CircleGeometry(7.2, 28), M.chrome, [CF + 0.05, 0, 0], [0, Math.PI / 2, 0]);
    add('Bolt carrier (M16 / M4A1 pattern)',
      'Full-mass carrier in manganese-phosphate steel with a chrome-lined interior. Gas tapped from the barrel drives it rearward: it unlocks and pulls the bolt, compresses the buffer spring, then runs forward again to strip and chamber the next round. The notches on its right side are for the forward assist.',
      group(body, onSurface(group(...serr), 38), onSurface(group(...vents), 8), slot, pinHole, bore),
      [-30, 300, 0], 0.25);
  }

  // --- Gas key ---
  {
    const k = KEY;
    const block = mesh(extrudeXY([
      [k.x0, R - 1], [k.x0, 19.6], [k.x0 + 2, 20.6], [k.x1 - 12, 20.6], [k.x1 - 6, 19], [k.x1, 18.8], [k.x1, 14.2], [k.x1 - 6, 13.8], [k.x1 - 10, R - 1],
    ], 9.4, { bevel: 0.8 }), M.phos);
    const nose = mesh(latheX([[k.x1 - 2, 0], [k.x1 - 2, 3.3], [k.x1 + 9, 3.3], [k.x1 + 10, 2.6], [k.x1 + 10, 0]], 20), M.phos, [0, k.y, 0]);
    const screws = [k.x0 + 12, k.x0 + 30].map((x) => group(
      mesh(new THREE.CylinderGeometry(3, 3, 1, 20), M.steel, [x, 20.5, 0]),
      mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.1, 6), M.hole, [x, 20.6, 0]),
      // staking: the key metal is punched into the screw heads
      rboxAt(x - 4.2, x - 3, 20.2, 21.2, -1, 1, 0.2, M.phosDark), rboxAt(x + 3, x + 4.2, 20.2, 21.2, -1, 1, 0.2, M.phosDark),
    ));
    add('Gas key',
      'Also called the carrier key. The rear of the gas tube slides into its nose; gas flows through it into the space between carrier and bolt and drives the carrier back. The two screws are staked so they cannot work loose.',
      group(block, nose, ...screws), [-30, 350, 0], 0.45);
  }

  // --- Bolt ---
  {
    const body = mesh(latheX([
      [BF - 66, 0], [BF - 66, 3.6], [BF - 50, 3.6], [BF - 50, 6.3], [BF - 44, 6.3], [BF - 44, 6.0], [BF - 43.2, 6.0], [BF - 43.2, 6.3],
      [BF - 42.4, 6.3], [BF - 42.4, 6.0], [BF - 41.6, 6.0], [BF - 41.6, 6.3], [BF - 10, 6.3], [BF - 10, 5.2], [BF, 5.2], [BF, 0],
    ], 32), M.phos);
    // seven locking lugs (the eighth position is the extractor)
    const lugs = [];
    for (let k = 0; k < 7; k++) {
      const a = (k + 1) * 45;
      const lug = rboxAt(BF - 6.5, BF - 0.4, -2.6, 2.6, 4.6, 8.4, 0.5, M.phos);
      const g = group(lug); g.rotation.x = -a * DEG;
      lugs.push(g);
    }
    const recess = mesh(new THREE.CircleGeometry(4.7, 28), M.phosDark, [BF + 0.05, 0, 0], [0, Math.PI / 2, 0]);
    const ejector = mesh(new THREE.CircleGeometry(1, 12), M.steel, [BF + 0.08, -2.6, -1.5], [0, Math.PI / 2, 0]);
    const camHole = mesh(cylZ(2.6, 2.6, 12.8, 16), M.hole, [CAM_X, 0, 0], [Math.PI / 2, 0, 0]);
    add('Bolt',
      'Rotating bolt with seven locking lugs that lock into the barrel extension, like a bank-vault door. Three split gas rings seal it inside the carrier, and the recessed bolt face holds the cartridge head; the small plunger in the face is the spring-loaded ejector.',
      group(body, ...lugs, recess, ejector, camHole), [60, 300, 0], 0.5);
  }

  // --- Extractor ---
  {
    const claw = extrudeXY([[BF + 0.4, 5.2], [BF - 2, 4.1], [BF - 4, 5.6], [BF - 27, 5.6], [BF - 29, 7.4], [BF - 1, 8.6], [BF + 0.4, 7.6]], 4, { bevel: 0.4 });
    const g = group(mesh(claw, M.phos));
    g.rotation.x = Math.PI / 2; // lay it on the bolt's right side (3 o'clock)
    add('Extractor',
      'Spring-loaded claw pinned into the side of the bolt. It snaps over the cartridge rim as the round chambers and pulls the empty case out as the bolt travels back.',
      g, [80, 300, 35], 0.7);
  }

  // --- Cam pin ---
  {
    const g = group(
      mesh(new THREE.CylinderGeometry(2.5, 2.5, 18, 16), M.phos, [CAM_X, 3.5, 0]),
      mesh(new THREE.BoxGeometry(8, 3.4, 6.4), M.phos, [CAM_X, R + 0.6, 0]),
    );
    add('Cam pin',
      'Rides in a curved track in the carrier. As the carrier moves the pin rotates the bolt about 22.5° to lock and unlock it, and it stops the bolt coming out of the carrier.',
      g, [25, 345, 0], 0.6);
  }

  // --- Firing pin ---
  {
    const fp = latheX([[BF - 84, 0], [BF - 84, 2.8], [BF - 56, 2.8], [BF - 55, 4.4], [BF - 52.6, 4.4], [BF - 51.6, 2.4], [BF - 4, 1.9], [BF - 1, 1.1], [BF - 0.4, 0]], 18);
    add('Firing pin',
      'Floating pin that runs through the bolt. The hammer strikes its rear end and the tip hits the primer; the collar keeps it captive in the carrier.',
      group(mesh(fp, M.chrome)), [-150, 300, 0], 0.6);
  }

  // --- Firing pin retaining pin ---
  {
    const g = group(
      mesh(new THREE.CylinderGeometry(1, 1, 22, 10), M.steel, [-98, 1, -2]),
      mesh(new THREE.TorusGeometry(2.2, 0.8, 8, 16), M.steel, [-98, 13, -2], [0, Math.PI / 2, 0]),
    );
    g.rotation.x = 18 * DEG;
    add('Firing pin retaining pin',
      'A split cotter pin pushed in from the left side of the carrier. It traps the firing pin, and is the one part of the bolt carrier group that is easy to lose.',
      g, [-60, 300, -45], 0.7);
  }
}
