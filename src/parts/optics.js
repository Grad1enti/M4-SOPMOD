import * as THREE from 'three';
import { D, IN } from '../dims.js';
import { M } from '../materials.js';
import { mesh, rboxAt, latheX, extrudeXY, group, cylZ } from '../geom.js';
import { FSB } from './barrel.js';

// Block II sights: EOTech 553 (SU-231/PEQ) holographic sight with a G33 3x
// magnifier behind it, a KAC folding rear sight and the fixed front sight post.
// The sight line sits ~2.6 in over the bore, so the optics and irons co-witness.
const R = D.railTop;
export const SIGHT_Y = R + 1.42 * IN; // absolute co-witness height
const glass = new THREE.MeshStandardMaterial({
  color: 0x7a98a8, roughness: 0.04, metalness: 0.7, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
});
const lens = new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: 0.05, metalness: 0.9, side: THREE.DoubleSide });
const reticle = new THREE.MeshBasicMaterial({ color: 0xff2a1a, side: THREE.DoubleSide });

export function buildOptics(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'optics', object, explode, delay });

  // --- EOTech 553: 4.9 x 1.8 x 2.8 in ---
  {
    const L = 4.9 * IN, W = 1.8 * IN, H = 2.8 * IN;
    const x1 = 60, x0 = x1 - L, hw = W / 2, top = R + H;
    const g = group();
    // base with its cross-bolt clamp
    g.add(rboxAt(x0 + 4, x1 - 2, R - 1, R + 12, -hw + 2, hw - 2, 2, M.anodDark));
    g.add(rboxAt(x0 + 30, x0 + 44, R - 6, R + 4, -12.6, 12.6, 1, M.anodDark)); // clamp jaws around the rail
    g.add(mesh(cylZ(5.5, 5.5, 5, 18), M.phosDark, [x0 + 37, R + 1, -hw - 1.5])); // cross-bolt thumb nut
    // electronics / battery housing at the rear, with the three control buttons on its back face
    g.add(rboxAt(x0, x0 + 38, R + 10, R + 44, -hw + 1, hw - 1, 5, M.polymer));
    for (const [y, z] of [[R + 30, -8], [R + 30, 0], [R + 30, 8]]) g.add(mesh(new THREE.CylinderGeometry(3, 3, 2.4, 16), M.rubber, [x0 - 0.8, y, z], [0, 0, Math.PI / 2]));
    g.add(mesh(cylZ(8, 8, 3, 24), M.anodDark, [x0 + 20, R + 22, -hw])); // CR123 battery cap
    // protective hood: two side wings and a top bridge, all around the window
    const wing = [[x0 + 30, R + 10], [x1, R + 10], [x1, R + 50], [x1 - 6, top - 4], [x1 - 14, top], [x0 + 44, top], [x0 + 32, R + 46]];
    const opening = [[x0 + 47, R + 23], [x1 - 7, R + 23], [x1 - 7, top - 16], [x1 - 16, top - 11], [x0 + 50, top - 11]];
    for (const sd of [-1, 1]) g.add(mesh(extrudeXY(wing, 4, { bevel: 1, z: sd * (hw - 2), holes: [opening] }), M.anodDark));
    g.add(rboxAt(x0 + 42, x1 - 10, top - 7, top, -hw + 1, hw - 1, 3, M.anodDark));
    for (let x = x0 + 50; x < x1 - 14; x += 7) g.add(rboxAt(x, x + 3, top - 1, top + 1.2, -hw + 4, hw - 4, 0.8, M.anodDark));
    // optical window: rear and front panes, with the red 65 MOA ring and 1 MOA dot
    const wy = SIGHT_Y;
    for (const x of [x0 + 42, x1 - 6]) g.add(mesh(new THREE.PlaneGeometry(26, 21), glass, [x, wy, 0], [0, Math.PI / 2, 0]));
    g.add(rboxAt(x0 + 40, x0 + 44, wy - 12.5, wy - 10.5, -14, 14, 0.5, M.anodDark));
    g.add(mesh(new THREE.TorusGeometry(6.5, 0.28, 6, 40), reticle, [x0 + 43, wy, 0], [0, Math.PI / 2, 0]));
    g.add(mesh(new THREE.CircleGeometry(0.6, 12), reticle, [x0 + 43, wy, 0], [0, Math.PI / 2, 0]));
    add('EOTech 553 holographic sight',
      'SU-231/PEQ, the Block II close-quarters optic: 4.9 × 1.8 × 2.8 in and powered by one CR123. A laser-lit hologram puts a 65 MOA ring around a 1 MOA dot out at the target, so both eyes stay open and the dot stays put if your head moves. Night-vision compatible settings; the hood protects the window.',
      g, [150, 270, 0], 0.35);
  }

  // --- G33 3x magnifier on its STS flip-to-side mount ---
  {
    const L = 4.4 * IN, x1 = -70, x0 = x1 - L, y = SIGHT_Y;
    const tube = mesh(latheX([
      [x0, 0], [x0, 17.5], [x0 + 18, 17.5], [x0 + 20, 15.5], [x1 - 22, 15.5], [x1 - 16, 17.8], [x1, 17.8], [x1, 0],
    ], 36), M.anodDark, [0, y, 0]);
    const cup = mesh(latheX([[x0 - 6, 16], [x0 - 6, 19], [x0 + 6, 19], [x0 + 6, 16]], 36), M.rubber, [0, y, 0]);
    const lenses = [x0 - 5.9, x1 + 0.1].map((x) => mesh(new THREE.CircleGeometry(14, 32), lens, [x, y, 0], [0, Math.PI / 2, 0]));
    const turrets = [
      mesh(new THREE.CylinderGeometry(6, 6, 7, 20), M.anodDark, [x0 + 30, y + 18, 0]),
      mesh(cylZ(6, 6, 7, 20), M.anodDark, [x0 + 30, y, 18]),
    ];
    const mx0 = -150, mx1 = -96; // STS mount
    const mount = group(
      rboxAt(mx0, mx1, R - 1, R + 9, -12, 12, 1.5, M.anodDark),
      rboxAt(mx0 + 18, mx1 - 6, R + 7, y - 12, -8, 8, 2, M.anodDark),
      mesh(latheX([[mx0 + 16, 16], [mx0 + 16, 21], [mx1 - 4, 21], [mx1 - 4, 16]], 36), M.anodDark, [0, y, 0]),
      mesh(cylZ(3, 3, 30, 16), M.phosDark, [mx0 + 24, R + 10, 0]), // hinge pin
      rboxAt(mx0 + 4, mx0 + 18, R + 2, R + 12, -18, -12, 1.5, M.anodDark), // release lever
    );
    add('G33 3× magnifier (STS mount)',
      'EOTech G33 behind the holographic sight triples the view of the target and reticle for longer shots, 4.4 in (112 mm) long. The STS mount pivots it off to the side in a second when you are back to close range.',
      group(tube, cup, ...lenses, ...turrets, mount), [110, 205, 0], 0.45);
  }

  // --- KAC folding rear sight (stowed) ---
  {
    const x0 = D.upperRear + 2, x1 = x0 + 25;
    const g = group(
      rboxAt(x0, x1, R - 1, R + 7, -11, 11, 1.5, M.anodDark),
      mesh(cylZ(3.5, 3.5, 20, 16), M.anodDark, [x1 - 5, R + 8, 0]),
      // aperture leaf folded down flat
      rboxAt(x0 + 1, x1 - 3, R + 7, R + 11, -7.5, 7.5, 1.5, M.anodDark),
      mesh(new THREE.TorusGeometry(2.4, 0.9, 8, 18), M.anodDark, [x0 + 6, R + 11.2, 0], [Math.PI / 2, 0, 0]),
      mesh(cylZ(4, 4, 4, 16), M.anodDark, [x1 - 5, R + 8, 12]), // windage knob
    );
    add('KAC folding rear sight',
      'Knight\'s Armament backup iron sight, folded flat under the magnifier. Flipped up, its aperture lines up with the front sight post through the EOTech window (absolute co-witness), so the carbine can still be aimed if the optic fails.',
      g, [-40, 150, -60], 0.4);
  }

  // --- Front sight post ---
  {
    const x = (FSB.x0 + FSB.x1) / 2;
    const tip = SIGHT_Y - 2;
    const g = group(
      mesh(new THREE.CylinderGeometry(2.6, 2.6, 8, 16), M.phos, [x, R + 18, 0]),
      mesh(new THREE.BoxGeometry(1.8, tip - (R + 22), 1.8), M.phos, [x, (tip + R + 22) / 2, 0]),
    );
    add('Front sight post',
      'F-marked post in the front sight base, taller than the A2 post to match the higher flat-top rear sight. It is screwed up or down against a detent to set the iron sights\' elevation.',
      g, [85, 240, 0], 0.5);
  }
}
