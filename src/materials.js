import * as THREE from 'three';
import { SURF } from './textures.js';

/** Standard material with an optional procedural surface preset (see textures.js). */
const std = (color, roughness = 0.5, metalness = 0, surface = null, extra = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide, ...extra });
  if (surface) m.userData.surface = SURF[surface];
  return m;
};

export const M = {
  // type III hard-anodised 7075 aluminium (receivers, rail)
  anod: std(0x34373b, 0.5, 0.5, 'anodized'),
  anodDark: std(0x222428, 0.54, 0.45, 'anodized'),
  inside: std(0x121315, 0.85, 0.2), // unlit-looking inner walls seen through openings
  // manganese-phosphate (parkerised) steel: barrel, pins, castle nut
  phos: std(0x3c3d3e, 0.6, 0.55, 'phosphate'),
  phosDark: std(0x262728, 0.62, 0.5, 'phosphate'),
  // flat dark earth polymer furniture
  fde: std(0x8b7657, 0.8, 0.0, 'polymer'),
  fdeDark: std(0x6f5e45, 0.84, 0.0, 'polymer'),
  grip: std(0x8b7657, 0.78, 0.0, 'grip'), // A2 grip: checkered side panels
  // FDE Cerakote over aluminium
  fdeMetal: std(0x8a7558, 0.62, 0.2, 'cerakote'),
  rubber: std(0x1b1c1d, 0.9, 0.0, 'rubber'),
  polymer: std(0x232426, 0.72, 0.05, 'polymer'),
  chrome: std(0xc9ccd0, 0.16, 1.0, 'chrome'),
  steel: std(0x8d9196, 0.34, 0.9, 'steel'),
  spring: std(0x6f7378, 0.36, 0.85, 'steel'),
  brass: std(0xc9a14a, 0.3, 0.95, 'brass'),
  copper: std(0xb8733d, 0.3, 0.9, 'brass'),
  greenTip: std(0x3f7a3a, 0.5, 0.2),
  magAlu: std(0x3c3e41, 0.64, 0.35, 'magazine'), // dry-film-lube coated aluminium magazine
  follower: std(0x8a7a52, 0.7, 0.0),
  hole: std(0x050506, 1.0, 0.0), // fake openings (magwell, stock bore)
  white: std(0xe8e6e0, 0.6, 0.0),
};
