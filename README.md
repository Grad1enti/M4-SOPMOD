# M4A1 SOPMOD Block II: 3D exploded view

Interactive, stylized 3D model of an M4A1 carbine in SOPMOD Block II configuration with
flat dark earth (FDE) furniture: 42 parts in six groups.

**Open `m4-sopmod.html`**. It is one self-contained file (three.js bundled, no CDN, no
network needed), so you can copy it to a phone and open it in Chrome.

- Drag to orbit, pinch or scroll to zoom, tap a part for its name and description
- **Pull apart** slider explodes the parts (staggered, with dashed guide lines); portrait
  screens get a taller layout, landscape a wider one
- Category chips show one group at a time, with the receivers, barrel, rail and stock as a
  ghosted outline; the camera re-frames onto the chosen group
- Light/dark mode follows the system (the half-moon button forces light or dark) and
  `prefers-reduced-motion` is respected

## Groups

| Group | Parts |
| --- | --- |
| Upper receiver | M4A1 flat-top upper with 1913 rail and ejection port, charging handle, dust cover, forward assist |
| Lower receiver & stock | M4A1 lower, trigger & disconnector, hammer, auto sear, selector, bolt catch, magazine catch, takedown & pivot pins, trigger guard, FDE A2 grip, 30-round magazine, buffer tube, castle nut & end plate, buffer & spring, B5 Enhanced SOPMOD stock (FDE) |
| Bolt carrier group | carrier, gas key, bolt, extractor, cam pin, firing pin, retaining pin |
| Barrel & handguard | 14.5 in barrel, barrel nut, gas tube, front sight base / gas block, Daniel Defense M4A1 FSP RIS II upper and lower halves (FDE), FDE rail panels, KAC NT4 flash hider |
| Optics & sights | EOTech 553 (SU-231/PEQ), G33 3× magnifier on STS mount, KAC folding rear sight, front sight post |
| SOPMOD accessories | AN/PEQ-15 (ATPIAL), Insight M3X light, FDE vertical foregrip, KAC QDSS-NT4 suppressor |

## Dimensions used

All proportions come from published figures (see `src/dims.js` and the part modules):
overall length 838 mm stock extended / 756 mm collapsed, 14.5 in (368 mm) barrel from the bolt
face, mil-spec carbine buffer tube 7.25 in × 1.148 in, STANAG 30-round magazine
(~190 × 65 × 22 mm), MIL-STD-1913 rail (0.835 in across, 0.394 in slot pitch), sight line
~2.6 in over the bore; RIS II 12.25 × 2.23 × 2.25 in, EOTech 553 4.9 × 1.8 × 2.8 in,
G33 4.4 in, PEQ-15 4.6 × 2.8 × 1.6 in, M3X 4.1 × 1.7 × 1.6 in, QDSS-NT4 6.4 × 1.5 in,
B5 Enhanced SOPMOD stock 7.4 × 4.9 in.

## Build

```sh
npm install
npm run build        # -> dist/index.html and m4-sopmod.html
npm run shot out.png explode=0.6 cat=lower   # headless screenshot (uses /opt/pw-browsers/chromium)
```

`npm run shot` also takes `view=az,el,zoom`, `select=Part name`, `theme=dark`, `reduced=1`,
`w=` and `h=`.

Source: `src/parts/{upper,lower,bcg,barrel,optics,sopmod}.js` hold the parts, one module per
group. World units are millimetres: x along the bore (+ towards the muzzle), y up, z to the
rifle's right. `src/registry.js` handles pull-apart, ghosting, highlighting and merges each
part's meshes by material to keep draw calls low on phones.
