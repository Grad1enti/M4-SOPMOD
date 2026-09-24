import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Registry, CATEGORIES, catById } from './registry.js';
import { buildUpper } from './parts/upper.js';
import { buildLower } from './parts/lower.js';
import { buildBCG } from './parts/bcg.js';
import { buildBarrel } from './parts/barrel.js';

const $ = (id) => document.getElementById(id);
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedMQ.matches;

// ---------- renderer / scene (units: millimetres) ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;
const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(300, 800, 600);
const rim = new THREE.DirectionalLight(0xdfe6ff, 0.9);
rim.position.set(-400, 300, -700);
scene.add(key, rim, new THREE.HemisphereLight(0xeef2f7, 0x40382e, 0.55));

const camera = new THREE.PerspectiveCamera(34, 1, 5, 30000);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 150;
controls.maxDistance = 8000;
controls.enableDamping = !reduced;
controls.dampingFactor = 0.09;
controls.zoomToCursor = false;

// ---------- parts ----------
const reg = new Registry(scene);
reg.root.add(reg.guides);
buildUpper(reg);
buildLower(reg);
buildBCG(reg);
buildBarrel(reg);

// Each part's assembled bounding box; framing and the contact shadow derive from these.
const LIFT = 120; // the rifle rises as it comes apart so parts pushed down stay above the shadow
reg.root.updateMatrixWorld(true);
for (const p of reg.parts) p.box = new THREE.Box3().setFromObject(p.outer);
const ALL = reg.parts.reduce((b, p) => b.union(p.box), new THREE.Box3());
const SIZE = ALL.getSize(new THREE.Vector3());
const SHADOW_Y = ALL.min.y - 40;

// soft contact shadow (canvas-generated, no external assets)
const shadow = (() => {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 64, 4, 128, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.42)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.setTransform(2, 0, 0, 1, -128, 0);
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE.x * 1.3, Math.max(SIZE.z, 60) * 5),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(ALL.getCenter(new THREE.Vector3()).x, SHADOW_Y, 0);
  m.renderOrder = -1;
  scene.add(m);
  return m;
})();

// ---------- state ----------
const state = { explodeTarget: 0, explode: 0, cat: 'all', selected: null, dirty: true };

