"""Render Gone's original eight-direction operative animation frames.

Run with:
  blender --background --python art/agent/build_agent_atlas.py

The resulting transparent frame sequence is assembled by
tools/assemble-agent-atlas.mjs into a deterministic Phaser atlas.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "art/agent/renders"
BLEND_PATH = ROOT / "art/agent/gone-operative.blend"
FRAME_WIDTH = 256
FRAME_HEIGHT = 320


def hex_color(value: str) -> tuple[float, float, float, float]:
    clean = value.removeprefix("#")
    return tuple(int(clean[index : index + 2], 16) / 255 for index in (0, 2, 4)) + (1.0,)


def material(name: str, value: str, roughness: float = 0.75, metallic: float = 0.0) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = hex_color(value)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = hex_color(value)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return result


def parent(obj: bpy.types.Object, rig: bpy.types.Object) -> bpy.types.Object:
    obj.parent = rig
    return obj


def box(name: str, location: tuple[float, float, float], dimensions: tuple[float, float, float], mat: bpy.types.Material, rig: bpy.types.Object, bevel: float = 0.08) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft garment edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return parent(obj, rig)


def cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float, mat: bpy.types.Material, rig: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return parent(obj, rig)


def build_operative() -> tuple[bpy.types.Object, dict[str, bpy.types.Object]]:
    rig = bpy.data.objects.new("Gone Operative Rig", None)
    bpy.context.scene.collection.objects.link(rig)
    coat = material("Field coat", "#45635b")
    coat_dark = material("Coat shadow", "#293e3a")
    trousers = material("Field trousers", "#252c2b")
    leather = material("Boots and satchel", "#3a2b21")
    skin = material("Operative skin", "#b78366")
    hair = material("Operative hair", "#33251f")
    brass = material("Gone insignia", "#b7b064", 0.45, 0.25)

    box("Torso", (0, 0, 2.65), (1.02, 0.58, 1.38), coat, rig, 0.14)
    box("Coat skirts", (0, 0.02, 1.84), (1.18, 0.72, 0.62), coat_dark, rig, 0.12)
    box("Belt", (0, -0.33, 2.13), (1.05, 0.12, 0.16), leather, rig, 0.04)
    box("Satchel", (0.66, 0.08, 2.03), (0.48, 0.26, 0.72), leather, rig, 0.09)
    box("Insignia", (-0.25, -0.315, 2.9), (0.16, 0.04, 0.16), brass, rig, 0.03)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=(0, -0.02, 3.82), scale=(0.44, 0.39, 0.53))
    head = bpy.context.object
    head.name = "Head"
    head.data.materials.append(skin)
    parent(head, rig)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=10, location=(0, 0.06, 4.02), scale=(0.47, 0.42, 0.36))
    hair_obj = bpy.context.object
    hair_obj.name = "Hair"
    hair_obj.data.materials.append(hair)
    parent(hair_obj, rig)

    limbs = {
        "left_arm": cylinder("Left arm", (-0.67, 0, 2.55), 0.16, 1.28, coat, rig),
        "right_arm": cylinder("Right arm", (0.67, 0, 2.55), 0.16, 1.28, coat, rig),
        "left_leg": cylinder("Left leg", (-0.28, 0, 1.05), 0.18, 1.55, trousers, rig),
        "right_leg": cylinder("Right leg", (0.28, 0, 1.05), 0.18, 1.55, trousers, rig),
        "left_boot": box("Left boot", (-0.28, -0.1, 0.22), (0.38, 0.65, 0.34), leather, rig, 0.09),
        "right_boot": box("Right boot", (0.28, -0.1, 0.22), (0.38, 0.65, 0.34), leather, rig, 0.09),
    }
    return rig, limbs


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def pose(limbs: dict[str, bpy.types.Object], phase: float, amount: float, bounce: float) -> None:
    swing = math.sin(phase) * amount
    counter = math.sin(phase + math.pi) * amount
    limbs["left_arm"].rotation_euler[0] = counter
    limbs["right_arm"].rotation_euler[0] = swing
    limbs["left_leg"].rotation_euler[0] = swing
    limbs["right_leg"].rotation_euler[0] = counter
    limbs["left_boot"].rotation_euler[0] = max(0, -swing) * 0.35
    limbs["right_boot"].rotation_euler[0] = max(0, -counter) * 0.35
    for obj in limbs.values():
        obj.location.z += bounce


def reset_pose(limbs: dict[str, bpy.types.Object], base_locations: dict[str, Vector]) -> None:
    for name, obj in limbs.items():
        obj.rotation_euler = (0, 0, 0)
        obj.location = base_locations[name]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = FRAME_WIDTH
    scene.render.resolution_y = FRAME_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.035, 0.045, 0.04)

    rig, limbs = build_operative()
    base_locations = {name: obj.location.copy() for name, obj in limbs.items()}
    bpy.ops.object.light_add(type="AREA", location=(-4.5, -6, 8))
    bpy.context.object.data.energy = 900
    bpy.context.object.data.size = 5
    bpy.context.object.data.color = (0.76, 0.86, 0.9)
    bpy.ops.object.light_add(type="AREA", location=(4, 3, 6))
    bpy.context.object.data.energy = 650
    bpy.context.object.data.size = 4
    bpy.context.object.data.color = (0.72, 0.58, 0.4)

    camera_data = bpy.data.cameras.new("Operative sprite camera")
    camera = bpy.data.objects.new("Operative sprite camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0, -10, 5.6)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 5.65
    point_camera(camera, Vector((0, 0, 2.15)))
    scene.camera = camera

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    for direction in range(8):
        # Atlas rows follow screen-space headings: 0 points right, 2 points down.
        rig.rotation_euler[2] = math.radians(90 - direction * 45)
        frames = [("idle", 0, 0.0, 0.0, 0.0)]
        frames += [("walk", frame, frame / 4 * math.tau, 0.36, abs(math.sin(frame / 4 * math.tau)) * 0.035) for frame in range(4)]
        frames += [("run", frame, frame / 4 * math.tau, 0.62, abs(math.sin(frame / 4 * math.tau)) * 0.085) for frame in range(4)]
        for column, (_motion, _frame, phase, amount, bounce) in enumerate(frames):
            reset_pose(limbs, base_locations)
            pose(limbs, phase, amount, bounce)
            scene.render.filepath = str(OUTPUT / f"direction-{direction}-frame-{column}.png")
            bpy.ops.render.render(write_still=True)
    reset_pose(limbs, base_locations)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


if __name__ == "__main__":
    main()
