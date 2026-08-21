# Cluj-Napoca station realism trials

These five PNG files are private, provisional art-direction trials. At the user's request, the optimized derivatives in `runtime/` provide all five beauty plates in the private runtime build. `tools/generate-cluj-station.ts` copies those deterministic WebP masters into the generated location. They must not be used for collision or projection alignment, treated as final distributable Gone artwork, or published without replacement by cleanly sourced artwork.

## Provenance and input roles

- Generated on 2026-08-21 with Codex's built-in image-generation tool in edit/reference mode.
- The strict edit targets were temporary PNG rasterizations of the canonical SVGs in `public/content/locations/cluj-napoca-station/views/`.
- The corresponding files in `images/gara/` were user-authorized temporary aerial references for factual material, color, roof, façade, road, platform, canopy, and vegetation direction.
- `view-0.png` became the finish, lighting, palette, and texture-density reference for the other four trials.
- The runtime manifest loads one derived WebP plate for each matching view: 0°, 90°, 180°, 270°, and SAT/top. The generator retains the canonical SVGs separately as editable `sourceViews` and retains the existing data-driven overlays, occlusion, projection, and gameplay geometry.

The `images/gara/` captures visibly derive from Google imagery. Their use was explicitly authorized only for this private trial after the earlier production restriction was discussed. These trials are therefore not cleared final assets and should not be redistributed. Replace those references with the user's own photographs, then regenerate or manually author the final artwork with clean provenance.

## Reliability

The generator was instructed to preserve the canonical camera, footprint, roads, tracks, platform edges, building footprints, and tree anchors. It preserved the broad topology and framing, but it introduced visual interpretation and local geometric drift. These images are suitable for judging realism, palette, materials, and architectural character only. They are not suitable as survey data, geometry sources, occlusion masks, depth maps, or gameplay-aligned runtime plates.

The first `view-180` attempt over-weighted its close aerial reference and was rejected. The first `view-90` attempt drifted to a wide non-canonical canvas and was also rejected. Neither is stored here. Both accepted replacements were regenerated from their canonical full-map plates and the Gone `view-0` finish anchor.

## Core generation brief

> Repaint the complete canonical Cluj station map into an original, high-fidelity pre-rendered isometric tactical environment. Preserve the strict 3:2 canvas, orthographic camera, trimmed footprint, broad map topology, roads, rail corridor, platforms, building footprints, tree anchors, and near-black exterior field. Use temporary aerial references only to understand factual material families and architectural character: weathered red brick, pale stone trim, terracotta roofs, gray platform canopies, ballast, patched asphalt, tram grooves, pavers, plaster, steel, vegetation, and subtle grime. Keep the result text-free and free of people, vehicles, advertisements, logos, watermarks, UI, invented buildings, roads, and gameplay obstacles. Avoid photogrammetry artifacts, floating-board presentation, unpopulated interior areas, plastic-miniature styling, excessive bloom, and painterly looseness.
