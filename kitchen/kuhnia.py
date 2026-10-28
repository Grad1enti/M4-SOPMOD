"""Права кухня – долен ред. Генерира kuhnia.dxf (+ PDF/PNG преглед).

Всички размери са в мм, чертежът е в мащаб 1:1 в моделното пространство.
"""
import sys
from pathlib import Path

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment

OUT = Path(__file__).resolve().parent

# --- Параметри -------------------------------------------------------------
ROOM_L, ROOM_H = 3800, 2600
T = 18            # ПДЧ
HDF = 3           # гръб
PL = 100          # цокъл
CH = 720          # височина на долен корпус
WT = 38           # плот
D = 560           # дълбочина на корпус
WD = 600          # дълбочина на плот
FT = 18           # дебелина на фронт
GAP = 3           # фуга между фронтове
CEIL_GAP = 20     # отстояние до тавана
NICHE = 1777      # ниша за BOSCH KIN86ADD0 (по инструкция 1775–1780)
VENT = 40         # вентилационен канал зад надстойката
SHELF_D = 520     # дълбочина на рафт
BLEND = 100       # ширина на бленда
PLINTH_SET = 50   # отстъп на цокъла от корпуса

TOP = ROOM_H - CEIL_GAP              # 2580 – горен ръб на колоната
CARC_TOP = PL + CH                   # 820 – горен ръб на долните корпуси
FRONT_TOP = CARC_TOP - GAP           # 817 – горен ръб на долните фронтове
FRONT_H = FRONT_TOP - PL             # 717
COL_TOP = PL + T + NICHE + T         # 1913 – горен ръб на колоната за хладилник
NAD_H = TOP - COL_TOP                # 667 – височина на надстойката
NAD_D = D - VENT                     # 520 – дълбочина на надстойката (с гърба)
FR_TOP = COL_TOP - 2                 # 1911 – горен ръб на фронта на хладилника
NAD_FR0 = COL_TOP + 1                # 1914 – долен ръб на фронта на надстойката

# Отстояния в дълбочина, измерени от стената
Y_CARC0 = HDF                        # 3   – заден ръб на страниците
Y_CARC1 = HDF + D                    # 563 – преден ръб на корпуса
Y_FRONT = Y_CARC1 + FT               # 581 – лице на фронтовете

# Модули отляво надясно: (поз., ширина, тип)
MODULES = [
    (1, 600, "fridge"),
    (3, 600, "dw"),
    (4, 200, "bottle"),
    (5, 1000, "sink"),
    (6, 600, "drawers"),
    (7, 400, "door_L"),
    (8, 400, "door_R"),
]
assert sum(m[1] for m in MODULES) == ROOM_L, "модулите не запълват стената"

x = 0
MOD_X = {}
for pos, w, kind in MODULES:
    MOD_X[pos] = (x, x + w, kind)
    x += w

# --- Документ --------------------------------------------------------------
doc = ezdxf.new("R2018", setup=True)
doc.units = units.MM
doc.header["$INSUNITS"] = 4
doc.header["$MEASUREMENT"] = 1
doc.header["$LTSCALE"] = 20
doc.styles.add("BG", font="arial.ttf")

LAYERS = {
    "СТЕНИ": (8, "CONTINUOUS", 50),
    "КОРПУСИ": (7, "CONTINUOUS", 35),
    "ФРОНТОВЕ": (4, "CONTINUOUS", 35),
    "ПЛОТ": (30, "CONTINUOUS", 35),
    "СКРИТИ": (8, "DASHED2", 18),
    "ОТВАРЯНЕ": (1, "DASHED", 13),
    "УРЕДИ": (5, "DASHED2", 18),
    "РАЗРЕЗ": (7, "CONTINUOUS", 50),
    "ЩРИХОВКА": (8, "CONTINUOUS", 13),
    "ОСИ": (6, "DASHDOT", 18),
    "РАЗМЕРИ": (3, "CONTINUOUS", 13),
    "ТЕКСТ": (7, "CONTINUOUS", 18),
    "РАМКА": (7, "CONTINUOUS", 50),
}
for name, (color, lt, lw) in LAYERS.items():
    doc.layers.add(name, color=color, linetype=lt, lineweight=lw)

