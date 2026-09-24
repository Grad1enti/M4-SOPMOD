import * as THREE from 'three';
import { D } from '../dims.js';
import { M } from '../materials.js';
import { decal, stick, font } from '../decals.js';
import { mesh, rboxAt, latheX, extrudeXY, spline2, helixX, group, cylZ, DEG, curve1d, ringLoft, clamp } from '../geom.js';

// M4A1 lower receiver group, buffer system and SOPMOD buttstock.
const B = D.parting, W = D.upperHW;
const PIVOT = [-16, -21.5], TAKEDOWN = [-167, -21];
const TRIG = [-108, -34], HAMMER = [-128, -30], SELECTOR = [-146, -32], AUTOSEAR = [-151, -19];
const MAGREL = [-79, -30];
const GRIP_TOP = [-138, -52], GRIP_ANGLE = -22 * DEG;

/** Pin running across the receiver (along Z), head on the right. */
function pin(x, y, r, head = 0, mat = M.phos) {
  const g = group(mesh(cylZ(r, r, 2 * W - 0.4, 16), mat, [x, y, 0]));
  if (head) g.add(mesh(cylZ(head, head, 1.6, 24), mat, [x, y, W + 0.6]));
  return g;
}
/** Flat disc facing +x or along an axis, used to fake openings. */
function hole(w, h, pos, rot) {
  const m = mesh(new THREE.PlaneGeometry(w, h), M.hole, pos, rot);
  return m;
}

