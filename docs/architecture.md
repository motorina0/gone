# Architecture

`WorldState` is authoritative. A 30 Hz fixed-step clock currently updates only player movement; Phaser rendering projects that state without owning it. `GameScene` does not construct or update guard, patrol, detection, observation, interaction, or mission systems in exploration mode. The dormant generic modules remain isolated for possible future phases.

Every public location manifest declares `mode: "exploration"`, one player entity, and no patrol resources. Content behavior and geometry come from external JSON/SVG resources, never location-specific branches in generic systems. Restart clears movement orders before reconstructing canonical state.

The visual stack is a baked 2× material-rich WebP background displayed on the canonical 960×640 stage, detail overlay, projected character/route markers, then foreground occlusion. Vatra's primary editable source is a Gone-only Blender scene with five orthographic cameras and aligned beauty, depth, and transparent building/foliage occlusion outputs; SVG projections remain deterministic editable fallbacks. All layers align through the same per-location projection resource. Tactical views use a cropped close camera bounded to the projected world extent; SAT opens as a complete overview. Camera focus and zoom are remembered independently for every view.

Boot loads only the preferred view plus the data-driven operative atlas. Other background/detail/occlusion triplets are decoded on first use and retained in Phaser's texture cache. This avoids downloading five large backgrounds before mobile interaction. The operative atlas declares frame geometry, eight direction rows, and idle/walk/run columns in each location manifest.

Navigation loads the active location's external `navigation/walkable.json`. Polygon unions describe traversable surfaces and elevations; blockers from navigation JSON and blocking environment props are applied afterward. A deterministic eight-neighbour A* route cannot cut blocked corners, and line-of-sight smoothing never leaves the authored surface.