ds = doc.dimstyles.duplicate_entry("EZDXF", "КУХНЯ")
ds.dxf.dimtxsty = "BG"
ds.dxf.dimtxt = 40
ds.dxf.dimasz = 25
ds.dxf.dimblk = "ARCHTICK"
ds.dxf.dimexe = 20
ds.dxf.dimexo = 15
ds.dxf.dimgap = 10
ds.dxf.dimdec = 0
ds.dxf.dimlfac = 1
ds.dxf.dimpost = ""
ds.dxf.dimtad = 1
ds.dxf.dimclrd = 3
ds.dxf.dimclre = 3
ds.dxf.dimclrt = 7

msp = doc.modelspace()


def rect(x0, y0, x1, y1, layer):
    msp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True,
                       dxfattribs={"layer": layer})


def line(p0, p1, layer):
    msp.add_line(p0, p1, dxfattribs={"layer": layer})


def text(x, y, s, h=40, align=TextEntityAlignment.MIDDLE_CENTER, layer="ТЕКСТ", rot=0):
    t = msp.add_text(s, height=h, rotation=rot,
                     dxfattribs={"layer": layer, "style": "BG"})
    t.set_placement((x, y), align=align)
    return t


def hatch_rect(x0, y0, x1, y1, scale=6):
    h = msp.add_hatch(color=8, dxfattribs={"layer": "ЩРИХОВКА"})
    h.set_pattern_fill("ANSI31", scale=scale)
    h.paths.add_polyline_path([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], is_closed=True)


def solid_rect(x0, y0, x1, y1, scale=6):
    """Разрязан детайл: контур + щриховка."""
    hatch_rect(x0, y0, x1, y1, scale)
    rect(x0, y0, x1, y1, "РАЗРЕЗ")


def hdim(x0, x1, y, base_y=None, text_override=None):
    d = msp.add_linear_dim(base=(x0, y), p1=(x0, base_y if base_y is not None else y),
                           p2=(x1, base_y if base_y is not None else y), angle=0,
                           dimstyle="КУХНЯ", dxfattribs={"layer": "РАЗМЕРИ"},
                           text=text_override or "<>")
    d.render()


def vdim(y0, y1, x, base_x=None, text_override=None):
    d = msp.add_linear_dim(base=(x, y0), p1=(base_x if base_x is not None else x, y0),
                           p2=(base_x if base_x is not None else x, y1), angle=90,
                           dimstyle="КУХНЯ", dxfattribs={"layer": "РАЗМЕРИ"},
                           text=text_override or "<>")
    d.render()


def hchain(xs, y, base_y):
    for a, b in zip(xs, xs[1:]):
        hdim(a, b, y, base_y)


def vchain(ys, x, base_x):
    for a, b in zip(ys, ys[1:]):
        vdim(a, b, x, base_x)


def door_symbol(x0, y0, x1, y1, hinge):
    """Знак за отваряне – върхът на триъгълника сочи страната на пантите."""
    ym = (y0 + y1) / 2
    if hinge == "L":
        line((x1, y0), (x0, ym), "ОТВАРЯНЕ")
        line((x1, y1), (x0, ym), "ОТВАРЯНЕ")
    else:
        line((x0, y0), (x1, ym), "ОТВАРЯНЕ")
        line((x0, y1), (x1, ym), "ОТВАРЯНЕ")


def pos_marker(x, y, n, r=45):
    msp.add_circle((x, y), r, dxfattribs={"layer": "ТЕКСТ"})
    text(x, y, str(n), h=45)


# ===========================================================================
# 1. ФРОНТАЛЕН ИЗГЛЕД
# ===========================================================================
# Стени, под, таван
W_T = 150
hatch_rect(-W_T, -W_T, 0, ROOM_H + W_T, scale=12)
hatch_rect(ROOM_L, -W_T, ROOM_L + W_T, ROOM_H + W_T, scale=12)
hatch_rect(0, ROOM_H, ROOM_L, ROOM_H + W_T, scale=12)
hatch_rect(0, -W_T, ROOM_L, 0, scale=12)
rect(0, 0, ROOM_L, ROOM_H, "СТЕНИ")
rect(-W_T, -W_T, ROOM_L + W_T, ROOM_H + W_T, "СТЕНИ")

