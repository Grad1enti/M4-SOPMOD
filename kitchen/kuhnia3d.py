"""Права кухня – 3D модел. Генерира kuhnia3d.json (за 3D прегледа) и kuhnia-3d.dxf.

Оси (мм): x – по стената отляво надясно, y – нагоре от пода, z – навън от стената.
Всеки детайл е паралелепипед [x0, y0, z0, x1, y1, z1], изчислен от params.py,
така че 3D моделът съвпада с 2D чертежа и разкроя.
"""
import json
from pathlib import Path

import ezdxf
from ezdxf import units
from ezdxf.render import forms

from params import *  # noqa: F401,F403

OUT = Path(__file__).resolve().parent

parts = []
movers = []


def part(pos, name, kind, x0, y0, z0, x1, y1, z1, mover=None, shape="box", whole=None):
    """whole – размерите на целия детайл, когато е моделиран от няколко парчета."""
    parts.append({
        "pos": pos, "name": name, "kind": kind, "shape": shape,
        "box": [round(v, 1) for v in (x0, y0, z0, x1, y1, z1)],
        **({"mover": mover} if mover else {}),
        **({"whole": [round(v, 1) for v in whole]} if whole else {}),
    })


def hinge(mid, x, side):
    """Врата на панти: върти се около вертикална ос по ръба на фронта."""
    movers.append({"id": mid, "type": "hinge", "pivot": [x, 0, Y_FRONT],
                   "angle": -100 if side == "L" else 100})


def slide(mid, dz):
    movers.append({"id": mid, "type": "slide", "pivot": [0, 0, 0], "offset": dz})


def flap(mid, y):
    movers.append({"id": mid, "type": "flap", "pivot": [0, y, Y_FRONT], "angle": 85})


def legs(pos, a, b):
    for xc in (a + 60, b - 60):
        for zc in (60, Y_CARC1 - PLINTH_SET - 16 - 40):
            part(pos, "Краче", "metal", xc - 20, 0, zc - 20, xc + 20, PL, zc + 20, shape="cyl")


def base_carcass(pos, a, b, sink=False, shelf=False):
    part(pos, "Страница", "korpus", a, PL, Y_CARC0, a + T, CARC_TOP, Y_CARC1)
    part(pos, "Страница", "korpus", b - T, PL, Y_CARC0, b, CARC_TOP, Y_CARC1)
    part(pos, "Дъно", "korpus", a + T, PL, Y_CARC0, b - T, PL + T, Y_CARC1)
    if sink:
        part(pos, "Бленда вертикална", "korpus", a + T, CARC_TOP - BLEND, Y_CARC1 - T,
             b - T, CARC_TOP, Y_CARC1)
        part(pos, "Бленда вертикална", "korpus", a + T, CARC_TOP - BLEND, Y_CARC0,
             b - T, CARC_TOP, Y_CARC0 + T)
    else:
        part(pos, "Бленда", "korpus", a + T, CARC_TOP - T, Y_CARC1 - BLEND, b - T, CARC_TOP, Y_CARC1)
        part(pos, "Бленда", "korpus", a + T, CARC_TOP - T, Y_CARC0, b - T, CARC_TOP, Y_CARC0 + BLEND)
    part(pos, "Гръб HDF", "hdf", a + 2, PL + 2, 0, b - 2, CARC_TOP - 2, HDF)
    if shelf:
        sy = PL + T + (CH - 3 * T) / 2
        part(pos, "Рафт", "korpus", a + T + 0.5, sy, Y_CARC0, b - T - 0.5, sy + T, Y_CARC0 + SHELF_D)
    legs(pos, a, b)


h = GAP / 2

# --- Поз. 1: колона за хладилник -----------------------------------------
a, b, _ = MOD_X[1]
part(1, "Страница колона", "korpus", a, PL, Y_CARC0, a + T, COL_TOP, Y_CARC1)
part(1, "Страница колона", "korpus", b - T, PL, Y_CARC0, b, COL_TOP, Y_CARC1)
part(1, "Дъно колона", "korpus", a + T, PL, Y_CARC0, b - T, PL + T, Y_CARC1)
part(1, "Междинна полица", "korpus", a + T, COL_TOP - T, Y_CARC1 - NAD_D, b - T, COL_TOP, Y_CARC1)
part(1, "Хладилник BOSCH KIN86ADD0", "fridge", a + 21, PL + T + 2, Y_CARC1 - 545,
     a + 21 + 558, PL + T + 2 + 1772, Y_CARC1)
