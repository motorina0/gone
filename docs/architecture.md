# Architecture

`WorldState` is authoritative. A 30 Hz fixed-step clock currently updates only player movement; Phaser rendering projects that state without owning it. `GameScene` does not construct or update guard, patrol, detection, observation, interaction, or mission systems in exploration mode. The dormant generic modules remain isolated for possible future phases.

Every public location manifest declares `mode: "exploration"`, one player entity, and no patrol resources. Content behavior and geometry come from external JSON/SVG resources, never location-specific branches in generic systems. Restart clears movement orders before reconstructing canonical state.

The visual stack is background, detail overlay, projected character/markers, then foreground occlusion. All five layers align through the same per-location projection resource.
