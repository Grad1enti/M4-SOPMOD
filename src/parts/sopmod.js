import * as THREE from 'three';
import { D, IN } from '../dims.js';
import { M } from '../materials.js';
import { mesh, rboxAt, latheX, group, cylZ, DEG } from '../geom.js';
import { RIS } from './barrel.js';

// Block II SOPMOD accessories on the RIS II: AN/PEQ-15 laser module (12 o'clock),
// Insight M3X light (3 o'clock), vertical foregrip (6 o'clock) and the KAC
// QDSS-NT4 suppressor on the NT4 flash hider.
const lensMat = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.05, metalness: 0.9, side: THREE.DoubleSide });
const emitter = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.1, metalness: 0.2, emissive: 0x9fb0bb, emissiveIntensity: 0.25, side: THREE.DoubleSide });

/** Rail clamp block hugging a Picatinny rail, built upright on the rail's top face. */
function clamp(x0, x1, mat, lugs = 2) {
  const g = group(
    rboxAt(x0, x1, 6.4, 10.5, -12.8, 12.8, 1, mat),
    rboxAt(x0, x1, -1, 7, 10.4, 12.8, 0.6, mat),
    rboxAt(x0, x1, -1, 7, -12.8, -10.4, 0.6, mat),
  );
  for (let k = 0; k < lugs; k++) {
    const x = x0 + ((k + 1) * (x1 - x0)) / (lugs + 1);
    g.add(mesh(cylZ(4.5, 4.5, 4, 16), M.steel, [x, 3, -15]));
  }
  return g;
}

