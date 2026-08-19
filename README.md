# Gone — Field Operations

An original mobile-compatible 2.5D tactical exploration prototype. It borrows only the high-level spatial grammar of classic squad-tactics games—a clear central map and a framed bottom command console—while using original Gone artwork, interface assets, locations, and characters.

## Current phase

Choose Piața Unirii or the fictional Vatra Central Station and freely explore with one visible field agent. Click or tap a destination to walk, double-click or choose **Run** to move faster, pan and zoom the map, and switch among four isometric projections and the playable top-down view.

Guard logic, character AI, detection, objectives, and interactions are disabled in this phase. Each exploration manifest loads exactly one player resource and an empty patrol list. The older mission resources and generic systems remain dormant for possible later development; they are not loaded or updated by the public runtime.

The committed schematic environments include original projected buildings, roads, plazas, rails, platforms, trains, parked cars, trees, benches, weather treatments, foreground occlusion, and a replaceable cathedral detail layer. Piața is an intentionally inexact overcast approximation; Vatra is an original blue-hour railway district after rain. No commercial artwork or map-provider imagery is used.

## Stack and setup

Phaser 4.2, strict TypeScript, Vite, Vitest, Playwright, ESLint, npm, and GitHub Pages. Node 24 is recorded in `.nvmrc` and `package.json`.

```bash
nvm use
npm ci
npm run dev
```

Run `npm run verify` before every push. It validates content, type-checks, lints, runs unit tests, builds with the `/gone/` base path, and exercises desktop and mobile browser flows.

## Controls

- Desktop: click a destination to move; double-click to run; right/middle-drag to pan; wheel to zoom; 1–5 change view; W/R choose walk/run; Space or Escape pauses.
- Mobile: tap to move, double-tap to run, drag empty ground to pan, pinch to zoom, and use the safe-area-aware command console.
- All five camera views are playable and retain exact world position, camera focus, pace, pause state, and zoom preference.

## Architecture

Gameplay uses one canonical top-down world measured in approximate metres. Navigation and movement operate only in `(x, y, elevation)`. Five JSON projection matrices provide invertible world/screen transforms; projection is the only screen-coordinate adapter. Phaser display objects render the authoritative state rather than owning it.

The content registry loads a location manifest referencing separate world, environment, navigation, entity, projection, background, detail, occlusion, and sprite resources. The exploration runtime reads only the single player listed by the active manifest. JSON Schemas and cross-resource rules are checked with `npm run validate:content`.

### Environment art pipeline

`environment.json` is the canonical visual source for atmosphere, surfaces, landmarks, trees, and static props. `npm run generate:views` projects that data through the five location matrices and regenerates independently replaceable 960×640 SVG backgrounds, occlusion masks, and SVG detail overlays. Artist-authored or generated final backgrounds can replace those files without changing gameplay coordinates.

- Add a location by copying a location directory, assigning stable IDs, and registering its manifest in `public/content/index.json`.
- Add roads, buildings, cars, or props in that location's `environment.json`; never put location geometry in generic TypeScript systems.
- Keep collision and occlusion aligned with the canonical environment geometry.

More detail: [architecture](docs/architecture.md), [content format](docs/content-format.md), [projection system](docs/projection-system.md), [mobile controls](docs/mobile-controls.md), and [roadmap](docs/roadmap.md).

## Deployment

The Pages workflow verifies the project and deploys `dist` only after success. In **Settings → Pages**, set Source to **GitHub Actions** once. Expected URL: <https://motorina0.github.io/gone/>.

For a blank page, inspect the browser console and confirm Pages deployed the workflow artifact rather than repository source. For asset 404s, verify manifest-relative filename casing and that URLs retain the `/gone/` prefix.
