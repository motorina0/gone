# Art provenance

Every runtime-visible asset in Gone is original to this repository. No stock library, map-provider image, extracted game file, traced commercial asset, third-party texture, font, icon, character, or environment mesh is used.

## Vatra Central Station

- `art/vatra/build_vatra_scene.py` constructs the fictional station, surrounding district, material-specific architecture, roads and markings, rails and catenary, platforms and canopies, footbridge, static trains and cars, station furniture, freight dressing, vegetation, rain treatment, and practical lighting from Gone's `environment.json` resource.
- `art/vatra/vatra-central-station.blend` is the editable generated scene source. It contains five orthographic cameras aligned with the canonical projection resources.
- `art/vatra/renders/` contains reproducible 3840×2560 working masters and linear depth passes and is intentionally ignored. `tools/process-vatra-renders.mjs` creates the committed 1920×1280 WebP runtime views and 960×640 depth maps.
- `tools/generate-placeholder-views.ts` remains the deterministic SVG projection/fallback and creates the aligned editable occlusion and detail layers.

The user-provided Commandos 2 screenshot was used only to discuss high-level composition, density, and camera framing. It was not supplied to an image generator, sampled, traced, transformed, or shipped.

## Operative

- `art/agent/build_agent_atlas.py` creates Gone's low-poly field operative, eight facings, idle pose, four walk frames, and four run frames.
- `art/agent/gone-operative.blend` is the editable character source.
- `tools/assemble-agent-atlas.mjs` deterministically builds the transparent runtime atlas. The same Gone operative is used in both current locations.

## Generated Gone materials

The following original raster materials were generated with Codex's built-in image-generation tool and are stored as external files under `public/content/materials/`. They are environmental material inputs, not complete maps.

### `vatra-platform-concrete.png`

Prompt:

> Create one square 2048x2048 seamless tileable PBR-style base-color texture made specifically for the original game Gone: an old Eastern European railway station platform just after rain. Fine weathered concrete aggregate, subtle repaired cracks, dark damp variation, sparse tiny rust runoff and muted moss in creases, restrained blue-grey and warm stone palette. Orthographic material scan, flat even lighting, no perspective, no horizon, no objects, no rails, no signs, no text, no letters, no numbers, no logos, no borders. Realistic game-environment texture, highly detailed. It must tile cleanly on every edge.

### `vatra-aged-steel.png`

Prompt:

> Create one square 2048x2048 seamless tileable PBR-style base-color texture made specifically for the original game Gone: aged dark painted steel used on a fictional railway station after rain. Layered charcoal-green paint, fine scratches, restrained worn brass-colored edges, small oxidation blooms and water streaks. Orthographic material scan, flat even lighting, no perspective, no horizon, no objects, no bolts, no signs, no text, no letters, no numbers, no logos, no borders. Realistic game-environment texture, highly detailed, muted tactical palette. It must tile cleanly on every edge.

The earlier `industrial-wet-asphalt.png`, `old-town-pavers.png`, `weathered-masonry.png`, and `weathered-roof.png` files were likewise generated specifically for Gone as tileable, text-free environmental materials. Their subjects and intended use are encoded by their filenames; none derive from external source imagery.

### `vatra-wet-brick.png`

Prompt:

> Original seamless wet red brick masonry made specifically for the fictional Vatra Central Station district in Gone. Realistic PBR-style base-color texture, orthographic material scan, flat even lighting. Restrained soot-dark burgundy, muted clay, charcoal mortar; repaired mortar, subtle rain-darkening, faint mineral streaks, sparse chipped edges and restrained grime. Square edge-to-edge material surface with uniform detail density. Genuinely seamless on every edge; no perspective, directional light, objects, signs, graffiti, text, letters, numbers, logos, borders, watermark, or prominent focal feature.

### `vatra-painted-plaster.png`

Prompt:

> Original seamless weathered painted plaster made specifically for the fictional Vatra Central Station district in Gone. Realistic PBR-style base-color texture, orthographic material scan, flat even lighting. Desaturated blue-grey with a warm limestone underlayer; subtle hairline cracks, patch repairs, light rain streaks, sparse flaking paint and restrained soot deposits. Square edge-to-edge material surface with uniform detail density. Genuinely seamless on every edge; no perspective, directional light, objects, signs, graffiti, text, letters, numbers, logos, borders, watermark, or prominent focal feature.

### `vatra-corrugated-metal.png`

Prompt:

> Original seamless aged corrugated metal made specifically for the fictional Vatra Central Station rail district in Gone. Realistic PBR-style base-color texture, orthographic material scan, flat even lighting. Charcoal blue-green paint and dark steel with restrained rust brown; narrow corrugations, worn industrial coating, subtle vertical water streaks, fine scratches and sparse oxidation at seams. Square edge-to-edge material surface with a regular corrugation rhythm. Genuinely seamless on every edge; no perspective, directional light, objects, bolts, signs, text, letters, numbers, logos, borders, watermark, or prominent focal feature.

## UI and projected fallback art

All HUD panels are repository CSS. Icons, portraits, projection overlays, and SVG fallback scenes are original vector resources created in this repository. The UI follows only the broad genre grammar of a restrained bottom command console with a clear central viewport.