hinge("m1", a + h, "L")
part(1, "Фронт хладилник", "front", a + h, PL, Y_CARC1, b - h, FR_TOP, Y_FRONT, mover="m1")
legs(1, a, b)

# --- Поз. 2: надстойка ----------------------------------------------------
z0 = Y_CARC1 - NAD_D + HDF
part(2, "Страница надстойка", "korpus", a, COL_TOP, z0, a + T, TOP, Y_CARC1)
part(2, "Страница надстойка", "korpus", b - T, COL_TOP, z0, b, TOP, Y_CARC1)
part(2, "Дъно надстойка", "korpus", a + T, COL_TOP, z0, b - T, COL_TOP + T, Y_CARC1)
part(2, "Таван надстойка", "korpus", a + T, TOP - T, z0, b - T, TOP, Y_CARC1)
part(2, "Гръб надстойка HDF", "hdf", a + 2, COL_TOP + 2, z0 - HDF, b - 2, TOP - 2, z0)
hinge("m2", a + h, "L")
part(2, "Фронт надстойка", "front", a + h, NAD_FR0, Y_CARC1, b - h, TOP, Y_FRONT, mover="m2")

# --- Поз. 3: съдомиялна ---------------------------------------------------
a, b, _ = MOD_X[3]
part(3, "Съдомиялна TEKA DFI 46900", "appliance", a + 1, PL, Y_CARC1 - 550, b - 1, 818, Y_CARC1 - 22)
part(3, "Съдомиялна – основа (зад цокъла)", "appliance", a + 1, 2, Y_CARC1 - 550, b - 1, PL,
     Y_CARC1 - PLINTH_SET - 16 - 5)
flap("m3", PL)
part(3, "Врата съдомиялна", "appliance", a + 1, 100, Y_CARC1 - 22, b - 1, 818, Y_CARC1, mover="m3")
part(3, "Фронт съдомиялна", "front", a + h, PL, Y_CARC1, b - h, FRONT_TOP, Y_FRONT, mover="m3")

# --- Поз. 4: бутилки, карго 150 ------------------------------------------
a, b, _ = MOD_X[4]
base_carcass(4, a, b)
slide("m4", 450)
part(4, "Фронт карго", "front", a + h, PL, Y_CARC1, b - h, FRONT_TOP, Y_FRONT, mover="m4")
cx0, cx1 = a + T + 7, b - T - 7
CARGO = (cx1 - cx0, 760 - 140, Y_CARC1 - 5 - 60)
for yy in (300, 620):
    part(4, "Карго 150 (схематично)", "metal", cx0, yy, 60, cx1, yy + 3, Y_CARC1 - 5, mover="m4",
         whole=CARGO)
    for xx in (cx0, cx1 - 3):
        part(4, "Карго 150 (схематично)", "metal", xx, yy, 60, xx + 3, yy + 60, Y_CARC1 - 5,
             mover="m4", whole=CARGO)
part(4, "Карго 150 (схематично)", "metal", cx0, 140, Y_CARC1 - 25, cx1, 760, Y_CARC1 - 5,
     mover="m4", whole=CARGO)

# --- Поз. 5: мивка --------------------------------------------------------
a, b, _ = MOD_X[5]
xm = (a + b) / 2
base_carcass(5, a, b, sink=True)
hinge("m5l", a + h, "L")
hinge("m5r", b - h, "R")
part(5, "Врата мивка", "front", a + h, PL, Y_CARC1, xm - h, FRONT_TOP, Y_FRONT, mover="m5l")
part(5, "Врата мивка", "front", xm + h, PL, Y_CARC1, b - h, FRONT_TOP, Y_FRONT, mover="m5r")