export function buildLower(reg) {
  const add = (name, desc, object, explode, delay, shell = false) => reg.add({ name, desc, cat: 'lower', object, explode, delay, shell });

  // --- Lower receiver ---
  {
    const prof = [
      [-9, B], [-8, -18], [-9, -24], [-12, -28], [-17, -31], [-19.5, -33],
      [-21, -83], [-24, -88], [-26, -91], [-88, -91], [-89.5, -87], [-87, -82],
      [-87, -50], [-92, -46.5], [-136, -46.5], [GRIP_TOP[0], GRIP_TOP[1]],
      [-172.5, -38.2], [-178, -31], [-182.5, -25], [-188, -19], [D.towerRear, -14], [D.towerRear, -6],
      [D.towerFront, -6], [D.towerFront, B],
    ];
    const body = mesh(extrudeXY(prof, 2 * W, { bevel: 1.6 }), M.anod);
    // magazine well flares out slightly at the bottom
    const flare = mesh(extrudeXY([[-20.5, -76], [-25, -91], [-89, -91], [-88.5, -76]], 2 * W + 2.4, { bevel: 1.4 }), M.anod);
    // buffer tower ring the receiver extension screws into
    const tower = mesh(latheX([[D.towerRear, 12.7], [D.towerRear, 16.5], [D.towerFront, 16.5], [D.towerFront, 12.7], [D.towerRear, 12.7]], 40), M.anod);
    // raised fence around the magazine release, bolt catch boss on the left
    const fence = mesh(extrudeXY([[-90, -40], [-68, -40], [-66, -22], [-70, -20], [-72, -34], [-86, -34], [-88, -22], [-92, -22]], 3.2, { bevel: 0.8, z: W + 0.9 }), M.anod);
    const catchBoss = rboxAt(-96, -80, -34, -18, -W - 2.2, -W + 1, 1.2, M.anod);
    // dark openings: magazine well, fire-control pocket, magazine release hole
    const wellBottom = hole(62, 21, [-55.5, -91.1, 0], [Math.PI / 2, 0, 0]);
    const pocket = hole(145, 20, [-93.5, B + 0.05, 0], [-Math.PI / 2, 0, 0]);
    // roll marks on the left of the magazine well
    const roll = stick(decal(48, 15, (ctx, px) => {
      ctx.font = font(3.1, px, 700);
      ctx.fillText('M4A1 CARBINE', 24 * px, 4.2 * px);
      ctx.fillText('CAL 5.56 MM', 24 * px, 10.4 * px);
    }), '-z', -53, -60, -W - 0.06);
    // selector positions around the lever, read from the left: forward is to the viewer's left
    const marks = stick(decal(56, 34, (ctx, px) => {
      ctx.font = font(2.8, px, 700);
      const cx = 28 * px, cy = 17 * px;
      for (const [label, a] of [['SAFE', 150], ['SEMI', 90], ['AUTO', 30]]) {
        const r = 15.5 * px, t = (a * Math.PI) / 180;
        ctx.fillText(label, cx + Math.cos(t) * r, cy - Math.sin(t) * r * 0.78);
      }
    }), '-z', SELECTOR[0], SELECTOR[1] + 2, -W - 0.06);
    add('Lower receiver (M4A1)',
      'Forged 7075-T6 aluminium, hard-coat anodised. It carries the magazine well, the fire-control group, the pistol grip and, in the ring at its rear, the buffer tube. The M4A1 version has a three-position selector (Safe, Semi, Auto) instead of the M4\'s three-round burst.',
      group(body, flare, tower, fence, catchBoss, wellBottom, pocket, roll, marks), [0, -55, 0], 0.05, true);
  }

  // --- Magazine (30-round) with two rounds under the feed lips ---
  {
    const front = spline2([[-24.5, -17], [-24.5, -40], [-23, -80], [-18, -112], [-8, -142], [6, -170]], 24, false);
    const rear = spline2([[-84, -17], [-84, -40], [-82, -80], [-77, -115], [-68, -150], [-46, -194]], 24, false);
    const outline = [...front, ...rear.reverse()];
    const body = mesh(extrudeXY(outline, 22, { bevel: 1.2 }), M.magAlu);
    // floorplate, square to the bottom of the body
    const F = new THREE.Vector2(6, -170), R = new THREE.Vector2(-46, -194);
    const along = R.clone().sub(F).normalize(), down = new THREE.Vector2(along.y, -along.x);
    if (down.y > 0) down.negate();
    const fp = [F.clone().addScaledVector(along, -2), R.clone().addScaledVector(along, 2)];
    const floor = [fp[0], fp[1], fp[1].clone().addScaledVector(down, 3.5), fp[0].clone().addScaledVector(down, 3.5)].map((v) => [v.x, v.y]);
    const plate = mesh(extrudeXY(floor, 24, { bevel: 1 }), M.polymer);
    // pressed stiffening ribs along both sides
    const ribs = [-1, 1].map((s) => mesh(extrudeXY([
      ...spline2([[-40, -60], [-37, -100], [-30, -130], [-18, -158]], 12, false),
      ...spline2([[-24, -160], [-35, -131], [-42, -101], [-45, -60]], 12, false),
    ], 1.2, { z: s * 11.2 }), M.magAlu));
    const round = (y, z) => {
      const g = group(
        mesh(latheX([[0, 0], [0, 4.7], [0.8, 4.7], [0.9, 4.1], [1.6, 4.1], [2.2, 4.8], [36.5, 4.6], [39.5, 3.1], [44.7, 3.1], [44.7, 0]], 20), M.brass),
        mesh(latheX([[44.7, 0], [44.7, 2.85], [48, 2.85], [53, 1.9], [53, 0]], 20), M.copper),
        mesh(latheX([[53, 0], [53, 1.9], [55.5, 1.1], [57.4, 0.3], [57.4, 0]], 20), M.greenTip),
      );
      g.position.set(-83, y, z);
      return g;
    };
    add('Magazine, 30-round',
      'STANAG magazine with an aluminium body and anti-tilt follower, about 190 mm long. The cartridges sit in a staggered double column; shown loaded with M855 green-tip 5.56×45 mm NATO rounds. The curve follows the tapered cartridge case.',
      group(body, plate, ...ribs, round(-22, 2.6), round(-29, -2.6)), [45, -200, 0], 0.1, true);
  }

  // --- Pistol grip (FDE) ---
  {
    // A2 grip, lofted from cross-sections along its 22° rake. Local frame: x fore-aft
    // (+ forward), s down the grip from the receiver, z across. Side profile and width
    // follow the A2: finger swell on the front strap, palm swell on the backstrap,
    // ~27 mm across and ~37 mm deep at the top, 100 mm long.
    const FRONT = [[0, 0], [-8, -1], [-20, -2.8], [-30, -2.2], [-38, 0.6], [-44, 3.2], [-49, 4], [-54, 3], [-60, 0.2], [-68, -1.8], [-84, -2.2], [-94, 0], [-100, 0.8]];
    const BACK = [[0, -37], [-8, -35.2], [-20, -33], [-35, -35], [-50, -36.4], [-65, -36], [-80, -34.6], [-94, -33], [-100, -32.6]];
    const HALF = [[0, 13.9], [-30, 13.9], [-55, 13.6], [-80, 13.2], [-100, 12.8]];
    const c = Math.cos(GRIP_ANGLE), sn = Math.sin(GRIP_ANGLE);
    const toWorld = (x, s, z) => [GRIP_TOP[0] + x * c - s * sn, GRIP_TOP[1] + x * sn + s * c, z];
    const section = (s, shrink = 1, N = 48, e = 2.7) => {
      const f = curve1d(FRONT, s), b = curve1d(BACK, s), hw = curve1d(HALF, s) * shrink;
      const mid = (f + b) / 2, d = ((f - b) / 2) * shrink;
      return Array.from({ length: N }, (_, k) => {
        const t = (k / N) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
        const u = Math.sign(ct) * Math.abs(ct) ** (2 / e), v = Math.sign(st) * Math.abs(st) ** (2 / e);
        return toWorld(mid + d * u, s, hw * v * (1 - 0.14 * Math.max(0, u))); // slimmer at the finger side
      });
    };
    const rings = [];
    for (let s = 0; s >= -96; s -= 3) rings.push(section(s));
    for (const [s, k] of [[-97.8, 0.95], [-99, 0.86], [-99.7, 0.74], [-100, 0.6]]) rings.push(section(s, k));
    const grip = mesh(ringLoft(rings), M.grip);
    // the A2 is open at the bottom: a dark hollow for the grip screw and small spares
    const hollow = mesh(ringLoft([section(-100.05, 0.45, 32)], { cap1: false }), M.hole);
    add('Pistol grip (FDE)',
      'A2 grip in flat dark earth polymer, with the finger swell between the middle and ring fingers and checkered side panels. One screw up through its hollow core holds it to the receiver and also traps the selector\'s detent spring.',
      group(grip, hollow), [-40, -170, 0], 0.3, true);
  }

  // --- Trigger guard ---
  {
    const outer = [[-85.5, -46], [-85.5, -58], [-89, -63.5], [-96, -66], [-129, -66], [-135, -62], [-137.5, -55], [-137.5, -46]];
    const inner = [[-91, -48], [-91, -57], [-95, -61.2], [-128, -61.2], [-132.5, -57.5], [-133, -48]];
    add('Trigger guard',
      'Hinged aluminium guard. A spring-loaded detent at the front lets it swing down so the trigger can be reached wearing winter gloves.',
      group(mesh(extrudeXY(outer, 11, { bevel: 1, holes: [inner] }), M.anod), pin(-88, -50.5, 1.2)), [5, -130, 30], 0.35);
  }

  // --- Trigger & disconnector ---
  {
    const prof = [
      [-100, -29.5], [-110, -30], [-126, -36.5], [-140, -37.5], [-141.5, -40.5], [-126, -42], [-113, -41],
      ...spline2([[-111, -46], [-112, -53], [-115, -58.5], [-119, -61.5]], 10, false),
      [-117, -63], ...spline2([[-113.5, -61], [-109, -56.5], [-106.5, -49], [-104.5, -41]], 10, false), [-100, -36],
    ];
    const trig = mesh(extrudeXY(prof, 6, { bevel: 0.7 }), M.phos);
    const disc = mesh(extrudeXY([[-104, -29.5], [-121, -31], [-123, -27.5], [-117, -26], [-104, -26.5]], 5.2, { bevel: 0.5 }), M.phos);
    const spring = mesh(helixX(-100, -90, 3.2, 0.5, 5, -33, 0), M.spring);
    add('Trigger & disconnector',
      'The trigger pivots on its pin and releases the hammer. The disconnector riding on top catches the hammer after each shot in Semi, so the trigger must be let forward before the next shot.',
      group(trig, disc, spring, pin(...TRIG, 2)), [0, -95, 90], 0.45);
  }

  // --- Hammer (cocked) ---
  {
    const prof = [
      [-121, -26.5], [-124.5, -22.5], [-131, -19.5], [-146, -16.5], [-149.5, -18], [-148.5, -22.5],
      [-139, -25.5], [-134.5, -33], [-129, -37.5], [-122.5, -35],
    ];
    const hammer = mesh(extrudeXY(prof, 7.6, { bevel: 0.8 }), M.phos);
    const boss = mesh(cylZ(5.6, 5.6, 7.6, 24), M.phos, [...HAMMER, 0]);
    add('Hammer',
      'Spring-loaded hammer, shown cocked. When the trigger releases it, it swings up and forward and strikes the firing pin through the back of the bolt carrier.',
      group(hammer, boss, pin(...HAMMER, 2)), [-10, -60, 110], 0.5);
  }

  // --- Auto sear (M4A1) ---
  {
    const prof = [[-157, -24], [-145.5, -24], [-145, -18], [-148, -14.5], [-151, -13.5], [-153.5, -15.5], [-157, -18.5]];
    add('Auto sear',
      'Found only in automatic M4A1 lowers. With the selector on Auto, the bolt carrier trips it as it closes, releasing the hammer again for as long as the trigger is held.',
      group(mesh(extrudeXY(prof, 6, { bevel: 0.6 }), M.phos), pin(...AUTOSEAR, 1.6)), [-30, -30, 125], 0.55);
  }

  // --- Selector ---
  {
    const drum = mesh(cylZ(4.8, 4.8, 2 * W - 1, 24), M.phos, [...SELECTOR, 0]);
    const lever = extrudeXY([
      [SELECTOR[0] + 6, SELECTOR[1] + 3.5], [SELECTOR[0] + 21, SELECTOR[1] + 2.6], [SELECTOR[0] + 23, SELECTOR[1]],
      [SELECTOR[0] + 21, SELECTOR[1] - 2.6], [SELECTOR[0] + 6, SELECTOR[1] - 4.5], [SELECTOR[0] - 4, SELECTOR[1] - 5.5],
      [SELECTOR[0] - 6.5, SELECTOR[1]], [SELECTOR[0] - 4, SELECTOR[1] + 5],
    ], 2.4, { bevel: 0.6, z: -W - 1.4 });
    add('Selector (Safe · Semi · Auto)',
      'Fire selector on the left side. On Safe its drum blocks the trigger tail; Semi fires one shot per pull; Auto (M4A1) keeps firing while the trigger is held. Shown on Safe, lever pointing forward.',
      group(drum, mesh(lever, M.phosDark)), [0, -60, -90], 0.45);
  }

  // --- Bolt catch ---
  {
    const prof = [[-94, -19], [-82, -19], [-81, -24], [-85, -27], [-85, -33], [-82, -36], [-83, -39], [-93, -39], [-94, -34], [-91, -30], [-92, -24]];
    add('Bolt catch',
      'Holds the bolt open after the last round, when the magazine follower pushes it up. Pressing its upper paddle drops the bolt; pressing the lower one locks the bolt back.',
      group(mesh(extrudeXY(prof, 2.6, { bevel: 0.6, z: -W - 3.3 }), M.phos), mesh(cylZ(1.3, 1.3, 7, 12), M.steel, [-88, -22, -W])), [5, -40, -80], 0.4);
  }

  // --- Magazine catch & release ---
  {
    const button = mesh(cylZ(5.3, 5.3, 6.5, 28), M.phos, [MAGREL[0], MAGREL[1], W + 2.6]);
    const serr = [0, 1, 2].map((k) => mesh(cylZ(5.6, 5.6, 0.6, 28), M.phosDark, [MAGREL[0], MAGREL[1], W + 1 + k * 1.6]));
    const bar = rboxAt(MAGREL[0] - 4, MAGREL[0] + 4, MAGREL[1] - 3, MAGREL[1] + 3, -W + 0.5, W, 1, M.phos);
    const tooth = rboxAt(MAGREL[0] + 4, MAGREL[0] + 8.5, MAGREL[1] - 2.5, MAGREL[1] + 2, -8, -3, 0.5, M.phos);
    add('Magazine catch & release',
      'Push-button on the right. The catch bar runs across the lower and hooks into a notch in the magazine; the raised fence around the button guards against knocking it by accident.',
      group(button, ...serr, bar, tooth), [0, -85, 80], 0.4);
  }

  // --- Takedown & pivot pins ---
  add('Takedown & pivot pins',
    'Two captive pins join the receivers. Push the rear takedown pin across and the upper hinges open on the front pivot pin; push both out and the receivers separate.',
    group(pin(...PIVOT, 3.1, 4.6), pin(...TAKEDOWN, 3.1, 4.6)), [0, -40, 70], 0.35);

  // --- Receiver extension (buffer tube) ---
  {
    const R = D.tubeR, x1 = D.tubeEnd;
    const tube = mesh(latheX([[x1, 0], [x1, R - 1.2], [x1 + 1.2, R], [D.towerRear - 13, R], [D.towerRear - 13, R + 0.5], [D.towerFront - 1, R + 0.5], [D.towerFront - 1, 0]], 40), M.anod);
    const keel = rboxAt(x1 + 4, D.towerRear - 16, -R - 4.6, -R + 2, -4.3, 4.3, 1.2, M.anod);
    const holes = Array.from({ length: 6 }, (_, k) => mesh(new THREE.CircleGeometry(1.9, 14), M.hole, [x1 + 26 + k * 20.3, -R - 4.65, 0], [Math.PI / 2, 0, 0]));
    add('Receiver extension (buffer tube)',
      'Mil-spec carbine buffer tube: 7.25 in (184 mm) long and 1.148 in (29.2 mm) across, with six holes along its bottom rib for the stock latch. It houses the buffer and action spring.',
      group(tube, keel, ...holes), [-40, -45, 0], 0.2, true);
  }

  // --- Castle nut & end plate ---
  {
    const x = D.towerRear;
    const nut = mesh(latheX([[x - 13, D.tubeR], [x - 13, 17.8], [x - 3, 17.8], [x - 3, D.tubeR]], 40), M.phos);
    const notches = [0, 120, 240].map((a) => {
      const m = rboxAt(x - 13.2, x - 9, -2.4, 2.4, 16.2, 18.2, 0.3, M.phosDark);
      const g = group(m); g.rotation.x = a * DEG; return g;
    });
    const plate = mesh(latheX([[x - 3, D.tubeR], [x - 3, 17.2], [x, 17.2], [x, D.tubeR]], 40), M.phos);
    const loop = mesh(new THREE.TorusGeometry(5.5, 1.6, 8, 20), M.phos, [x - 1.5, -12, -21], [0, Math.PI / 2, 0]);
    add('Castle nut & end plate',
      'The castle nut locks the buffer tube in the lower receiver and is staked into the end plate so vibration cannot loosen it. The plate also keeps the rear takedown pin\'s detent spring in place and carries a sling loop.',
      group(nut, ...notches, plate, loop), [-15, -40, 50], 0.25);
  }

  // --- Buffer & action spring ---
  {
    const f = D.towerFront - 12;
    const buffer = mesh(latheX([[f - 82, 0], [f - 82, 10.5], [f - 80, 12.2], [f - 8, 12.2], [f - 6, 11], [f - 6, 0]], 32), M.steel);
    const bumper = mesh(latheX([[f - 6, 0], [f - 6, 9.5], [f - 1, 9], [f, 7.5], [f, 0]], 24), M.polymer);
    const spring = mesh(helixX(f - 82, D.tubeEnd + 2, 11.4, 1.05, 24), M.spring);
    add('Buffer & action spring',
      'The carbine buffer (steel, weighted with tungsten slugs) and the action spring soak up the bolt carrier\'s rearward travel, then drive it forward again to strip and chamber the next round.',
      group(buffer, bumper, spring), [-75, 70, 0], 0.3);
  }

  // --- B5 Enhanced SOPMOD buttstock (FDE) ---
  {
    const xr = D.butt + 12, xf = D.butt + 188; // 7.4 in body incl. pad, 4.9 in tall
    const prof = spline2([
      [xr, 26], [xr + 40, 27.5], [xr + 90, 25.5], [xr + 140, 21.5], [xf - 6, 19], [xf, 14],
      [xf, -18], [xf - 4, -25], [xf - 24, -30], [xf - 60, -40], [xf - 105, -62], [xf - 145, -86], [xr + 8, -98], [xr, -99], [xr - 0.5, -40],
    ], 110, true, 0.35);
    const body = mesh(extrudeXY(prof, 29, { bevel: 5, seg: 4 }), M.fde);
    // storage compartments moulded into both sides, each with a screw cap at the front
    const pods = [-1, 1].map((sd) => group(
      mesh(latheX([[xf - 112, 0], [xf - 110, 5], [xf - 104, 8.6], [xf - 94, 10], [xf - 4, 10], [xf - 4, 0]], 28), M.fde, [0, 0, sd * 13.5]),
      mesh(latheX([[xf - 4, 0], [xf - 4, 10.2], [xf + 2, 10.2], [xf + 3, 9], [xf + 3, 0]], 28), M.fdeDark, [0, 0, sd * 13.5]),
    ));
    // QD sling sockets on both sides, just behind the latch
    const qd = [-1, 1].map((sd) => group(
      mesh(cylZ(5.8, 5.8, 3, 24), M.phos, [xf - 22, -26, sd * 14.6]),
      mesh(cylZ(3.2, 3.2, 3.2, 16), M.hole, [xf - 22, -26, sd * 14.7]),
    ));
    const pad = mesh(extrudeXY(spline2([
      [D.butt, 29], [xr + 1, 29], [xr + 1, -102], [D.butt, -102], [D.butt - 1, -40],
    ], 60, true, 0.25), 33, { bevel: 3 }), M.rubber);
    const latch = rboxAt(xf - 34, xf - 8, -33.5, -24, -4.5, 4.5, 1.5, M.fdeDark);
    const bore = mesh(new THREE.CircleGeometry(D.tubeR + 0.3, 32), M.hole, [xf + 0.05, 0, 0], [0, Math.PI / 2, 0]);
    add('B5 Enhanced SOPMOD stock (FDE)',
      'The Block II buttstock, in flat dark earth: 7.4 in long and 4.9 in tall. It slides along the buffer tube; fully extended the carbine is 838 mm (33 in) long, collapsed 756 mm (29.75 in). The two moulded compartments hold three CR123 batteries each, and there are QD sling sockets on both sides.',
      group(body, ...pods, ...qd, pad, latch, bore), [-120, -20, 0], 0.2, true);
  }
}