# Цокъл (вижда се под фронтовете)
rect(0, 0, ROOM_L, PL, "КОРПУСИ")
x0, x1, _ = MOD_X[1]
rect(x0 + 100, 20, x1 - 100, 80, "КОРПУСИ")        # вентилационна решетка
for i in range(int(x0 + 120), int(x1 - 100), 30):
    line((i, 30), (i, 70), "КОРПУСИ")

# Плот
rect(MOD_X[3][0], CARC_TOP, ROOM_L, CARC_TOP + WT, "ПЛОТ")

# Поз. 1 – колона за хладилник, поз. 2 – надстойка
x0, x1, _ = MOD_X[1]
h = GAP / 2
rect(x0 + h, PL, x1 - h, FR_TOP, "ФРОНТОВЕ")                 # фронт хладилник
rect(x0 + h, NAD_FR0, x1 - h, TOP, "ФРОНТОВЕ")               # фронт надстойка
door_symbol(x0 + h, PL, x1 - h, FR_TOP, "L")
door_symbol(x0 + h, NAD_FR0, x1 - h, TOP, "L")
# скрити: ниша и уред
rect(x0 + T, PL + T, x1 - T, PL + T + NICHE, "СКРИТИ")
rect(x0 + 21, PL + T + 2, x0 + 21 + 558, PL + T + 2 + 1772, "УРЕДИ")
text((x0 + x1) / 2, 1250, "BOSCH", h=45, layer="УРЕДИ")
text((x0 + x1) / 2, 1190, "KIN86ADD0", h=45, layer="УРЕДИ")
text((x0 + x1) / 2, 1130, "ниша 1777×560", h=30, layer="УРЕДИ")
pos_marker((x0 + x1) / 2, 1450, 1)
pos_marker((x0 + x1) / 2, (COL_TOP + TOP) / 2, 2)

# Поз. 3 – съдомиялна
x0, x1, _ = MOD_X[3]
rect(x0 + h, PL, x1 - h, FRONT_TOP, "ФРОНТОВЕ")
rect(x0 + 1, PL + 2, x1 - 1, CARC_TOP - 2, "УРЕДИ")
text((x0 + x1) / 2, 530, "TEKA", h=40, layer="УРЕДИ")
text((x0 + x1) / 2, 475, "DFI 46900", h=40, layer="УРЕДИ")
text((x0 + x1) / 2, 420, "декоративен фронт", h=28, layer="УРЕДИ")
pos_marker((x0 + x1) / 2, 660, 3)

# Поз. 4 – бутилки (карго)
x0, x1, _ = MOD_X[4]
rect(x0 + h, PL, x1 - h, FRONT_TOP, "ФРОНТОВЕ")
for yy in (300, 620):                                   # нива на карго
    line((x0 + T + 5, yy), (x1 - T - 5, yy), "СКРИТИ")
text((x0 + x1) / 2, 460, "карго 150", h=28, rot=90)
pos_marker((x0 + x1) / 2, 720, 4, r=40)

# Поз. 5 – мивка, 2 врати, вертикални бленди
x0, x1, _ = MOD_X[5]
xm = (x0 + x1) / 2
rect(x0 + h, PL, xm - h, FRONT_TOP, "ФРОНТОВЕ")
rect(xm + h, PL, x1 - h, FRONT_TOP, "ФРОНТОВЕ")
door_symbol(x0 + h, PL, xm - h, FRONT_TOP, "L")
door_symbol(xm + h, PL, x1 - h, FRONT_TOP, "R")
rect(x0 + T, CARC_TOP - BLEND, x1 - T, CARC_TOP, "СКРИТИ")   # предна вертикална бленда
text(xm, 300, "вертикални бленди", h=28)
pos_marker(xm, 660, 5)

# Поз. 6 – три еднакви чекмеджета
x0, x1, _ = MOD_X[6]
dh = (FRONT_H - 2 * GAP) / 3
for i in range(3):
    y0 = PL + i * (dh + GAP)
    rect(x0 + h, y0, x1 - h, y0 + dh, "ФРОНТОВЕ")
    line((x0 + 200, y0 + dh - 50), (x1 - 200, y0 + dh - 50), "ОТВАРЯНЕ")
pos_marker((x0 + x1) / 2, 660, 6)