# --- Поз. 6: три чекмеджета ----------------------------------------------
a, b, _ = MOD_X[6]
base_carcass(6, a, b)
dh = (FRONT_H - 2 * GAP) / 3
for i in range(3):
    y0 = PL + i * (dh + GAP)
    mid = f"m6_{i}"
    slide(mid, 420)
    part(6, "Фронт чекмедже", "front", a + h, y0, Y_CARC1, b - h, y0 + dh, Y_FRONT, mover=mid)
    bx0, bx1 = a + T + 13, b - T - 13
    by0, by1 = y0 + 35, y0 + dh - 50
    bz0, bz1 = Y_CARC1 - 505, Y_CARC1 - 5
    box = (bx1 - bx0, by1 - by0, bz1 - bz0)
    part(6, "Кутия чекмедже (схематично)", "drawer", bx0, by0, bz0, bx1, by0 + 12, bz1, mover=mid,
         whole=box)
    part(6, "Кутия чекмедже (схематично)", "drawer", bx0, by0, bz0, bx0 + 12, by1, bz1, mover=mid,
         whole=box)
    part(6, "Кутия чекмедже (схематично)", "drawer", bx1 - 12, by0, bz0, bx1, by1, bz1, mover=mid,
         whole=box)
    part(6, "Кутия чекмедже (схематично)", "drawer", bx0 + 12, by0, bz0, bx1 - 12, by1, bz0 + 12, mover=mid,
         whole=box)
    part(6, "Кутия чекмедже (схематично)", "drawer", bx0 + 12, by0, bz1 - 12, bx1 - 12, by1, bz1, mover=mid,
         whole=box)

# --- Поз. 7 и 8: врата + рафт --------------------------------------------
for pos, side in ((7, "L"), (8, "R")):
    a, b, _ = MOD_X[pos]
    base_carcass(pos, a, b, shelf=True)
    mid = f"m{pos}"
    hinge(mid, a + h if side == "L" else b - h, side)
    part(pos, "Врата", "front", a + h, PL, Y_CARC1, b - h, FRONT_TOP, Y_FRONT, mover=mid)

