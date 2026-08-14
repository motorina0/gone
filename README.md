# Gone — The Courier

A production-oriented proof of concept for an original mobile 2.5D stealth-tactics game. The schematic setting is inspired by Piața Unirii in Cluj-Napoca but is intentionally neither geographically nor architecturally exact. All artwork is original placeholder SVG.

## Proof-of-concept scope

Choose Piața Unirii or Vatra Central Station, select one field agent, follow a courier, hold **Observe** during the exchange, collect the package with **Interact**, then reach the green extraction marker before the 60-second lockdown. Three guards patrol with exposure-based detection, four civilians animate the square, and foreground overlays provide simple occlusion. No combat, accounts, backend, commercial artwork, or map-provider data is used.

## Stack and setup

Phaser 4.2, strict TypeScript, Vite, Vitest, Playwright, ESLint, npm, and GitHub Pages. Node 24 is recorded in `.nvmrc` and `package.json`.

```bash
nvm use
npm ci
npm run dev
```

Scripts: `dev`, `build`, `preview`, `validate:content`, `generate:views`, `typecheck`, `lint`, `test`, `test:e2e`, and `verify`. Run `npm run verify` before every push.

## Controls

**Desktop:** click the agent to select; click ground to move; right/middle-drag to pan; wheel to zoom; 1–5 change view; Space pauses. **Mobile:** tap to select/move, drag empty ground to pan, use the large action/view buttons, and device browser gestures for zoom. Landscape is recommended, but portrait remains playable.

## Architecture

Gameplay uses one canonical top-down world measured in approximate metres. Navigation, patrol, detection, mission state, and interactions operate only in `(x, y, elevation)`. Five JSON projection matrices provide invertible world/screen transforms. Switching an SVG background never resets canonical state. Phaser display objects are adapters over testable state and systems; data lives under `public/content`, not generic engine code.

The content registry loads a location manifest, which references separate world, mission, navigation, entity, patrol, interaction, projection, background, occlusion, and sprite resources. JSON Schemas are checked with `npm run validate:content`.

The opening location picker loads its choices from `public/content/index.json`; `?location=<id>` links directly to a registered location.

### Extend or replace content

- Add a location by copying the location directory, assigning stable IDs, and registering its manifest in `public/content/index.json`.
- Add a mission as a separate mission resource and reference it from a location manifest.
- Replace a background or occlusion SVG at the same manifest-relative path; no code change is needed.
- Edit `environment.json`, then run `npm run generate:views` to regenerate the original schematic placeholders.

More detail: [architecture](docs/architecture.md), [content format](docs/content-format.md), [projection system](docs/projection-system.md), [mobile controls](docs/mobile-controls.md), and [roadmap](docs/roadmap.md).

## Testing and deployment

`npm run verify` validates content, type-checks, lints, runs WebGL-free unit tests, builds at the `/gone/` base, then runs Chromium smoke tests at 1280×720, 390×844, and 844×390. The Pages workflow repeats those checks and deploys `dist` only after success. In **Settings → Pages**, set Source to **GitHub Actions** once. Expected URL: <https://motorina0.github.io/gone/>.

For a blank page, inspect the browser console and confirm Pages deployed the workflow artifact rather than repository source. For asset 404s, verify the manifest-relative filename/case and that URLs retain the `/gone/` prefix. Current limitations include grid navigation, overlay-based occlusion, no audio, procedural station artwork awaiting final AI-assisted paint-over, and one mission per location.
