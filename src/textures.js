import * as THREE from 'three';

// Procedural surface detail. Small tileable RGBA textures are generated at
// start-up (R = height for bump, G = colour variation, B = roughness variation)
// and applied with object-space triplanar mapping, so parts need no UVs and the
// single-file build needs no image assets. Units are millimetres.

const SIZE = 256;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const smooth = (t) => t * t * (3 - 2 * t);

/** Periodic value noise with cx x cy lattice cells per tile, values 0..1. */
function noise(cx, cy, seed) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: cx * cy }, r);
  const out = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const fy = (y / SIZE) * cy, iy = Math.floor(fy), ty = smooth(fy - iy);
    const y0 = iy % cy, y1 = (iy + 1) % cy;
    for (let x = 0; x < SIZE; x++) {
      const fx = (x / SIZE) * cx, ix = Math.floor(fx), tx = smooth(fx - ix);
      const x0 = ix % cx, x1 = (ix + 1) % cx;
      const a = lat[y0 * cx + x0], b = lat[y0 * cx + x1], c = lat[y1 * cx + x0], d = lat[y1 * cx + x1];
      out[y * SIZE + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}
/** Sum of octaves [[cellsX, cellsY, weight], ...], normalised to 0..1. */
function fbm(octaves, seed) {
  const out = new Float32Array(SIZE * SIZE);
  octaves.forEach(([cx, cy, w], k) => {
    const n = noise(cx, cy, seed + k * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * w;
  });
  return normalise(out);
}
function normalise(a) {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) / (hi - lo || 1);
  return a;
}
/** Randomly scattered round bumps (wrap-around), e.g. a moulded stipple. */
function bumps(count, rMin, rMax, seed) {
  const r = rng(seed), out = new Float32Array(SIZE * SIZE);
  for (let k = 0; k < count; k++) {
    const cx = r() * SIZE, cy = r() * SIZE, rad = rMin + r() * (rMax - rMin);
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad;
      if (d >= 1) continue;
      const i = ((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE);
      out[i] = Math.max(out[i], Math.sqrt(1 - d * d));
    }
  }
  return out;
}
/** Pyramid-shaped diamond checkering, `cells` diamonds across a tile. */
function checker(cells) {
  const out = new Float32Array(SIZE * SIZE);
  const tri = (t) => 1 - Math.abs(2 * (t - Math.floor(t)) - 1);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = (x / SIZE) * cells, v = (y / SIZE) * cells;
    out[y * SIZE + x] = Math.min(tri(u + v), tri(u - v)) ** 0.8;
  }
  return out;
}

function pack(h, c, r) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = h[i] * 255; data[i * 4 + 1] = c[i] * 255; data[i * 4 + 2] = r[i] * 255; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  const low = (seed) => fbm([[3, 3, 0.5], [6, 6, 0.3], [12, 12, 0.2]], seed);
  const grain = fbm([[96, 96, 0.5], [160, 160, 0.3], [48, 48, 0.2]], 11);
  const speck = fbm([[128, 128, 0.7], [64, 64, 0.3]], 23).map((v) => smooth(Math.min(1, Math.max(0, (v - 0.35) * 2.2))));
  const dots = bumps(700, 4, 8, 37);
  const fine = fbm([[64, 64, 0.6], [128, 128, 0.4]], 41);
  const streak = fbm([[4, 192, 0.6], [8, 96, 0.4]], 53);
  const chk = checker(8);
  TEX = {
    // bead-blasted, hard-anodised aluminium
    grain: pack(grain, low(1), fbm([[8, 8, 0.5], [64, 64, 0.5]], 2)),
    // crystalline manganese phosphate (parkerising)
    park: pack(speck, normalise(low(3).map((v, i) => v * 0.75 + speck[i] * 0.25)), normalise(speck.map((v, i) => v * 0.6 + fine[i] * 0.4))),
    // moulded polymer stipple
    stipple: pack(normalise(dots.map((v, i) => v * 0.85 + fine[i] * 0.15)), low(5), normalise(dots.map((v, i) => 1 - v * 0.7 + fine[i] * 0.3))),
    // diamond checkering, for grip side panels
    checker: pack(chk, low(7), chk.map((v) => 1 - v * 0.6)),
    rubber: pack(fine, low(9), fbm([[32, 32, 1]], 10)),
    // fine turning / grinding marks running along x
    brushed: pack(streak, low(13), streak),
  };
  return TEX;
}

/**
 * Surface presets, stored on materials as plain data (material.userData.surface).
 * scale: tile size in mm; macro: how many tiles the slow colour / roughness drift spans;
 * color / rough: variation amounts; bump: relief depth in mm; wear: edge-wear strength.
 */