export function buildSOPMOD(reg) {
  const add = (name, desc, object, explode, delay) => reg.add({ name, desc, cat: 'sopmod', object, explode, delay });

  // --- AN/PEQ-15 (ATPIAL): 4.6 x 2.8 x 1.6 in, on the top rail ahead of the front sight base ---
  {
    const L = 4.6 * IN, W = 2.8 * IN, H = 1.6 * IN;
    const x0 = 236, x1 = x0 + L, y0 = D.railTop + 2.5, y1 = y0 + H, hw = W / 2;
    const g = group();
    g.add(rboxAt(x0, x1, y0, y1, -hw, hw, 5, M.fde));
    const c = clamp(x0 + 12, x0 + 62, M.fdeDark);
    c.position.set(0, RIS.baseTop, 0);
    g.add(c);
    // front face: IR illuminator with its focus bezel, and the aiming-laser windows
    const yc = (y0 + y1) / 2;
    g.add(mesh(latheX([[x1 - 2, 0], [x1 - 2, 13.5], [x1 + 4, 13.5], [x1 + 4, 0]], 32), M.fdeDark, [0, yc, 13]));
    g.add(mesh(new THREE.CircleGeometry(10.5, 28), lensMat, [x1 + 4.05, yc, 13], [0, Math.PI / 2, 0]));
    for (const [y, z] of [[yc + 7, -12], [yc - 7, -12], [yc, -24]]) {
      g.add(mesh(new THREE.CircleGeometry(3.2, 18), lensMat, [x1 + 0.05, y, z], [0, Math.PI / 2, 0]));
    }
    // top: rotary mode selector and the two boresight adjusters; rear: fire buttons
    g.add(mesh(new THREE.CylinderGeometry(9, 9, 6, 24), M.fdeDark, [x0 + 22, y1 + 2.5, -16]));
    g.add(rboxAt(x0 + 13, x0 + 31, y1 + 5, y1 + 7.5, -18, -14, 0.8, M.fdeDark));
    for (const [x, z] of [[x0 + 70, 0], [x0 + 70, 22]]) g.add(mesh(new THREE.CylinderGeometry(4.5, 4.5, 3, 16), M.steel, [x, y1 + 1.2, z]));
    for (const z of [-10, 10]) g.add(mesh(new THREE.CylinderGeometry(5, 5, 4, 18), M.rubber, [x0 - 1.5, yc, z], [0, 0, Math.PI / 2]));
    g.add(mesh(cylZ(8, 8, 4, 22), M.fdeDark, [x0 + 40, yc, hw + 1.5])); // CR123 battery cap
    add('AN/PEQ-15 laser (ATPIAL)',
      'Advanced Target Pointer Illuminator Aiming Laser, the Block II laser module: 4.6 × 2.8 × 1.6 in on one CR123. It holds an infrared aiming laser and an infrared illuminator that only show up through night-vision goggles, plus a visible red aiming laser. Fired from its rear buttons or a remote pressure switch.',
      g, [120, 200, 0], 0.5);
  }

  // --- Insight M3X light: 4.1 x 1.7 x 1.6 in, on the right-side rail ---
  {
    const L = 4.1 * IN, x0 = 200, x1 = x0 + L;
    const g = group();
    const c = clamp(x0 + 30, x0 + 66, M.anodDark, 1);
    g.add(c);
    g.add(rboxAt(x0 + 10, x1 - 22, 10, 36, -14, 14, 4, M.anodDark));
    const head = mesh(latheX([[x1 - 26, 0], [x1 - 26, 13], [x1 - 18, 16], [x1, 16], [x1, 0]], 32), M.anodDark, [0, 24, 0]);
    g.add(head);
    g.add(mesh(new THREE.CircleGeometry(13.5, 30), emitter, [x1 + 0.05, 24, 0], [0, Math.PI / 2, 0]));
    g.add(rboxAt(x0, x0 + 12, 14, 32, -8, 8, 2, M.rubber)); // rear paddle switch
    // hang it on the 3 o'clock rail
    const face = group(g);
    face.position.set(0, RIS.cy, RIS.baseSide);
    face.rotation.x = Math.PI / 2;
    add('Insight M3X weapon light',
      'White-light illuminator, 4.1 × 1.7 × 1.6 in, on the right-side rail. The lever mount comes off without tools, and the ambidextrous paddle switch at the back gives momentary or constant light for identifying targets in the dark.',
      face, [40, -40, 110], 0.55);
  }

  // --- Vertical foregrip (FDE) on the bottom rail ---
  {
    const xc = 130, len = 96;
    const g = group();
    const c = clamp(xc - 24, xc + 24, M.fde, 1);
    g.add(c);
    const body = mesh(latheX([[0, 0], [0, 15.5], [4, 16], [len - 12, 15], [len - 4, 15.5], [len, 14.5], [len, 0]], 36), M.fde);
    body.rotation.z = Math.PI / 2; // lathe axis X -> +Y (points away from the rail)
    body.position.set(xc, 10, 0);
    g.add(body);
    for (let k = 0; k < 7; k++) g.add(mesh(latheX([[0, 15.6], [2.4, 15.6]], 36), M.fdeDark, [xc, 30 + k * 8, 0], [0, 0, Math.PI / 2]));
    g.add(mesh(latheX([[0, 0], [0, 15.8], [4, 15.8], [4, 0]], 36), M.fdeDark, [xc, 10 + len, 0], [0, 0, Math.PI / 2])); // storage cap
    const face = group(g);
    face.position.set(0, RIS.baseBot, 0);
    face.rotation.x = Math.PI;
    add('Vertical foregrip (FDE)',
      'Clamps to the bottom rail and gives the support hand a solid hold for fast transitions and for controlling the carbine in automatic fire. The hollow body stores spare batteries behind a screw cap.',
      face, [30, -240, 0], 0.5);
  }

  // --- KAC QDSS-NT4 suppressor: 6.4 in long, 1.5 in across ---
  {
    const L = 6.4 * IN, r = 1.5 * IN / 2, x0 = D.muzzle - 13, x1 = x0 + L;
    const can = mesh(latheX([
      [x0, 13.2], [x0, r - 1.5], [x0 + 2, r], [x1 - 6, r], [x1 - 1, r - 3], [x1, r - 6], [x1, 3.6], [x1 - 3, 3.4],
    ], 48), M.phosDark);
    const ring = mesh(latheX([[x0 + 1, r + 0.2], [x0 + 16, r + 0.2]], 48), M.phos);
    const knurl = Array.from({ length: 24 }, (_, k) => {
      const g = group(rboxAt(x0 + 2, x0 + 15, -0.7, 0.7, r, r + 0.9, 0.2, M.phosDark)); g.rotation.x = k * 15 * DEG; return g;
    });
    const latch = rboxAt(x0 + 4, x0 + 24, -3, 3, r - 1, r + 3.5, 1, M.steel);
    const latchG = group(latch); latchG.rotation.x = 70 * DEG;
    add('KAC QDSS-NT4 suppressor',
      'Knight\'s Armament quick-detach sound suppressor, 6.4 in long and 1.5 in across. It slides over the NT4 flash hider and locks onto its ratchet ring, cutting the report and muzzle flash so the shooter is harder to locate. It adds about 120 mm to the carbine.',
      group(can, ring, ...knurl, latchG), [95, -105, 0], 0.45);
  }
}
