"""
FireCal globe for the pitch video: NASA Blue Marble Earth with one glowing column per
0.25° cell, height = mean annual harmonized fire activity 2001–2025.

Headless, never touches an open Blender session:
  blender -b --factory-startup --python globe_scene.py -- [--frames 240] [--still]
Outputs: ../globe.png (still), ../frames_globe/f_####.png (animation), ../firecal_globe.blend
Encode:  ffmpeg -framerate 24 -i ../frames_globe/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ../firecal_globe.mp4
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "app" / "public" / "data"
MEDIA = HERE.parent
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FRAMES = int(ARGS[ARGS.index("--frames") + 1]) if "--frames" in ARGS else 240
STILL = "--still" in ARGS

R = 10.0
FIRE = ["#8a1c2b", "#d4441c", "#ff8a1f", "#ffd166", "#fff3c4"]
EMIT = [0.6, 1.2, 2.2, 3.5, 5.0]


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# ------------------------------------------------------------------ data
meta = json.loads((DATA / "meta.json").read_text())
buf = (DATA / "overview.bin").read_bytes()
f = meta["overview"]["fields"]
ids = np.frombuffer(buf, "<u4", f["id"]["length"], f["id"]["offset"])
mean = np.frombuffer(buf, "<f4", f["mean"]["length"], f["mean"]["offset"])
keep = mean >= 1.5
ids, mean = ids[keep].astype(np.int64), mean[keep].astype(np.float64)
cell, nx = meta["grid"]["cell"], meta["grid"]["nx"]
lat = np.radians(-90 + (ids // nx + 0.5) * cell)
lon = np.radians(-180 + (ids % nx + 0.5) * cell)
t = np.clip(np.log10(1 + mean) / np.log10(301), 0, 1)
height = 0.03 + 1.2 * t ** 2.4
bins = np.minimum(len(FIRE) - 1, (t * len(FIRE)).astype(int))
print(f"columns: {ids.size:,}")

# ------------------------------------------------------------------ scene
scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

pivot = bpy.data.objects.new("Pivot", None)
scene.collection.objects.link(pivot)

# Earth with equirectangular Blue Marble mapped from object coordinates (same lon/lat convention as the columns)
bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=R)
earth = bpy.context.active_object
earth.name = "Earth"
bpy.ops.object.shade_smooth()
earth.parent = pivot
mat = bpy.data.materials.new("Earth")
mat.use_nodes = True
nt = mat.node_tree
N, L = nt.nodes, nt.links
bsdf = N.get("Principled BSDF")
tex = N.new("ShaderNodeTexCoord")
sep = N.new("ShaderNodeSeparateXYZ")
L.new(tex.outputs["Object"], sep.inputs[0])
atan = N.new("ShaderNodeMath"); atan.operation = "ARCTAN2"
L.new(sep.outputs["Y"], atan.inputs[0]); L.new(sep.outputs["X"], atan.inputs[1])
u = N.new("ShaderNodeMath"); u.operation = "MULTIPLY_ADD"
u.inputs[1].default_value = 1 / (2 * math.pi); u.inputs[2].default_value = 0.5
L.new(atan.outputs[0], u.inputs[0])
length = N.new("ShaderNodeVectorMath"); length.operation = "LENGTH"
L.new(tex.outputs["Object"], length.inputs[0])
div = N.new("ShaderNodeMath"); div.operation = "DIVIDE"
L.new(sep.outputs["Z"], div.inputs[0]); L.new(length.outputs["Value"], div.inputs[1])
asin = N.new("ShaderNodeMath"); asin.operation = "ARCSINE"
L.new(div.outputs[0], asin.inputs[0])
v = N.new("ShaderNodeMath"); v.operation = "MULTIPLY_ADD"
v.inputs[1].default_value = 1 / math.pi; v.inputs[2].default_value = 0.5
L.new(asin.outputs[0], v.inputs[0])
comb = N.new("ShaderNodeCombineXYZ")
L.new(u.outputs[0], comb.inputs["X"]); L.new(v.outputs[0], comb.inputs["Y"])
img = N.new("ShaderNodeTexImage")
img.image = bpy.data.images.load(str(MEDIA / "textures" / "bluemarble_5400.jpg"))
img.extension = "EXTEND"
L.new(comb.outputs[0], img.inputs["Vector"])
dark = N.new("ShaderNodeMixRGB"); dark.blend_type = "MULTIPLY"
dark.inputs["Fac"].default_value = 1.0
dark.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1)
L.new(img.outputs["Color"], dark.inputs["Color1"])
L.new(dark.outputs[0], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.8
earth.data.materials.append(mat)

# atmosphere rim
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=R * 1.025)
atmo = bpy.context.active_object
atmo.name = "Atmosphere"
bpy.ops.object.shade_smooth()
atmo.parent = pivot
am = bpy.data.materials.new("Atmosphere")
am.use_nodes = True
an = am.node_tree
an.nodes.remove(an.nodes.get("Principled BSDF"))
lw = an.nodes.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
rim = an.nodes.new("ShaderNodeMath"); rim.operation = "POWER"; rim.inputs[1].default_value = 5.0
an.links.new(lw.outputs["Facing"], rim.inputs[0])
em = an.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = lin("#4f8cff"); em.inputs["Strength"].default_value = 3.0
tr = an.nodes.new("ShaderNodeBsdfTransparent")
mix = an.nodes.new("ShaderNodeMixShader")
an.links.new(rim.outputs[0], mix.inputs["Fac"])
an.links.new(tr.outputs[0], mix.inputs[1]); an.links.new(em.outputs[0], mix.inputs[2])
an.links.new(mix.outputs[0], an.nodes.get("Material Output").inputs["Surface"])
for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
    if hasattr(am, attr):
        try:
            setattr(am, attr, val)
        except TypeError:
            pass
atmo.data.materials.append(am)

# fire columns: one box per cell, oriented radially (vectorized)
n = ids.size
up = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], 1)
east = np.stack([-np.sin(lon), np.cos(lon), np.zeros(n)], 1)
north = np.cross(up, east)
w = R * math.radians(cell) * 0.42
base = up * R * 0.999
top = up * (R + height[:, None])
corners = []
for z in (base, top):
    for se, sn in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        corners.append(z + se * w * east + sn * w * north)
verts = np.stack(corners, 1).reshape(-1, 3)
quad = np.array([[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])
faces = (quad[None] + (np.arange(n) * 8)[:, None, None]).reshape(-1, 4)
mesh = bpy.data.meshes.new("Fire")
mesh.vertices.add(len(verts)); mesh.vertices.foreach_set("co", verts.astype(np.float32).ravel())
mesh.loops.add(faces.size); mesh.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
mesh.polygons.add(len(faces))
mesh.polygons.foreach_set("loop_start", (np.arange(len(faces)) * 4).astype(np.int32))
mesh.polygons.foreach_set("material_index", np.repeat(bins, 6).astype(np.int32))
mesh.update(calc_edges=True)
mesh.validate()
fire = bpy.data.objects.new("Fire", mesh)
scene.collection.objects.link(fire)
fire.parent = pivot
for i, hx in enumerate(FIRE):
    m = bpy.data.materials.new(f"fire_{i}")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = lin(hx)
    b.inputs["Emission Color"].default_value = lin(hx)
    b.inputs["Emission Strength"].default_value = EMIT[i]
    mesh.materials.append(m)

# light, world, camera
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 4.0
sun.data.angle = math.radians(1)
sun.location = (-45, -35, 25)
scene.collection.objects.link(sun)
aim = sun.constraints.new("TRACK_TO")
aim.target = pivot
aim.track_axis = "TRACK_NEGATIVE_Z"
aim.up_axis = "UP_Y"
world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = lin("#030407")

cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
cam.data.lens = 50
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0, -64, 7)
cam.rotation_euler = (math.radians(90 - math.degrees(math.atan2(7, 64))), 0, 0)

# animation: one full turn, starting with South America facing the camera (camera looks at lon -90°)
pivot.rotation_euler = (math.radians(-8), 0, math.radians(-15))
scene.frame_start, scene.frame_end = 1, FRAMES
pivot.keyframe_insert("rotation_euler", frame=1)
pivot.rotation_euler[2] += math.radians(360)
pivot.keyframe_insert("rotation_euler", frame=FRAMES + 1)
for fc in (pivot.animation_data.action.fcurves if hasattr(pivot.animation_data.action, "fcurves") else []):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

# render settings
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
try:
    scene.eevee.taa_render_samples = 32
except AttributeError:
    pass
scene.view_settings.view_transform = "AgX"
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.image_settings.file_format = "PNG"
bpy.ops.wm.save_as_mainfile(filepath=str(MEDIA / "firecal_globe.blend"))

if STILL:
    scene.frame_set(1)
    scene.render.filepath = str(MEDIA / "globe.png")
    bpy.ops.render.render(write_still=True)
else:
    (MEDIA / "frames_globe").mkdir(exist_ok=True)
    scene.render.filepath = str(MEDIA / "frames_globe" / "f_")
    bpy.ops.render.render(animation=True)
print("OK")
