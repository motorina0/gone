# Art provenance

Every runtime-visible asset in Gone is original to this repository. No stock library, map-provider image, extracted game file, traced commercial asset, third-party texture, font, icon, character, or environment mesh is used.

## Gara Cluj-Napoca

- `data/cluj-napoca-station/osm-source.json` is a normalized, clipped ODbL source snapshot used for geographic geometry; it is data rather than artwork.
- `data/cluj-napoca-station/terrain-source.json` contains sampled Copernicus GLO-30 elevations, the canonical terrain-plane derivation, and the required source and liability notices. No DEM raster is shipped.
- `data/cluj-napoca-station/gameplay-authoring.json` records conservative original gameplay interpretation and every material station approximation.
- `tools/generate-cluj-station.ts` deterministically creates the five runtime beauty SVGs and their separate detail, occlusion, and backdrop layers. All colors, patterns, façade and mapped-entrance treatment, platform/canopy styling, ballast, rails, fences and walls, vegetation rendering, wet-surface treatment, icons, and typography are original Gone vectors. No raster map or aerial image is used as an art input.
- `data/cluj-napoca-station/openaerialmap-coverage.json` records that OAM returned no catalogue image. The OAM viewer basemap was not downloaded or used.

## Vatra Central Station

- `art/vatra/build_vatra_scene.py` constructs the fictional station, surrounding district, material-specific architecture, roads and markings, rails and catenary, platforms and canopies, footbridge, static trains and cars, station furniture, freight dressing, vegetation, rain treatment, and practical lighting from Gone's `environment.json` resource.
- `art/vatra/vatra-central-station.blend` is the editable generated scene source. It contains five orthographic cameras aligned with the canonical projection resources.
- `art/vatra/renders/` contains reproducible 3840×2560 geometry, linear-depth, and occlusion masters and is intentionally ignored. The four original Gone finish plates in `art/vatra/paintovers/` are external, replaceable raster sources. `tools/process-vatra-renders.mjs` creates the committed 1920×1280 WebP runtime views, derives color-matched transparent occlusion from the canonical Blender masks, feathers the finished center into the extended backdrop, and writes 960×640 depth maps.
- `tools/generate-placeholder-views.ts` remains the deterministic SVG projection/fallback and creates the aligned editable occlusion and detail layers.

The user-provided Commandos 2 screenshot was used only to discuss high-level composition, density, and camera framing. It was not supplied to an image generator, sampled, traced, transformed, or shipped. All image-generation inputs were existing Gone-only renders or Gone-only generated references.

### Vatra concept and finish plates

Codex's built-in image-generation tool was used in edit/reference mode. `art/vatra/references/gone-vatra-hero-slice-concept.png` is an original Gone art-direction target and is not loaded at runtime. Its prompt was:

> Create an original high-fidelity isometric tactical environment concept made specifically for Gone: the fictional Vatra Central Station at blue hour just after rain. Preserve the supplied Gone station's broad orthographic composition while developing a believable central-platform hero slice with aged brick and plaster station buildings, wet tiled roofs, detailed rails and catenary, steel-and-glass footbridge, platform canopies, parked cars, full organic trees, drainage, puddles, grime, warm practical lamps, and cool atmospheric fill. Early-2000s pre-rendered tactical realism, richly textured and grounded, no floating map edge. No people, UI, readable text, logos, weapons, military imagery, or assets from another game.

The four runtime finish sources in `art/vatra/paintovers/view-{0,90,180,270}.png` were edited from their corresponding canonical Gone Blender plates. View 0 also used the Gone concept above as a finish reference; each later view used the already approved Gone finish plates only to keep materials and lighting coherent. The shared production prompt was:

> Create the final original Gone tactical beauty master for Vatra Central Station. The first image is the strict canonical layout plate for this projection: preserve its exact 3:2 framing, orthographic isometric camera, projected geometry, footprints, edges, road lanes, tracks, platforms, footbridge, buildings, trees, vehicles, and empty walkable spaces. Do not move, resize, rotate, add, or remove any gameplay-significant object. Other supplied Gone images are style, material, and lighting references only; do not copy their cameras or object positions. Paint over the first image into coherent, richly detailed early-2000s pre-rendered tactical realism: blue-hour after rain, wet reflective asphalt, convincing brick, plaster, stone and corrugated materials, aged roof tiles and flashing, detailed windows, doors, gutters and façade trim, realistic platform furniture, steel bridge trusses and glazing, rail hardware, puddles, grime, restrained warm practical lights, organic full-canopy foliage, and subtle atmospheric depth. Preserve every silhouette and coordinate from the first image so canonical projection, navigation, and occlusion remain aligned. Surface-only grime, reflections, cracks, leaves, posters without readable text, and small non-solid litter are allowed. No people, UI, labels, readable words, logos, weapons, military imagery, copied game assets, blank bands, floating board, or border. Edge-to-edge, high-detail, game-ready raster in the original Gone art direction.

## Operative

- `art/agent/build_agent_atlas.py` creates Gone's low-poly field operative, eight facings, idle pose, four walk frames, and four run frames.
- `art/agent/gone-operative.blend` is the editable character source.
- `tools/assemble-agent-atlas.mjs` deterministically builds the transparent runtime atlas. The same Gone operative is used in both current locations.

`art/agent/references/gone-operative-turnaround.png` is an original Gone-only design reference created with Codex's built-in image-generation tool in reference mode; it is not loaded at runtime. Prompt:

> Create an original character turnaround made specifically for Gone: a late-thirties civilian field operative in a slate-green raincoat over charcoal knitwear and trousers, worn brown boots, and a practical brown leather satchel. Realistic human proportions, restrained tired expression, short dark hair, subtle early-2000s Eastern European civilian styling, no uniform, no weapon, no tactical armor, no insignia, no logo, no text. Show clear front, three-quarter, profile, and back views on a neutral studio background for an isometric game sprite model. Grounded realistic materials and construction, entirely original character design.

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
