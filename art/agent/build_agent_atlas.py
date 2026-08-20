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
FRAME_WIDTH = 384
FRAME_HEIGHT = 480


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
    coat = material("Rain-dark field coat", "#3f504b", 0.66, fabric=True)
    coat_dark = material("Field coat shadow panels", "#26332f", 0.74, fabric=True)
    knit = material("Charcoal knit layer", "#252928", 0.84, fabric=True)
    trousers = material("Field trousers", "#202524", 0.80, fabric=True)
    leather = material("Worn brown leather", "#3b2b22", 0.62)
    leather_edge = material("Scuffed leather edges", "#695143", 0.70)
    skin = material("Operative skin", "#aa755c", 0.72)
    skin_shadow = material("Operative skin shadow", "#765044", 0.78)
    hair = material("Short dark hair", "#211c19", 0.88)
    brass = material("Gone brass pin", "#b4a15f", 0.38, 0.42)
    shadow = material("Operative contact shadow", "#111716", 0.92, alpha=0.25)

    sphere("Contact shadow", (0, 0.08, 0.045), (0.72, 0.43, 0.035), shadow, rig, segments=24, rings=10)
    tapered("Coat torso", (0, 0.02, 2.82), 0.50, 0.66, 1.48, coat, motion, vertices=18, scale_y=0.62)
    tapered("Coat skirt", (0, 0.04, 1.92), 0.60, 0.50, 0.68, coat_dark, motion, vertices=18, scale_y=0.68)
    box("Inner knit shirt", (0, -0.355, 2.75), (0.62, 0.08, 1.08), knit, motion, 0.05)
    box("Coat left lapel", (-0.22, -0.405, 3.13), (0.24, 0.07, 0.78), coat_dark, motion, 0.04, (0, math.radians(-10), math.radians(-16)))
    box("Coat right lapel", (0.22, -0.405, 3.13), (0.24, 0.07, 0.78), coat_dark, motion, 0.04, (0, math.radians(10), math.radians(16)))
    box("Coat belt", (0, -0.39, 2.25), (1.02, 0.10, 0.13), leather, motion, 0.035)
    for button_index, button_z in enumerate((2.48, 2.78, 3.08)):
        sphere(f"Coat button {button_index}", (0.11, -0.425, button_z), (0.045, 0.025, 0.045), brass, motion, segments=12, rings=8)
    box("Gone pin", (-0.27, -0.425, 3.20), (0.13, 0.05, 0.13), brass, motion, 0.025)

    cylinder("Neck", (0, 0, 3.65), 0.20, 0.32, skin_shadow, motion, vertices=20)
    sphere("Head", (0, -0.015, 4.09), (0.40, 0.36, 0.52), skin, motion, segments=32, rings=20)
    sphere("Jaw", (0, -0.055, 3.94), (0.34, 0.33, 0.30), skin, motion, segments=28, rings=16)
    sphere("Nose", (0, -0.365, 4.10), (0.085, 0.12, 0.13), skin, motion, segments=18, rings=12)
    for ear_side in (-1, 1):
        sphere(f"Ear {ear_side}", (ear_side * 0.405, -0.015, 4.10), (0.075, 0.045, 0.13), skin_shadow, motion, segments=16, rings=10)
        box(f"Eyebrow {ear_side}", (ear_side * 0.145, -0.355, 4.22), (0.18, 0.035, 0.035), hair, motion, 0.012, (0, 0, ear_side * math.radians(4)))
    sphere("Hair crown", (0, 0.025, 4.40), (0.43, 0.38, 0.29), hair, motion, segments=28, rings=16)
    box("Hair fringe", (0, -0.31, 4.36), (0.58, 0.13, 0.18), hair, motion, 0.06, (math.radians(-8), 0, 0))

    left_arm = empty("Left shoulder pivot", (-0.69, 0.0, 3.18), motion)
    right_arm = empty("Right shoulder pivot", (0.69, 0.0, 3.18), motion)
    for side_name, arm in (("Left", left_arm), ("Right", right_arm)):
        tapered(f"{side_name} coat sleeve", (0, 0, -0.66), 0.12, 0.20, 1.32, coat, arm, vertices=16, scale_y=0.88)
        box(f"{side_name} cuff", (0, -0.005, -1.28), (0.30, 0.27, 0.16), coat_dark, arm, 0.06)
        sphere(f"{side_name} hand", (0, -0.025, -1.47), (0.14, 0.12, 0.20), skin, arm, segments=20, rings=12)

    left_leg = empty("Left hip pivot", (-0.27, 0, 1.72), motion)
    right_leg = empty("Right hip pivot", (0.27, 0, 1.72), motion)
    for side_name, leg in (("Left", left_leg), ("Right", right_leg)):
        tapered(f"{side_name} trouser leg", (0, 0, -0.72), 0.15, 0.24, 1.46, trousers, leg, vertices=18, scale_y=0.92)
        box(f"{side_name} boot", (0, -0.12, -1.52), (0.36, 0.66, 0.35), leather, leg, 0.10)
        box(f"{side_name} boot sole", (0, -0.15, -1.70), (0.39, 0.72, 0.10), leather_edge, leg, 0.04)

    box("Document satchel", (0.70, 0.10, 2.02), (0.52, 0.28, 0.76), leather, motion, 0.10, (0, math.radians(-5), math.radians(-4)))
    box("Satchel flap", (0.70, -0.065, 2.17), (0.54, 0.08, 0.34), leather_edge, motion, 0.055, (math.radians(-5), 0, math.radians(-4)))
    sphere("Satchel clasp", (0.70, -0.115, 2.09), (0.055, 0.025, 0.055), brass, motion, segments=12, rings=8)
    beam("Satchel shoulder strap", (-0.45, -0.36, 3.42), (0.66, -0.36, 2.18), 0.045, leather_edge, motion)

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
    camera_data.ortho_scale = 5.65
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
