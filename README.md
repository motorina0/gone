# Gone — Field Operations

An original mobile-compatible 2.5D tactical exploration prototype. It borrows only the high-level spatial grammar of classic squad-tactics games—a clear central map and a framed bottom command console—while using original Gone artwork, interface assets, locations, and characters.

## Current phase

Choose Piața Unirii, the fictional Vatra Central Station, or the open-data-derived Gara Cluj-Napoca and freely explore with one visible field agent. Hover to preview a route on ordinary maps (hazard-dense maps keep immediate move/blocked cursor feedback), click or tap a destination to walk, double-click or choose **Run** to move faster, pan and zoom the environment, optionally follow the operative, and switch among four isometric projections and the playable top-down view.

Guard logic, character AI, detection, objectives, and interactions are disabled in this phase. Each exploration manifest loads exactly one player resource and an empty patrol list. The older mission resources and generic systems remain dormant for possible later development; they are not loaded or updated by the public runtime.

The committed environments include original projected buildings, roads, plazas, rails, platforms, trains, parked cars, trees, benches, weather treatments, foreground occlusion, and a replaceable cathedral detail layer. Vatra is the visual benchmark: its purpose-built editable Blender scene adds material-specific façades, platform canopies, rail catenary, signals, detailed static vehicles, freight dressing, road markings, station furniture, practical lighting, wet reflections, and a lighter-detail outer district across five aligned pre-renders and depth outputs. Four original Gone finish plates replace the raw procedural look in the tactical views while retaining Blender-derived depth and occlusion masks. Its eight-direction animated operative is also built from an original editable Blender source. Original raster asphalt, paving, masonry, roof, concrete, plaster, brick, and metal materials add detail without changing canonical geometry. Piața is an intentionally inexact overcast approximation; Vatra is an original blue-hour railway district after rain. No commercial artwork or map-provider imagery is used.

## Stack and setup

Phaser 4.2, strict TypeScript, Vite, Vitest, Playwright, ESLint, npm, and GitHub Pages. Node 24 is recorded in `.nvmrc` and `package.json`.

```bash
nvm use
npm ci
npm run dev
```

Run `npm run verify` before every push. It validates content, type-checks, lints, runs unit tests, builds with the `/gone/` base path, and exercises desktop and mobile browser flows.

## Controls

- Desktop: hover to preview a route where map complexity permits; click a destination to move; double-click to run; drag, move the pointer to a screen edge, or use the arrow keys to pan; wheel to zoom at the pointer; 1–5 change view; W/R choose walk/run; F toggles follow; Space or Escape pauses.
- Mobile: tap to move, double-tap to run, drag empty ground to pan, pinch to zoom, and use the safe-area-aware command console.
- All five camera views are playable and retain exact world position, per-view camera focus/zoom, pace, and pause state. The four tactical projections open at a close 3× framing and can zoom out to an aspect-aware whole-map fit; SAT opens at that full-map overview. Camera views are loaded on demand after the initial view to keep mobile startup bounded.

## Architecture

Gameplay uses one canonical top-down world measured in approximate metres. Navigation and movement operate only in `(x, y, elevation)`. Authored walkable polygons define streets, plazas, platforms, crossings, and yards; eight-direction routing prevents corner cutting and smooths only verified clear segments. Five JSON projection matrices provide invertible world/screen transforms; projection is the only screen-coordinate adapter. Phaser display objects render the authoritative state rather than owning it.

The content registry loads a location manifest referencing separate world, environment, navigation, entity, projection, background, detail, occlusion, and sprite resources. The exploration runtime reads only the single player listed by the active manifest. JSON Schemas and cross-resource rules are checked with `npm run validate:content`.

### Environment art pipeline

`environment.json` is the canonical visual source for atmosphere, surfaces, landmarks, trees, and static props. `npm run generate:views` projects that data through the five location matrices, writes independently editable SVG sources, and bakes material-complete fallback WebPs on the canonical 960×640 stage. For Vatra, `npm run generate:vatra:3d` builds the original editable Blender source, renders five 3840×2560 geometry/depth/occlusion masters, applies the four replaceable Gone tactical finish plates, and bakes the committed 1920×1280 WebPs. `npm run generate:agent` builds and renders the eight-direction character atlas. Raster materials and finish plates stay external to scene data. Final backgrounds remain replaceable without changing gameplay coordinates.

Gara Cluj-Napoca uses normalized OpenStreetMap geometry, sampled Copernicus GLO-30 terrain, separate gameplay-authoring JSON, and deterministic original SVG artwork. See [the location documentation](docs/cluj-napoca-station.md) and [source-data README](data/cluj-napoca-station/README.md).

- Add a location by copying a location directory, assigning stable IDs, and registering its manifest in `public/content/index.json`.
- Add roads, buildings, cars, or props in that location's `environment.json`; never put location geometry in generic TypeScript systems.
- Keep collision and occlusion aligned with the canonical environment geometry.

More detail: [architecture](docs/architecture.md), [art provenance](docs/art-provenance.md), [content format](docs/content-format.md), [projection system](docs/projection-system.md), [mobile controls](docs/mobile-controls.md), and [roadmap](docs/roadmap.md).

## Deployment

The Pages workflow verifies the project and deploys `dist` only after success. In **Settings → Pages**, set Source to **GitHub Actions** once. Expected URL: <https://motorina0.github.io/gone/>.

For a blank page, inspect the browser console and confirm Pages deployed the workflow artifact rather than repository source. For asset 404s, verify manifest-relative filename casing and that URLs retain the `/gone/` prefix.
