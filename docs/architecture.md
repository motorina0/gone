# Architecture

`WorldState` is authoritative. A 30 Hz fixed-step clock currently updates only player movement; Phaser rendering projects that state without owning it. `GameScene` does not construct or update guard, patrol, detection, observation, interaction, or mission systems in exploration mode. The dormant generic modules remain isolated for possible future phases.

Every public location manifest declares `mode: "exploration"`, one player entity, and no patrol resources. Content behavior and geometry come from external JSON/SVG resources, never location-specific branches in generic systems. Restart clears movement orders before reconstructing canonical state.

The visual stack is a baked 2× material-rich WebP background displayed on the canonical 960×640 stage, detail overlay, projected character/markers, then foreground occlusion. Editable SVG sources and runtime WebPs are separate manifest resources, and all five layers align through the same per-location projection resource. Tactical views use a cropped close camera bounded to the projected world extent; SAT deliberately resets to the full overview while retaining canonical focus for the return trip.

Navigation loads the active location's external `navigation/walkable.json`. Polygon unions describe traversable surfaces and elevations; blockers from navigation JSON and blocking environment props are applied afterward. A deterministic eight-neighbour A* route cannot cut blocked corners, and line-of-sight smoothing never leaves the authored surface.
