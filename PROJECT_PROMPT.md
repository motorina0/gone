# Project implementation prompt

> **CURRENT STATE — 2026-08-09:** The playable vertical slice described below is implemented and deployed. Desktop and mobile input, explicit zoom/rotation controls, persistent guard-vision-field visibility, and the GitHub Pages workflow are working. Continue future work from this marker and verify the repository before changing status.

---

Create a browser-based real-time stealth tactics game inspired by the gameplay
structure of classic Commandos.

Do not copy any copyrighted characters, names, missions, maps, dialogue,
artwork, sounds, music, UI designs, or game assets. Create an original game
with similar high-level stealth-tactics mechanics.

The repository is public and the game must be deployed through GitHub Pages.

Use:

- Babylon.js
- TypeScript
- Vite
- HTML and CSS
- Vitest
- GitHub Actions
- GitHub Pages

The application must:

- run entirely in the browser;
- require no backend;
- build as a static site;
- work on modern desktop browsers;
- be structured so mobile support can be added later.

Do not introduce React, Vue, Angular, or another frontend framework unless
there is a strong technical reason. Prefer Babylon.js with modular TypeScript
and lightweight DOM-based UI.

Build a minimal but playable vertical slice using primitive meshes.

Implement:

1. A simple original 3D test level containing walls, buildings, obstacles,
   walkable areas, an objective area, and an extraction area.
2. An angled tactical Babylon.js ArcRotateCamera with a high perspective,
   mouse-wheel zoom, mouse-drag panning, optional rotation, sensible limits,
   and controls that do not interfere with selection.
3. One controllable player character with click selection, a visible selection
   indicator, click-to-move, obstacle avoidance, procedural movement, and
   correct stopping at the destination.
4. Navigation around static obstacles, separate from rendering, using a
   maintainable pathfinding solution. Unreachable clicks must fail safely.
5. Six guards with individual patrol routes, visible vision cones,
   line-of-sight, distance/angle detection, and configurable exposure time.
6. Guard states: idle, patrol, suspicious, investigate, alert, and return.
7. A configurable-radius, cooldown-limited sound distraction ability.
8. Silent takedowns only from sufficiently close behind a non-alert guard;
   defeated guards stop detecting/moving, with clear availability feedback.
9. Objective, extraction, win/loss, restart, pause, and resume mission flow.
10. A tactical HUD showing selection, objective, cooldown, alert state,
    pause/restart actions, end overlays, and control instructions.
11. localStorage settings for sound volume, camera rotation preference, and
    vision-cone visibility, without accounts or a backend.

Use a clean, modular architecture. Keep application bootstrap, rendering,
scene setup, camera, input, entities, movement, navigation, guard AI, vision,
sound, interactions, mission objectives, game state, UI, and persistence
separate. Do not place most logic in one file. Prefer small focused modules,
clear TypeScript types, no unnecessary `any`, deterministic gameplay state,
and separation between gameplay state and Babylon.js meshes. Avoid
unnecessary dependencies.

Add automated tests for at least:

- vision angle and distance calculations;
- line-of-sight decisions where practical;
- exposure-time detection;
- guard AI transitions;
- sound-event radius checks;
- silent-takedown eligibility;
- mission completion and win/loss conditions;
- settings serialization.

Add and keep working scripts for `npm run dev`, `npm run build`, `npm test`,
`npm run typecheck`, and `npm run lint`.

The game must automatically deploy to GitHub Pages from
`.github/workflows/deploy-pages.yml`. The workflow must trigger on every push
to `main` and by manual dispatch, install with `npm ci`, run typecheck, lint,
tests, and the production build, deploy `dist` with current official Pages
actions and required permissions, prevent conflicting deployments, and stop
on validation failure.

Configure Vite robustly for both project repositories at
`https://username.github.io/repository-name/` and user-site repositories named
`username.github.io`. Derive the repository name from the Actions environment
rather than hard-coding an unknown name. Use `/` for user sites and
`/repository-name/` for project sites.

All assets must respect the Pages base path. Do not use unprefixed
root-absolute asset paths. Use imports, `import.meta.env.BASE_URL`,
`new URL(..., import.meta.url)`, or correctly handled public files. Bundles,
CSS, GLB models, textures, audio, icons, and dynamic assets must load after
deployment. Do not depend on localhost, local paths, secrets, server processes,
or unavailable APIs. Avoid client routing initially; if added, use a
Pages-safe approach. Include an unobtrusive visible build/version identifier.

Create README.md with the project description, stack, installation,
development commands, controls, gameplay and architecture overviews, tests,
Pages deployment and URL formats, blank-page/404 troubleshooting,
limitations, and roadmap.

Create AGENTS.md with conventions, architecture rules, testing and Git
requirements, deployment constraints, future Codex instructions, and required
verification before every push.

Create a reusable narrowly scoped read-only verifier in
`.codex/agents/verifier.toml`, with any needed configuration in
`.codex/config.toml`. It must focus on compliance, correctness, regressions,
gameplay, console errors, missing tests, asset loading, Pages compatibility,
basic-control accessibility, unnecessary dependencies, and maintainability.
Document its invocation in AGENTS.md.

After implementation, a separate verifier that did not author the work must:

1. Read the complete specification and inspect the entire diff.
2. Check every requirement and acceptance criterion.
3. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and
   `npm run build`.
4. Start the application and perform browser smoke testing.
5. Inspect console output and verify load, selection, movement, obstacles,
   patrols, cones, detection, distraction, takedown, pause/restart,
   objectives, win/loss, persistence, assets, non-root production base paths,
   and Pages paths.
6. Inspect the Pages workflow and produce a concise report of checks,
   problems, fixes, command results, and limitations.

If verification finds a blocker, return to implementation, fix it, and repeat
the complete verification. Do not declare completion with blockers. If new
agent configuration cannot load in-session, independently verify directly and
leave the configuration ready for future sessions.

Work directly on `main`. Before changes, inspect the repository, preserve
useful work, avoid unrelated deletion, check status, and synchronize with
latest `main` when supported.

After implementation and independent verification:

1. Confirm no unexpected generated files or secrets exist.
2. Confirm `.gitignore` covers `node_modules`, `dist`, local environment
   files, editor temporary files, and test artifacts.
3. Review the complete diff.
4. Run the full validation sequence one final time.
5. Commit completed changes directly to `main` with a clear message.
6. Push `main` without force-pushing or rewriting history.
7. Never push if validation fails.
8. Check the deployment status when possible; inspect, fix, commit, repush,
   and recheck failures.
9. If permissions prevent pushing, still commit locally and report the exact
   reason without claiming a remote update.
10. Never commit credentials, tokens, passwords, keys, or session cookies.

The task is complete only when the game is meaningfully playable; modular and
documented; all five validation commands pass; independent verification has
no blockers; the non-root production build and Pages workflow work; required
assets load; and changes are committed and pushed when permissions allow.

Do not spend time on polished art, advanced audio, multiplayer, a backend,
accounts, monetization, or a large campaign. Prioritize reliable gameplay,
clean architecture, tests, successful Pages deployment, and safe extensibility.
