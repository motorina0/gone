"""Build and render the original Gone Vatra Central Station environment.

Run with:
  blender --background --python art/vatra/build_vatra_scene.py

The script reads the location JSON as its source of truth, builds an editable
Blender scene using only Gone-owned geometry and materials, saves the .blend,
and renders five aligned 4K masters plus linear depth passes.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
LOCATION = ROOT / "public/content/locations/vatra-central-station"
ENVIRONMENT_PATH = LOCATION / "environment.json"
CAMERA_CONFIG = json.loads((ROOT / "art/vatra/camera-config.json").read_text())
MATERIALS = ROOT / "public/content/materials"
OUTPUT = ROOT / "art/vatra/renders"
BLEND_PATH = ROOT / "art/vatra/vatra-central-station.blend"
MASTER_WIDTH = 3840
MASTER_HEIGHT = 2560
WORLD_CENTER = Vector((300.0, 180.0, 0.0))
RANDOM = random.Random(27081989)
BOX_MESHES: dict[str, bpy.types.Mesh] = {}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.materials, bpy.data.meshes, bpy.data.curves, bpy.data.cameras):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def collection(name: str) -> bpy.types.Collection:
    found = bpy.data.collections.get(name)
    if found:
        return found
    found = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(found)
    return found


def move_to_collection(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def color(hex_color: str) -> tuple[float, float, float, float]:
    cleaned = hex_color.removeprefix("#")
    return tuple(int(cleaned[index : index + 2], 16) / 255 for index in (0, 2, 4)) + (1.0,)


def material(
    name: str,
    base: str,
    *,
    texture: str | None = None,
    roughness: float = 0.72,
    metallic: float = 0.0,
    transmission: float = 0.0,
    alpha: float = 1.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = color(base)
    nodes = result.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color(base)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Alpha"].default_value = alpha
    if "Transmission Weight" in principled.inputs:
        principled.inputs["Transmission Weight"].default_value = transmission
    if emission:
        principled.inputs["Emission Color"].default_value = color(emission)
        principled.inputs["Emission Strength"].default_value = emission_strength
    if texture:
        image = bpy.data.images.load(str(MATERIALS / texture), check_existing=True)
        texture_node = nodes.new("ShaderNodeTexImage")
        texture_node.image = image
        texture_node.projection = "BOX"
        texture_node.projection_blend = 0.22
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (0.08, 0.08, 0.08)
        coordinates = nodes.new("ShaderNodeTexCoord")
        result.node_tree.links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
        result.node_tree.links.new(mapping.outputs["Vector"], texture_node.inputs["Vector"])
        result.node_tree.links.new(texture_node.outputs["Color"], principled.inputs["Base Color"])
    if alpha < 1.0:
        result.surface_render_method = "DITHERED"
    return result


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    bevel: float = 0.0,
    rotation: float = 0.0,
) -> bpy.types.Object:
    mesh = BOX_MESHES.get(mat.name)
    if mesh is None:
        mesh = bpy.data.meshes.new(f"Gone unit box — {mat.name}")
        vertices = [
            (-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (0.5, 0.5, -0.5), (-0.5, 0.5, -0.5),
            (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5), (-0.5, 0.5, 0.5),
        ]
        faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(mat)
        BOX_MESHES[mat.name] = mesh
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.scale = dimensions
    obj.rotation_euler[2] = math.radians(rotation)
    target.objects.link(obj)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to_collection(obj, target)
    return obj


def pitched_roof(
    name: str,
    x: float,
    y: float,
    width: float,
    depth: float,
    z: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> None:
    ridge = min(4.2, max(1.5, depth * 0.18))
    vertices = [
        (-width / 2, -depth / 2, 0),
        (width / 2, -depth / 2, 0),
        (-width / 2, depth / 2, 0),
        (width / 2, depth / 2, 0),
        (-width / 2, 0, ridge),
        (width / 2, 0, ridge),
    ]
    faces = [(0, 1, 5, 4), (4, 5, 3, 2), (0, 4, 2), (1, 3, 5)]
    mesh = bpy.data.meshes.new(f"{name}-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (x + width / 2, y + depth / 2, z)
    target.objects.link(obj)


def add_windows(
    landmark: dict,
    building_height: float,
    window_mat: bpy.types.Material,
    trim_mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> None:
    x, y = landmark["x"], landmark["y"]
    width, depth = landmark["width"], landmark["height"]
    floors = max(1, min(5, int(building_height // 3.4)))
    for floor in range(floors):
        z = 2.0 + floor * 3.0
        for side, length in (("north", width), ("south", width)):
            columns = max(2, min(10, int(length // 8)))
            side_y = y - 0.04 if side == "north" else y + depth + 0.04
            for column_index in range(columns):
                wx = x + (column_index + 0.5) * width / columns
                add_box(
                    f"{landmark['id']}-{side}-window-{floor}-{column_index}",
                    (wx, side_y, z),
                    (min(2.4, width / columns * 0.52), 0.10, 1.25),
                    window_mat,
                    target,
                    bevel=0.04,
                )
        for side, length in (("west", depth), ("east", depth)):
            columns = max(1, min(6, int(length // 8)))
            side_x = x - 0.04 if side == "west" else x + width + 0.04
            for column_index in range(columns):
                wy = y + (column_index + 0.5) * depth / columns
                add_box(
                    f"{landmark['id']}-{side}-window-{floor}-{column_index}",
                    (side_x, wy, z),
                    (0.10, min(2.4, depth / columns * 0.52), 1.25),
                    window_mat,
                    target,
                    bevel=0.04,
                )
    add_box(
        f"{landmark['id']}-foundation",
        (x + width / 2, y + depth / 2, 0.45),
        (width + 0.25, depth + 0.25, 0.9),
        trim_mat,
        target,
        bevel=0.08,
    )


def add_car(prop: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = prop["x"], prop["y"]
    rotation = prop.get("rotation", 0)
    width = prop.get("width", 4.6)
    depth = prop.get("depth", 2.0)
    palette = [mats["car_red"], mats["car_blue"], mats["car_cream"], mats["car_green"]]
    body = palette[abs(int(x * 3 + y)) % len(palette)]
    add_box(f"car-{x}-{y}-body", (x, y, 0.72), (width, depth, 0.75), body, target, bevel=0.32, rotation=rotation)
    add_box(f"car-{x}-{y}-cabin", (x, y, 1.25), (width * 0.52, depth * 0.88, 0.62), mats["glass"], target, bevel=0.24, rotation=rotation)
    angle = math.radians(rotation)
    for local_x in (-width * 0.3, width * 0.3):
        for local_y in (-depth * 0.52, depth * 0.52):
            wx = x + local_x * math.cos(angle) - local_y * math.sin(angle)
            wy = y + local_x * math.sin(angle) + local_y * math.cos(angle)
            add_cylinder(
                f"car-{x}-{y}-wheel",
                (wx, wy, 0.45),
                0.36,
                0.22,
                mats["rubber"],
                target,
                vertices=12,
                rotation=(math.pi / 2, 0.0, math.radians(rotation)),
            )


def add_train(prop: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = prop["x"], prop["y"]
    length = prop.get("width", 34)
    depth = prop.get("depth", 4.2)
    height = prop.get("height", 3.8)
    rotation = prop.get("rotation", 0)
    body_mat = mats["train_blue"] if prop["type"] == "regional-train" else mats["train_freight"]
    add_box(f"{prop['type']}-{x}-{y}", (x, y, height / 2 + 0.45), (length, depth, height), body_mat, target, bevel=0.34, rotation=rotation)
    add_box(f"{prop['type']}-{x}-{y}-roof", (x, y, height + 0.65), (length * 0.96, depth * 0.92, 0.28), mats["steel"], target, bevel=0.18, rotation=rotation)
    if prop["type"] == "regional-train":
        angle = math.radians(rotation)
        for offset in range(int(-length / 2 + 3), int(length / 2 - 2), 4):
            for side in (-1, 1):
                lx, ly = offset, side * (depth / 2 + 0.04)
                wx = x + lx * math.cos(angle) - ly * math.sin(angle)
                wy = y + lx * math.sin(angle) + ly * math.cos(angle)
                add_box(f"train-window-{x}-{y}-{offset}-{side}", (wx, wy, 2.75), (2.2, 0.10, 1.05), mats["glass"], target, bevel=0.08, rotation=rotation)


def add_tree(index: int, tree: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = tree["x"], tree["y"]
    size = tree.get("size", 1.0)
    add_cylinder(f"tree-{index}-trunk", (x, y, 2.5 * size), 0.52 * size, 5.0 * size, mats["bark"], target, vertices=9)
    for crown_index, (ox, oy, oz, radius) in enumerate(
        ((0, 0, 6.1, 3.0), (-1.4, 0.7, 5.8, 2.2), (1.2, -0.8, 6.0, 2.35), (0.2, 0.3, 7.8, 2.25))
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius * size, location=(x + ox * size, y + oy * size, oz * size))
        crown = bpy.context.object
        crown.name = f"tree-{index}-crown-{crown_index}"
        crown.scale.z = 0.82
        crown.data.materials.append(mats["leaves_a"] if (index + crown_index) % 2 else mats["leaves_b"])
        move_to_collection(crown, target)


def build_environment(environment: dict) -> None:
    architecture = collection("Gone Architecture")
    occluders = collection("Gone Occluders")
    surfaces = collection("Gone Ground and Tracks")
    props = collection("Gone Props and Vehicles")
    foliage = collection("Gone Foliage")
    atmosphere = environment["atmosphere"]
    mats = {
        "ground": material("Wet station ground", atmosphere["groundDark"], texture="industrial-wet-asphalt.png", roughness=0.46),
        "asphalt": material("Wet asphalt", "#303a3d", texture="industrial-wet-asphalt.png", roughness=0.38),
        "platform": material("Vatra platform concrete", "#77756f", texture="vatra-platform-concrete.png", roughness=0.58),
        "ballast": material("Rail ballast", "#34383a", texture="vatra-platform-concrete.png", roughness=0.86),
        "steel": material("Vatra aged steel", "#343b3b", texture="vatra-aged-steel.png", roughness=0.38, metallic=0.55),
        "rail": material("Polished rail", "#6b7070", roughness=0.22, metallic=0.85),
        "sleeper": material("Creosote sleepers", "#221d1a", roughness=0.82),
        "masonry": material("Weathered masonry", "#79756c", texture="weathered-masonry.png", roughness=0.82),
        "roof": material("Weathered station roof", "#373631", texture="weathered-roof.png", roughness=0.66, metallic=0.12),
        "glass": material("Rain-dark glass", "#18333b", roughness=0.18, metallic=0.08, transmission=0.18),
        "trim": material("Stone trim", "#aaa28f", roughness=0.78),
        "rubber": material("Tyre rubber", "#121514", roughness=0.91),
        "bark": material("Wet bark", "#3a2c21", roughness=0.92),
        "leaves_a": material("Vatra foliage dark", "#183c27", roughness=0.86),
        "leaves_b": material("Vatra foliage light", "#2e6038", roughness=0.84),
        "car_red": material("Gone vehicle oxblood", "#62372f", roughness=0.48, metallic=0.18),
        "car_blue": material("Gone vehicle blue", "#344f5b", roughness=0.45, metallic=0.18),
        "car_cream": material("Gone vehicle cream", "#837d67", roughness=0.5, metallic=0.12),
        "car_green": material("Gone vehicle green", "#354b3c", roughness=0.48, metallic=0.16),
        "train_blue": material("Vatra regional blue", "#375f70", roughness=0.42, metallic=0.22),
        "train_freight": material("Vatra freight red", "#643d35", roughness=0.72, metallic=0.25),
        "lamp": material("Station lamps", "#d9bd75", roughness=0.35, emission="#ffc971", emission_strength=3.2),
        "water": material("Rain puddles", "#253d45", roughness=0.08, metallic=0.18, transmission=0.15, alpha=0.68),
    }

    # The art ground deliberately extends beyond the canonical playable bounds so
    # no camera exposes a floating-board edge. Navigation remains JSON-bounded.
    add_box("Vatra district base", (300, 180, -0.7), (2000, 2000, 1.4), mats["ground"], surfaces, bevel=1.5)
    for item in environment["surfaces"]:
        surface_mat = mats["platform"] if item["type"] in ("sidewalk", "plaza") else mats["asphalt"]
        if item["type"] == "rail":
            add_box(f"{item['id']}-ballast", (item["x"] + item["width"] / 2, item["y"] + item["height"] / 2, 0.05), (item["width"], item["height"], 0.10), mats["ballast"], surfaces, bevel=0.1)
            horizontal = item["width"] >= item["height"]
            length = item["width"] if horizontal else item["height"]
            for offset in range(3, int(length), 10):
                location = (item["x"] + offset, item["y"] + item["height"] / 2, 0.16) if horizontal else (item["x"] + item["width"] / 2, item["y"] + offset, 0.16)
                dimensions = (0.45, item["height"] * 0.92, 0.18) if horizontal else (item["width"] * 0.92, 0.45, 0.18)
                add_box(f"{item['id']}-sleeper-{offset}", location, dimensions, mats["sleeper"], surfaces, bevel=0.04)
            for rail_offset in (-1.2, 1.2):
                location = (item["x"] + item["width"] / 2, item["y"] + item["height"] / 2 + rail_offset, 0.34) if horizontal else (item["x"] + item["width"] / 2 + rail_offset, item["y"] + item["height"] / 2, 0.34)
                dimensions = (item["width"], 0.16, 0.22) if horizontal else (0.16, item["height"], 0.22)
                add_box(f"{item['id']}-rail-{rail_offset}", location, dimensions, mats["rail"], surfaces, bevel=0.06)
            continue
        add_box(
            item["id"],
            (item["x"] + item["width"] / 2, item["y"] + item["height"] / 2, 0.06),
            (item["width"], item["height"], 0.12),
            surface_mat,
            surfaces,
            bevel=0.18,
        )

    height_by_type = {"station": 15, "tower": 29, "platform": 1.0, "bridge": 7.5, "warehouse": 9, "office": 8, "utility": 6, "building": 11, "yard": 0.18}
    for landmark in environment["landmarks"]:
        height = landmark.get("elevation", height_by_type.get(landmark["type"], 8))
        x, y, width, depth = landmark["x"], landmark["y"], landmark["width"], landmark["height"]
        if landmark["type"] == "bridge":
            add_box(landmark["id"], (x + width / 2, y + depth / 2, 7.3), (width, depth, 1.25), mats["glass"], occluders, bevel=0.22)
            for support_y in (y + 4, y + depth - 4):
                for support_x in (x + 2, x + width - 2):
                    add_box(f"{landmark['id']}-support", (support_x, support_y, 3.4), (0.55, 0.55, 6.8), mats["steel"], occluders, bevel=0.08)
            continue
        body_mat = mats["platform"] if landmark["type"] in ("platform", "yard") else mats["masonry"]
        target = occluders if height >= 5 else architecture
        # Ground-level platform tops are canonical elevation zero. Extend their
        # mass downward so sprites, blockers, and the rendered walking surface agree.
        center_z = -height / 2 if landmark["type"] == "platform" else height / 2
        add_box(landmark["id"], (x + width / 2, y + depth / 2, center_z), (width, depth, height), body_mat, target, bevel=0.22)
        if height >= 5:
            add_windows(landmark, height, mats["glass"], mats["trim"], target)
            pitched_roof(f"{landmark['id']}-roof", x, y, width, depth, height, mats["roof"], target)
        elif landmark["type"] == "platform":
            add_box(f"{landmark['id']}-edge", (x + width / 2, y + depth - 0.28, 0.08), (width, 0.45, 0.16), mats["trim"], architecture, bevel=0.04)

    for index, tree in enumerate(environment["trees"]):
        add_tree(index, tree, mats, foliage)

    for index, prop in enumerate(environment["streetFurniture"]):
        kind = prop["type"]
        if kind == "car":
            add_car(prop, mats, props)
        elif kind in ("regional-train", "freight-wagon"):
            add_train(prop, mats, props)
        elif kind == "maintenance-vehicle":
            add_car(prop, mats, props)
        elif kind == "bench":
            x, y = prop["x"], prop["y"]
            add_box(f"bench-{index}-seat", (x, y, 0.65), (3.2, 0.7, 0.18), mats["steel"], props, bevel=0.09)
            add_box(f"bench-{index}-back", (x, y + 0.28, 1.15), (3.2, 0.15, 0.95), mats["steel"], props, bevel=0.07)

    # Deterministic Gone-authored rain dressing, derived from the station surfaces.
    for index in range(22):
        x = RANDOM.uniform(8, 592)
        y = RANDOM.uniform(40, 312)
        add_box(f"rain-puddle-{index}", (x, y, 0.145), (RANDOM.uniform(2.5, 8.0), RANDOM.uniform(0.8, 2.8), 0.025), mats["water"], props, bevel=0.35, rotation=RANDOM.uniform(-20, 20))
    for index, (x, y) in enumerate(((126, 80), (126, 178), (225, 82), (320, 82), (420, 82), (520, 82), (225, 184), (420, 184), (528, 184))):
        add_cylinder(f"lamp-{index}-post", (x, y, 3.2), 0.12, 6.4, mats["steel"], props, vertices=10)
        add_box(f"lamp-{index}-light", (x, y, 6.35), (0.75, 0.75, 0.34), mats["lamp"], props, bevel=0.12)


def setup_scene(environment: dict) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = MASTER_WIDTH
    scene.render.resolution_y = MASTER_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.render.use_file_extension = True
    scene.render.resolution_percentage = 100
    scene.render.image_settings.compression = 35
    scene.world.color = color(environment["atmosphere"]["horizon"])[0:3]
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = color(environment["atmosphere"]["horizon"])
    background.inputs["Strength"].default_value = 0.62
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.object.light_add(type="AREA", location=(-180, -120, 520))
    key = bpy.context.object
    key.name = "Overcast sky key"
    key.data.energy = 2200
    key.data.shape = "DISK"
    key.data.size = 420
    key.data.color = (0.72, 0.82, 0.90)
    key.rotation_euler = (WORLD_CENTER - key.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.light_add(type="AREA", location=(520, 430, 260))
    fill = bpy.context.object
    fill.name = "Blue-hour fill"
    fill.data.energy = 1100
    fill.data.size = 300
    fill.data.color = (0.34, 0.48, 0.62)
    fill.rotation_euler = (WORLD_CENTER - fill.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 300))
    sun = bpy.context.object
    sun.name = "Soft overcast sun"
    sun.data.energy = 2.1
    sun.data.angle = math.radians(18)
    sun.data.color = (0.68, 0.76, 0.82)
    sun.rotation_euler = (math.radians(28), math.radians(-24), math.radians(-38))


def camera_for(view_id: str) -> bpy.types.Object:
    if view_id == "view-top":
        back = Vector((0, 0, 1))
        right = Vector((1, 0, 0))
        up = Vector((0, 1, 0))
        ortho_scale = CAMERA_CONFIG["top"]["orthoScale"]
    else:
        azimuth = {"view-0": 45, "view-90": 135, "view-180": 225, "view-270": 315}[view_id]
        angle = math.radians(azimuth)
        # Match the canonical 35.264 degree isometric projection exactly.
        back = Vector((math.cos(angle), math.sin(angle), CAMERA_CONFIG["isometric"]["backZ"])).normalized()
        right = Vector((-math.sin(angle), math.cos(angle), 0)).normalized()
        up = back.cross(right).normalized()
        ortho_scale = CAMERA_CONFIG["isometric"]["orthoScale"]
    data = bpy.data.cameras.new(f"{view_id} camera")
    camera = bpy.data.objects.new(f"{view_id} camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = WORLD_CENTER + back * 900
    camera.matrix_world = Matrix((right, up, back)).transposed().to_4x4()
    camera.location = WORLD_CENTER + back * 900
    data.type = "ORTHO"
    data.ortho_scale = ortho_scale
    data.lens = 50
    data.dof.use_dof = False
    return camera


def configure_compositor(view_id: str) -> None:
    scene = bpy.context.scene
    scene.use_nodes = True
    nodes = scene.node_tree.nodes
    nodes.clear()
    links = scene.node_tree.links
    render_layers = nodes.new("CompositorNodeRLayers")
    composite = nodes.new("CompositorNodeComposite")
    links.new(render_layers.outputs["Image"], composite.inputs["Image"])
    scene.view_layers[0].use_pass_mist = True
    scene.world.mist_settings.use_mist = True
    scene.world.mist_settings.start = 650
    scene.world.mist_settings.depth = 500
    scene.world.mist_settings.falloff = "LINEAR"
    depth = nodes.new("CompositorNodeOutputFile")
    depth.name = "Gone linear depth output"
    depth.base_path = str(OUTPUT / "depth")
    depth.format.file_format = "PNG"
    depth.format.color_mode = "BW"
    depth.file_slots[0].path = f"{view_id}-"
    links.new(render_layers.outputs["Mist"], depth.inputs[0])


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "depth").mkdir(parents=True, exist_ok=True)
    (OUTPUT / "occlusion").mkdir(parents=True, exist_ok=True)
    environment = json.loads(ENVIRONMENT_PATH.read_text())
    clear_scene()
    setup_scene(environment)
    build_environment(environment)
    cameras = {view_id: camera_for(view_id) for view_id in ("view-0", "view-90", "view-180", "view-270", "view-top")}
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    for view_id, camera in cameras.items():
        bpy.context.scene.camera = camera
        configure_compositor(view_id)
        bpy.context.scene.render.filepath = str(OUTPUT / f"{view_id}.png")
        bpy.ops.render.render(write_still=True)
        depth_output = bpy.context.scene.node_tree.nodes.get("Gone linear depth output")
        if depth_output:
            depth_output.mute = True
        for hidden_name in ("Gone Architecture", "Gone Ground and Tracks", "Gone Props and Vehicles"):
            bpy.data.collections[hidden_name].hide_render = True
        bpy.context.scene.render.film_transparent = True
        bpy.context.scene.render.filepath = str(OUTPUT / "occlusion" / f"{view_id}.png")
        bpy.ops.render.render(write_still=True)
        bpy.context.scene.render.film_transparent = False
        for hidden_name in ("Gone Architecture", "Gone Ground and Tracks", "Gone Props and Vehicles"):
            bpy.data.collections[hidden_name].hide_render = False
        if depth_output:
            depth_output.mute = False
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


if __name__ == "__main__":
    main()