// ---------- camera framing ----------
// The camera target and distance blend from a fit of the assembled rifle to a fit
// of the pulled-apart parts, so the exploded view fills the screen on phones and
// desktops. Picking a group re-fits smoothly to that group (plus the ghosted outline).
// Portrait phones have spare height, so the parts spread taller there and the
// default view turns further round to shorten the rifle on screen.
const LAYOUTS = {
  portrait: { az: 40, el: 16, spread: new THREE.Vector3(0.85, 1.45, 1.15) },
  landscape: { az: 24, el: 12, spread: new THREE.Vector3(1.15, 0.9, 1.1) },
};
const layoutKey = () => (innerWidth < innerHeight * 0.9 ? 'portrait' : 'landscape');
let layout = null;
const cam = {
  zoom: 1, // user zoom relative to the fitted distance
  pan: new THREE.Vector3(), // user pan relative to the fitted centre
  goal: null, cur: null, // { c0, c1, d0, d1 } fitted centres / distances, assembled and exploded
  busy: false, // true while the user is dragging
};
function viewport() {
  const w = innerWidth, h = innerHeight;
  const panel = document.querySelector('.panel').getBoundingClientRect();
  const top = document.querySelector('.top').getBoundingClientRect();
  const free = Math.max(200, panel.top - top.bottom);
  return { w, h, free, offset: (h - (top.bottom + free / 2)) - h / 2 };
}
/** Distance that fits `box` seen along `dir` (unit vector from target to camera) into the free area. */
function fitDistance(box, dir) {
  const { free } = viewport();
  const c = box.getCenter(new THREE.Vector3());
  const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  const up = dir.clone().cross(right);
  let hx = 0, hy = 0, hz = 0;
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c);
    hx = Math.max(hx, Math.abs(p.dot(right))); hy = Math.max(hy, Math.abs(p.dot(up))); hz = Math.max(hz, Math.abs(p.dot(dir)));
  }
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (free / innerHeight);
  const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
  return Math.max(hx / th, hy / tv) * 1.1 + hz;
}
/** Fit for the current category, seen along `dir`. */
function computeFit(dir) {
  const b0 = new THREE.Box3(), b1 = new THREE.Box3();
  for (const p of reg.parts) {
    const active = state.cat === 'all' || p.cat === state.cat;
    if (!active && !p.shell) continue;
    b0.union(p.box);
    // pulled apart, frame just the active group; the ghosted outline may run off-screen
    if (active) b1.union(p.box.clone().translate(p.dir));
  }
  b1.translate(new THREE.Vector3(0, LIFT, 0));
  return {
    c0: b0.getCenter(new THREE.Vector3()), c1: b1.getCenter(new THREE.Vector3()),
    d0: fitDistance(b0, dir), d1: fitDistance(b1, dir),
  };
}
const viewDir = (az, el) => {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
};
const currentDir = () => camera.position.clone().sub(controls.target).normalize();
const fitAt = (f, t) => THREE.MathUtils.lerp(f.d0, f.d1, t);
const centerAt = (f, t) => f.c0.clone().lerp(f.c1, t);
/** Place the camera from the current fit, explode amount, user zoom / pan, keeping its direction. */
function applyCamera(dir = currentDir()) {
  controls.target.copy(centerAt(cam.cur, state.explode)).add(cam.pan);
  camera.position.copy(controls.target).addScaledVector(dir, fitAt(cam.cur, state.explode) * cam.zoom);
  state.dirty = true;
}
function setView(az = LAYOUTS[layout].az, el = LAYOUTS[layout].el, scale = 1) {
  const dir = viewDir(az, el);
  cam.goal = computeFit(dir);
  cam.cur = { ...cam.goal, c0: cam.goal.c0.clone(), c1: cam.goal.c1.clone() };
  cam.zoom = scale;
  cam.pan.set(0, 0, 0);
  applyCamera(dir);
  controls.update();
}
/** Re-fit for a new category; the frame loop eases cam.cur towards it. */
function refit() {
  if (!cam.cur) return;
  cam.goal = computeFit(currentDir());
  if (reduced) { cam.cur = cam.goal; applyCamera(); }
}
function resize() {
  const { w, h, offset } = viewport();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.setViewOffset(w, h, 0, offset, w, h);
  camera.updateProjectionMatrix();
  state.dirty = true;
}
/** Apply the portrait / landscape spread; returns true if it changed. */
function applyLayout() {
  const k = layoutKey();
  if (k === layout) return false;
  layout = k;
  reg.setSpread(LAYOUTS[k].spread);
  return true;
}
addEventListener('resize', () => {
  resize();
  if (applyLayout()) setView(); // turning the phone re-frames; plain resizes keep the user's view
  else refit();
});
resize();
applyLayout();
setView();

// ---------- UI ----------
const chips = $('chips');
const chipDefs = [{ id: 'all', label: 'All', color: null }, ...CATEGORIES.filter((c) => reg.parts.some((p) => p.cat === c.id))];
for (const c of chipDefs) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.dataset.cat = c.id;
  b.innerHTML = (c.color ? `<span class="cat-dot" style="background:${c.color}"></span>` : '') + c.label;
  b.addEventListener('click', () => setCategory(c.id));
  chips.append(b);
}
function setCategory(cat) {
  state.cat = cat;
  for (const b of chips.children) b.setAttribute('aria-checked', String(b.dataset.cat === cat));
  reg.setFilter(cat);
  refit();
  if (reduced) reg.updateFade(Infinity);
  if (state.selected && reg.parts[state.selected.id].alphaTarget !== 1) select(null);
  const n = reg.parts.filter((p) => p.alphaTarget === 1).length;
  $('stat').textContent = `${n} parts`;
  state.dirty = true;
}
setCategory('all');

const slider = $('explode');
slider.addEventListener('input', () => { state.explodeTarget = slider.value / 100; state.dirty = true; hideHint(); });

$('resetView').addEventListener('click', () => setView());

// theme: follow the system, or force light / dark (remembered per device)
const THEMES = ['system', 'light', 'dark'];
let theme = 'system';
try { theme = localStorage.getItem('m4-theme') || 'system'; } catch { /* storage unavailable */ }
function applyTheme(t) {
  theme = THEMES.includes(t) ? t : 'system';
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  $('theme').setAttribute('aria-label', `Colour theme: ${theme === 'system' ? 'follows system' : theme}`);
  try { localStorage.setItem('m4-theme', theme); } catch { /* ignore */ }
  state.dirty = true;
}
applyTheme(theme);
$('theme').addEventListener('click', () => applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]));

