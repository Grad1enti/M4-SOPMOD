# M4A1 SOPMOD: 3D exploded view

Interactive, stylized 3D model of an M4A1 carbine in SOPMOD configuration with flat dark
earth (FDE) furniture.

**Open `m4-sopmod.html`**. It is one self-contained file (three.js bundled, no CDN, no
network needed), so you can copy it to a phone and open it in Chrome.

- Drag to orbit, pinch or scroll to zoom, tap a part for its name and description
- **Pull apart** slider explodes the parts (staggered, with dashed guide lines)
- Category chips show one group at a time with the receivers, barrel and stock as a ghosted outline
- Light/dark mode follows the system (the half-moon button forces light or dark) and `prefers-reduced-motion` is respected

Proportions use published dimensions: overall length 838 mm stock extended (756 mm collapsed),
14.5 in (368 mm) barrel, mil-spec carbine buffer tube 7.25 in × 1.148 in, STANAG 30-round
magazine, MIL-STD-1913 rail (0.835 in across, 0.394 in slot pitch). See `src/dims.js`.

## Build

```sh
npm install
npm run build        # -> dist/index.html and m4-sopmod.html
npm run shot out.png explode=0.6 cat=lower   # headless screenshot (uses /opt/pw-browsers/chromium)
```

Source: `src/parts/*.js` hold the parts, one module per category. World units are millimetres,
x along the bore (+ towards the muzzle), y up, z to the rifle's right.