# Поз. 7 и 8 – врата + рафт
for pos, hinge in ((7, "L"), (8, "R")):
    x0, x1, _ = MOD_X[pos]
    rect(x0 + h, PL, x1 - h, FRONT_TOP, "ФРОНТОВЕ")
    door_symbol(x0 + h, PL, x1 - h, FRONT_TOP, hinge)
    sy = PL + T + (CH - 2 * T - T) / 2                 # рафт по средата
    rect(x0 + T, sy, x1 - T, sy + T, "СКРИТИ")
    pos_marker((x0 + x1) / 2, 660, pos)

# Граници между модулите (корпуси зад фронтовете)
for pos in (4, 5, 6, 7, 8):
    xa = MOD_X[pos][0]
    line((xa, PL), (xa, CARC_TOP), "СКРИТИ")
line((MOD_X[1][1], PL), (MOD_X[1][1], TOP), "КОРПУСИ")

# Размери – фронтален изглед
xs = [0] + [MOD_X[p][1] for p, _, _ in MODULES]
hchain(xs, -250, 0)
hdim(0, ROOM_L, -400, 0)
vchain([0, PL, CARC_TOP, CARC_TOP + WT], ROOM_L + 300, ROOM_L)
vdim(0, CARC_TOP + WT, ROOM_L + 500, ROOM_L)
vchain([0, PL, COL_TOP, TOP, ROOM_H], -300, 0)
vdim(0, ROOM_H, -500, 0)
vdim(PL + T, PL + T + NICHE, MOD_X[1][1] - 120, MOD_X[1][1] - T)
# височини на чекмеджетата
x1 = MOD_X[6][1]
for i in range(3):
    y0 = PL + i * (dh + GAP)
    vdim(y0, y0 + dh, x1 - 60, x1 - h)

text(ROOM_L / 2, ROOM_H + 330, "ФРОНТАЛЕН ИЗГЛЕД", h=90)

# ===========================================================================
# 2. ПЛАН (изглед отгоре)
# ===========================================================================
PY = -1100                         # линия на задната стена в плана


def py(d):
    return PY - d


hatch_rect(-W_T, PY, ROOM_L + W_T, PY + W_T, scale=12)
hatch_rect(-W_T, py(900), 0, PY, scale=12)
hatch_rect(ROOM_L, py(900), ROOM_L + W_T, PY, scale=12)
line((0, PY), (ROOM_L, PY), "СТЕНИ")
line((0, PY), (0, py(900)), "СТЕНИ")
line((ROOM_L, PY), (ROOM_L, py(900)), "СТЕНИ")

# Колона + надстойка (виждат се отгоре)
x0, x1, _ = MOD_X[1]
rect(x0, py(Y_CARC0), x1, py(Y_CARC1), "КОРПУСИ")
rect(x0 + T, py(Y_CARC0), x1 - T, py(Y_CARC1 - NAD_D), "СКРИТИ")    # вент. канал
rect(x0 + h, py(Y_CARC1), x1 - h, py(Y_FRONT), "ФРОНТОВЕ")
text((x0 + x1) / 2, py(23), "вент. канал 40", h=22)
text((x0 + x1) / 2, py(330), "колона", h=40)
text((x0 + x1) / 2, py(390), "H=2580", h=35)
pos_marker((x0 + x1) / 2, py(200), 1)

# Плот
x0 = MOD_X[3][0]
rect(x0, py(0), ROOM_L, py(WD), "ПЛОТ")
text((MOD_X[6][0] + ROOM_L) / 2, py(470), "плот 3200×600×38", h=40)
# Скрити корпуси и фронтове под плота
for pos, w, kind in MODULES[1:]:
    a, b, _ = MOD_X[pos]
    if kind != "dw":
        rect(a, py(Y_CARC0), b, py(Y_CARC1), "СКРИТИ")
    line((a, py(Y_CARC1)), (a, py(Y_FRONT)), "СКРИТИ")
    pos_marker((a + b) / 2, py(Y_FRONT + 200), pos, r=40)
