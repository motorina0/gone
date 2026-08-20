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
import sys
from pathlib import Path

import bmesh
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
DISTRICT_BASE_SIZE = 4000
BACKDROP_SCALE = 4
RANDOM = random.Random(27081989)
BOX_MESHES: dict[str, bpy.types.Mesh] = {}
CYLINDER_MESHES: dict[tuple[int, str], bpy.types.Mesh] = {}
ICOSPHERE_MESHES: dict[tuple[int, str], bpy.types.Mesh] = {}
CONE_MESHES: dict[tuple[int, float, float, str], bpy.types.Mesh] = {}


def cylinder_mesh(vertices: int, mat: bpy.types.Material) -> bpy.types.Mesh:
    key = (vertices, mat.name)
    cached = CYLINDER_MESHES.get(key)
    if cached:
        return cached
    points = []
    for z in (-0.5, 0.5):
        points.extend(
            (0.5 * math.cos(math.tau * index / vertices), 0.5 * math.sin(math.tau * index / vertices), z)
            for index in range(vertices)
        )
    faces = [tuple(range(vertices - 1, -1, -1)), tuple(range(vertices, vertices * 2))]
    faces.extend(
        (index, (index + 1) % vertices, vertices + (index + 1) % vertices, vertices + index)
        for index in range(vertices)
    )
    mesh = bpy.data.meshes.new(f"Gone unit cylinder {vertices} — {mat.name}")
    mesh.from_pydata(points, [], faces)
    mesh.materials.append(mat)
    CYLINDER_MESHES[key] = mesh
    return mesh


def icosphere_mesh(subdivisions: int, mat: bpy.types.Material) -> bpy.types.Mesh:
    key = (subdivisions, mat.name)
    cached = ICOSPHERE_MESHES.get(key)
    if cached:
        return cached
    mesh = bpy.data.meshes.new(f"Gone unit icosphere {subdivisions} — {mat.name}")
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    ICOSPHERE_MESHES[key] = mesh
    return mesh


def cone_mesh(vertices: int, radius1: float, radius2: float, mat: bpy.types.Material) -> bpy.types.Mesh:
    key = (vertices, radius1, radius2, mat.name)
    cached = CONE_MESHES.get(key)
    if cached:
        return cached
    points = []
    for radius, z in ((radius1, -0.5), (radius2, 0.5)):
        points.extend(
            (radius * math.cos(math.tau * index / vertices), radius * math.sin(math.tau * index / vertices), z)
            for index in range(vertices)
        )
    faces = [tuple(range(vertices - 1, -1, -1)), tuple(range(vertices, vertices * 2))]
    faces.extend(
        (index, (index + 1) % vertices, vertices + (index + 1) % vertices, vertices + index)
        for index in range(vertices)
    )
    mesh = bpy.data.meshes.new(f"Gone tapered cylinder {vertices} — {mat.name}")
    mesh.from_pydata(points, [], faces)
    mesh.materials.append(mat)
    CONE_MESHES[key] = mesh
    return mesh


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
    texture_scale: float = 4.0,
    coat_weight: float = 0.0,
    coat_roughness: float = 0.18,
    bump_strength: float = 0.0,
    bump_distance: float = 0.12,
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
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat_weight
        principled.inputs["Coat Roughness"].default_value = coat_roughness
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
        mapping.inputs["Scale"].default_value = (texture_scale, texture_scale, texture_scale)
        coordinates = nodes.new("ShaderNodeTexCoord")
        result.node_tree.links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
        result.node_tree.links.new(mapping.outputs["Vector"], texture_node.inputs["Vector"])
        result.node_tree.links.new(texture_node.outputs["Color"], principled.inputs["Base Color"])
        if bump_strength > 0:
            grayscale = nodes.new("ShaderNodeRGBToBW")
            bump = nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = bump_strength
            bump.inputs["Distance"].default_value = bump_distance
            result.node_tree.links.new(texture_node.outputs["Color"], grayscale.inputs["Color"])
            result.node_tree.links.new(grayscale.outputs["Val"], bump.inputs["Height"])
            result.node_tree.links.new(bump.outputs["Normal"], principled.inputs["Normal"])
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
    if bevel >= 0.15:
        half_x, half_y, half_z = (dimension / 2 for dimension in dimensions)
        mesh = bpy.data.meshes.new(f"{name}-mesh")
        mesh.from_pydata(
            [
                (-half_x, -half_y, -half_z), (half_x, -half_y, -half_z),
                (half_x, half_y, -half_z), (-half_x, half_y, -half_z),
                (-half_x, -half_y, half_z), (half_x, -half_y, half_z),
                (half_x, half_y, half_z), (-half_x, half_y, half_z),
            ],
            [],
            [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)],
        )
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        obj.location = location
        obj.rotation_euler[2] = math.radians(rotation)
        bevel_modifier = obj.modifiers.new("Gone softened edges", "BEVEL")
        bevel_modifier.width = min(bevel, min(dimensions) * 0.24)
        bevel_modifier.segments = 2
        bevel_modifier.limit_method = "ANGLE"
        target.objects.link(obj)
        return obj
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


def add_rotated_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    rotation: tuple[float, float, float],
    bevel: float = 0.0,
) -> bpy.types.Object:
    obj = add_box(name, location, dimensions, mat, target, bevel=bevel)
    obj.rotation_euler = rotation
    return obj


def add_beam_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    vertices: int = 8,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    obj = bpy.data.objects.new(name, cylinder_mesh(vertices, mat))
    obj.location = tuple((start_vector + end_vector) / 2)
    obj.scale = (radius * 2, radius * 2, direction.length)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    target.objects.link(obj)
    return obj


def add_point_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    color_value: tuple[float, float, float],
    target: bpy.types.Collection,
    *,
    radius: float = 2.0,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.energy = energy
    data.color = color_value
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    target.objects.link(obj)
    return obj


def local_point(
    x: float,
    y: float,
    local_x: float,
    local_y: float,
    rotation: float,
) -> tuple[float, float]:
    angle = math.radians(rotation)
    return (
        x + local_x * math.cos(angle) - local_y * math.sin(angle),
        y + local_x * math.sin(angle) + local_y * math.cos(angle),
    )


def add_ico_sphere(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    subdivisions: int = 2,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, icosphere_mesh(subdivisions, mat))
    obj.location = location
    obj.scale = tuple(radius * component for component in scale)
    target.objects.link(obj)
    return obj


