import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// World units are millimetres. x runs along the bore (+ = muzzle), y is up,
// z is the rifle's right-hand side (ejection port side).

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const DEG = Math.PI / 180;

/**
 * Hollow shell swept through a list of rings (each ring is a closed loop of
 * [x, y, z] points, all rings the same length). The outer skin is offset
 * inward by `thick`; open ends and cut-outs are stitched so walls read solid.
 * `keep(i, j, centre)` can drop quads, e.g. to cut an ejection port.
 * The geometry has two material groups: 0 = outside, 1 = inside skin.
 */
export function sweep(rings, { thick = 0, keep = null } = {}) {
  const nu = rings.length - 1, N = rings[0].length;
  const P = rings.map((r) => r.map((p) => new THREE.Vector3(...p)));
  const at = (i, j) => P[i][(j + N) % N];
  const cen = P.map((r) => r.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / N));

  // vertex normals from neighbours, oriented away from each ring's centre
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const Nrm = P.map((r, i) => r.map((p, j) => {
    a.subVectors(at(Math.min(i + 1, nu), j), at(Math.max(i - 1, 0), j));
    b.subVectors(at(i, j + 1), at(i, j - 1));
    const n = new THREE.Vector3().crossVectors(a, b).normalize();
    d.subVectors(p, cen[i]);
    d.x = 0;
    return n.dot(d) < 0 ? n.negate() : n;
  }));
  // winding: make the first quad face along its outward normal
  a.subVectors(at(1, 0), at(0, 0));
  b.subVectors(at(0, 1), at(0, 0));
  const flip = new THREE.Vector3().crossVectors(a, b).dot(Nrm[0][0]) < 0;

  const on = [];
  const c = new THREE.Vector3();
  for (let i = 0; i < nu; i++) {
    on.push([]);
    for (let j = 0; j < N; j++) {
      c.copy(at(i, j)).add(at(i + 1, j)).add(at(i + 1, j + 1)).add(at(i, j + 1)).multiplyScalar(0.25);
      on[i].push(!keep || keep(i, j, c));
    }
  }
  const isOn = (i, j) => i >= 0 && i < nu && on[i][(j + N) % N];

  // index lists per material group: 0 = outer skin and cut edges, 1 = inner skin
  const pos = [], idx = [], idxIn = [];
  const push = (v) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };
  const quad = (A, B, C, D, rev, out = idx) => { if (rev) out.push(A, C, B, A, D, C); else out.push(A, B, C, A, C, D); };
  const outer = P.map((r) => r.map(push));
  const inner = thick > 0 ? P.map((r, i) => r.map((p, j) => push(p.clone().addScaledVector(Nrm[i][j], -thick)))) : null;
  const O = (i, j) => outer[i][(j + N) % N], I = (i, j) => inner[i][(j + N) % N];
  for (let i = 0; i < nu; i++) for (let j = 0; j < N; j++) {
    if (!on[i][j]) continue;
    quad(O(i, j), O(i + 1, j), O(i + 1, j + 1), O(i, j + 1), flip);
    if (!inner) continue;
    quad(I(i, j), I(i + 1, j), I(i + 1, j + 1), I(i, j + 1), !flip, idxIn);
    // stitch every edge that borders a missing quad (or the open ends)
    const wall = (p0, p1, q0, q1, rev) => {
      const o0 = push(P[p0[0]][(p0[1] + N) % N]), o1 = push(P[p1[0]][(p1[1] + N) % N]);
      const n0 = push(P[q0[0]][(q0[1] + N) % N].clone().addScaledVector(Nrm[q0[0]][(q0[1] + N) % N], -thick));
      const n1 = push(P[q1[0]][(q1[1] + N) % N].clone().addScaledVector(Nrm[q1[0]][(q1[1] + N) % N], -thick));
      quad(o0, o1, n1, n0, rev !== flip);
    };
    if (!isOn(i - 1, j)) wall([i, j + 1], [i, j], [i, j + 1], [i, j], false);
    if (!isOn(i + 1, j)) wall([i + 1, j], [i + 1, j + 1], [i + 1, j], [i + 1, j + 1], false);
    if (!isOn(i, j - 1)) wall([i, j], [i + 1, j], [i, j], [i + 1, j], false);
    if (!isOn(i, j + 1)) wall([i + 1, j + 1], [i, j + 1], [i + 1, j + 1], [i, j + 1], false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([...idx, ...idxIn]);
  g.addGroup(0, idx.length, 0);
  g.addGroup(idx.length, idxIn.length, 1);
  g.computeVertexNormals();
  return g;
}

/**
 * Loft along X through superellipse cross-sections.
 * sections: [{ x, y0, y1, hwBot, hwTop, zc?, e? }] - e is the superellipse exponent (2 = ellipse, higher = boxier)
 */
export function loftX(sections, around = 28, caps = true) {
  const pos = [], idx = [];
  const ring = (s) => {
    const e = s.e ?? 5, zc = s.zc ?? 0;
    const out = [];
    for (let k = 0; k < around; k++) {
      const t = (k / around) * Math.PI * 2;
      const c = Math.cos(t), sn = Math.sin(t);
      const ez = Math.sign(c) * Math.abs(c) ** (2 / e);
      const ey = Math.sign(sn) * Math.abs(sn) ** (2 / e);
      const yy = lerp(s.y0, s.y1, (ey + 1) / 2);
      const hw = lerp(s.hwBot, s.hwTop, (ey + 1) / 2);
      out.push([s.x, yy, zc + ez * hw]);
    }
    return out;
  };
  const rings = sections.map(ring);
  rings.forEach((r) => r.forEach((p) => pos.push(...p)));
  for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < around; k++) {
    const a = r * around + k, b = r * around + ((k + 1) % around);
    const c = (r + 1) * around + ((k + 1) % around), d = (r + 1) * around + k;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!caps) return g;
  const capGeo = (r, flip) => {
    const pts = rings[r];
    const cy = pts.reduce((s, p) => s + p[1], 0) / around;
    const cz = pts.reduce((s, p) => s + p[2], 0) / around;
    const cp = [pts[0][0], cy, cz, ...pts.flat()];
    const ci = [];
    for (let k = 0; k < around; k++) {
      const a = 1 + k, b = 1 + ((k + 1) % around);
      if (flip) ci.push(0, b, a); else ci.push(0, a, b);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setIndex(ci);
    cg.computeVertexNormals();
    return cg;
  };
  return mergeSimple([g, capGeo(0, false), capGeo(rings.length - 1, true)]);
}

/** Merge geometries keeping only position + normal (+ index). */
export function mergeSimple(geos) {
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    if (g.index) for (const i of g.index.array) idx.push(i + off);
    else for (let i = 0; i < p.length / 3; i++) idx.push(i + off);
    off += p.length / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Merge many same-kind geometries (e.g. rail teeth) into one draw call. */
export function merge(geos) {
  const clean = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  });
  return mergeGeometries(clean, false);
}

