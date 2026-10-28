"""3D DXF на кухнята от kuhnia3d.json.

kuhnia-3d.dxf       – 3DSOLID тела (ACIS), за AutoCAD / BricsCAD
kuhnia-3d-mesh.dxf  – същото като MESH обекти, ако програмата не приеме телата

Всяка позиция е отделен блок (ПОЗ_1 … ПОЗ_8), детайлите са на слоеве по материал.
Вратите, чекмеджетата и каргото са в два варианта: слой ПОДВИЖНИ_ЗАТВОРЕНО (включен)
и ПОДВИЖНИ_ОТВОРЕНО (изключен). В DXF оста Z е нагоре, фронтовете гледат към −Y.
"""
import json
import math
from pathlib import Path

import ezdxf
from ezdxf import colors, units
from ezdxf.acis import api as acis
from ezdxf.enums import TextEntityAlignment
from ezdxf.math import UCS, Vec3
from ezdxf.render import forms

OUT = Path(__file__).resolve().parent
model = json.loads((OUT / "kuhnia3d.json").read_text())
L, H = model["room"]["length"], model["room"]["height"]
ROOM_D = 2400                      # дълбочина на помещението в модела (само за обстановка)
MOVERS = {m["id"]: m for m in model["movers"]}

KINDS = {
    "korpus": ("КОРПУСИ", (239, 237, 231)),
    "hdf": ("ГРЪБ_HDF", (216, 207, 190)),
    "front": ("ФРОНТОВЕ", (203, 191, 174)),
    "cokal": ("ЦОКЪЛ", (203, 191, 174)),
    "plot": ("ПЛОТ", (176, 135, 86)),
    "fridge": ("УРЕДИ", (245, 245, 243)),
    "appliance": ("УРЕДИ", (183, 186, 188)),
    "metal": ("ОБКОВ", (158, 163, 166)),
    "drawer": ("ОБКОВ", (140, 145, 147)),
    "inox": ("МИВКА", (201, 205, 207)),
    "dark": ("ОБКОВ", (42, 44, 46)),
}
EXTRA_LAYERS = {
    "ПОДВИЖНИ_ЗАТВОРЕНО": ((203, 191, 174), True),
    "ПОДВИЖНИ_ОТВОРЕНО": ((203, 191, 174), False),
    "СТЕНИ": ((236, 234, 228), True),
    "ПОД": ((207, 200, 187), True),
    "ТАВАН": ((244, 243, 239), False),
    "ТЕКСТ": ((40, 44, 46), True),
    "РАЗМЕРИ": ((31, 111, 139), True),
}


def to_dxf(x, y, z):
    """Координати на модела (x, нагоре, навън) -> DXF (X, Y, Z нагоре)."""
    return Vec3(x, -z, y)


def from_dxf(v):
    return v.x, v.z, -v.y


def part_mesh(p):
    x0, y0, z0, x1, y1, z1 = p["box"]
    if p["shape"] == "cyl":
        m = forms.cylinder(count=24, radius=0.5, top_center=(0, 0, 1), caps=True)
        m.translate(0.5, 0.5, 0)
    else:
        m = forms.cube(center=False)
    return m.scale(x1 - x0, z1 - z0, y1 - y0).translate(*to_dxf(x0, y0, z1))


def box_mesh(x0, y0, z0, x1, y1, z1):
    """Паралелепипед директно в DXF координати."""
    return forms.cube(center=False).scale(x1 - x0, y1 - y0, z1 - z0).translate(x0, y0, z0)


def opened(mesh, mv):
    """Положение „отворено“ – същите формули като в прегледа."""
    px, py, pz = mv["pivot"]
    out = []
    for v in mesh.vertices:
        x, y, z = from_dxf(v)
        if mv["type"] == "hinge":
            a = math.radians(mv["angle"])
            dx, dz = x - px, z - pz
            x, z = px + dx * math.cos(a) + dz * math.sin(a), pz - dx * math.sin(a) + dz * math.cos(a)
        elif mv["type"] == "flap":
            a = math.radians(mv["angle"])
            dy, dz = y - py, z - pz
            y, z = py + dy * math.cos(a) - dz * math.sin(a), pz + dy * math.sin(a) + dz * math.cos(a)
        else:
            z += mv["offset"]
        out.append(to_dxf(x, y, z))
    m = mesh.copy()
    m.vertices = out
    return m