line((MOD_X[3][0], py(Y_FRONT)), (ROOM_L, py(Y_FRONT)), "СКРИТИ")
# Мивка (ориентировъчно)
a, b, _ = MOD_X[5]
xm = (a + b) / 2
msp.add_lwpolyline([(xm - 390, py(80)), (xm + 390, py(80)), (xm + 390, py(520)),
                    (xm - 390, py(520))], close=True,
                   dxfattribs={"layer": "ПЛОТ", "const_width": 0})
rect(xm - 340, py(120), xm + 340, py(480), "ПЛОТ")
msp.add_circle((xm, py(300)), 25, dxfattribs={"layer": "ПЛОТ"})
text(xm, py(50), "мивка – по избор (ориентировъчно)", h=26)
text((MOD_X[3][0] + MOD_X[3][1]) / 2, py(300), "съдомиялна", h=35, layer="УРЕДИ")

# Сечения (линии на разрезите)
for letter, xc in (("A", (MOD_X[7][0] + MOD_X[7][1]) / 2),
                   ("B", MOD_X[5][0] + 250),
                   ("C", (MOD_X[1][0] + MOD_X[1][1]) / 2)):
    line((xc, py(-60)), (xc, py(720)), "ОСИ")
    for yy, dy in ((py(-60), 1), (py(720), -1)):
        line((xc, yy), (xc - 80, yy), "РАЗРЕЗ")
        text(xc - 130, yy, letter, h=60)

# Размери в плана
xs = [0] + [MOD_X[p][1] for p, _, _ in MODULES]
hchain(xs, py(1000), py(Y_FRONT))
vchain([py(WD), py(0)], ROOM_L + 300, ROOM_L)
vchain([py(Y_FRONT), py(Y_CARC1), py(Y_CARC1 - NAD_D), py(0)], -300, 0)
text(ROOM_L / 2, py(1200), "ПЛАН (ИЗГЛЕД ОТГОРЕ)", h=90)

# ===========================================================================
# 3. РАЗРЕЗИ (страничен изглед: ляво – стената, дясно – лицето)
# ===========================================================================


def base_section(sx, title, sink=False, shelf=False):
    def X(d):
        return sx + d

    hatch_rect(X(-W_T), -W_T, X(0), 1200, scale=12)
    hatch_rect(X(-W_T), -W_T, X(800), 0, scale=12)
    line((X(0), 0), (X(0), 1200), "СТЕНИ")
    line((X(0), 0), (X(800), 0), "СТЕНИ")
    # далечна страница (вижда се)
    rect(X(Y_CARC0), PL, X(Y_CARC1), CARC_TOP, "КОРПУСИ")
    # гръб HDF
    solid_rect(X(0), PL + 2, X(HDF), CARC_TOP - 2, scale=1)
    # дъно
    solid_rect(X(Y_CARC0), PL, X(Y_CARC1), PL + T)
    # бленди
    if sink:
        solid_rect(X(Y_CARC0), CARC_TOP - BLEND, X(Y_CARC0 + T), CARC_TOP)
        solid_rect(X(Y_CARC1 - T), CARC_TOP - BLEND, X(Y_CARC1), CARC_TOP)
        # мивка, ориентировъчно
        msp.add_lwpolyline([(X(80), CARC_TOP + WT), (X(80), CARC_TOP - 180),
                            (X(520), CARC_TOP - 180), (X(520), CARC_TOP + WT)],
                           dxfattribs={"layer": "СКРИТИ"})
        text(X(300), CARC_TOP - 260, "мивка", h=30)
        text(X(300), 450, "вертикални", h=30)
        text(X(300), 410, "бленди 100×18", h=30)
    else:
        solid_rect(X(Y_CARC0), CARC_TOP - T, X(Y_CARC0 + BLEND), CARC_TOP)
        solid_rect(X(Y_CARC1 - BLEND), CARC_TOP - T, X(Y_CARC1), CARC_TOP)
    if shelf:
        sy = PL + T + (CH - 2 * T - T) / 2
        solid_rect(X(Y_CARC0), sy, X(Y_CARC0 + SHELF_D), sy + T)
        text(X(280), sy + 60, "рафт", h=30)
    # врата
    solid_rect(X(Y_CARC1), PL, X(Y_FRONT), FRONT_TOP)
    # плот
    solid_rect(X(0), CARC_TOP, X(WD), CARC_TOP + WT, scale=10)
    # цокъл и крачета
    solid_rect(X(Y_CARC1 - PLINTH_SET - 16), 0, X(Y_CARC1 - PLINTH_SET), PL - 2)
    for d in (60, Y_CARC1 - PLINTH_SET - 70):
        rect(X(d), 0, X(d + 40), PL, "СКРИТИ")
    # размери
    vchain([0, PL, CARC_TOP, CARC_TOP + WT], X(WD + 180), X(WD))
    if shelf:
        vchain([PL + T, sy, sy + T, CARC_TOP - T], X(-280), X(Y_CARC0))
    if sink:
        vdim(CARC_TOP - BLEND, CARC_TOP, X(-280), X(Y_CARC0))
    hchain([X(0), X(Y_CARC1), X(Y_FRONT)], 1050, CARC_TOP + WT)
    hdim(X(0), X(WD), 1180, CARC_TOP + WT)
    text(X(330), -260, title, h=60)


