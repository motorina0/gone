# Shadow Grid

Shadow Grid is an original browser-based real-time stealth tactics vertical slice. Guide a lone field operative through a compact industrial relay, avoid six patrol guards, secure an intelligence cache, and reach extraction. It uses only generated primitive geometry and does not reproduce any characters, locations, narrative, UI, or assets from another game.

## Stack and installation

Babylon.js renders the 3D scene; strict TypeScript holds gameplay; Vite builds the static application; Vitest tests deterministic rules; HTML/CSS provides the HUD. Node 22 is recommended.

The game runs entirely in the browser and does not require a backend service.

```sh
npm ci
npm run dev
```

Commands: `npm run dev` starts Vite, `npm run build` creates `dist`, `npm test` runs unit tests, `npm run typecheck` checks strict TypeScript, and `npm run lint` runs ESLint.

## Controls and gameplay

Tap or left-click the cyan operative to select them, then tap or left-click walkable ground to path around structures. On touchscreens, drag to orbit and pinch to zoom; with a mouse, middle/right drag pans or rotates and the wheel zooms. Use the labelled HUD buttons or press **Q** to distract, **E** for a rear silent takedown, and **P/Escape** to pause. First enter the violet intel area, then the green extraction. Sustained visible exposure causes loss; overlays and Restart allow another attempt.

Settings for volume, camera rotation, and cone visibility are stored locally. Volume is reserved for later generated audio; this slice intentionally ships silently.

## Architecture and tests

`src/core` owns orchestration/types/math; `navigation` is grid A* independent of rendering; `ai`, `vision`, `sound`, `interaction`, `mission`, and `movement` are deterministic systems; `entities` creates state; `rendering` and `input` adapt Babylon; `ui` is lightweight DOM; and `persistence` validates localStorage data. Tests cover vision geometry/occlusion/exposure, AI transitions, sound radius, takedowns, objectives/outcomes, and settings.

## GitHub Pages deployment

Every push to `main` (or manual dispatch) validates and deploys `dist` using GitHub's official Pages actions. `vite.config.ts` derives the repository and owner from Actions: a repository named `username.github.io` uses `/`; all others use `/repository-name/`. Expected URLs are `https://username.github.io/` or `https://username.github.io/repository-name/`. Locally, `VITE_BASE_PATH=/preview/ npm run build` tests a subdirectory build.

If Pages shows a blank page, inspect the browser console/network panel, confirm Pages uses **GitHub Actions**, confirm the workflow succeeded, and verify bundle URLs begin with the repository base. Asset 404s usually mean a root-absolute URL was introduced; import assets or prefix public URLs with `import.meta.env.BASE_URL`. No external runtime assets are currently required.

## Limitations and roadmap

This focused slice uses coarse grid navigation, simple geometric line-of-sight, one mission, procedural bobbing rather than authored animation, and no audio despite a persisted volume preference. Richer navmeshes, cover/crouch, additional accessibility options, generated audio, more objectives, save games, and additional original missions are future work.