def build(solid: bool):
    doc = ezdxf.new("R2010", setup=True)
    doc.units = units.MM
    doc.header["$INSUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    doc.styles.add("BG", font="arial.ttf")

    for kind, (name, rgb) in KINDS.items():
        if name not in doc.layers:
            doc.layers.add(name).rgb = rgb
    for name, (rgb, on) in EXTRA_LAYERS.items():
        lay = doc.layers.add(name)
        lay.rgb = rgb
        if not on:
            lay.off()

    def emit(space, mesh, layer, rgb=None):
        attribs = {"layer": layer}
        if rgb:
            attribs["true_color"] = colors.rgb2int(rgb)
        if solid:
            s = space.add_3dsolid(dxfattribs=attribs)
            acis.export_dxf(s, [acis.body_from_mesh(mesh)])
        else:
            mesh.render_mesh(space, dxfattribs=attribs)

    msp = doc.modelspace()

    # Блок за всяка позиция, вмъкнат в (0, 0, 0)
    blocks = {}
    for p in model["parts"]:
        pos = str(p["pos"]).replace("–", "-")
        if pos not in blocks:
            blocks[pos] = doc.blocks.new(f"ПОЗ_{pos}")
        blk = blocks[pos]
        layer, rgb = KINDS[p["kind"]]
        m = part_mesh(p)
        if "mover" in p:
            emit(blk, m, "ПОДВИЖНИ_ЗАТВОРЕНО", rgb)
            emit(blk, opened(m, MOVERS[p["mover"]]), "ПОДВИЖНИ_ОТВОРЕНО", rgb)
        else:
            emit(blk, m, layer)
    for pos in blocks:
        msp.add_blockref(f"ПОЗ_{pos}", (0, 0, 0), dxfattribs={"layer": "0"})

    # Помещение: стени 100 мм зад/до плоскостите на модела
    emit(msp, box_mesh(-100, 0, -100, L + 100, 100, H + 100), "СТЕНИ")
    emit(msp, box_mesh(-100, -ROOM_D, -100, 0, 0, H + 100), "СТЕНИ")
    emit(msp, box_mesh(L, -ROOM_D, -100, L + 100, 0, H + 100), "СТЕНИ")
    emit(msp, box_mesh(0, -ROOM_D, -100, L, 0, 0), "ПОД")
    emit(msp, box_mesh(0, -ROOM_D, H, L, 0, H + 100), "ТАВАН")

    # Номера на позициите върху фронтовете (четат се отпред)
    fronts = {}
    for p in model["parts"]:
        if p["kind"] == "front":
            b = fronts.setdefault(p["pos"], list(p["box"]))
            for i in range(3):
                b[i] = min(b[i], p["box"][i])
                b[i + 3] = max(b[i + 3], p["box"][i + 3])
    for pos, (x0, y0, z0, x1, y1, z1) in fronts.items():
        t = msp.add_text(str(pos), height=70, dxfattribs={
            "layer": "ТЕКСТ", "style": "BG", "extrusion": (0, -1, 0)})
        # OCS при нормала (0,-1,0): x = X, y = Z (нагоре), z = −Y
        t.set_placement(((x0 + x1) / 2, (y0 + y1) / 2, z1 + 2), align=TextEntityAlignment.MIDDLE_CENTER)
    t = msp.add_text(f"ПРАВА КУХНЯ – ДОЛЕН РЕД · {L}×{H} мм", height=60, dxfattribs={
        "layer": "ТЕКСТ", "style": "BG", "extrusion": (0, -1, 0)})
    t.set_placement((L / 2 + 300, 2250, 1), align=TextEntityAlignment.MIDDLE_CENTER)

    # Размери във фронталната равнина (Y = −650) и върху плота
    ds = doc.dimstyles.duplicate_entry("EZDXF", "КУХНЯ")
    for k, v in dict(dimtxsty="BG", dimtxt=40, dimasz=25, dimblk="ARCHTICK", dimexe=20,
                     dimexo=15, dimgap=10, dimdec=0, dimtad=1, dimlfac=1, dimclrd=5,
                     dimclre=5, dimclrt=7).items():
        ds.dxf.set(k, v)
    ds.dxf.dimpost = ""
    front_ucs = UCS(origin=(0, -650, 0), ux=(1, 0, 0), uz=(0, -1, 0))
    top_ucs = UCS(origin=(0, 0, 858 + 1), ux=(1, 0, 0), uz=(0, 0, 1))

    def dim(ucs, p1, p2, base, angle):
        d = msp.add_linear_dim(base=base, p1=p1, p2=p2, angle=angle, dimstyle="КУХНЯ",
                               dxfattribs={"layer": "РАЗМЕРИ"})
        d.render(ucs=ucs)

    xs = [0]
    for pos in (1, 3, 4, 5, 6, 7, 8):
        b = fronts[pos]
        xs.append(round(b[3] + 1.5))
    for a, b in zip(xs, xs[1:]):
        dim(front_ucs, (a, 0), (b, 0), (a, 60), 0)
    dim(front_ucs, (0, H), (L, H), (0, H - 120), 0)
    ys_r = [0, 100, 820, 858]
    for a, b in zip(ys_r, ys_r[1:]):
        dim(front_ucs, (L, a), (L, b), (L - 90, a), 90)
    dim(front_ucs, (L, 0), (L, 858), (L - 260, 0), 90)
    col = fronts[2]
    ys_l = [0, 100, round(fronts[1][4] + 2), col[4], H]
    for a, b in zip(ys_l, ys_l[1:]):
        dim(front_ucs, (0, a), (0, b), (90, a), 90)
    dim(front_ucs, (0, 0), (0, H), (260, 0), 90)
    dim(top_ucs, (3500, 0), (3500, -600), (3500, 0), 90)

    # Именувани изгледи (VIEW) и начален изометричен изглед
    center = Vec3(L / 2, -400, H / 2 - 300)
    views = {
        "1 Изометрия": ((1, -1.2, 0.8), 3600, 6200),
        "2 Отпред": ((0, -1, 0), 3200, 5200),
        "3 Отгоре": ((0, 0, 1), 3400, 5200),
        "4 Отляво": ((-1, 0, 0), 3200, 5200),
        "5 Отдясно": ((1, 0, 0), 3200, 5200),
    }
    for name, (direction, height, width) in views.items():
        doc.views.new(name, dxfattribs={
            "direction": direction, "target": center, "center": (0, 0),
            "height": height, "width": width, "focal_length": 50,
        })
    vp = doc.viewports.get("*Active")[0]
    vp.dxf.direction = views["1 Изометрия"][0]
    vp.dxf.target = center
    vp.dxf.center = (0, 0)
    vp.dxf.height = views["1 Изометрия"][1]
    return doc


for solid, name in ((True, "kuhnia-3d.dxf"), (False, "kuhnia-3d-mesh.dxf")):
    doc = build(solid)
    doc.saveas(OUT / name)
    print("saved", name)
