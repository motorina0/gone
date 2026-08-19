# Content format

`public/content/index.json` is the registry. Each manifest resolves all paths relative to itself and references independently editable JSON/SVG resources. Every resource has `id`, `schemaVersion`, and a human-readable name where appropriate. Schemas in `public/content/schemas` are validated by `tools/validate-content.ts`. Keep IDs stable and paths case-sensitive.

Exploration manifests must list exactly one player entity and no patrols. `environment.json` stores canonical world-space atmosphere, surfaces, landmarks, trees, and street furniture. Static props with `blocksMovement: true` contribute blockers using their dimensions and rotation. `tools/generate-placeholder-views.ts` projects this same data into all five background, detail, and occlusion resources.
