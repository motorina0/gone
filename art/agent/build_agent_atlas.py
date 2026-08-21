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
FRAME_WIDTH = 1024
FRAME_HEIGHT = 1280


def hex_color(value: str) -> tuple[float, float, float, float]:
    clean = value.removeprefix("#")
    return tuple(int(clean[index : index + 2], 16) / 255 for index in (0, 2, 4)) + (1.0,)


def material(
    name: str,
    value: str,
    roughness: float = 0.75,
    metallic: float = 0.0,
    *,
    alpha: float = 1.0,
    fabric: bool = False,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*hex_color(value)[:3], alpha)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = hex_color(value)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Alpha"].default_value = alpha
    if fabric:
        noise = result.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 78.0
        noise.inputs["Detail"].default_value = 2.2
        noise.inputs["Roughness"].default_value = 0.72
        bump = result.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.24
        bump.inputs["Distance"].default_value = 0.035
        result.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        result.node_tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    if alpha < 1.0:
        result.surface_render_method = "DITHERED"
    return result


def smooth(obj: bpy.types.Object) -> bpy.types.Object:
    for polygon in getattr(obj.data, "polygons", []):
        polygon.use_smooth = True
    return obj


def empty(
    name: str,
    location: tuple[float, float, float],
    parent_obj: bpy.types.Object | None = None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent_obj
    obj.location = location
    return obj


def attach(
    obj: bpy.types.Object,
    parent_obj: bpy.types.Object,
    location: tuple[float, float, float],
) -> bpy.types.Object:
    obj.parent = parent_obj
    obj.location = location
    return obj


def box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    parent_obj: bpy.types.Object,
    bevel: float = 0.08,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    attach(obj, parent_obj, location)
    obj.rotation_euler = rotation
    if bevel:
        modifier = obj.modifiers.new("Soft garment edge", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
    return obj


def tapered(
    name: str,
    location: tuple[float, float, float],
    radius_bottom: float,
    radius_top: float,
    depth: float,
    mat: bpy.types.Material,
    parent_obj: bpy.types.Object,
    *,
    vertices: int = 16,
    scale_y: float = 1.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale.y = scale_y
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    attach(obj, parent_obj, location)
    return smooth(obj)


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    parent_obj: bpy.types.Object,
    *,
    segments: int = 28,
    rings: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    attach(obj, parent_obj, location)
    return smooth(obj)


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    parent_obj: bpy.types.Object,
    *,
    vertices: int = 18,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    attach(obj, parent_obj, location)
    obj.rotation_euler = rotation
    return smooth(obj)


def beam(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    parent_obj: bpy.types.Object,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=direction.length)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent_obj
    obj.location = (start_vector + end_vector) / 2
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return smooth(obj)


def build_operative() -> tuple[bpy.types.Object, dict[str, bpy.types.Object]]:
    rig = empty("Gone Operative Direction Rig", (0, 0, 0))
    motion = empty("Gone Operative Motion Root", (0, 0, 0), rig)
    coat = material("Weathered charcoal raincoat", "#252b29", 0.72, fabric=True)
    coat_dark = material("Raincoat shadow panels", "#171c1b", 0.79, fabric=True)
    coat_edge = material("Worn raincoat edges", "#3d4441", 0.76, fabric=True)
    knit = material("Charcoal knit layer", "#17191a", 0.90, fabric=True)
    trousers = material("Field trousers", "#17191a", 0.86, fabric=True)
    leather = material("Worn brown leather", "#35251f", 0.66)
    leather_edge = material("Scuffed leather edges", "#60483a", 0.72)
    skin = material("Operative skin", "#9e6d56", 0.76)
    skin_shadow = material("Operative skin shadow", "#68483d", 0.82)
    stubble = material("Short dark stubble", "#302724", 0.92)
    eye_white = material("Muted eye white", "#c2b8a8", 0.78)
    iris = material("Brown iris", "#34271d", 0.66)
    hair = material("Short dark hair", "#171513", 0.92)
    brass = material("Small brass coat pin", "#9d8a50", 0.44, 0.36)
    shadow = material("Operative contact shadow", "#111716", 0.92, alpha=0.25)

    sphere("Contact shadow", (0, 0.08, 0.045), (0.72, 0.43, 0.035), shadow, rig, segments=24, rings=10)
    tapered("Coat torso", (0, 0.02, 2.79), 0.46, 0.60, 1.42, coat, motion, vertices=24, scale_y=0.56)
    tapered("Long coat skirt", (0, 0.05, 1.85), 0.54, 0.47, 1.15, coat, motion, vertices=24, scale_y=0.62)
    box("Inner knit shirt", (0, -0.325, 2.82), (0.54, 0.065, 1.18), knit, motion, 0.035)
    box("Coat left lapel", (-0.20, -0.37, 3.13), (0.24, 0.055, 0.78), coat_edge, motion, 0.025, (0, math.radians(-10), math.radians(-18)))
    box("Coat right lapel", (0.20, -0.37, 3.13), (0.24, 0.055, 0.78), coat_dark, motion, 0.025, (0, math.radians(10), math.radians(18)))
    box("Raised left collar", (-0.30, -0.18, 3.48), (0.24, 0.18, 0.48), coat, motion, 0.05, (math.radians(-8), math.radians(-12), math.radians(-20)))
    box("Raised right collar", (0.30, -0.18, 3.48), (0.24, 0.18, 0.48), coat_dark, motion, 0.05, (math.radians(-8), math.radians(12), math.radians(20)))
    sphere("Folded coat hood", (0, 0.24, 3.47), (0.53, 0.24, 0.31), coat_dark, motion, segments=24, rings=14)
    box("Coat waist drawcord seam", (0, -0.35, 2.30), (0.88, 0.055, 0.075), coat_edge, motion, 0.018)
    box("Coat center placket", (0.07, -0.355, 2.45), (0.075, 0.055, 1.65), coat_dark, motion, 0.018)
    for side in (-1, 1):
        box(f"Coat pocket {side}", (side * 0.34, -0.36, 2.02), (0.32, 0.055, 0.30), coat_dark, motion, 0.035, (0, 0, side * math.radians(8)))
    for button_index, button_z in enumerate((2.38, 2.68, 2.98, 3.26)):
        sphere(f"Coat button {button_index}", (0.11, -0.39, button_z), (0.034, 0.018, 0.034), brass, motion, segments=12, rings=8)
    sphere("Small coat pin", (-0.30, -0.39, 3.20), (0.055, 0.022, 0.055), brass, motion, segments=12, rings=8)

    cylinder("Neck", (0, 0, 3.62), 0.17, 0.30, skin_shadow, motion, vertices=20)
    sphere("Head", (0, -0.015, 4.02), (0.33, 0.30, 0.44), skin, motion, segments=32, rings=20)
    sphere("Jaw", (0, -0.055, 3.90), (0.28, 0.27, 0.27), skin, motion, segments=28, rings=16)
    sphere("Stubble jaw", (0, -0.285, 3.90), (0.255, 0.035, 0.18), stubble, motion, segments=24, rings=14)
    sphere("Nose", (0, -0.315, 4.04), (0.065, 0.09, 0.11), skin, motion, segments=18, rings=12)
    for ear_side in (-1, 1):
        sphere(f"Ear {ear_side}", (ear_side * 0.335, -0.015, 4.05), (0.055, 0.035, 0.105), skin_shadow, motion, segments=16, rings=10)
        box(f"Eyebrow {ear_side}", (ear_side * 0.125, -0.302, 4.15), (0.15, 0.025, 0.025), hair, motion, 0.008, (0, 0, ear_side * math.radians(4)))
        sphere(f"Eye white {ear_side}", (ear_side * 0.12, -0.304, 4.10), (0.072, 0.018, 0.038), eye_white, motion, segments=14, rings=8)
        sphere(f"Iris {ear_side}", (ear_side * 0.12, -0.324, 4.10), (0.022, 0.012, 0.022), iris, motion, segments=12, rings=8)
    box("Mouth", (0, -0.305, 3.86), (0.15, 0.018, 0.022), skin_shadow, motion, 0.006)
    sphere("Hair crown", (0, 0.015, 4.29), (0.35, 0.31, 0.24), hair, motion, segments=30, rings=18)
    box("Short hair fringe", (0, -0.265, 4.27), (0.49, 0.10, 0.15), hair, motion, 0.04, (math.radians(-8), 0, 0))

    left_arm = empty("Left shoulder pivot", (-0.60, 0.0, 3.16), motion)
    right_arm = empty("Right shoulder pivot", (0.60, 0.0, 3.16), motion)
    for side_name, arm in (("Left", left_arm), ("Right", right_arm)):
        tapered(f"{side_name} coat sleeve", (0, 0, -0.61), 0.10, 0.17, 1.22, coat, arm, vertices=18, scale_y=0.82)
        box(f"{side_name} cuff", (0, -0.005, -1.17), (0.24, 0.22, 0.13), coat_dark, arm, 0.045)
        sphere(f"{side_name} hand", (0, -0.025, -1.35), (0.105, 0.09, 0.17), skin, arm, segments=20, rings=12)

    left_leg = empty("Left hip pivot", (-0.22, 0, 1.58), motion)
    right_leg = empty("Right hip pivot", (0.22, 0, 1.58), motion)
    for side_name, leg in (("Left", left_leg), ("Right", right_leg)):
        tapered(f"{side_name} trouser leg", (0, 0, -0.66), 0.13, 0.20, 1.34, trousers, leg, vertices=18, scale_y=0.86)
        box(f"{side_name} boot", (0, -0.10, -1.36), (0.29, 0.53, 0.29), leather, leg, 0.075)
        box(f"{side_name} boot sole", (0, -0.13, -1.51), (0.31, 0.57, 0.075), leather_edge, leg, 0.028)

    box("Document satchel", (0.62, 0.10, 1.83), (0.46, 0.24, 0.62), leather, motion, 0.075, (0, math.radians(-5), math.radians(-4)))
    box("Satchel flap", (0.62, -0.045, 1.98), (0.48, 0.065, 0.28), leather_edge, motion, 0.04, (math.radians(-5), 0, math.radians(-4)))
    sphere("Satchel clasp", (0.62, -0.085, 1.90), (0.038, 0.018, 0.038), brass, motion, segments=12, rings=8)
    beam("Satchel shoulder strap", (-0.40, -0.33, 3.39), (0.58, -0.33, 1.99), 0.034, leather_edge, motion)

    controls = {
        "motion": motion,
        "left_arm": left_arm,
        "right_arm": right_arm,
        "left_leg": left_leg,
        "right_leg": right_leg,
    }
    return rig, controls


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def pose(controls: dict[str, bpy.types.Object], phase: float, amount: float, bounce: float) -> None:
    swing = math.sin(phase) * amount
    counter = math.sin(phase + math.pi) * amount
    controls["left_arm"].rotation_euler[0] = counter * 0.78
    controls["right_arm"].rotation_euler[0] = swing * 0.78
    controls["left_leg"].rotation_euler[0] = swing
    controls["right_leg"].rotation_euler[0] = counter
    controls["left_leg"].rotation_euler[1] = -0.03
    controls["right_leg"].rotation_euler[1] = 0.03
    controls["motion"].location.z = bounce
    controls["motion"].rotation_euler[0] = min(0.10, abs(amount) * 0.12)


def reset_pose(controls: dict[str, bpy.types.Object]) -> None:
    for name, obj in controls.items():
        obj.rotation_euler = (0, 0, 0)
        if name == "motion":
            obj.location = (0, 0, 0)


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
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.45
    scene.world.color = (0.025, 0.032, 0.03)

    rig, controls = build_operative()
    bpy.ops.object.light_add(type="AREA", location=(-4.5, -6, 8))
    key = bpy.context.object
    key.name = "Cool soft sprite key"
    key.data.energy = 1050
    key.data.size = 5
    key.data.color = (0.68, 0.80, 0.86)
    bpy.ops.object.light_add(type="AREA", location=(4, 3, 6))
    rim = bpy.context.object
    rim.name = "Warm sprite rim"
    rim.data.energy = 720
    rim.data.size = 4
    rim.data.color = (0.88, 0.58, 0.34)
    bpy.ops.object.light_add(type="AREA", location=(0, 1, 8))
    fill = bpy.context.object
    fill.name = "Operative overhead fill"
    fill.data.energy = 420
    fill.data.size = 3
    fill.data.color = (0.45, 0.58, 0.62)

    camera_data = bpy.data.cameras.new("Operative sprite camera")
    camera = bpy.data.objects.new("Operative sprite camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0, -10, 5.65)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 5.30
    point_camera(camera, Vector((0, 0, 2.15)))
    scene.camera = camera

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    for direction in range(8):
        # Atlas rows follow screen-space headings: 0 points right, 2 points down.
        rig.rotation_euler[2] = math.radians(90 - direction * 45)
        frames = [("idle", 0, 0.0, 0.0, 0.0)]
        frames += [
            ("walk", frame, frame / 4 * math.tau, 0.38, abs(math.sin(frame / 4 * math.tau)) * 0.045)
            for frame in range(4)
        ]
        frames += [
            ("run", frame, frame / 4 * math.tau, 0.66, abs(math.sin(frame / 4 * math.tau)) * 0.095)
            for frame in range(4)
        ]
        for column, (_motion, _frame, phase, amount, bounce) in enumerate(frames):
            reset_pose(controls)
            pose(controls, phase, amount, bounce)
            scene.render.filepath = str(OUTPUT / f"direction-{direction}-frame-{column}.png")
            bpy.ops.render.render(write_still=True)
    reset_pose(controls)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


if __name__ == "__main__":
    main()