export function mesh(geo, mat, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

export const rbox = (w, h, d, r = 1, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
/** Rounded box given by its min / max corners. */
export function rboxAt(x0, x1, y0, y1, z0, z1, r = 1, mat) {
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) throw new Error(`rboxAt: inverted extents ${[x0, x1, y0, y1, z0, z1]}`);
  return mesh(rbox(x1 - x0, y1 - y0, z1 - z0, r), mat, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
}

/** Cylinder whose axis runs along X (default three.js cylinders run along Y). */
export function cylX(r1, r2, len, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** Cylinder whose axis runs along Z. */
export function cylZ(r1, r2, len, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Solid of revolution around the X axis. profile: [[x, r], ...] from back to front. */
export function latheX(profile, seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-4), x)), seg);
  g.rotateZ(-Math.PI / 2); // lathe axis Y -> X
  return g;
}

/**
 * Side-profile extrusion: a closed [x, y] outline pushed through `depth` along Z,
 * centred on z = 0 (or `z`). `bevel` rounds the edges without growing the outline.
 */
export function extrudeXY(pts, depth, { bevel = 0, holes = [], z = 0, seg = 3 } = {}) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const core = Math.max(0.05, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel,
    bevelSegments: seg, curveSegments: 16,
  });
  g.translate(0, 0, z - core / 2);
  return g;
}

/** Sample a smooth closed (or open) outline through control points. */
export function spline2(pts, n = 64, closed = true, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), closed, 'catmullrom', tension);
  return c.getPoints(n).slice(0, closed ? n : n + 1).map((p) => [p.x, p.y]);
}

