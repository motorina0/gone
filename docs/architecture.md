# Architecture

`WorldState` is authoritative. A 30 Hz fixed-step clock updates patrol, movement, detection, observation, and generic mission systems independently from Phaser rendering. `GameScene` composes these modules but content behavior comes from external resources. Location-specific geometry is never embedded in generic systems. Restart clears paths and detection state before reconstructing canonical state.