def column_section(sx):
    def X(d):
        return sx + d

    hatch_rect(X(-W_T), -W_T, X(0), ROOM_H + W_T, scale=12)
    hatch_rect(X(-W_T), -W_T, X(800), 0, scale=12)
    hatch_rect(X(0), ROOM_H, X(800), ROOM_H + W_T, scale=12)
    line((X(0), 0), (X(0), ROOM_H), "СТЕНИ")
    line((X(0), 0), (X(800), 0), "СТЕНИ")
    line((X(0), ROOM_H), (X(800), ROOM_H), "СТЕНИ")
    # колона
    rect(X(Y_CARC0), PL, X(Y_CARC1), COL_TOP, "КОРПУСИ")
    solid_rect(X(Y_CARC0), PL, X(Y_CARC1), PL + T)
    solid_rect(X(Y_CARC1 - NAD_D), COL_TOP - T, X(Y_CARC1), COL_TOP)   # междинна полица
    # хладилник
    rect(X(Y_CARC1 - 545), PL + T + 2, X(Y_CARC1), PL + T + 2 + 1772, "УРЕДИ")
    text(X(290), 1100, "BOSCH KIN86ADD0", h=30, rot=90, layer="УРЕДИ")
    # надстойка
    rect(X(Y_CARC1 - NAD_D + HDF), COL_TOP, X(Y_CARC1), TOP, "КОРПУСИ")
    solid_rect(X(Y_CARC1 - NAD_D), COL_TOP + 2, X(Y_CARC1 - NAD_D + HDF), TOP - 2, scale=1)
    solid_rect(X(Y_CARC1 - NAD_D + HDF), COL_TOP, X(Y_CARC1), COL_TOP + T)
    solid_rect(X(Y_CARC1 - NAD_D + HDF), TOP - T, X(Y_CARC1), TOP)
    # фронтове
    solid_rect(X(Y_CARC1), PL, X(Y_FRONT), FR_TOP)
    solid_rect(X(Y_CARC1), NAD_FR0, X(Y_FRONT), TOP)
    # цокъл с решетка
    solid_rect(X(Y_CARC1 - PLINTH_SET - 16), 0, X(Y_CARC1 - PLINTH_SET), PL - 2)
    # въздушен поток
    for (a, b) in (((X(Y_FRONT + 120), 50), (X(Y_CARC1 - PLINTH_SET + 30), 50)),
                   ((X(20), 1500), (X(20), 2450))):
        line(a, b, "ОТВАРЯНЕ")
    text(X(20) + 5, 2520, "въздух", h=24, align=TextEntityAlignment.MIDDLE_LEFT)
    # размери
    vchain([0, PL, COL_TOP, TOP, ROOM_H], X(WD + 180), X(Y_FRONT))
    vdim(PL + T, PL + T + NICHE, X(150), X(Y_CARC1 - 545))
    text(X(200), 600, "ниша", h=30, rot=90)
    vdim(0, ROOM_H, X(WD + 360), X(Y_FRONT))
    hchain([X(0), X(Y_CARC1 - NAD_D), X(Y_CARC1), X(Y_FRONT)], ROOM_H + 330,
           ROOM_H)
    text(X(330), -260, "РАЗРЕЗ C–C (поз. 1, 2)", h=60)