/** Arc of points around (cx, cy), angles in degrees. */
export function arc(cx, cy, r, a0, a1, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n) * DEG;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Tube through a list of points. */
export function tube(points, r, seg = 64, radial = 10, tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

/** Coil spring along X from x0 to x1. */
export function helixX(x0, x1, R, wire, turns, y = 0, z = 0) {
  const pts = [];
  const n = Math.ceil(turns * 14);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(lerp(x0, x1, t), y + Math.cos(a) * R, z + Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6, false);
}

/** Cylinder between two points (for pins, links, shafts). */
export function rod(a, b, r, seg = 12, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

/**
 * MIL-STD-1913 (Picatinny) rail running along X, built upright on y = 0.
 * Cross-section per the standard: 21.2 mm across the dovetail, 45° flanks,
 * 5.23 mm slots on a 10.0 mm pitch. Returns one merged geometry.
 * Rotate the result about X to hang it at 3, 6 or 9 o'clock.
 */
export function picatinny(x0, x1, { h = 6.4, slots = true, spine = 15.6 } = {}) {
  const prof = [ // [z, y] half outline of one crossbar (mirrored)
    [spine / 2, 0], [spine / 2, 1.2], [10.6, 3.9], [10.6, 4.4], [8.6, h], [-8.6, h], [-10.6, 4.4], [-10.6, 3.9], [-spine / 2, 1.2], [-spine / 2, 0],
  ];
  const bar = (len) => {
    const s = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    g.rotateY(Math.PI / 2); // extrude +Z -> +X, shape z -> -z (symmetric anyway)
    return g;
  };
  const geos = [];
  if (!slots) {
    const g = bar(x1 - x0); g.translate(x0, 0, 0); geos.push(g);
    return merge(geos);
  }
  // slot floor spine along the full length
  const floor = new THREE.BoxGeometry(x1 - x0, h - 2.9, spine);
  floor.translate((x0 + x1) / 2, (h - 2.9) / 2, 0);
  geos.push(floor);
  for (const xc of railTeeth(x0, x1)) {
    const g = bar(RAIL_TOOTH);
    g.translate(xc - RAIL_TOOTH / 2, 0, 0);
    geos.push(g);
  }
  return merge(geos);
}
const RAIL_PITCH = 10.0, RAIL_SLOT = 5.23, RAIL_TOOTH = RAIL_PITCH - RAIL_SLOT;
/** Centres of the Picatinny crossbars between x0 and x1 (centred on the span). */
export function railTeeth(x0, x1) {
  const count = Math.floor((x1 - x0 + RAIL_SLOT) / RAIL_PITCH);
  const start = x0 + ((x1 - x0) - (count * RAIL_PITCH - RAIL_SLOT)) / 2;
  return Array.from({ length: count }, (_, k) => start + k * RAIL_PITCH + RAIL_TOOTH / 2);
}

/** Group helper */
export function group(...children) {
  const g = new THREE.Group();
  children.flat().forEach((c) => c && g.add(c));
  return g;
}

/** Catmull-Rom through [[s, value], ...] (s monotonic), evaluated at s. */
export function curve1d(pts, s) {
  const n = pts.length, dir = Math.sign(pts[n - 1][0] - pts[0][0]) || 1;
  let i = 0;
  while (i < n - 2 && (s - pts[i + 1][0]) * dir > 0) i++;
  const [s0, v0] = pts[i], [s1, v1] = pts[i + 1];
  const t = clamp((s - s0) / (s1 - s0));
  const slope = (a, b) => (pts[b][1] - pts[a][1]) / (pts[b][0] - pts[a][0]);
  const m0 = (i > 0 ? slope(i - 1, i + 1) : slope(i, i + 1)) * (s1 - s0);
  const m1 = (i < n - 2 ? slope(i, i + 2) : slope(i, i + 1)) * (s1 - s0);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1;
}

/** Skin a list of closed rings ([[x, y, z], ...], equal lengths) with optional flat end caps. */
export function ringLoft(rings, { cap0 = true, cap1 = true } = {}) {
  const N = rings[0].length, pos = [], idx = [];
  rings.forEach((r) => r.forEach((p) => pos.push(...p)));
  for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < N; k++) {
    const a = r * N + k, b = r * N + ((k + 1) % N), c = (r + 1) * N + ((k + 1) % N), d = (r + 1) * N + k;
    idx.push(a, b, c, a, c, d);
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setIndex(idx);
  side.computeVertexNormals();
  const geos = [side];
  const cap = (ring, flip) => {
    const c = ring.reduce((s, p) => [s[0] + p[0] / N, s[1] + p[1] / N, s[2] + p[2] / N], [0, 0, 0]);
    const cp = [...c, ...ring.flat()], ci = [];
    for (let k = 0; k < N; k++) { const a = 1 + k, b = 1 + ((k + 1) % N); if (flip) ci.push(0, b, a); else ci.push(0, a, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    g.setIndex(ci);
    g.computeVertexNormals();
    return g;
  };
  if (cap0) geos.push(cap(rings[0], true));
  if (cap1) geos.push(cap(rings[rings.length - 1], false));
  return mergeSimple(geos);
}