// info card
function select(part) {
  if (state.selected) reg.highlight(state.selected, false);
  state.selected = part;
  const info = $('info');
  if (!part) { info.hidden = true; state.dirty = true; return; }
  reg.highlight(part, true);
  const c = catById[part.cat];
  $('infoDot').style.background = c.color;
  $('infoCat').textContent = c.label;
  $('infoName').textContent = part.name;
  $('infoDesc').textContent = part.desc;
  info.hidden = false;
  state.dirty = true;
}
$('infoClose').addEventListener('click', () => select(null));
addEventListener('keydown', (e) => { if (e.key === 'Escape') select(null); });

// tap to pick (ignore drags / pinches)
const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now(), multi: false } : (down && (down.multi = true), down);
  hideHint();
});
canvas.addEventListener('pointerup', (e) => {
  if (!down || !e.isPrimary || down.multi) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved > 8 || performance.now() - down.t > 600) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(reg.pickables(), false)[0];
  const part = hit ? hit.object.userData.part : null;
  select(part && part !== state.selected ? part : null);
});
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; $('hint').classList.add('gone'); } }

controls.addEventListener('change', () => { state.dirty = true; });
reducedMQ.addEventListener('change', (e) => { reduced = e.matches; controls.enableDamping = !reduced; });

// ---------- loop ----------
let lastT = performance.now();
/** Remember the user's zoom and pan relative to the fit, so pulling apart keeps them. */
function captureUser() {
  cam.zoom = camera.position.distanceTo(controls.target) / fitAt(cam.cur, state.explode);
  cam.pan.copy(controls.target).sub(centerAt(cam.cur, state.explode));
}
controls.addEventListener('start', () => { cam.busy = true; });
controls.addEventListener('end', () => { cam.busy = false; captureUser(); });
let lastExplode = -1;
function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (reduced) state.explode = state.explodeTarget;
  else state.explode += (state.explodeTarget - state.explode) * Math.min(1, dt * 7);
  if (Math.abs(state.explode - state.explodeTarget) < 1e-4) state.explode = state.explodeTarget;
  // parts follow the slider directly; they only animate on their own when the
  // filter changes (ghosted parts glide back into the outline)
  let animating = false;
  if (reg.update(state.explode, reduced ? Infinity : dt)) { state.dirty = true; animating = true; }
  // ease the fit towards the current category's fit
  let moved = state.explode !== lastExplode;
  if (cam.goal !== cam.cur) {
    const k = Math.min(1, dt * 5);
    const c = cam.cur, g = cam.goal;
    c.c0.lerp(g.c0, k); c.c1.lerp(g.c1, k);
    c.d0 += (g.d0 - c.d0) * k; c.d1 += (g.d1 - c.d1) * k;
    if (c.c0.distanceTo(g.c0) + c.c1.distanceTo(g.c1) + Math.abs(g.d0 - c.d0) + Math.abs(g.d1 - c.d1) < 0.05) cam.cur = cam.goal;
    moved = true;
  }
  if (moved && !cam.busy) applyCamera();
  animating ||= moved;
  if (state.explode !== lastExplode) {
    reg.root.position.y = state.explode * LIFT;
    shadow.material.opacity = 1 - state.explode * 0.5;
    lastExplode = state.explode;
    state.dirty = true;
  }
  if (reg.updateFade(reduced ? Infinity : dt)) { state.dirty = true; animating = true; }
  state.idleFrames = animating || state.explode !== state.explodeTarget ? 0 : (state.idleFrames || 0) + 1;
  if (controls.update()) {
    state.dirty = true;
    if (!cam.busy) captureUser(); // damping keeps moving the camera after the drag ends
  }
  if (state.dirty) {
    renderer.render(scene, camera);
    state.dirty = false;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Small API used by the headless screenshot script (and handy from devtools).
window.app = {
  ready: true,
  reg,
  setExplode(v, instant) {
    state.explodeTarget = v; slider.value = String(Math.round(v * 100));
    if (instant) state.explode = v;
    state.dirty = true;
  },
  setCategory(c) { setCategory(c); reg.updateFade(Infinity); cam.cur = cam.goal; applyCamera(); },
  setView(az, el, s) { setView(az, el, s); },
  setTheme: applyTheme,
  selectByName(n) { select(reg.parts.find((p) => p.name === n) || null); },
  /** Resolves once every animation (parts, fades, camera) has come to rest. */
  settle: () => new Promise((r) => {
    const t0 = performance.now();
    const check = () => (state.idleFrames > 3 || performance.now() - t0 > 8000 ? r() : setTimeout(check, 50));
    setTimeout(check, 100);
  }),
  parts: () => reg.parts.map((p) => `${p.cat}: ${p.name}`),
};