SX = ROOM_L + 1300
column_section(SX)
base_section(SX + 1500, "РАЗРЕЗ A–A (поз. 7, 8)", shelf=True)
base_section(SX + 2900, "РАЗРЕЗ B–B (поз. 5)", sink=True)

# ===========================================================================
# 4. СПЕЦИФИКАЦИЯ И РАЗКРОЙ
# ===========================================================================


def table(x, y, widths, rows, rh=70, th=32, header_rows=1):
    total_w = sum(widths)
    n = len(rows)
    rect(x, y - n * rh, x + total_w, y, "РАМКА")
    for i in range(1, n):
        line((x, y - i * rh), (x + total_w, y - i * rh),
             "РАМКА" if i == header_rows else "ТЕКСТ")
    cx = x
    for w in widths[:-1]:
        cx += w
        line((cx, y), (cx, y - n * rh), "ТЕКСТ")
    for r, row in enumerate(rows):
        cx = x
        for w, cell in zip(widths, row):
            text(cx + 15, y - r * rh - rh / 2, str(cell), h=th,
                 align=TextEntityAlignment.MIDDLE_LEFT)
            cx += w
    return y - n * rh


def iw(w):            # вътрешна ширина на корпус
    return w - 2 * T


spec_rows = [
    ("Поз.", "Наименование", "Ш×В×Д, мм"),
    (1, "Колона за вграден хладилник BOSCH KIN86ADD0", f"600×{COL_TOP - PL}×{D}"),
    (2, "Надстойка над хладилника, 1 врата", f"600×{NAD_H}×{NAD_D}"),
    (3, "Съдомиялна TEKA DFI 46900 (напълно вградима)", f"600×{CH}"),
    (4, "Шкаф за бутилки, карго 150", f"200×{CH}×{D}"),
    (5, "Шкаф за мивка, 2 врати, вертикални бленди", f"1000×{CH}×{D}"),
    (6, "Шкаф с 3 еднакви чекмеджета", f"600×{CH}×{D}"),
    (7, "Шкаф с 1 врата (панти вляво), 1 рафт", f"400×{CH}×{D}"),
    (8, "Шкаф с 1 врата (панти вдясно), 1 рафт", f"400×{CH}×{D}"),
]

cut = [("Поз.", "Детайл", "Бр.", "Дълж.", "Шир.", "Материал")]
cut += [
    (1, "Страница колона", 2, COL_TOP - PL, D, "ПДЧ 18"),
    (1, "Дъно колона", 1, iw(600), D, "ПДЧ 18"),
    (1, "Междинна полица", 1, iw(600), NAD_D, "ПДЧ 18"),
    (2, "Страница надстойка", 2, NAD_H, NAD_D - HDF, "ПДЧ 18"),
    (2, "Дъно / таван надстойка", 2, iw(600), NAD_D - HDF, "ПДЧ 18"),
    (2, "Гръб надстойка", 1, 600 - 4, NAD_H - 4, "HDF 3"),
]
for pos, w, kind in MODULES[2:]:
    cut.append((pos, "Страница", 2, CH, D, "ПДЧ 18"))
    cut.append((pos, "Дъно", 1, iw(w), D, "ПДЧ 18"))
    cut.append((pos, "Бленда вертикална" if kind == "sink" else "Бленда", 2, iw(w), BLEND,
                "ПДЧ 18"))
    if kind.startswith("door"):
        cut.append((pos, "Рафт", 1, iw(w) - 1, SHELF_D, "ПДЧ 18"))
    cut.append((pos, "Гръб", 1, w - 4, CH - 4, "HDF 3"))

fronts = [
    (1, "Фронт хладилник", 1, FR_TOP - PL, 600 - GAP),
    (2, "Фронт надстойка", 1, TOP - NAD_FR0, 600 - GAP),
    (3, "Фронт съдомиялна", 1, FRONT_H, 600 - GAP),
    (4, "Фронт карго", 1, FRONT_H, 200 - GAP),
    (5, "Врата мивка", 2, FRONT_H, 500 - GAP),
    (6, "Фронт чекмедже", 3, dh, 600 - GAP),
    (7, "Врата", 1, FRONT_H, 400 - GAP),
    (8, "Врата", 1, FRONT_H, 400 - GAP),
]
for pos, name, n, l, w in fronts:
    cut.append((pos, name, n, f"{l:g}", f"{w:g}", "фронт 18"))
