# Content format

`public/content/index.json` is the registry. Each manifest resolves all paths relative to itself and references independently editable JSON/SVG resources. Every resource has `id`, `schemaVersion`, and a human-readable name where appropriate. Schemas in `public/content/schemas` are validated by `tools/validate-content.ts`. Keep IDs stable and paths case-sensitive.
