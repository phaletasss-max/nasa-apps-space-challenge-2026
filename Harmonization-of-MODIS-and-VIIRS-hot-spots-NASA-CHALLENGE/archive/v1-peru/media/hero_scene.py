"""
Escena 3D "FireCal Perú" para el pitch: cada celda 0.25° se extruye según su
quema media anual armonizada (2001–2025, celda-días equivalentes VIIRS).

Uso (no toca ninguna sesión abierta de Blender):
  blender -b --factory-startup --python hero_scene.py -- [--frames N]
Salida: ../hero.png, ../firecal_hero.blend  (y ../frames/ si --frames > 1)
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
WEB = HERE.parent.parent / "web" / "data"
MEDIA = HERE.parent
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FRAMES = int(ARGS[ARGS.index("--frames") + 1]) if "--frames" in ARGS else 1

CX, CY = -75.0, -9.3
FIRE = ["#3b0f1f", "#8a1c2b", "#d4441c", "#ff8a1f", "#ffd166", "#fff3c4"]
EMIT = [0.0, 0.15, 0.6, 1.3, 2.2, 3.2]


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def xy(lon, lat):
    return (lon - CX, lat - CY)


# ------------------------------------------------------------------ datos
G = json.loads((WEB / "grid.json").read_text(encoding="utf-8"))
C = json.loads((WEB / "calib.json").read_text(encoding="utf-8"))
DEPS = json.loads((WEB / "departments.geojson").read_text(encoding="utf-8"))
YEARS = range(2001, 2026)
months = {(y - 2000) * 12 + k for y in YEARS for k in range(12)}

cells = []
for x, y, dep, ms, M, V in G["cells"]:
    tot = 0.0
    for m, a, b in zip(ms, M, V):
        if m not in months:
            continue
        tot += a * C["k"][dep][m % 12] if m < G["switch"] else b
    mean = tot / len(YEARS)
    if mean > 0:
        cells.append((G["lon0"] + x * G["res"], G["lat0"] + y * G["res"], mean))

# ------------------------------------------------------------------ escena limpia
scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)


def material(name, color, strength, rough=0.6):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Emission Color"].default_value = color
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


# ------------------------------------------------------------------ barras
mesh = bpy.data.meshes.new("FireBars")
bm = bmesh.new()
w = G["res"] * 0.84
LOGMAX = math.log10(301)
for lon, lat, mean in cells:
    t = min(1.0, math.log10(1 + mean) / LOGMAX)
    h = 0.02 + 3.4 * math.sqrt(min(mean, 260.0) / 260.0)
    bin_ = min(len(FIRE) - 1, int(t * len(FIRE)))
    x0, y0 = xy(lon + G["res"] / 2, lat + G["res"] / 2)
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    bmesh.ops.scale(bm, vec=(w, w, h), verts=verts)
    bmesh.ops.translate(bm, vec=(x0, y0, h / 2), verts=verts)
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = bin_
bm.to_mesh(mesh)
bm.free()
bars = bpy.data.objects.new("FireBars", mesh)
scene.collection.objects.link(bars)
for i, hx in enumerate(FIRE):
    mesh.materials.append(material(f"fire_{i}", hex_rgb(hx), EMIT[i], rough=0.4))

# ------------------------------------------------------------------ límites departamentales
curve = bpy.data.curves.new("Departamentos", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.028
for f in DEPS["features"]:
    g = f["geometry"]
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    for poly in polys:
        ring = poly[0]
        sp = curve.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for p, (lon, lat) in zip(sp.points, ring):
            px, py = xy(lon, lat)
            p.co = (px, py, 0.01, 1.0)
        sp.use_cyclic_u = True
borders = bpy.data.objects.new("Departamentos", curve)
borders.data.materials.append(material("borde", hex_rgb("#9fb0cc"), 2.5))
scene.collection.objects.link(borders)

# ------------------------------------------------------------------ suelo, luz, mundo
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "Suelo"
ground.data.materials.append(material("suelo", hex_rgb("#0b0d11"), 0.0, rough=0.9))

sun_data = bpy.data.lights.new("Sol", "SUN")
sun_data.energy = 1.2
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new("Sol", sun_data)
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
scene.collection.objects.link(sun)

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = hex_rgb("#06080c")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

# ------------------------------------------------------------------ cámara
target = bpy.data.objects.new("Objetivo", None)
target.location = (0.3, 0.6, 0.0)
scene.collection.objects.link(target)
cam_data = bpy.data.cameras.new("Camara")
cam_data.lens = 40
cam = bpy.data.objects.new("Camara", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
tc = cam.constraints.new("TRACK_TO")
tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"
tc.up_axis = "UP_Y"

R, Z, A0 = 15.0, 27.0, math.radians(-104)  # desde el sur, vista alta
if FRAMES > 1:
    scene.frame_start, scene.frame_end = 1, FRAMES
    for fr in range(1, FRAMES + 1):
        a = A0 + math.radians(50) * (fr - 1) / (FRAMES - 1)
        cam.location = (R * math.cos(a), R * math.sin(a), Z)
        cam.keyframe_insert("location", frame=fr)
else:
    cam.location = (R * math.cos(A0), R * math.sin(A0), Z)

# ------------------------------------------------------------------ render
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
try:
    scene.eevee.taa_render_samples = 64
except AttributeError:
    pass
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast" if "AgX - Punchy" in [
    i.identifier for i in scene.view_settings.bl_rna.properties["look"].enum_items] else "None"
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.film_transparent = False

bpy.ops.wm.save_as_mainfile(filepath=str(MEDIA / "firecal_hero.blend"))
if FRAMES > 1:
    (MEDIA / "frames").mkdir(exist_ok=True)
    scene.render.filepath = str(MEDIA / "frames" / "f_")
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(animation=True)
else:
    scene.render.filepath = str(MEDIA / "hero.png")
    bpy.ops.render.render(write_still=True)
print(f"OK celdas={len(cells)} frames={FRAMES}")