export const SURF = {
  anodized: { tex: 'grain', scale: 12, macro: 16, color: 0.09, rough: 0.1, bump: 0.02, wear: 0.5, wearColor: 0x8e9398 },
  phosphate: { tex: 'park', scale: 9, macro: 14, color: 0.3, rough: 0.22, bump: 0.02, wear: 0.4, wearColor: 0x8d9197 },
  cerakote: { tex: 'grain', scale: 12, macro: 14, color: 0.12, rough: 0.14, bump: 0.015, wear: 0.35, wearColor: 0xb2aea6 },
  polymer: { tex: 'stipple', scale: 10, macro: 18, color: 0.1, rough: 0.14, bump: 0.05, wear: 0.12, wearColor: 0xc2ad8c },
  grip: { tex: 'stipple', side: 'checker', scale: 10, macro: 18, color: 0.1, rough: 0.16, bump: 0.18, wear: 0.1, wearColor: 0xc2ad8c },
  rubber: { tex: 'rubber', scale: 6, macro: 20, color: 0.1, rough: 0.08, bump: 0.03, wear: 0 },
  magazine: { tex: 'grain', scale: 12, macro: 10, color: 0.12, rough: 0.22, bump: 0.015, wear: 0.55, wearColor: 0x8a8f95 },
  steel: { tex: 'brushed', scale: 14, macro: 10, color: 0.1, rough: 0.14, bump: 0.004, wear: 0 },
  chrome: { tex: 'brushed', scale: 18, macro: 10, color: 0.04, rough: 0.06, bump: 0.002, wear: 0 },
  brass: { tex: 'grain', scale: 10, macro: 8, color: 0.14, rough: 0.12, bump: 0.004, wear: 0 },
};

const VERT_DECL = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNrm;`;

const FRAG_DECL = /* glsl */ `
uniform sampler2D triTex;
uniform sampler2D triSide;
uniform vec4 triA; // x = tiles per mm, y = macro factor, z = colour variation, w = roughness variation
uniform vec4 triB; // x = bump depth (mm), y = edge wear
uniform vec3 triWearColor;
varying vec3 vTriPos;
varying vec3 vTriNrm;
vec3 triW;
vec4 triMicro;
vec4 triMacro;
float triWear;
vec4 triSample(sampler2D t, sampler2D s, vec3 p) {
  return texture2D(t, p.yz) * triW.x + texture2D(t, p.zx) * triW.y + texture2D(s, p.xy) * triW.z;
}`;

const FRAG_COLOR = /* glsl */ `
{
  vec3 an = pow(abs(normalize(vTriNrm)), vec3(4.0));
  triW = an / (an.x + an.y + an.z);
  vec3 p = vTriPos * triA.x;
  triMicro = triSample(triTex, triSide, p);
  triMacro = triSample(triTex, triTex, p * triA.y + 0.37);
  float cv = (triMicro.g - 0.5) * 0.3 + (triMacro.g - 0.5) * 1.5;
  diffuseColor.rgb *= max(0.0, 1.0 + triA.z * cv);
  // edge wear: bright where the surface curves sharply (bevels, corners), broken up by noise,
  // and only once a pixel is small enough to resolve it
  float fp = length(fwidth(vViewPosition));
  float curv = length(fwidth(vNormal)) / max(fp, 1e-4);
  float nearby = 1.0 - smoothstep(0.2, 0.7, fp);
  triWear = smoothstep(0.3, 1.1, curv) * smoothstep(0.4, 0.75, triMacro.r * 0.6 + triMicro.r * 0.4) * nearby * triB.y;
  diffuseColor.rgb = mix(diffuseColor.rgb, triWearColor, clamp(triWear, 0.0, 1.0));
}`;

const FRAG_ROUGH = /* glsl */ `
roughnessFactor = clamp(roughnessFactor + triA.w * ((triMicro.b - 0.5) * 0.6 + (triMacro.b - 0.5)) - triWear * 0.25, 0.04, 1.0);`;

const FRAG_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, 0.85, clamp(triWear, 0.0, 1.0));`;

const FRAG_NORMAL = /* glsl */ `
{
  // bump from the triplanar height (surface-gradient method, heights in mm)
  float h = triMicro.r * triB.x;
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1) * faceDirection;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  normal = normalize(abs(det) * normal - grad);
}`;

/** Give a (cloned) standard material its procedural surface, if it has a preset. */
export function applySurface(mat) {
  const s = mat.userData.surface;
  if (!s || !mat.isMeshStandardMaterial) return;
  const T = textures();
  const uniforms = {
    triTex: { value: T[s.tex] },
    triSide: { value: T[s.side || s.tex] },
    triA: { value: new THREE.Vector4(1 / s.scale, 1 / s.macro, s.color, s.rough) },
    triB: { value: new THREE.Vector4(s.bump, s.wear || 0, 0, 0) },
    triWearColor: { value: new THREE.Color(s.wearColor ?? 0x888888) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERT_DECL}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position;\nvTriNrm = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>${FRAG_ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>${FRAG_METAL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${FRAG_NORMAL}`);
  };
  mat.customProgramCacheKey = () => 'triplanar-v1';
}
