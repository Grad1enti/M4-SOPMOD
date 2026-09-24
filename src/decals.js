import * as THREE from 'three';

// Engraved markings (roll marks, selector marks, rail slot numbers). Each is a
// small plane carrying a canvas texture, laid a hair above the surface; the
// letters show the bare, lighter metal the way real engraving does.

/**
 * @param {number} w  width in mm
 * @param {number} h  height in mm
 * @param {(ctx: CanvasRenderingContext2D, px: number) => void} draw  px = pixels per mm
 */
export function decal(w, h, draw, { pxPerMm = 14, color = 0xb4b9bf, metalness = 0.55, roughness = 0.42 } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * pxPerMm);
  c.height = Math.ceil(h * pxPerMm);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  draw(ctx, pxPerMm);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    color, map: tex, transparent: true, depthWrite: false, metalness, roughness, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

export const font = (mm, px, weight = 600) => `${weight} ${Math.round(mm * px)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

/** Place a decal on a flat face. face: '+z' | '-z' | '+y' (top, text reading along +x from the right). */
export function stick(m, face, x, y, z) {
  m.position.set(x, y, z);
  if (face === '-z') m.rotation.y = Math.PI; // reads correctly from the left side
  if (face === '+y') m.rotation.x = -Math.PI / 2;
  return m;
}

/**
 * Slot numbers along the top of a Picatinny rail, on every other crossbar.
 * `teeth` are the crossbar centres (from railTeeth) and `first` the number of the first one.
 */
export function railNumbers(teeth, y, { first = 1, every = 2, color } = {}) {
  const x0 = teeth[0] - 5, x1 = teeth[teeth.length - 1] + 5;
  const m = decal(x1 - x0, 12, (ctx, px) => {
    ctx.font = font(3.6, px, 700);
    teeth.forEach((x, k) => {
      if (k % every) return;
      ctx.fillText(String(first + k), (x - x0) * px, 6 * px);
    });
  }, { pxPerMm: 10, color });
  return stick(m, '+y', (x0 + x1) / 2, y + 0.05, 0);
}