def add_text_sign(
    name: str,
    text: str,
    location: tuple[float, float, float],
    size: float,
    mat: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
) -> bpy.types.Object:
    data = bpy.data.curves.new(f"{name}-font", type="FONT")
    data.body = text
    data.align_x = "CENTER"
    data.align_y = "CENTER"
    data.size = size
    data.extrude = max(0.015, size * 0.035)
    data.bevel_depth = max(0.008, size * 0.012)
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
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
    obj = bpy.data.objects.new(name, cylinder_mesh(vertices, mat))
    obj.location = location
    obj.scale = (radius * 2, radius * 2, depth)
    obj.rotation_euler = rotation
    target.objects.link(obj)
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
    lit_window_mat: bpy.types.Material,
    trim_mat: bpy.types.Material,
    target: bpy.types.Collection,
) -> None:
    x, y = landmark["x"], landmark["y"]
    width, depth = landmark["width"], landmark["height"]
    floors = landmark.get("floors", max(1, min(5, int(building_height // 3.4))))
    for floor in range(floors):
        z = min(building_height - 1.1, 2.15 + floor * ((building_height - 1.8) / floors))
        for side, length in (("north", width), ("south", width)):
            columns = max(2, min(10, int(length // 8)))
            side_y = y - 0.04 if side == "north" else y + depth + 0.04
            for column_index in range(columns):
                wx = x + (column_index + 0.5) * width / columns
                window_width = min(2.4, width / columns * 0.52)
                window_material = (
                    lit_window_mat
                    if (floor * 11 + column_index * 5 + len(landmark["id"]) + (0 if side == "north" else 3)) % 13 == 0
                    else window_mat
                )
                add_box(
                    f"{landmark['id']}-{side}-window-{floor}-{column_index}",
                    (wx, side_y, z),
                    (window_width, 0.10, 1.25),
                    window_material,
                    target,
                    bevel=0.04,
                )
                add_box(
                    f"{landmark['id']}-{side}-sill-{floor}-{column_index}",
                    (wx, side_y + (-0.03 if side == "north" else 0.03), z - 0.72),
                    (min(2.8, width / columns * 0.62), 0.16, 0.11),
                    trim_mat,
                    target,
                )
                frame_y = side_y + (-0.035 if side == "north" else 0.035)
                for frame_side in (-1, 1):
                    add_box(
                        f"{landmark['id']}-{side}-window-frame-{floor}-{column_index}-{frame_side}",
                        (wx + frame_side * (window_width / 2 + 0.07), frame_y, z),
                        (0.12, 0.16, 1.55),
                        trim_mat,
                        target,
                    )
                add_box(
                    f"{landmark['id']}-{side}-window-lintel-{floor}-{column_index}",
                    (wx, frame_y, z + 0.74),
                    (window_width + 0.28, 0.16, 0.13),
                    trim_mat,
                    target,
                )
        for side, length in (("west", depth), ("east", depth)):
            columns = max(1, min(6, int(length // 8)))
            side_x = x - 0.04 if side == "west" else x + width + 0.04
            for column_index in range(columns):
                wy = y + (column_index + 0.5) * depth / columns
                window_width = min(2.4, depth / columns * 0.52)
                window_material = (
                    lit_window_mat
                    if (floor * 7 + column_index * 3 + len(landmark["id"]) + (0 if side == "west" else 5)) % 17 == 0
                    else window_mat
                )
                add_box(
                    f"{landmark['id']}-{side}-window-{floor}-{column_index}",
                    (side_x, wy, z),
                    (0.10, window_width, 1.25),
                    window_material,
                    target,
                    bevel=0.04,
                )
                add_box(
                    f"{landmark['id']}-{side}-sill-{floor}-{column_index}",
                    (side_x + (-0.03 if side == "west" else 0.03), wy, z - 0.72),
                    (0.16, min(2.8, depth / columns * 0.62), 0.11),
                    trim_mat,
                    target,
                )
                frame_x = side_x + (-0.035 if side == "west" else 0.035)
                for frame_side in (-1, 1):
                    add_box(
                        f"{landmark['id']}-{side}-window-frame-{floor}-{column_index}-{frame_side}",
                        (frame_x, wy + frame_side * (window_width / 2 + 0.07), z),
                        (0.16, 0.12, 1.55),
                        trim_mat,
                        target,
                    )
                add_box(
                    f"{landmark['id']}-{side}-window-lintel-{floor}-{column_index}",
                    (frame_x, wy, z + 0.74),
                    (0.16, window_width + 0.28, 0.13),
                    trim_mat,
                    target,
                )
    add_box(
        f"{landmark['id']}-foundation",
        (x + width / 2, y + depth / 2, 0.45),
        (width + 0.25, depth + 0.25, 0.9),
        trim_mat,
        target,
        bevel=0.08,
    )

    band_levels = {1.05, building_height - 0.55}
    if floors >= 3:
        band_levels.add(building_height * 0.52)
    for band_index, band_z in enumerate(sorted(band_levels)):
        add_box(
            f"{landmark['id']}-north-band-{band_index}",
            (x + width / 2, y - 0.07, band_z),
            (width + 0.35, 0.16, 0.22),
            trim_mat,
            target,
        )
        add_box(
            f"{landmark['id']}-south-band-{band_index}",
            (x + width / 2, y + depth + 0.07, band_z),
            (width + 0.35, 0.16, 0.22),
            trim_mat,
            target,
        )
        add_box(
            f"{landmark['id']}-west-band-{band_index}",
            (x - 0.07, y + depth / 2, band_z),
            (0.16, depth + 0.35, 0.22),
            trim_mat,
            target,
        )
        add_box(
            f"{landmark['id']}-east-band-{band_index}",
            (x + width + 0.07, y + depth / 2, band_z),
            (0.16, depth + 0.35, 0.22),
            trim_mat,
            target,
        )

    door_width = min(3.4, width * 0.12)
    add_box(
        f"{landmark['id']}-main-door",
        (x + width * 0.5, y + depth + 0.09, 1.45),
        (door_width, 0.18, 2.9),
        window_mat,
        target,
        bevel=0.16,
    )
    add_box(
        f"{landmark['id']}-main-door-canopy",
        (x + width * 0.5, y + depth + 0.72, 3.05),
        (door_width + 1.2, 1.4, 0.18),
        trim_mat,
        target,
        bevel=0.16,
    )


def add_building_dressing(
    landmark: dict,
    height: float,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
    lights: bpy.types.Collection,
) -> None:
    x, y = landmark["x"], landmark["y"]
    width, depth = landmark["width"], landmark["height"]
    for corner_index, (corner_x, corner_y) in enumerate(
        ((x, y), (x + width, y), (x, y + depth), (x + width, y + depth))
    ):
        add_box(
            f"{landmark['id']}-corner-pilaster-{corner_index}",
            (corner_x, corner_y, height * 0.50),
            (0.58, 0.58, height * 0.94),
            mats["trim"],
            target,
            bevel=0.08,
        )
    for side, gutter_y in (("north", y - 0.18), ("south", y + depth + 0.18)):
        add_beam_between(
            f"{landmark['id']}-{side}-gutter",
            (x - 0.35, gutter_y, height + 0.06),
            (x + width + 0.35, gutter_y, height + 0.06),
            0.13,
            mats["steel"],
            target,
            vertices=10,
        )
    for pipe_index, (pipe_x, pipe_y) in enumerate(
        (
            (x + 0.42, y - 0.22),
            (x + width - 0.42, y - 0.22),
            (x + 0.42, y + depth + 0.22),
            (x + width - 0.42, y + depth + 0.22),
        )
    ):
        add_cylinder(
            f"{landmark['id']}-downpipe-{pipe_index}",
            (pipe_x, pipe_y, height / 2),
            0.09,
            height,
            mats["steel"],
            target,
            vertices=10,
        )
    if landmark.get("roof", "pitched") not in ("flat", "open"):
        chimney_count = max(1, min(4, int(width // 32)))
        for chimney_index in range(chimney_count):
            chimney_x = x + width * (chimney_index + 1) / (chimney_count + 1)
            chimney_y = y + depth * (0.38 if chimney_index % 2 else 0.62)
            add_box(
                f"{landmark['id']}-chimney-{chimney_index}",
                (chimney_x, chimney_y, height + 1.15),
                (1.25, 1.05, 2.3),
                mats["brick"],
                target,
                bevel=0.10,
            )
            add_box(
                f"{landmark['id']}-chimney-cap-{chimney_index}",
                (chimney_x, chimney_y, height + 2.32),
                (1.48, 1.28, 0.18),
                mats["trim"],
                target,
                bevel=0.06,
            )
    if landmark["type"] == "station":
        entrance_x = x + width / 2
        facade_y = y + depth + 0.24
        arch_radius = min(3.2, width * 0.055)
        for arch_index in range(11):
            angle = math.pi * arch_index / 10
            arch_x = entrance_x + math.cos(angle) * arch_radius
            arch_z = 3.05 + math.sin(angle) * arch_radius
            add_rotated_box(
                f"{landmark['id']}-entrance-arch-{arch_index}",
                (arch_x, facade_y, arch_z),
                (0.72, 0.28, 0.48),
                mats["trim"],
                target,
                rotation=(0.0, -angle + math.pi / 2, 0.0),
                bevel=0.08,
            )
        for door_side in (-1, 1):
            add_box(
                f"{landmark['id']}-entrance-door-{door_side}",
                (entrance_x + door_side * 0.82, facade_y + 0.04, 1.58),
                (1.48, 0.18, 3.12),
                mats["glass_lit"],
                target,
                bevel=0.08,
            )
        for step_index in range(3):
            add_box(
                f"{landmark['id']}-entrance-step-{step_index}",
                (entrance_x, y + depth + 2.45 + step_index * 0.62, 0.10 + step_index * 0.10),
                (arch_radius * 2.8 - step_index * 0.4, 1.35, 0.20),
                mats["trim"],
                target,
                bevel=0.08,
            )
        for lamp_index, lamp_x in enumerate(
            (entrance_x - arch_radius * 1.35, entrance_x + arch_radius * 1.35)
        ):
            add_box(
                f"{landmark['id']}-facade-lamp-{lamp_index}",
                (lamp_x, facade_y + 0.05, 4.05),
                (0.46, 0.32, 0.82),
                mats["lamp"],
                target,
                bevel=0.12,
            )
            add_point_light(
                f"{landmark['id']}-facade-practical-{lamp_index}",
                (lamp_x, facade_y + 0.58, 3.85),
                155.0,
                (1.0, 0.56, 0.26),
                lights,
                radius=2.6,
            )


def add_car(prop: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = prop["x"], prop["y"]
    rotation = prop.get("rotation", 0)
    width = prop.get("width", 4.6)
    depth = prop.get("depth", 2.0)
    palette = [mats["car_red"], mats["car_blue"], mats["car_cream"], mats["car_green"]]
    body = palette[abs(int(x * 3 + y)) % len(palette)]
    add_box(f"car-{x}-{y}-lower-body", (x, y, 0.68), (width, depth, 0.66), body, target, bevel=0.28, rotation=rotation)
    hood_x, hood_y = local_point(x, y, width * 0.31, 0, rotation)
    trunk_x, trunk_y = local_point(x, y, -width * 0.33, 0, rotation)
    add_box(f"car-{x}-{y}-hood", (hood_x, hood_y, 1.02), (width * 0.3, depth * 0.94, 0.20), body, target, bevel=0.18, rotation=rotation)
    add_box(f"car-{x}-{y}-trunk", (trunk_x, trunk_y, 1.00), (width * 0.26, depth * 0.92, 0.18), body, target, bevel=0.16, rotation=rotation)
    cabin_x, cabin_y = local_point(x, y, -width * 0.02, 0, rotation)
    add_box(f"car-{x}-{y}-cabin", (cabin_x, cabin_y, 1.30), (width * 0.48, depth * 0.86, 0.68), mats["glass"], target, bevel=0.24, rotation=rotation)
    add_box(f"car-{x}-{y}-roof", (cabin_x, cabin_y, 1.67), (width * 0.39, depth * 0.82, 0.10), body, target, bevel=0.16, rotation=rotation)
    for side in (-1, 1):
        side_x, side_y = local_point(x, y, -width * 0.02, side * depth * 0.445, rotation)
        add_box(
            f"car-{x}-{y}-side-glass-{side}",
            (side_x, side_y, 1.34),
            (width * 0.40, 0.075, 0.48),
            mats["glass"],
            target,
            bevel=0.05,
            rotation=rotation,
        )
        for pillar_offset in (-width * 0.12, width * 0.11):
            pillar_x, pillar_y = local_point(x, y, pillar_offset, side * depth * 0.462, rotation)
            add_box(
                f"car-{x}-{y}-window-pillar-{side}-{pillar_offset}",
                (pillar_x, pillar_y, 1.35),
                (0.10, 0.08, 0.62),
                body,
                target,
                rotation=rotation,
            )
        handle_x, handle_y = local_point(x, y, -width * 0.18, side * depth * 0.492, rotation)
        add_box(
            f"car-{x}-{y}-door-handle-{side}",
            (handle_x, handle_y, 1.08),
            (0.30, 0.06, 0.06),
            mats["chrome"],
            target,
            bevel=0.03,
            rotation=rotation,
        )
        mirror_x, mirror_y = local_point(x, y, width * 0.18, side * depth * 0.57, rotation)
        add_box(
            f"car-{x}-{y}-mirror-{side}",
            (mirror_x, mirror_y, 1.38),
            (0.28, 0.14, 0.16),
            body,
            target,
            bevel=0.08,
            rotation=rotation,
        )
    for local_y in (-depth * 0.34, depth * 0.34):
        light_x, light_y = local_point(x, y, width * 0.505, local_y, rotation)
        add_box(f"car-{x}-{y}-headlamp-{local_y}", (light_x, light_y, 0.84), (0.10, 0.34, 0.24), mats["headlamp"], target, rotation=rotation)
        rear_x, rear_y = local_point(x, y, -width * 0.505, local_y, rotation)
        add_box(f"car-{x}-{y}-tail-{local_y}", (rear_x, rear_y, 0.82), (0.10, 0.30, 0.20), mats["tail_lamp"], target, rotation=rotation)
    for local_x, label in ((width * 0.515, "front"), (-width * 0.515, "rear")):
        bumper_x, bumper_y = local_point(x, y, local_x, 0, rotation)
        add_box(f"car-{x}-{y}-{label}-bumper", (bumper_x, bumper_y, 0.50), (0.10, depth * 0.84, 0.12), mats["chrome"], target, rotation=rotation)
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
            add_cylinder(
                f"car-{x}-{y}-wheel-hub",
                (wx, wy, 0.45),
                0.18,
                0.235,
                mats["wheel_hub"],
                target,
                vertices=16,
                rotation=(math.pi / 2, 0.0, math.radians(rotation)),
            )


def add_maintenance_vehicle(prop: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = prop["x"], prop["y"]
    rotation = prop.get("rotation", 0)
    width = prop.get("width", 6.2)
    depth = prop.get("depth", 2.4)
    cab_x, cab_y = local_point(x, y, width * 0.24, 0, rotation)
    bed_x, bed_y = local_point(x, y, -width * 0.24, 0, rotation)
    add_box(f"maintenance-{x}-{y}-chassis", (x, y, 0.62), (width, depth, 0.42), mats["steel"], target, bevel=0.18, rotation=rotation)
    add_box(f"maintenance-{x}-{y}-cab", (cab_x, cab_y, 1.40), (width * 0.4, depth, 1.34), mats["maintenance_yellow"], target, bevel=0.24, rotation=rotation)
    add_box(f"maintenance-{x}-{y}-glass", (cab_x + math.cos(math.radians(rotation)) * width * 0.205, cab_y + math.sin(math.radians(rotation)) * width * 0.205, 1.54), (0.10, depth * 0.72, 0.58), mats["glass"], target, rotation=rotation)
    add_box(f"maintenance-{x}-{y}-bed", (bed_x, bed_y, 1.00), (width * 0.45, depth * 0.9, 0.18), mats["maintenance_yellow"], target, bevel=0.16, rotation=rotation)
    add_cylinder(f"maintenance-{x}-{y}-beacon", (cab_x, cab_y, 2.16), 0.18, 0.28, mats["warning_lamp"], target, vertices=12)
    for local_x in (-width * 0.33, width * 0.31):
        for local_y in (-depth * 0.52, depth * 0.52):
            wheel_x, wheel_y = local_point(x, y, local_x, local_y, rotation)
            add_cylinder(
                f"maintenance-{x}-{y}-wheel-{local_x}-{local_y}",
                (wheel_x, wheel_y, 0.48),
                0.42,
                0.25,
                mats["rubber"],
                target,
                vertices=14,
                rotation=(math.pi / 2, 0.0, math.radians(rotation)),
            )


def add_platform_canopies(
    landmark: dict,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
    lights: bpy.types.Collection,
) -> None:
    x, y = landmark["x"], landmark["y"]
    platform_depth = landmark["height"]
    for segment_index, segment in enumerate(landmark.get("canopies", [])):
        length = segment["length"]
        center_x = x + segment["offset"] + length / 2
        center_y = y + platform_depth / 2 + segment.get("yOffset", 0)
        canopy_depth = segment.get("depth", min(8.5, platform_depth * 0.32))
        eave_z = 5.05
        ridge_z = 5.78
        half_depth = canopy_depth / 2
        slope = math.atan2(ridge_z - eave_z, half_depth)
        panel_depth = math.hypot(half_depth, ridge_z - eave_z)
        for side in (-1, 1):
            panel_y = center_y + side * canopy_depth * 0.25
            add_rotated_box(
                f"{landmark['id']}-canopy-roof-{segment_index}-{side}",
                (center_x, panel_y, (eave_z + ridge_z) / 2),
                (length, panel_depth, 0.18),
                mats["canopy_roof"],
                target,
                rotation=(-side * slope, 0.0, 0.0),
                bevel=0.12,
            )
            eave_y = center_y + side * half_depth
            add_beam_between(
                f"{landmark['id']}-canopy-gutter-{segment_index}-{side}",
                (center_x - length / 2, eave_y, eave_z - 0.06),
                (center_x + length / 2, eave_y, eave_z - 0.06),
                0.12,
                mats["steel"],
                target,
                vertices=10,
            )
            add_box(
                f"{landmark['id']}-canopy-valance-{segment_index}-{side}",
                (center_x, eave_y, eave_z - 0.25),
                (length, 0.12, 0.48),
                mats["corrugated"],
                target,
                bevel=0.04,
            )
        add_beam_between(
            f"{landmark['id']}-canopy-ridge-{segment_index}",
            (center_x - length / 2, center_y, ridge_z + 0.04),
            (center_x + length / 2, center_y, ridge_z + 0.04),
            0.13,
            mats["steel"],
            target,
            vertices=10,
        )
        frame_count = max(3, int(length // 12))
        frame_positions = [
            center_x - length / 2 + 1.6 + (length - 3.2) * index / frame_count
            for index in range(frame_count + 1)
        ]
        for frame_index, frame_x in enumerate(frame_positions):
            for side in (-1, 1):
                eave_y = center_y + side * half_depth
                add_beam_between(
                    f"{landmark['id']}-canopy-rafter-{segment_index}-{frame_index}-{side}",
                    (frame_x, eave_y, eave_z),
                    (frame_x, center_y, ridge_z),
                    0.105,
                    mats["steel"],
                    target,
                )
            add_beam_between(
                f"{landmark['id']}-canopy-tie-{segment_index}-{frame_index}",
                (frame_x, center_y - half_depth, eave_z - 0.10),
                (frame_x, center_y + half_depth, eave_z - 0.10),
                0.09,
                mats["steel"],
                target,
            )
            if frame_index % 2 == 0 or frame_index in (0, len(frame_positions) - 1):
                for post_y in (center_y - canopy_depth * 0.29, center_y + canopy_depth * 0.29):
                    add_cylinder(
                        f"{landmark['id']}-canopy-post-{segment_index}-{frame_index}-{post_y}",
                        (frame_x, post_y, (eave_z - 0.12) / 2),
                        0.15,
                        eave_z - 0.12,
                        mats["steel"],
                        target,
                        vertices=12,
                    )
                    add_box(
                        f"{landmark['id']}-canopy-post-foot-{segment_index}-{frame_index}-{post_y}",
                        (frame_x, post_y, 0.12),
                        (0.55, 0.55, 0.22),
                        mats["trim"],
                        target,
                        bevel=0.08,
                    )
        lamp_count = max(2, int(length // 18))
        for lamp_index in range(lamp_count):
            lamp_x = center_x - length / 2 + length * (lamp_index + 0.5) / lamp_count
            add_box(
                f"{landmark['id']}-canopy-light-{segment_index}-{lamp_index}",
                (lamp_x, center_y, 4.82),
                (1.25, 0.42, 0.12),
                mats["lamp"],
                target,
                bevel=0.12,
            )
            add_point_light(
                f"{landmark['id']}-canopy-practical-{segment_index}-{lamp_index}",
                (lamp_x, center_y, 4.62),
                105.0,
                (1.0, 0.63, 0.30),
                lights,
                radius=2.4,
            )


def add_footbridge(
    landmark: dict,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
    lights: bpy.types.Collection,
) -> None:
    x, y = landmark["x"], landmark["y"]
    width, depth = landmark["width"], landmark["height"]
    center_x, center_y = x + width / 2, y + depth / 2
    floor_z = 6.85
    eave_z = 9.20
    ridge_z = 10.05
    add_box(
        f"{landmark['id']}-walkway",
        (center_x, center_y, floor_z),
        (width, depth, 0.58),
        mats["platform"],
        target,
        bevel=0.12,
    )
    for side in (-1, 1):
        side_x = center_x + side * (width / 2 - 0.28)
        add_box(
            f"{landmark['id']}-rain-glass-{side}",
            (side_x, center_y, floor_z + 1.25),
            (0.16, depth - 1.2, 2.28),
            mats["bridge_glass"],
            target,
            bevel=0.04,
        )
        add_beam_between(
            f"{landmark['id']}-lower-rail-{side}",
            (side_x, y + 0.8, floor_z + 0.34),
            (side_x, y + depth - 0.8, floor_z + 0.34),
            0.10,
            mats["steel"],
            target,
        )
        add_beam_between(
            f"{landmark['id']}-upper-rail-{side}",
            (side_x, y + 0.8, eave_z),
            (side_x, y + depth - 0.8, eave_z),
            0.12,
            mats["steel"],
            target,
        )

    half_width = width / 2
    slope = math.atan2(ridge_z - eave_z, half_width)
    panel_width = math.hypot(half_width, ridge_z - eave_z)
    for side in (-1, 1):
        add_rotated_box(
            f"{landmark['id']}-roof-panel-{side}",
            (center_x + side * width * 0.25, center_y, (eave_z + ridge_z) / 2),
            (panel_width, depth, 0.18),
            mats["canopy_glass"],
            target,
            rotation=(0.0, side * slope, 0.0),
            bevel=0.08,
        )
    add_beam_between(
        f"{landmark['id']}-roof-ridge",
        (center_x, y, ridge_z),
        (center_x, y + depth, ridge_z),
        0.16,
        mats["steel"],
        target,
        vertices=10,
    )

    frame_spacing = 8.0
    frame_count = max(4, int(depth // frame_spacing))
    frame_ys = [y + 1.0 + (depth - 2.0) * index / frame_count for index in range(frame_count + 1)]
    for frame_index, frame_y in enumerate(frame_ys):
        for side in (-1, 1):
            frame_x = center_x + side * (width / 2 - 0.28)
            add_beam_between(
                f"{landmark['id']}-upright-{frame_index}-{side}",
                (frame_x, frame_y, floor_z + 0.18),
                (frame_x, frame_y, eave_z),
                0.13,
                mats["steel"],
                target,
                vertices=10,
            )
            add_beam_between(
                f"{landmark['id']}-rafter-{frame_index}-{side}",
                (frame_x, frame_y, eave_z),
                (center_x, frame_y, ridge_z),
                0.11,
                mats["steel"],
                target,
            )
        add_beam_between(
            f"{landmark['id']}-floor-crossbeam-{frame_index}",
            (x + 0.35, frame_y, floor_z - 0.28),
            (x + width - 0.35, frame_y, floor_z - 0.28),
            0.12,
            mats["steel"],
            target,
        )
        if frame_index < len(frame_ys) - 1:
            next_y = frame_ys[frame_index + 1]
            for side in (-1, 1):
                frame_x = center_x + side * (width / 2 - 0.28)
                if frame_index % 2 == 0:
                    brace_start = (frame_x, frame_y, floor_z + 0.45)
                    brace_end = (frame_x, next_y, eave_z - 0.18)
                else:
                    brace_start = (frame_x, frame_y, eave_z - 0.18)
                    brace_end = (frame_x, next_y, floor_z + 0.45)
                add_beam_between(
                    f"{landmark['id']}-diagonal-{frame_index}-{side}",
                    brace_start,
                    brace_end,
                    0.075,
                    mats["steel"],
                    target,
                )

    for support_y in (y + 4.0, y + depth - 4.0):
        for support_x in (x + 2.2, x + width - 2.2):
            add_cylinder(
                f"{landmark['id']}-support-{support_x}-{support_y}",
                (support_x, support_y, floor_z / 2),
                0.32,
                floor_z,
                mats["steel"],
                target,
                vertices=12,
            )
            add_box(
                f"{landmark['id']}-support-foot-{support_x}-{support_y}",
                (support_x, support_y, 0.14),
                (0.85, 0.85, 0.28),
                mats["trim"],
                target,
                bevel=0.08,
            )

    for stair_side, stair_y, direction in (("north", y + 1.0, -1), ("south", y + depth - 1.0, 1)):
        for step in range(16):
            step_z = 0.22 + step * 0.42
            step_center_y = stair_y - direction * step * 0.72
            add_box(
                f"{landmark['id']}-{stair_side}-step-{step}",
                (center_x, step_center_y, step_z),
                (width * 0.70, 1.54, 0.34),
                mats["platform"],
                target,
                bevel=0.05,
            )
        for side in (-1, 1):
            rail_x = center_x + side * width * 0.37
            add_beam_between(
                f"{landmark['id']}-{stair_side}-handrail-{side}",
                (rail_x, stair_y, 1.1),
                (rail_x, stair_y - direction * 10.8, floor_z + 1.0),
                0.08,
                mats["steel"],
                target,
            )

    light_count = max(4, int(depth // 20))
    for light_index in range(light_count):
        light_y = y + depth * (light_index + 0.5) / light_count
        add_box(
            f"{landmark['id']}-ceiling-light-{light_index}",
            (center_x, light_y, ridge_z - 0.62),
            (1.20, 0.38, 0.12),
            mats["lamp"],
            target,
            bevel=0.10,
        )
        add_point_light(
            f"{landmark['id']}-practical-{light_index}",
            (center_x, light_y, ridge_z - 0.82),
            90.0,
            (1.0, 0.61, 0.30),
            lights,
            radius=2.2,
        )


def add_clock_tower_details(
    landmark: dict,
    height: float,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
) -> None:
    x = landmark["x"] + landmark["width"] / 2
    y = landmark["y"] + landmark["height"] / 2
    radius = min(3.5, landmark["width"] * 0.22)
    face_z = height * 0.72
    for side, face_location, rotation in (
        ("north", (x, landmark["y"] - 0.16, face_z), (math.pi / 2, 0.0, 0.0)),
        ("south", (x, landmark["y"] + landmark["height"] + 0.16, face_z), (math.pi / 2, 0.0, 0.0)),
        ("west", (landmark["x"] - 0.16, y, face_z), (0.0, math.pi / 2, 0.0)),
        ("east", (landmark["x"] + landmark["width"] + 0.16, y, face_z), (0.0, math.pi / 2, 0.0)),
    ):
        add_cylinder(f"clock-{side}-rim", face_location, radius + 0.28, 0.22, mats["trim"], target, vertices=32, rotation=rotation)
        outward = Vector(face_location) - Vector((x, y, face_z))
        outward.normalize()
        clock_location = Vector(face_location) + outward * 0.14
        add_cylinder(f"clock-{side}-face", tuple(clock_location), radius, 0.18, mats["clock_face"], target, vertices=32, rotation=rotation)
        add_cylinder(f"clock-{side}-hub", tuple(clock_location + outward * 0.12), 0.18, 0.20, mats["clock_hand"], target, vertices=16, rotation=rotation)
    add_box("clock-tower-crown", (x, y, height + 0.9), (landmark["width"] * 0.74, landmark["height"] * 0.74, 1.8), mats["trim"], target, bevel=0.22)
    pitched_roof("clock-tower-spire", landmark["x"] + landmark["width"] * 0.18, landmark["y"] + landmark["height"] * 0.18, landmark["width"] * 0.64, landmark["height"] * 0.64, height + 1.8, mats["roof"], target)


def add_flat_roof_details(
    landmark: dict,
    height: float,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
) -> None:
    x, y, width, depth = landmark["x"], landmark["y"], landmark["width"], landmark["height"]
    for side_index, (location, dimensions) in enumerate((
        ((x + width / 2, y + 0.18, height + 0.48), (width, 0.36, 0.96)),
        ((x + width / 2, y + depth - 0.18, height + 0.48), (width, 0.36, 0.96)),
        ((x + 0.18, y + depth / 2, height + 0.48), (0.36, depth, 0.96)),
        ((x + width - 0.18, y + depth / 2, height + 0.48), (0.36, depth, 0.96)),
    )):
        add_box(f"{landmark['id']}-parapet-{side_index}", location, dimensions, mats["trim"], target)
    for unit_index in range(max(1, min(4, int(width // 28)))):
        unit_x = x + width * (unit_index + 1) / (max(1, min(4, int(width // 28))) + 1)
        add_box(f"{landmark['id']}-roof-unit-{unit_index}", (unit_x, y + depth * 0.52, height + 0.85), (3.4, 2.2, 1.2), mats["steel"], target, bevel=0.16)


def add_train(prop: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = prop["x"], prop["y"]
    length = prop.get("width", 34)
    depth = prop.get("depth", 4.2)
    height = prop.get("height", 3.8)
    rotation = prop.get("rotation", 0)
    body_mat = mats["train_blue"] if prop["type"] == "regional-train" else mats["train_freight"]
    add_box(f"{prop['type']}-{x}-{y}-underframe", (x, y, 0.78), (length * 0.96, depth * 0.78, 0.54), mats["steel"], target, bevel=0.16, rotation=rotation)
    add_box(f"{prop['type']}-{x}-{y}", (x, y, height / 2 + 0.45), (length, depth, height), body_mat, target, bevel=0.34, rotation=rotation)
    add_box(f"{prop['type']}-{x}-{y}-roof", (x, y, height + 0.65), (length * 0.96, depth * 0.92, 0.28), mats["corrugated"], target, bevel=0.18, rotation=rotation)
    for wheel_offset in (-length * 0.32, length * 0.32):
        for side in (-1, 1):
            wheel_x, wheel_y = local_point(x, y, wheel_offset, side * depth * 0.43, rotation)
            add_cylinder(
                f"{prop['type']}-{x}-{y}-wheel-{wheel_offset}-{side}",
                (wheel_x, wheel_y, 0.55),
                0.58,
                0.32,
                mats["rubber"],
                target,
                vertices=16,
                rotation=(math.pi / 2, 0.0, math.radians(rotation)),
            )
    if prop["type"] == "regional-train":
        for offset in range(int(-length / 2 + 3), int(length / 2 - 2), 4):
            for side in (-1, 1):
                lx, ly = offset, side * (depth / 2 + 0.04)
                wx, wy = local_point(x, y, lx, ly, rotation)
                add_box(f"train-window-{x}-{y}-{offset}-{side}", (wx, wy, 2.75), (2.2, 0.10, 1.05), mats["glass"], target, bevel=0.08, rotation=rotation)
        for door_offset in (-length * 0.28, length * 0.28):
            for side in (-1, 1):
                door_x, door_y = local_point(x, y, door_offset, side * (depth / 2 + 0.07), rotation)
                add_box(f"train-door-{x}-{y}-{door_offset}-{side}", (door_x, door_y, 2.15), (1.45, 0.12, 2.65), mats["train_door"], target, bevel=0.04, rotation=rotation)
        for side in (-1, 1):
            stripe_x, stripe_y = local_point(x, y, 0, side * (depth / 2 + 0.09), rotation)
            add_box(f"train-stripe-{x}-{y}-{side}", (stripe_x, stripe_y, 1.56), (length * 0.9, 0.08, 0.20), mats["train_stripe"], target, rotation=rotation)
        for end in (-1, 1):
            for side in (-0.8, 0.8):
                lamp_x, lamp_y = local_point(x, y, end * (length / 2 + 0.05), side, rotation)
                add_box(f"train-end-lamp-{x}-{y}-{end}-{side}", (lamp_x, lamp_y, 1.32), (0.12, 0.24, 0.24), mats["headlamp"], target, rotation=rotation)
    else:
        for rib_offset in range(int(-length / 2 + 2), int(length / 2), 3):
            for side in (-1, 1):
                rib_x, rib_y = local_point(x, y, rib_offset, side * (depth / 2 + 0.07), rotation)
                add_box(f"freight-rib-{x}-{y}-{rib_offset}-{side}", (rib_x, rib_y, 2.1), (0.16, 0.10, height * 0.82), mats["steel"], target, rotation=rotation)


def add_tree(index: int, tree: dict, mats: dict[str, bpy.types.Material], target: bpy.types.Collection) -> None:
    x, y = tree["x"], tree["y"]
    size = tree.get("size", 1.0)
    local_random = random.Random(9817 + index * 193)
    trunk_height = local_random.uniform(5.2, 6.4) * size
    trunk = bpy.data.objects.new(
        f"tree-{index}-tapered-trunk",
        cone_mesh(12, 0.62, 0.34, mats["bark"]),
    )
    trunk.location = (x, y, trunk_height / 2)
    trunk.scale = (size, size, trunk_height)
    target.objects.link(trunk)
    branch_ends: list[tuple[float, float, float]] = []
    for branch_index in range(9):
        angle = local_random.uniform(0, math.tau)
        branch_length = local_random.uniform(2.0, 3.9) * size
        start_z = local_random.uniform(trunk_height * 0.48, trunk_height * 0.93)
        end_z = start_z + local_random.uniform(1.0, 2.7) * size
        end = (
            x + math.cos(angle) * branch_length,
            y + math.sin(angle) * branch_length,
            end_z,
        )
        branch_ends.append(end)
        add_beam_between(
            f"tree-{index}-branch-{branch_index}",
            (x, y, start_z),
            end,
            local_random.uniform(0.11, 0.22) * size,
            mats["bark"],
            target,
            vertices=8,
        )
    crown_centers = [(x, y, trunk_height + 1.5 * size), *branch_ends]
    for crown_index in range(22):
        anchor = crown_centers[crown_index % len(crown_centers)]
        radius = local_random.uniform(0.9, 1.75) * size
        location = (
            anchor[0] + local_random.uniform(-1.15, 1.15) * size,
            anchor[1] + local_random.uniform(-1.15, 1.15) * size,
            anchor[2] + local_random.uniform(-0.55, 1.05) * size,
        )
        add_ico_sphere(
            f"tree-{index}-crown-{crown_index}",
            location,
            radius,
            mats["leaves_a"] if (index + crown_index) % 2 else mats["leaves_b"],
            target,
            scale=(
                local_random.uniform(0.78, 1.25),
                local_random.uniform(0.78, 1.25),
                local_random.uniform(0.62, 1.05),
            ),
            subdivisions=1,
        )
    for root_index, angle in enumerate((20, 92, 154, 228, 302)):
        root_x, root_y = local_point(x, y, 1.15 * size, 0, angle)
        add_beam_between(
            f"tree-{index}-root-{root_index}",
            (x, y, 0.28 * size),
            (root_x, root_y, 0.10 * size),
            0.12 * size,
            mats["bark"],
            target,
            vertices=7,
        )


def add_road_details(
    surface: dict,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
) -> None:
    x, y, width, depth = surface["x"], surface["y"], surface["width"], surface["height"]
    horizontal = width >= depth
    if surface.get("markings") == "two-lane":
        length = width if horizontal else depth
        for offset in range(9, int(length), 18):
            location = (x + offset, y + depth / 2, 0.16) if horizontal else (x + width / 2, y + offset, 0.16)
            dimensions = (7.2, 0.22, 0.028) if horizontal else (0.22, 7.2, 0.028)
            add_box(f"{surface['id']}-center-dash-{offset}", location, dimensions, mats["road_marking"], target)
        for side in (-1, 1):
            location = (x + width / 2, y + depth / 2 + side * (depth / 2 - 2.2), 0.16) if horizontal else (x + width / 2 + side * (width / 2 - 2.2), y + depth / 2, 0.16)
            dimensions = (width, 0.16, 0.028) if horizontal else (0.16, depth, 0.028)
            add_box(f"{surface['id']}-edge-line-{side}", location, dimensions, mats["road_marking_faded"], target)
        drain_length = width if horizontal else depth
        for offset in range(18, int(drain_length), 54):
            for side in (-1, 1):
                location = (x + offset, y + depth / 2 + side * (depth / 2 - 0.9), 0.17) if horizontal else (x + width / 2 + side * (width / 2 - 0.9), y + offset, 0.17)
                dimensions = (1.5, 0.55, 0.035) if horizontal else (0.55, 1.5, 0.035)
                add_box(f"{surface['id']}-drain-{offset}-{side}", location, dimensions, mats["drain"], target, bevel=0.16)
    elif surface.get("markings") == "parking":
        bay_depth = min(10, depth * 0.34)
        for offset in range(8, int(width), 10):
            add_box(f"{surface['id']}-parking-line-{offset}-north", (x + offset, y + bay_depth / 2 + 1, 0.16), (0.16, bay_depth, 0.025), mats["road_marking_faded"], target)
            add_box(f"{surface['id']}-parking-line-{offset}-south", (x + offset, y + depth - bay_depth / 2 - 1, 0.16), (0.16, bay_depth, 0.025), mats["road_marking_faded"], target)
    if surface["type"] in ("road", "yard") and width > 10 and depth > 6:
        local_random = random.Random(sum(ord(character) for character in surface["id"]) * 743)
        patch_count = max(5, min(28, int(width * depth // 1400)))
        for patch_index in range(patch_count):
            patch_x = local_random.uniform(x + 2, x + width - 2)
            patch_y = local_random.uniform(y + 1.5, y + depth - 1.5)
            patch_width = local_random.uniform(2.0, min(9.0, width * 0.12))
            patch_depth = local_random.uniform(0.7, min(3.4, depth * 0.18))
            add_box(
                f"{surface['id']}-asphalt-repair-{patch_index}",
                (patch_x, patch_y, 0.158),
                (patch_width, patch_depth, 0.022),
                mats["asphalt_patch"],
                target,
                bevel=0.20,
                rotation=local_random.uniform(-12, 12),
            )
        for crack_index in range(max(4, patch_count // 2)):
            crack_x = local_random.uniform(x + 2, x + width - 2)
            crack_y = local_random.uniform(y + 1, y + depth - 1)
            crack_length = local_random.uniform(1.6, 5.2)
            angle = local_random.uniform(0, 180)
            crack_end_x, crack_end_y = local_point(crack_x, crack_y, crack_length, 0, angle)
            add_beam_between(
                f"{surface['id']}-crack-{crack_index}",
                (crack_x, crack_y, 0.181),
                (crack_end_x, crack_end_y, 0.181),
                0.026,
                mats["joint"],
                target,
                vertices=6,
            )


def add_platform_surface_details(
    landmark: dict,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
) -> None:
    x, y, width, depth = landmark["x"], landmark["y"], landmark["width"], landmark["height"]
    for side in (-1, 1):
        edge_y = y + depth / 2 + side * (depth / 2 - 0.65)
        add_box(
            f"{landmark['id']}-safety-edge-{side}",
            (x + width / 2, edge_y, 0.10),
            (width - 1.2, 0.48, 0.05),
            mats["platform_edge"],
            target,
        )
        warning_y = y + depth / 2 + side * (depth / 2 - 1.45)
        add_box(
            f"{landmark['id']}-warning-line-{side}",
            (x + width / 2, warning_y, 0.105),
            (width - 1.6, 0.16, 0.055),
            mats["warning_line"],
            target,
        )
        for tactile_offset in range(3, int(width - 2), 4):
            add_box(
                f"{landmark['id']}-tactile-{side}-{tactile_offset}",
                (x + tactile_offset, warning_y, 0.14),
                (1.15, 0.42, 0.08),
                mats["tactile"],
                target,
                bevel=0.06,
            )
        for seam_offset in range(5, int(width), 5):
            add_box(
                f"{landmark['id']}-edge-seam-{side}-{seam_offset}",
                (x + seam_offset, edge_y, 0.15),
                (0.05, 0.56, 0.05),
                mats["joint"],
                target,
            )
    for tile_offset in range(10, int(width), 12):
        add_box(
            f"{landmark['id']}-tile-joint-{tile_offset}",
            (x + tile_offset, y + depth / 2, 0.108),
            (0.055, depth - 2.0, 0.025),
            mats["joint"],
            target,
        )
    for row_offset in range(4, int(depth - 2), 4):
        add_box(
            f"{landmark['id']}-tile-row-{row_offset}",
            (x + width / 2, y + row_offset, 0.109),
            (width - 2.0, 0.045, 0.026),
            mats["joint"],
            target,
        )
    for drain_offset in range(24, int(width), 48):
        add_box(
            f"{landmark['id']}-drain-{drain_offset}",
            (x + drain_offset, y + depth / 2, 0.145),
            (1.7, 0.62, 0.06),
            mats["drain"],
            target,
            bevel=0.10,
        )
        for slot in (-0.45, -0.15, 0.15, 0.45):
            add_box(
                f"{landmark['id']}-drain-slot-{drain_offset}-{slot}",
                (x + drain_offset + slot, y + depth / 2, 0.18),
                (0.08, 0.54, 0.025),
                mats["joint"],
                target,
            )
    local_random = random.Random(sum(ord(character) for character in landmark["id"]) * 981)
    for stain_index in range(max(12, int(width // 18))):
        stain_x = local_random.uniform(x + 2.5, x + width - 2.5)
        stain_y = local_random.uniform(y + 2.2, y + depth - 2.2)
        add_box(
            f"{landmark['id']}-rain-stain-{stain_index}",
            (stain_x, stain_y, 0.135),
            (local_random.uniform(1.3, 4.5), local_random.uniform(0.35, 1.15), 0.018),
            mats["water"],
            target,
            bevel=0.24,
            rotation=local_random.uniform(-18, 18),
        )


def add_station_furniture(
    index: int,
    prop: dict,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
    lights: bpy.types.Collection,
) -> None:
    kind = prop["type"]
    x, y = prop["x"], prop["y"]
    rotation = prop.get("rotation", 0)
    if kind == "bench":
        add_box(f"bench-{index}-seat", (x, y, 0.70), (3.2, 0.72, 0.18), mats["bench_wood"], target, bevel=0.16, rotation=rotation)
        back_x, back_y = local_point(x, y, 0, 0.34, rotation)
        add_box(f"bench-{index}-back", (back_x, back_y, 1.22), (3.2, 0.16, 0.88), mats["bench_wood"], target, bevel=0.16, rotation=rotation)
        for local_x in (-1.25, 1.25):
            for local_y in (-0.24, 0.24):
                leg_x, leg_y = local_point(x, y, local_x, local_y, rotation)
                add_box(f"bench-{index}-leg-{local_x}-{local_y}", (leg_x, leg_y, 0.34), (0.12, 0.12, 0.68), mats["steel"], target, rotation=rotation)
    elif kind == "lamp":
        height = prop.get("height", 6.4)
        add_cylinder(f"lamp-{index}-post", (x, y, height / 2), 0.13, height, mats["steel"], target, vertices=12)
        add_box(f"lamp-{index}-crossbar", (x, y, height - 0.18), (1.55, 0.16, 0.14), mats["steel"], target, bevel=0.16, rotation=rotation)
        for side in (-0.62, 0.62):
            lamp_x, lamp_y = local_point(x, y, side, 0, rotation)
            add_box(f"lamp-{index}-light-{side}", (lamp_x, lamp_y, height - 0.40), (0.62, 0.42, 0.26), mats["lamp"], target, bevel=0.18, rotation=rotation)
        if prop.get("castsLight", True):
            add_point_light(
                f"Gone platform lamp {index}",
                (x, y, height - 0.65),
                prop.get("energy", 92),
                (1.0, 0.64, 0.32),
                lights,
                radius=3.4,
            )
    elif kind == "bin":
        add_cylinder(f"bin-{index}", (x, y, 0.55), 0.36, 1.10, mats["steel"], target, vertices=16)
        add_cylinder(f"bin-{index}-rim", (x, y, 1.14), 0.40, 0.10, mats["trim"], target, vertices=16)
    elif kind == "bollard":
        add_cylinder(f"bollard-{index}", (x, y, 0.52), 0.16, 1.04, mats["bollard"], target, vertices=12)
        add_box(f"bollard-{index}-reflector", (x, y, 0.78), (0.34, 0.34, 0.12), mats["warning_line"], target, bevel=0.16)
    elif kind == "platform-sign":
        height = prop.get("height", 3.7)
        add_cylinder(f"sign-{index}-post", (x, y, height / 2), 0.10, height, mats["steel"], target, vertices=10)
        board_width = prop.get("width", 3.4)
        add_box(f"sign-{index}-board", (x, y, height), (board_width, 0.18, 1.25), mats["sign_blue"], target, bevel=0.18, rotation=rotation)
        if prop.get("text"):
            add_text_sign(f"sign-{index}-label", prop["text"], (x, y + 0.12, height), 0.72, mats["sign_text"], target)
    elif kind == "signal":
        height = prop.get("height", 5.4)
        add_cylinder(f"signal-{index}-post", (x, y, height / 2), 0.13, height, mats["steel"], target, vertices=12)
        add_box(f"signal-{index}-head", (x, y, height - 0.45), (0.72, 0.48, 1.65), mats["signal_black"], target, bevel=0.18, rotation=rotation)
        for lens_index, (lens_z, lens_mat) in enumerate(((height, mats["signal_red"]), (height - 0.48, mats["signal_amber"]), (height - 0.96, mats["signal_green"]))):
            lens_x, lens_y = local_point(x, y, 0, -0.27, rotation)
            add_ico_sphere(f"signal-{index}-lens-{lens_index}", (lens_x, lens_y, lens_z), 0.18, lens_mat, target, scale=(1.0, 0.35, 1.0))
    elif kind == "kiosk":
        width, depth, height = prop.get("width", 4.8), prop.get("depth", 3.2), prop.get("height", 3.0)
        add_box(f"kiosk-{index}-body", (x, y, height / 2), (width, depth, height), mats["plaster_warm"], target, bevel=0.22, rotation=rotation)
        counter_x, counter_y = local_point(x, y, 0, -depth / 2 - 0.08, rotation)
        add_box(f"kiosk-{index}-window", (counter_x, counter_y, 1.85), (width * 0.72, 0.12, 1.2), mats["glass_lit"], target, rotation=rotation)
        awning_x, awning_y = local_point(x, y, 0, -depth / 2 - 0.65, rotation)
        add_box(f"kiosk-{index}-awning", (awning_x, awning_y, 2.75), (width * 0.92, 1.35, 0.16), mats["awning"], target, bevel=0.16, rotation=rotation)
    elif kind == "planter":
        add_box(f"planter-{index}", (x, y, 0.42), (prop.get("width", 2.2), prop.get("depth", 1.4), 0.84), mats["masonry"], target, bevel=0.18, rotation=rotation)
        for shrub_index, local_x in enumerate((-0.55, 0.0, 0.55)):
            shrub_x, shrub_y = local_point(x, y, local_x, 0, rotation)
            add_ico_sphere(f"planter-{index}-shrub-{shrub_index}", (shrub_x, shrub_y, 1.18), 0.62, mats["leaves_b"], target, scale=(1.0, 0.82, 0.72))
    elif kind == "crate-stack":
        for crate_index, (ox, oy, oz) in enumerate(((0, 0, 0.45), (1.25, 0, 0.45), (0.4, 0.2, 1.35))):
            crate_x, crate_y = local_point(x, y, ox, oy, rotation)
            add_box(f"crate-{index}-{crate_index}", (crate_x, crate_y, oz), (1.1, 1.0, 0.9), mats["crate"], target, bevel=0.16, rotation=rotation)
    elif kind == "utility-cabinet":
        add_box(f"cabinet-{index}", (x, y, 1.05), (prop.get("width", 1.4), prop.get("depth", 0.8), 2.1), mats["steel"], target, bevel=0.18, rotation=rotation)
        add_box(f"cabinet-{index}-warning", (x, y - 0.43, 1.26), (0.46, 0.06, 0.52), mats["warning_lamp"], target, rotation=rotation)
    elif kind == "crosswalk":
        width = prop.get("width", 14)
        depth = prop.get("depth", 6)
        stripe_count = max(4, int(width // 1.7))
        for stripe_index in range(stripe_count):
            local_x = -width / 2 + (stripe_index + 0.5) * width / stripe_count
            stripe_x, stripe_y = local_point(x, y, local_x, 0, rotation)
            add_box(
                f"crosswalk-{index}-{stripe_index}",
                (stripe_x, stripe_y, 0.185),
                (width / stripe_count * 0.58, depth, 0.03),
                mats["road_marking_faded"],
                target,
                rotation=rotation,
            )
    elif kind == "gantry":
        span = prop.get("width", 44)
        height = prop.get("height", 8.4)
        for side in (-1, 1):
            post_x, post_y = local_point(x, y, 0, side * span / 2, rotation)
            add_box(f"gantry-{index}-post-{side}", (post_x, post_y, height / 2), (0.36, 0.36, height), mats["steel"], target, bevel=0.16, rotation=rotation)
        add_box(f"gantry-{index}-beam", (x, y, height), (0.38, span, 0.38), mats["steel"], target, bevel=0.16, rotation=rotation)
        for wire_offset in (-span * 0.34, -span * 0.11, span * 0.11, span * 0.34):
            insulator_x, insulator_y = local_point(x, y, 0, wire_offset, rotation)
            add_cylinder(f"gantry-{index}-insulator-{wire_offset}", (insulator_x, insulator_y, height - 0.65), 0.10, 1.3, mats["trim"], target, vertices=10)
            add_box(f"gantry-{index}-hanger-{wire_offset}", (insulator_x, insulator_y, height - 1.35), (0.06, 0.06, 0.36), mats["rail"], target)
    elif kind == "fence":
        length = prop.get("width", 20)
        height = prop.get("height", 2.2)
        post_count = max(2, int(length // 4))
        for post_index in range(post_count + 1):
            local_x = -length / 2 + length * post_index / post_count
            post_x, post_y = local_point(x, y, local_x, 0, rotation)
            add_box(f"fence-{index}-post-{post_index}", (post_x, post_y, height / 2), (0.10, 0.10, height), mats["steel"], target, rotation=rotation)
        for rail_z in (0.65, 1.35, 2.05):
            add_box(f"fence-{index}-rail-{rail_z}", (x, y, rail_z), (length, 0.08, 0.08), mats["steel"], target, rotation=rotation)
    elif kind == "service-cart":
        width = prop.get("width", 3.6)
        depth = prop.get("depth", 1.5)
        add_box(f"cart-{index}-deck", (x, y, 0.58), (width, depth, 0.22), mats["maintenance_yellow"], target, bevel=0.16, rotation=rotation)
        rail_x, rail_y = local_point(x, y, -width * 0.42, 0, rotation)
        add_box(f"cart-{index}-rail", (rail_x, rail_y, 1.05), (0.10, depth, 0.92), mats["steel"], target, rotation=rotation)
        for local_x in (-width * 0.32, width * 0.32):
            for local_y in (-depth * 0.46, depth * 0.46):
                wheel_x, wheel_y = local_point(x, y, local_x, local_y, rotation)
                add_cylinder(f"cart-{index}-wheel-{local_x}-{local_y}", (wheel_x, wheel_y, 0.35), 0.22, 0.14, mats["rubber"], target, vertices=12, rotation=(math.pi / 2, 0.0, math.radians(rotation)))


def add_distant_scenery(
    environment: dict,
    mats: dict[str, bpy.types.Material],
    target: bpy.types.Collection,
) -> None:
    for surface in environment.get("distantSurfaces", []):
        surface_mat = mats["platform"] if surface["type"] in ("sidewalk", "plaza") else mats["asphalt"]
        add_box(
            surface["id"],
            (surface["x"] + surface["width"] / 2, surface["y"] + surface["height"] / 2, 0.07),
            (surface["width"], surface["height"], 0.14),
            surface_mat,
            target,
            bevel=0.18,
        )
        add_road_details(surface, mats, target)
    for index, item in enumerate(environment.get("distantScenery", [])):
        kind = item["type"]
        x, y = item["x"], item["y"]
        if kind == "building":
            width, depth, height = item["width"], item["height"], item.get("elevation", 10)
            mat = mats["brick"] if item.get("material") == "brick" else mats["plaster_cool"]
            add_box(f"distant-building-{item['id']}", (x + width / 2, y + depth / 2, height / 2), (width, depth, height), mat, target, bevel=0.22, rotation=item.get("rotation", 0))
            pitched_roof(f"distant-building-{item['id']}-roof", x, y, width, depth, height, mats["roof"], target)
        elif kind == "warehouse":
            width, depth, height = item["width"], item["height"], item.get("elevation", 7)
            add_box(f"distant-warehouse-{item['id']}", (x + width / 2, y + depth / 2, height / 2), (width, depth, height), mats["corrugated"], target, bevel=0.22, rotation=item.get("rotation", 0))
            pitched_roof(f"distant-warehouse-{item['id']}-roof", x, y, width, depth, height, mats["roof"], target)
        elif kind == "tree":
            add_tree(1000 + index, item, mats, target)
        elif kind == "tank":
            radius = item.get("width", 6) / 2
            height = item.get("elevation", 12)
            add_cylinder(f"distant-tank-{item['id']}", (x, y, height / 2), radius, height, mats["steel"], target, vertices=24)
            add_cylinder(f"distant-tank-{item['id']}-cap", (x, y, height + 0.35), radius * 1.04, 0.7, mats["corrugated"], target, vertices=24)


def build_environment(environment: dict) -> None:
    architecture = collection("Gone Architecture")
    occluders = collection("Gone Occluders")
    surfaces = collection("Gone Ground and Tracks")
    props = collection("Gone Props and Vehicles")
    foliage = collection("Gone Foliage")
    lights = collection("Gone Practical Lights")
    distant = collection("Gone Distant District")
    atmosphere = environment["atmosphere"]
    mats = {
        "ground": material("Wet station ground", atmosphere["groundDark"], texture="industrial-wet-asphalt.png", roughness=0.42, texture_scale=80, coat_weight=0.28, bump_strength=0.18, bump_distance=0.08),
        "asphalt": material("Wet asphalt", "#303a3d", texture="industrial-wet-asphalt.png", roughness=0.34, texture_scale=36, coat_weight=0.55, coat_roughness=0.12, bump_strength=0.24, bump_distance=0.06),
        "platform": material("Vatra platform concrete", "#77756f", texture="vatra-platform-concrete.png", roughness=0.56, texture_scale=22, coat_weight=0.22, bump_strength=0.38, bump_distance=0.09),
        "ballast": material("Rail ballast", "#34383a", texture="vatra-platform-concrete.png", roughness=0.86, texture_scale=30, bump_strength=0.55, bump_distance=0.18),
        "steel": material("Vatra aged steel", "#343b3b", texture="vatra-aged-steel.png", roughness=0.38, metallic=0.55, texture_scale=8, bump_strength=0.18, bump_distance=0.04),
        "rail": material("Polished rail", "#6b7070", roughness=0.22, metallic=0.85),
        "rail_dark": material("Rail foot oxidized steel", "#323737", roughness=0.52, metallic=0.72),
        "rail_highlight": material("Rain-polished rail head", "#a9b0ae", roughness=0.12, metallic=0.94, coat_weight=0.24),
        "rail_fastener": material("Rail fasteners", "#4e4138", roughness=0.64, metallic=0.62),
        "catenary": material("Oxidized catenary wire", "#252c2c", roughness=0.46, metallic=0.80),
        "sleeper": material("Creosote sleepers", "#221d1a", roughness=0.82),
        "masonry": material("Weathered masonry", "#79756c", texture="weathered-masonry.png", roughness=0.82, texture_scale=7, bump_strength=0.42, bump_distance=0.12),
        "brick": material("Vatra wet brick", "#6a3b32", texture="vatra-wet-brick.png", roughness=0.78, texture_scale=8, bump_strength=0.48, bump_distance=0.11),
        "plaster_cool": material("Vatra cool plaster", "#718087", texture="vatra-painted-plaster.png", roughness=0.76, texture_scale=5, bump_strength=0.30, bump_distance=0.08),
        "plaster_warm": material("Vatra warm plaster", "#8c8274", texture="vatra-painted-plaster.png", roughness=0.78, texture_scale=5, bump_strength=0.30, bump_distance=0.08),
        "corrugated": material("Vatra corrugated metal", "#38484a", texture="vatra-corrugated-metal.png", roughness=0.58, metallic=0.34, texture_scale=10, bump_strength=0.36, bump_distance=0.08),
        "canopy_roof": material("Vatra platform canopy", "#41616a", texture="vatra-corrugated-metal.png", roughness=0.46, metallic=0.42, texture_scale=14, coat_weight=0.16, bump_strength=0.34, bump_distance=0.06),
        "canopy_glass": material("Rain-marked canopy glass", "#45636b", roughness=0.20, metallic=0.04, transmission=0.24, alpha=0.82, coat_weight=0.30),
        "bridge_glass": material("Rain-marked bridge glass", "#2d4a53", roughness=0.22, metallic=0.05, transmission=0.30, alpha=0.70, coat_weight=0.26),
        "roof": material("Weathered station roof", "#373631", texture="weathered-roof.png", roughness=0.66, metallic=0.12, texture_scale=7, bump_strength=0.44, bump_distance=0.11),
        "glass": material("Rain-dark glass", "#18333b", roughness=0.18, metallic=0.08, transmission=0.18),
        "glass_lit": material("Occupied warm glass", "#65462d", roughness=0.24, emission="#d79b5d", emission_strength=1.15),
        "trim": material("Stone trim", "#aaa28f", roughness=0.78),
        "rubber": material("Tyre rubber", "#121514", roughness=0.91),
        "bark": material("Wet bark", "#3a2c21", roughness=0.92),
        "leaves_a": material("Vatra foliage dark", "#183c27", roughness=0.86),
        "leaves_b": material("Vatra foliage light", "#2e6038", roughness=0.84),
        "car_red": material("Gone vehicle oxblood", "#62372f", roughness=0.42, metallic=0.18, coat_weight=0.52),
        "car_blue": material("Gone vehicle blue", "#344f5b", roughness=0.40, metallic=0.18, coat_weight=0.52),
        "car_cream": material("Gone vehicle cream", "#837d67", roughness=0.44, metallic=0.12, coat_weight=0.46),
        "car_green": material("Gone vehicle green", "#354b3c", roughness=0.42, metallic=0.16, coat_weight=0.50),
        "train_blue": material("Vatra regional blue", "#375f70", roughness=0.42, metallic=0.22),
        "train_freight": material("Vatra freight red", "#643d35", roughness=0.72, metallic=0.25),
        "train_door": material("Vatra train doors", "#2e444c", roughness=0.40, metallic=0.28),
        "train_stripe": material("Vatra train stripe", "#b6aa7c", roughness=0.52),
        "lamp": material("Station lamps", "#d9bd75", roughness=0.35, emission="#ffc971", emission_strength=3.2),
        "warning_lamp": material("Amber warning lamps", "#d8892f", roughness=0.30, emission="#ff9f32", emission_strength=2.8),
        "headlamp": material("Vehicle headlamps", "#d8d3b6", roughness=0.22, emission="#ffedb3", emission_strength=1.7),
        "tail_lamp": material("Vehicle tail lamps", "#6f1712", roughness=0.30, emission="#d82a20", emission_strength=1.2),
        "chrome": material("Dull vehicle chrome", "#777d79", roughness=0.28, metallic=0.88),
        "wheel_hub": material("Gone vehicle wheel hubs", "#656b69", roughness=0.34, metallic=0.78),
        "maintenance_yellow": material("Gone maintenance yellow", "#a97928", roughness=0.54, metallic=0.14),
        "bench_wood": material("Wet station bench wood", "#4d3426", roughness=0.72),
        "road_marking": material("Fresh road marking", "#d6d2b9", roughness=0.60),
        "road_marking_faded": material("Faded road marking", "#888b7f", roughness=0.72),
        "asphalt_patch": material("Layered asphalt repairs", "#242c2e", texture="industrial-wet-asphalt.png", roughness=0.42, texture_scale=5, coat_weight=0.24, bump_strength=0.28, bump_distance=0.06),
        "curb": material("Rain-dark curb stone", "#8d8a80", texture="weathered-masonry.png", roughness=0.78, texture_scale=10, bump_strength=0.22, bump_distance=0.05),
        "platform_edge": material("Platform edge stone", "#b7b09d", roughness=0.74),
        "warning_line": material("Vatra safety yellow", "#a98e3f", roughness=0.66),
        "tactile": material("Vatra tactile paving", "#9b8546", roughness=0.72),
        "joint": material("Platform joints", "#454846", roughness=0.88),
        "drain": material("Street drains", "#202625", roughness=0.48, metallic=0.65),
        "sign_blue": material("Vatra signage blue", "#244858", roughness=0.48, metallic=0.12),
        "sign_text": material("Vatra signage lettering", "#d8d5c7", roughness=0.58),
        "signal_black": material("Signal housings", "#151918", roughness=0.68, metallic=0.20),
        "signal_red": material("Signal red", "#641b17", roughness=0.28, emission="#e84231", emission_strength=1.8),
        "signal_amber": material("Signal amber", "#76521c", roughness=0.28, emission="#e6a52f", emission_strength=1.0),
        "signal_green": material("Signal green", "#174c32", roughness=0.28, emission="#39b974", emission_strength=1.2),
        "bollard": material("Cast iron bollards", "#26302e", roughness=0.68, metallic=0.42),
        "clock_face": material("Vatra clock face", "#d2ccba", roughness=0.64),
        "clock_hand": material("Vatra clock hands", "#1b201e", roughness=0.45, metallic=0.35),
        "awning": material("Gone kiosk awning", "#704036", roughness=0.66),
        "crate": material("Rail cargo crates", "#66503a", roughness=0.82),
        "water": material("Rain puddles", "#253d45", roughness=0.08, metallic=0.18, transmission=0.15, alpha=0.68),
    }

    # The art ground deliberately extends beyond the canonical playable bounds so
    # no camera exposes a floating-board edge. Navigation remains JSON-bounded.
    add_box(
        "Vatra district base",
        (300, 180, -0.7),
        (DISTRICT_BASE_SIZE, DISTRICT_BASE_SIZE, 1.4),
        mats["ground"],
        surfaces,
        bevel=1.5,
    )
    for item in environment["surfaces"]:
        surface_mat = mats["platform"] if item["type"] in ("sidewalk", "plaza") else mats["asphalt"]
        if item["type"] == "rail":
            add_box(f"{item['id']}-ballast", (item["x"] + item["width"] / 2, item["y"] + item["height"] / 2, 0.05), (item["width"], item["height"], 0.10), mats["ballast"], surfaces, bevel=0.1)
            horizontal = item["width"] >= item["height"]
            length = item["width"] if horizontal else item["height"]
            sleeper_count = max(1, int(length // 2.35))
            for sleeper_index in range(sleeper_count):
                offset = (sleeper_index + 0.5) * length / sleeper_count
                location = (item["x"] + offset, item["y"] + item["height"] / 2, 0.16) if horizontal else (item["x"] + item["width"] / 2, item["y"] + offset, 0.16)
                dimensions = (0.45, item["height"] * 0.92, 0.18) if horizontal else (item["width"] * 0.92, 0.45, 0.18)
                add_box(f"{item['id']}-sleeper-{sleeper_index}", location, dimensions, mats["sleeper"], surfaces, bevel=0.04)
                if sleeper_index % 4 == 0:
                    for rail_offset in (-1.2, 1.2):
                        for clip_offset in (-0.20, 0.20):
                            clip_location = (
                                (item["x"] + offset + clip_offset, item["y"] + item["height"] / 2 + rail_offset, 0.39)
                                if horizontal
                                else (item["x"] + item["width"] / 2 + rail_offset, item["y"] + offset + clip_offset, 0.39)
                            )
                            clip_dimensions = (0.12, 0.28, 0.10) if horizontal else (0.28, 0.12, 0.10)
                            add_box(
                                f"{item['id']}-rail-clip-{sleeper_index}-{rail_offset}-{clip_offset}",
                                clip_location,
                                clip_dimensions,
                                mats["rail_fastener"],
                                surfaces,
                                bevel=0.04,
                            )
            for rail_offset in (-1.2, 1.2):
                location = (item["x"] + item["width"] / 2, item["y"] + item["height"] / 2 + rail_offset, 0.34) if horizontal else (item["x"] + item["width"] / 2 + rail_offset, item["y"] + item["height"] / 2, 0.34)
                dimensions = (item["width"], 0.16, 0.22) if horizontal else (0.16, item["height"], 0.22)
                add_box(f"{item['id']}-rail-{rail_offset}", location, dimensions, mats["rail"], surfaces, bevel=0.06)
                foot_dimensions = (item["width"], 0.34, 0.08) if horizontal else (0.34, item["height"], 0.08)
                add_box(f"{item['id']}-rail-foot-{rail_offset}", (location[0], location[1], 0.25), foot_dimensions, mats["rail_dark"], surfaces, bevel=0.03)
                top_dimensions = (item["width"], 0.10, 0.07) if horizontal else (0.10, item["height"], 0.07)
                add_box(f"{item['id']}-rail-head-{rail_offset}", (location[0], location[1], 0.49), top_dimensions, mats["rail_highlight"], surfaces, bevel=0.03)
            continue
        add_box(
            item["id"],
            (item["x"] + item["width"] / 2, item["y"] + item["height"] / 2, 0.06),
            (item["width"], item["height"], 0.12),
            surface_mat,
            surfaces,
            bevel=0.18,
        )
        if item["type"] in ("sidewalk", "plaza"):
            center_x = item["x"] + item["width"] / 2
            center_y = item["y"] + item["height"] / 2
            for edge_index, (edge_location, edge_dimensions) in enumerate(
                (
                    ((center_x, item["y"] + 0.18, 0.18), (item["width"], 0.36, 0.28)),
                    ((center_x, item["y"] + item["height"] - 0.18, 0.18), (item["width"], 0.36, 0.28)),
                    ((item["x"] + 0.18, center_y, 0.18), (0.36, item["height"], 0.28)),
                    ((item["x"] + item["width"] - 0.18, center_y, 0.18), (0.36, item["height"], 0.28)),
                )
            ):
                add_box(
                    f"{item['id']}-curb-{edge_index}",
                    edge_location,
                    edge_dimensions,
                    mats["curb"],
                    architecture,
                    bevel=0.08,
                )
        add_road_details(item, mats, architecture)

    for item in (surface for surface in environment["surfaces"] if surface["type"] == "rail"):
        horizontal = item["width"] >= item["height"]
        center_x = item["x"] + item["width"] / 2
        center_y = item["y"] + item["height"] / 2
        wire_dimensions = (item["width"], 0.045, 0.045) if horizontal else (0.045, item["height"], 0.045)
        add_box(f"{item['id']}-contact-wire", (center_x, center_y, 6.82), wire_dimensions, mats["catenary"], props)
        add_box(f"{item['id']}-messenger-wire", (center_x, center_y, 7.62), wire_dimensions, mats["catenary"], props)
        length = item["width"] if horizontal else item["height"]
        for drop_offset in range(12, int(length), 24):
            drop_location = (
                (item["x"] + drop_offset, center_y, 7.22)
                if horizontal
                else (center_x, item["y"] + drop_offset, 7.22)
            )
            add_cylinder(
                f"{item['id']}-catenary-dropper-{drop_offset}",
                drop_location,
                0.025,
                0.80,
                mats["catenary"],
                props,
                vertices=6,
            )

    height_by_type = {"station": 15, "tower": 29, "platform": 1.0, "bridge": 7.5, "warehouse": 9, "office": 8, "utility": 6, "building": 11, "yard": 0.18}
    for landmark in environment["landmarks"]:
        height = landmark.get("elevation", height_by_type.get(landmark["type"], 8))
        x, y, width, depth = landmark["x"], landmark["y"], landmark["width"], landmark["height"]
        if landmark["type"] == "bridge":
            add_footbridge(landmark, mats, occluders, lights)
            continue
        material_key = landmark.get("material", "stone")
        body_mat = {
            "brick": mats["brick"],
            "plaster": mats["plaster_cool"],
            "concrete": mats["masonry"],
            "metal": mats["corrugated"],
            "stone": mats["masonry"],
        }.get(material_key, mats["masonry"])
        if landmark["type"] in ("platform", "yard"):
            body_mat = mats["platform"]
        target = occluders if height >= 5 else architecture
        # Ground-level platform tops are canonical elevation zero. Extend their
        # mass downward so sprites, blockers, and the rendered walking surface agree.
        center_z = -height / 2 if landmark["type"] == "platform" else height / 2
        add_box(landmark["id"], (x + width / 2, y + depth / 2, center_z), (width, depth, height), body_mat, target, bevel=0.22)
        if height >= 5:
            add_windows(landmark, height, mats["glass"], mats["glass_lit"], mats["trim"], target)
            if landmark.get("roof", "pitched") == "flat":
                add_flat_roof_details(landmark, height, mats, target)
            else:
                roof_material = mats["corrugated"] if landmark.get("roof") == "metal" else mats["roof"]
                pitched_roof(f"{landmark['id']}-roof", x, y, width, depth, height, roof_material, target)
            add_building_dressing(landmark, height, mats, target, lights)
            if landmark["type"] == "station":
                portico_y = y + depth + 1.9
                add_box(f"{landmark['id']}-portico-roof", (x + width / 2, portico_y, 5.0), (width * 0.48, 4.0, 0.38), mats["trim"], target, bevel=0.18)
                for column_x in (x + width * 0.31, x + width * 0.41, x + width * 0.59, x + width * 0.69):
                    add_cylinder(f"{landmark['id']}-portico-column-{column_x}", (column_x, portico_y, 2.5), 0.34, 5.0, mats["trim"], target, vertices=16)
                add_box(f"{landmark['id']}-name-board", (x + width / 2, y + depth + 0.13, 8.7), (width * 0.46, 0.22, 2.2), mats["sign_blue"], target, bevel=0.18)
                add_text_sign(
                    f"{landmark['id']}-name",
                    landmark.get("signText", landmark["name"].upper()),
                    (x + width / 2, y + depth + 0.27, 8.68),
                    1.15,
                    mats["sign_text"],
                    target,
                )
            if landmark["type"] == "tower":
                add_clock_tower_details(landmark, height, mats, target)
            if landmark["type"] == "warehouse":
                for door_index in range(max(2, min(5, int(width // 24)))):
                    door_x = x + width * (door_index + 1) / (max(2, min(5, int(width // 24))) + 1)
                    add_box(f"{landmark['id']}-loading-door-{door_index}", (door_x, y - 0.10, 2.25), (5.2, 0.20, 4.5), mats["corrugated"], target, bevel=0.04)
                    add_box(f"{landmark['id']}-loading-bumper-{door_index}", (door_x, y - 0.60, 0.42), (6.4, 1.15, 0.84), mats["masonry"], target, bevel=0.18)
        elif landmark["type"] == "platform":
            add_box(f"{landmark['id']}-edge", (x + width / 2, y + depth - 0.28, 0.08), (width, 0.45, 0.16), mats["trim"], architecture, bevel=0.04)
            add_platform_surface_details(landmark, mats, architecture)
            add_platform_canopies(landmark, mats, occluders, lights)

    for index, tree in enumerate(environment["trees"]):
        add_tree(index, tree, mats, foliage)

    for index, prop in enumerate(environment["streetFurniture"]):
        kind = prop["type"]
        if kind == "car":
            add_car(prop, mats, props)
        elif kind in ("regional-train", "freight-wagon"):
            add_train(prop, mats, props)
        elif kind == "maintenance-vehicle":
            add_maintenance_vehicle(prop, mats, props)
        else:
            add_station_furniture(index, prop, mats, props, lights)

    # Deterministic Gone-authored rain dressing, derived from the station surfaces.
    rain_surfaces = [item for item in environment["surfaces"] if item["type"] in ("road", "plaza", "yard", "sidewalk")]
    for index in range(atmosphere.get("puddleCount", 34)):
        surface = rain_surfaces[index % len(rain_surfaces)]
        x = RANDOM.uniform(surface["x"] + 2, surface["x"] + surface["width"] - 2)
        y = RANDOM.uniform(surface["y"] + 1, surface["y"] + surface["height"] - 1)
        add_box(f"rain-puddle-{index}", (x, y, 0.17), (RANDOM.uniform(2.2, 7.4), RANDOM.uniform(0.7, 2.4), 0.025), mats["water"], props, bevel=0.35, rotation=RANDOM.uniform(-18, 18))
    for index in range(atmosphere.get("leafLitterCount", 90)):
        tree = environment["trees"][index % len(environment["trees"])]
        angle = RANDOM.uniform(0, math.tau)
        distance = RANDOM.uniform(1.8, 7.5)
        x = tree["x"] + math.cos(angle) * distance
        y = tree["y"] + math.sin(angle) * distance
        add_box(
            f"wet-leaf-{index}",
            (x, y, 0.18),
            (RANDOM.uniform(0.12, 0.28), RANDOM.uniform(0.06, 0.14), 0.018),
            mats["leaves_a"] if index % 3 else mats["leaves_b"],
            props,
            rotation=RANDOM.uniform(0, 180),
        )

    add_distant_scenery(environment, mats, distant)


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
    background.inputs["Strength"].default_value = 0.82
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.72

    bpy.ops.object.light_add(type="AREA", location=(-180, -120, 520))
    key = bpy.context.object
    key.name = "Overcast sky key"
    key.data.energy = 3000
    key.data.shape = "DISK"
    key.data.size = 420
    key.data.color = (0.72, 0.82, 0.90)
    key.rotation_euler = (WORLD_CENTER - key.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.light_add(type="AREA", location=(520, 430, 260))
    fill = bpy.context.object
    fill.name = "Blue-hour fill"
    fill.data.energy = 1650
    fill.data.size = 300
    fill.data.color = (0.34, 0.48, 0.62)
    fill.rotation_euler = (WORLD_CENTER - fill.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 300))
    sun = bpy.context.object
    sun.name = "Soft overcast sun"
    sun.data.energy = 1.8
    sun.data.angle = math.radians(18)
    sun.data.color = (0.68, 0.76, 0.82)
    sun.rotation_euler = (math.radians(28), math.radians(-24), math.radians(-38))

    bpy.ops.object.light_add(type="AREA", location=(130, 300, 80))
    warm = bpy.context.object
    warm.name = "Station practical bounce"
    warm.data.energy = 780
    warm.data.size = 90
    warm.data.color = (1.0, 0.48, 0.23)
    warm.rotation_euler = (WORLD_CENTER - warm.location).to_track_quat("-Z", "Y").to_euler()


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
    data.clip_end = 5000
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
    (OUTPUT / "backdrops").mkdir(parents=True, exist_ok=True)
    environment = json.loads(ENVIRONMENT_PATH.read_text())
    clear_scene()
    setup_scene(environment)
    build_environment(environment)
    cameras = {view_id: camera_for(view_id) for view_id in ("view-0", "view-90", "view-180", "view-270", "view-top")}
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    if "--build-only" in sys.argv:
        return
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
        camera.data.ortho_scale *= BACKDROP_SCALE
        bpy.context.scene.render.filepath = str(OUTPUT / "backdrops" / f"{view_id}.png")
        bpy.ops.render.render(write_still=True)
        camera.data.ortho_scale /= BACKDROP_SCALE
        if depth_output:
            depth_output.mute = False
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


if __name__ == "__main__":
    main()