# --- Плот с отвор за мивка -----------------------------------------------
SINK_OUT = (xm - 390, 80, xm + 390, 520)      # борд на мивката (x0, z0, x1, z1)
SINK_IN = (xm - 340, 120, xm + 340, 480)      # корито
SINK_DEPTH = 180
SINK_W = (SINK_OUT[2] - SINK_OUT[0], SINK_DEPTH + 1, SINK_OUT[3] - SINK_OUT[1])
ya, yb = CARC_TOP, CARC_TOP + WT
TOP_W = (ROOM_L - MOD_X[3][0], WT, WD)
sx0, sz0, sx1, sz1 = SINK_IN
part("3–8", "Плот с отвор за мивка", "plot", MOD_X[3][0], ya, 0, sx0, yb, WD, whole=TOP_W)
part("3–8", "Плот с отвор за мивка", "plot", sx1, ya, 0, ROOM_L, yb, WD, whole=TOP_W)
part("3–8", "Плот с отвор за мивка", "plot", sx0, ya, 0, sx1, yb, sz0, whole=TOP_W)
part("3–8", "Плот с отвор за мивка", "plot", sx0, ya, sz1, sx1, yb, WD, whole=TOP_W)
ox0, oz0, ox1, oz1 = SINK_OUT
part(5, "Мивка (ориентировъчно)", "inox", ox0, yb, oz0, ox1, yb + 1, sz0, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", ox0, yb, sz1, ox1, yb + 1, oz1, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", ox0, yb, sz0, sx0, yb + 1, sz1, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", sx1, yb, sz0, ox1, yb + 1, sz1, whole=SINK_W)
bot = yb - SINK_DEPTH
part(5, "Мивка (ориентировъчно)", "inox", sx0, bot, sz0, sx1, bot + 1, sz1, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", sx0, bot, sz0, sx0 + 1, yb, sz1, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", sx1 - 1, bot, sz0, sx1, yb, sz1, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", sx0, bot, sz0, sx1, yb, sz0 + 1, whole=SINK_W)
part(5, "Мивка (ориентировъчно)", "inox", sx0, bot, sz1 - 1, sx1, yb, sz1, whole=SINK_W)
part(5, "Сифон", "dark", xm - 25, bot + 1, 275, xm + 25, bot + 2, 325, shape="cyl")

# --- Цокъл ----------------------------------------------------------------
pz0, pz1 = Y_CARC1 - PLINTH_SET - 16, Y_CARC1 - PLINTH_SET
part("1–8", "Цокъл", "cokal", 0, 0, pz0, MOD_X[3][0], PL - 2, pz1)
part("1–8", "Цокъл (пред съдомиялната)", "cokal", MOD_X[3][0], 0, pz0, MOD_X[3][1], PL - 2, pz1)
part("1–8", "Цокъл", "cokal", MOD_X[3][1], 0, pz0, ROOM_L, PL - 2, pz1)
part(1, "Вентилационна решетка", "dark", 100, 20, pz1, 500, 80, pz1 + 1)

# --- Размерни линии (стойността се изчислява от точките) -------------------
dims = []


def dim(p0, p1, off):
    dims.append({"a": p0, "b": p1, "off": off})


xs = [0] + [MOD_X[p][1] for p, _, _ in MODULES]
for x0, x1 in zip(xs, xs[1:]):
    dim([x0, 0, 800], [x1, 0, 800], [0, 0, 0])
dim([0, ROOM_H - 60, 30], [ROOM_L, ROOM_H - 60, 30], [0, 0, 0])          # дължина по стената
dim([ROOM_L - 30, 0, 30], [ROOM_L - 30, ROOM_H, 30], [0, 0, 0])          # височина на помещението
for y0, y1 in ((0, PL), (PL, CARC_TOP), (CARC_TOP, CARC_TOP + WT)):
    dim([ROOM_L - 60, y0, 700], [ROOM_L - 60, y1, 700], [0, 0, 0])
dim([MOD_X[8][0], 0, 700], [MOD_X[8][0], CARC_TOP + WT, 700], [0, 0, 0])  # работна височина
for y0, y1 in ((0, PL), (PL, COL_TOP), (COL_TOP, TOP), (TOP, ROOM_H)):
    dim([60, y0, 700], [60, y1, 700], [0, 0, 0])
dim([MOD_X[6][0] + 300, CARC_TOP + WT, 0], [MOD_X[6][0] + 300, CARC_TOP + WT, WD], [0, 0, 0])
dim([300, PL + T, Y_FRONT + 20], [300, PL + T + NICHE, Y_FRONT + 20], [0, 0, 0])  # ниша

model = {
    "units": "mm",
    "room": {"length": ROOM_L, "height": ROOM_H},
    "parts": parts,
    "movers": movers,
    "dims": dims,
}
(OUT / "kuhnia3d.json").write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")))
print("parts", len(parts), "movers", len(movers))

# --- 3D DXF (MESH), оста Z на AutoCAD е нагоре ----------------------------
doc = ezdxf.new("R2018")
doc.units = units.MM
COLORS = {"korpus": 7, "hdf": 33, "front": 4, "plot": 30, "cokal": 8, "fridge": 9,
          "appliance": 9, "metal": 8, "drawer": 8, "inox": 9, "dark": 250}
for kind, color in COLORS.items():
    doc.layers.add(kind.upper(), color=color)
msp = doc.modelspace()
for p in parts:
    x0, y0, z0, x1, y1, z1 = p["box"]
    # (x, y_нагоре, z_навън) -> DXF (x, -z, y)
    w, d, hh = x1 - x0, z1 - z0, y1 - y0
    if p["shape"] == "cyl":
        m = forms.cylinder(count=16, radius=0.5, top_center=(0, 0, 1), caps=True)
    else:
        m = forms.cube(center=False)
    m.scale(w, d, hh).translate(x0, -z1, y0)
    m.render_mesh(msp, dxfattribs={"layer": p["kind"].upper()})
doc.saveas(OUT / "kuhnia-3d.dxf")
print("saved kuhnia-3d.dxf")