cut.append(("3–8", "Плот", 1, ROOM_L - 600, WD, "плот 38"))
cut.append(("1–8", "Цокъл", 1, ROOM_L, PL - 2, "цокъл"))

TY = py(1400)
text(0, TY + 80, "СПЕЦИФИКАЦИЯ", h=60, align=TextEntityAlignment.MIDDLE_LEFT)
y_after = table(0, TY, [150, 1250, 450], spec_rows)

notes = [
    "БЕЛЕЖКИ:",
    "1. Всички размери са в мм. Корпуси от ПДЧ 18 мм, гръб HDF 3 мм, фуга между фронтове 3 мм.",
    "2. Цокъл 100 мм, отстъп 50 мм от корпуса. Корпус 720 мм, плот 38 мм – работна височина 858 мм.",
    "3. BOSCH KIN86ADD0 – ниша 1775–1780×560×550, плоска панта. Нишата е 1777 мм;",
    "   решетка в цокъла и канал 40 мм зад надстойката (мин. 200 см²). Колоната е без гръб.",
    "4. TEKA DFI 46900 – напълно вградима 60 см. Височината на фронта (717) да се",
    "   провери по инструкцията за монтаж на уреда.",
    "5. Чекмеджетата и каргото – по избраната система водачи (кутиите не са в разкроя).",
    "6. Цокълът се разделя пред съдомиялната (по инструкцията на уреда).",
    "7. Преди производство всички размери да се проверят на място.",
]
ny = y_after - 120
for i, s in enumerate(notes):
    text(0, ny - i * 60, s, h=32, align=TextEntityAlignment.MIDDLE_LEFT)

CX, CY = SX - 200, -900
text(CX, CY + 80, "РАЗКРОЙ (корпуси и фронтове)", h=60, align=TextEntityAlignment.MIDDLE_LEFT)
cut_bottom = table(CX, CY, [140, 720, 110, 190, 190, 260], cut, rh=58, th=28)

# Рамка с антетка
FX0, FY0 = -900, min(cut_bottom, ny - len(notes) * 60) - 300
FX1, FY1 = SX + 3900, ROOM_H + 700
rect(FX0, FY0, FX1, FY1, "РАМКА")
rect(FX0 + 40, FY0 + 40, FX1 - 40, FY1 - 40, "РАМКА")
title = [
    ("ПРАВА КУХНЯ – ДОЛЕН РЕД", 70),
    (f"Помещение: дължина {ROOM_L} мм, височина {ROOM_H} мм", 40),
    ("Мащаб 1:20 · единици: мм", 40),
    ("Дата: 28.10.2026", 40),
]
bx0, by1 = FX1 - 2040, FY0 + 440
rect(bx0, FY0 + 40, FX1 - 40, by1, "РАМКА")
for i, (s, hh) in enumerate(title):
    text(bx0 + 40, by1 - 80 - i * 90, s, h=hh, align=TextEntityAlignment.MIDDLE_LEFT)

doc.set_modelspace_vport(height=FY1 - FY0, center=((FX0 + FX1) / 2, (FY0 + FY1) / 2))
doc.saveas(OUT / "kuhnia.dxf", encoding="utf-8")
print("saved", OUT / "kuhnia.dxf")

if "--preview" in sys.argv:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import Frontend, RenderContext
    from ezdxf.addons.drawing.config import Configuration, BackgroundPolicy, ColorPolicy
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

    fig = plt.figure(figsize=(42, 22))
    ax = fig.add_axes([0, 0, 1, 1])
    cfg = Configuration(background_policy=BackgroundPolicy.WHITE,
                        color_policy=ColorPolicy.BLACK, lineweight_scaling=1.2)
    Frontend(RenderContext(doc), MatplotlibBackend(ax), config=cfg).draw_layout(msp)
    ax.set_aspect("equal")
    w, h = FX1 - FX0, FY1 - FY0
    fig.set_size_inches(w / 20 / 25.4, h / 20 / 25.4)       # мащаб 1:20
    fig.savefig(OUT / "kuhnia.pdf")
    fig.savefig(OUT / "kuhnia.png", dpi=100)
    print("preview saved")
