import * as THREE from 'three';

const std = (color, roughness = 0.5, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide, ...extra });

export const M = {
  // type III hard-anodised 7075 aluminium (receivers, rail)
  anod: std(0x34373b, 0.46, 0.5),
  anodDark: std(0x222428, 0.5, 0.45),
  inside: std(0x121315, 0.85, 0.2), // unlit-looking inner walls seen through openings
  // manganese-phosphate (parkerised) steel: barrel, pins, castle nut
  phos: std(0x3a3b3c, 0.58, 0.55),
  phosDark: std(0x242526, 0.6, 0.5),
  // flat dark earth polymer furniture
  fde: std(0x8b7657, 0.85, 0.0),
  fdeDark: std(0x6f5e45, 0.88, 0.0),
  // FDE Cerakote over aluminium
  fdeMetal: std(0x8a7558, 0.66, 0.15),
  rubber: std(0x1b1c1d, 0.92, 0.0),
  polymer: std(0x232426, 0.75, 0.05),
  chrome: std(0xc9ccd0, 0.18, 1.0),
  steel: std(0x8d9196, 0.35, 0.9),
  spring: std(0x6f7378, 0.35, 0.85),
  brass: std(0xc9a14a, 0.3, 0.95),
  copper: std(0xb8733d, 0.3, 0.9),
  greenTip: std(0x3f7a3a, 0.5, 0.2),
  magAlu: std(0x3c3e41, 0.68, 0.35), // dry-film-lube coated aluminium magazine
  follower: std(0x8a7a52, 0.7, 0.0),
  hole: std(0x050506, 1.0, 0.0), // fake openings (magwell, stock bore)
  white: std(0xe8e6e0, 0.6, 0.0),
};
