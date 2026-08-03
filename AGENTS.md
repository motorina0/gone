# Codex contributor instructions

## Conventions and architecture
- Use strict TypeScript, explicit domain types, small focused modules, and no `any`.
- Keep deterministic gameplay state independent from Babylon meshes. Rendering synchronizes state but does not own it.
- Preserve boundaries for bootstrap, rendering/scene, camera/input, entities, movement/navigation, AI/vision, sound/interactions, mission/state, UI, and persistence.
- Prefer primitive/generated assets and minimal dependencies. Never copy third-party game IP or assets.
- Keep basic controls keyboard-accessible and DOM controls labelled.

## Testing and verification
- Add unit tests for every gameplay rule or state transition. Before every push, run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Then invoke the independent `verifier` agent (configured in `.codex/config.toml`) and ask it to inspect the full specification and diff, run all checks, serve a non-root production build, smoke-test gameplay in a browser, inspect console/network output, and report blockers. The verifier is read-only and must not author the implementation.
- Fix every blocking finding, rerun the entire sequence, and ask the verifier to verify again. Never push known failures.

## Git and deployment
- Work on `main`, preserve unrelated work, inspect status and diff, use a focused conventional commit, pull/push without force or history rewriting, and never commit credentials or generated output.
- The app must remain backend-free and static. All URLs must respect Vite's base path. Validate both `/` user-site and `/repository/` project-site Pages layouts.
- Keep `.github/workflows/deploy-pages.yml` on official pinned-major Pages actions and retain validation gates, permissions, concurrency, and `dist` artifact deployment.
