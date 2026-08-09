<!-- CURRENT STATE (PHASE 2B COMPLETE): The playable vertical slice is implemented and deployed. Desktop and mobile input, zoom/rotation controls, persistent guard vision-field visibility, and the GitHub Pages workflow are working. -->

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

1. A simple original 3D test level containing:

   - walls;
   - buildings;
   - obstacles;
   - walkable areas;
   - an objective area;
   - an extraction area.

2. An angled tactical camera similar to games such as Commandos:

   - Babylon.js ArcRotateCamera;
   - high angled perspective;
   - mouse-wheel zoom;
   - mouse-drag panning;
   - optional camera rotation;
   - sensible zoom and movement limits;
   - camera controls must not interfere with unit selection.

3. One controllable player character:

   - click to select;
   - visible selection indicator;
   - click-to-move;
   - obstacle avoidance;
   - movement animation or a simple procedural movement effect;
   - movement must stop correctly at the destination.

4. Navigation:

   - support movement around static obstacles;
   - keep navigation logic separate from rendering;
   - use a navigation mesh or another maintainable pathfinding solution;
   - clicking an unreachable location must fail safely.

5. Six enemy guards:

   - individual patrol routes;
   - visible vision cones;
   - line-of-sight checks;
   - distance and angle-based detection;
   - detection must require a configurable exposure time rather than causing
     an instant failure.

6. Guard AI states:

   - idle;
   - patrol;
   - suspicious;
   - investigate;
   - alert;
   - return to patrol.

7. Distraction ability:

   - the player can create a sound event;
   - nearby guards may investigate it;
   - sound propagation must have a configurable radius;
   - the ability must have a cooldown.

8. Silent takedown:

   - usable only from sufficiently close behind a guard;
   - unavailable while the guard is fully alerted;
   - defeated guards stop detecting and moving;
   - show clear UI feedback when a takedown is available.

9. Mission flow:

   - one mission objective;
   - one extraction zone;
   - win condition;
   - loss condition;
   - restart;
   - pause and resume.

10. Minimal tactical HUD:

- selected character;
- current objective;
- distraction cooldown;
- alert state;
- pause button;
- restart button;
- win and loss overlays;
- control instructions.

11. Persistence:

- save settings in localStorage;
- include at least sound volume, camera rotation preference, and vision-cone
  visibility;
- do not require accounts or a backend.

Use a clean, modular architecture.

Keep these areas separated:

- application bootstrap;
- rendering;
- scene setup;
- camera;
- input;
- entities;
- movement;
- navigation;
- guard AI;
- vision and detection;
- sound events;
- interactions;
- mission objectives;
- game state;
- UI;
- persistence.

Do not place most of the project logic in one large file.

Prefer small, focused modules with explicit responsibilities.

Use clear TypeScript types and avoid unnecessary use of `any`.

Keep game-state logic deterministic where practical.

Separate gameplay state from Babylon.js meshes so gameplay systems can be
tested without requiring a rendered browser scene.

Avoid unnecessary dependencies.

Add automated tests for at least:

- angle and distance calculations for vision;
- line-of-sight decision logic where practical;
- exposure-time detection;
- guard AI state transitions;
- sound-event radius checks;
- silent-takedown eligibility;
- mission objective completion;
- win and loss conditions;
- settings serialization.

Add scripts for:

- npm run dev
- npm run build
- npm test
- npm run typecheck
- npm run lint

Configure the project so all scripts execute successfully.

The game must be automatically deployed to GitHub Pages.

Create a GitHub Actions workflow under:

.github/workflows/deploy-pages.yml

Requirements:

- trigger deployment on every push to the main branch;
- also support manual workflow dispatch;
- install dependencies using npm ci;
- run type checking;
- run linting;
- run tests;
- run the production build;
- deploy the generated dist directory using the current official GitHub Pages
  Actions workflow;
- use the required GitHub Pages permissions;
- prevent concurrent deployments from conflicting;
- fail deployment if tests or the build fail.

Configure Vite correctly for a GitHub Pages project URL:

[https://](https://.github.io//)[.github.io/](https://.github.io//)[/](https://.github.io//)

Do not hard-code an unknown repository name.

Determine the repository name from the GitHub Actions environment when
building, or use another robust configuration that works locally and on
GitHub Pages.

Handle both cases:

1. A normal project repository:
   [https://username.github.io/repository-name/](https://username.github.io/repository-name/)

2. A user-site repository named:
   username.github.io

Use `/` as the base for a user-site repository and
`/repository-name/` for a normal project repository.

All assets must load correctly from the GitHub Pages base path.

Do not use root-absolute asset paths such as:

/assets/model.glb

unless they are explicitly prefixed with the correct Vite base URL.

Use one of these safe approaches:

- imported assets;
- URLs generated with import.meta.env.BASE\_URL;
- new URL(..., import.meta.url);
- files handled correctly from the Vite public directory.

The following must work after deployment:

- JavaScript bundles;
- CSS;
- GLB models;
- textures;
- audio;
- icons;
- dynamically loaded assets.

The application must not depend on localhost, local file paths, environment
secrets, a server process, or APIs unavailable from GitHub Pages.

Avoid client-side URL routing for this initial version. If routing is added,
use a GitHub Pages-safe strategy such as hash routing.

Add a visible build/version identifier somewhere unobtrusive in the UI so a
deployment can be verified.

Create README.md containing:

- project description;
- technology stack;
- installation instructions;
- development commands;
- controls;
- gameplay overview;
- architecture overview;
- testing instructions;
- GitHub Pages deployment explanation;
- expected public URL format;
- troubleshooting for blank pages and asset 404 errors;
- current limitations;
- roadmap.

Create AGENTS.md containing:

- code conventions;
- architecture rules;
- testing requirements;
- Git workflow requirements;
- deployment constraints;
- instructions for future Codex tasks;
- instructions requiring verification before every push.

Create a reusable, narrowly scoped read-only verification agent for future
tasks.

Add:

- .codex/agents/verifier.toml
- any necessary Codex multi-agent configuration under .codex/config.toml

The verifier must focus on:

- requirement compliance;
- correctness;
- regressions;
- broken gameplay;
- browser console errors;
- missing tests;
- asset loading;
- GitHub Pages compatibility;
- accessibility of basic controls;
- unnecessary dependencies;
- maintainability.

Document in AGENTS.md how future tasks should invoke the verifier.

After implementation, use a separate verifier agent that did not write the
implementation.

The verifier must independently:

1. Read this complete task specification.
2. Inspect the entire git diff.
3. Check every requirement and acceptance criterion.
4. Run:
   - npm ci
   - npm run typecheck
   - npm run lint
   - npm test
   - npm run build
5. Start the application locally.
6. Perform browser-based smoke testing.
7. Check the browser console for errors and important warnings.
8. Verify:
   - the game loads;
   - the player can be selected;
   - click-to-move works;
   - obstacles affect movement;
   - guard patrols work;
   - vision cones display correctly;
   - detection works;
   - distraction works;
   - silent takedown works;
   - pause and restart work;
   - the objective can be completed;
   - win and loss states are reachable;
   - settings persist;
   - no required asset returns a 404;
   - the production build works from a non-root base path;
   - GitHub Pages paths are correct.
9. Inspect the GitHub Actions workflow for correct Pages configuration.
10. Produce a concise verification report containing:
    - checks performed;
    - problems found;
    - fixes applied;
    - final command results;
    - any remaining limitations.

If the verifier finds a blocking problem:

- return the work to the implementation phase;
- fix the problem;
- run the entire verification process again.

Do not declare the task complete while blocking verification failures remain.

If newly created Codex agent configuration cannot be loaded during the current
session, perform an independent fresh verification pass directly and leave the
verifier configuration ready for future sessions.

Work directly on the main branch.

Before modifying files:

- inspect the existing repository;
- preserve useful existing work;
- do not delete unrelated files;
- check the current git status;
- pull or synchronize with the latest main branch if supported.

After implementation and independent verification:

1. Confirm there are no unexpected generated files or secrets.

2. Confirm .gitignore includes:

   - node\_modules;
   - dist;
   - local environment files;
   - editor-specific temporary files;
   - test artifacts that should not be committed.

3. Review the complete diff.

4. Run the full validation sequence one final time:

   - npm ci
   - npm run typecheck
   - npm run lint
   - npm test
   - npm run build

5. Commit all completed project changes directly to main.

6. Use a clear commit message, for example:

   feat: add playable stealth tactics vertical slice

7. Push the main branch to the connected GitHub repository.

8. Do not force-push.

9. Do not rewrite existing history.

10. Do not push if any required validation command fails.

11. After pushing, check the GitHub Actions deployment status if the current
    environment permits it.

12. If deployment fails, inspect the logs, fix the problem, commit the fix,
    push again, and recheck.

If the environment cannot push because GitHub permissions are unavailable:

- still create the local commit;
- clearly report that the push could not be completed;
- provide the exact reason;
- do not claim that the repository was updated remotely.

Never commit:

- tokens;
- passwords;
- API keys;
- private keys;
- session cookies;
- personal credentials.

The task is complete only when:

- the game is meaningfully playable;
- the code is modular and documented;
- npm ci succeeds;
- npm run typecheck succeeds;
- npm run lint succeeds;
- npm test succeeds;
- npm run build succeeds;
- the verifier reports no blocking failures;
- the production build works using a GitHub Pages-style subdirectory base;
- the GitHub Pages workflow exists and is valid;
- all required assets load correctly;
- the changes are committed to main;
- the main branch is pushed, provided repository permissions allow it.

Do not spend time on polished art, advanced audio, multiplayer, a backend,
accounts, monetization, or a large campaign.

Prioritize:

1. reliable gameplay;
2. clean architecture;
3. tests;
4. successful GitHub Pages deployment;
5. a repository that is safe to extend in later Codex tasks.

Create a browser-based real-time stealth tactics game inspired by the gameplay

structure of classic Commandos.



Do not copy any copyrighted characters, names, missions, maps, dialogue,

artwork, sounds, music, UI designs, or game assets. Create an original game

with similar high-level stealth-tactics mechanics.



The repository is public and the game must be deployed through GitHub Pages.



\==================================================

TECHNOLOGY

\==================================================



Use:



\- Babylon.js

\- TypeScript

\- Vite

\- HTML and CSS

\- Vitest

\- GitHub Actions

\- GitHub Pages



The application must:



\- run entirely in the browser;

\- require no backend;

\- build as a static site;

\- work on modern desktop browsers;

\- be structured so mobile support can be added later.



Do not introduce React, Vue, Angular, or another frontend framework unless

there is a strong technical reason. Prefer Babylon.js with modular TypeScript

and lightweight DOM-based UI.



\==================================================

INITIAL PLAYABLE VERTICAL SLICE

\==================================================



Build a minimal but playable vertical slice using primitive meshes.



Implement:



1\. A simple original 3D test level containing:

   \- walls;

   \- buildings;

   \- obstacles;

   \- walkable areas;

   \- an objective area;

   \- an extraction area.



2\. An angled tactical camera similar to games such as Commandos:

   \- Babylon.js ArcRotateCamera;

   \- high angled perspective;

   \- mouse-wheel zoom;

   \- mouse-drag panning;

   \- optional camera rotation;

   \- sensible zoom and movement limits;

   \- camera controls must not interfere with unit selection.



3\. One controllable player character:

   \- click to select;

   \- visible selection indicator;

   \- click-to-move;

   \- obstacle avoidance;

   \- movement animation or a simple procedural movement effect;

   \- movement must stop correctly at the destination.



4\. Navigation:

   \- support movement around static obstacles;

   \- keep navigation logic separate from rendering;

   \- use a navigation mesh or another maintainable pathfinding solution;

   \- clicking an unreachable location must fail safely.



5\. Six enemy guards:

   \- individual patrol routes;

   \- visible vision cones;

   \- line-of-sight checks;

   \- distance and angle-based detection;

   \- detection must require a configurable exposure time rather than causing

     an instant failure.



6\. Guard AI states:

   \- idle;

   \- patrol;

   \- suspicious;

   \- investigate;

   \- alert;

   \- return to patrol.



7\. Distraction ability:

   \- the player can create a sound event;

   \- nearby guards may investigate it;

   \- sound propagation must have a configurable radius;

   \- the ability must have a cooldown.



8\. Silent takedown:

   \- usable only from sufficiently close behind a guard;

   \- unavailable while the guard is fully alerted;

   \- defeated guards stop detecting and moving;

   \- show clear UI feedback when a takedown is available.



9\. Mission flow:

   \- one mission objective;

   \- one extraction zone;

   \- win condition;

   \- loss condition;

   \- restart;

   \- pause and resume.



10\. Minimal tactical HUD:

   \- selected character;

   \- current objective;

   \- distraction cooldown;

   \- alert state;

   \- pause button;

   \- restart button;

   \- win and loss overlays;

   \- control instructions.



11\. Persistence:

   \- save settings in localStorage;

   \- include at least sound volume, camera rotation preference, and vision-cone

     visibility;

   \- do not require accounts or a backend.



\==================================================

ARCHITECTURE

\==================================================



Use a clean, modular architecture.



Keep these areas separated:



\- application bootstrap;

\- rendering;

\- scene setup;

\- camera;

\- input;

\- entities;

\- movement;

\- navigation;

\- guard AI;

\- vision and detection;

\- sound events;

\- interactions;

\- mission objectives;

\- game state;

\- UI;

\- persistence.



Do not place most of the project logic in one large file.



Prefer small, focused modules with explicit responsibilities.



Use clear TypeScript types and avoid unnecessary use of \`any\`.



Keep game-state logic deterministic where practical.



Separate gameplay state from Babylon.js meshes so gameplay systems can be

tested without requiring a rendered browser scene.



Avoid unnecessary dependencies.



\==================================================

TESTING

\==================================================



Add automated tests for at least:



\- angle and distance calculations for vision;

\- line-of-sight decision logic where practical;

\- exposure-time detection;

\- guard AI state transitions;

\- sound-event radius checks;

\- silent-takedown eligibility;

\- mission objective completion;

\- win and loss conditions;

\- settings serialization.



Add scripts for:



\- npm run dev

\- npm run build

\- npm test

\- npm run typecheck

\- npm run lint



Configure the project so all scripts execute successfully.



\==================================================

GITHUB PAGES DEPLOYMENT

\==================================================



The game must be automatically deployed to GitHub Pages.



Create a GitHub Actions workflow under:



.github/workflows/deploy-pages.yml



Requirements:



\- trigger deployment on every push to the main branch;

\- also support manual workflow dispatch;

\- install dependencies using npm ci;

\- run type checking;

\- run linting;

\- run tests;

\- run the production build;

\- deploy the generated dist directory using the current official GitHub Pages

  Actions workflow;

\- use the required GitHub Pages permissions;

\- prevent concurrent deployments from conflicting;

\- fail deployment if tests or the build fail.



Configure Vite correctly for a GitHub Pages project URL:



https\://\<github-username>.github.io/\<repository-name>/



Do not hard-code an unknown repository name.



Determine the repository name from the GitHub Actions environment when

building, or use another robust configuration that works locally and on

GitHub Pages.



Handle both cases:



1\. A normal project repository:

   [https://username.github.io/repository-name/](https://username.github.io/repository-name/)



2\. A user-site repository named:

   username.github.io



Use \`/\` as the base for a user-site repository and

\`/repository-name/\` for a normal project repository.



All assets must load correctly from the GitHub Pages base path.



Do not use root-absolute asset paths such as:



/assets/model.glb



unless they are explicitly prefixed with the correct Vite base URL.



Use one of these safe approaches:



\- imported assets;

\- URLs generated with import.meta.env.BASE\_URL;

\- new URL(..., import.meta.url);

\- files handled correctly from the Vite public directory.



The following must work after deployment:



\- JavaScript bundles;

\- CSS;

\- GLB models;

\- textures;

\- audio;

\- icons;

\- dynamically loaded assets.



The application must not depend on localhost, local file paths, environment

secrets, a server process, or APIs unavailable from GitHub Pages.



Avoid client-side URL routing for this initial version. If routing is added,

use a GitHub Pages-safe strategy such as hash routing.



Add a visible build/version identifier somewhere unobtrusive in the UI so a

deployment can be verified.



\==================================================

README AND PROJECT DOCUMENTATION

\==================================================



Create README.md containing:



\- project description;

\- technology stack;

\- installation instructions;

\- development commands;

\- controls;

\- gameplay overview;

\- architecture overview;

\- testing instructions;

\- GitHub Pages deployment explanation;

\- expected public URL format;

\- troubleshooting for blank pages and asset 404 errors;

\- current limitations;

\- roadmap.



Create AGENTS.md containing:



\- code conventions;

\- architecture rules;

\- testing requirements;

\- Git workflow requirements;

\- deployment constraints;

\- instructions for future Codex tasks;

\- instructions requiring verification before every push.



\==================================================

INDEPENDENT VERIFICATION AGENT

\==================================================



Create a reusable, narrowly scoped read-only verification agent for future

tasks.



Add:



\- .codex/agents/verifier.toml

\- any necessary Codex multi-agent configuration under .codex/config.toml



The verifier must focus on:



\- requirement compliance;

\- correctness;

\- regressions;

\- broken gameplay;

\- browser console errors;

\- missing tests;

\- asset loading;

\- GitHub Pages compatibility;

\- accessibility of basic controls;

\- unnecessary dependencies;

\- maintainability.



Document in AGENTS.md how future tasks should invoke the verifier.



After implementation, use a separate verifier agent that did not write the

implementation.



The verifier must independently:



1\. Read this complete task specification.

2\. Inspect the entire git diff.

3\. Check every requirement and acceptance criterion.

4\. Run:

   \- npm ci

   \- npm run typecheck

   \- npm run lint

   \- npm test

   \- npm run build

5\. Start the application locally.

6\. Perform browser-based smoke testing.

7\. Check the browser console for errors and important warnings.

8\. Verify:

   \- the game loads;

   \- the player can be selected;

   \- click-to-move works;

   \- obstacles affect movement;

   \- guard patrols work;

   \- vision cones display correctly;

   \- detection works;

   \- distraction works;

   \- silent takedown works;

   \- pause and restart work;

   \- the objective can be completed;

   \- win and loss states are reachable;

   \- settings persist;

   \- no required asset returns a 404;

   \- the production build works from a non-root base path;

   \- GitHub Pages paths are correct.

9\. Inspect the GitHub Actions workflow for correct Pages configuration.

10\. Produce a concise verification report containing:

    \- checks performed;

    \- problems found;

    \- fixes applied;

    \- final command results;

    \- any remaining limitations.



If the verifier finds a blocking problem:



\- return the work to the implementation phase;

\- fix the problem;

\- run the entire verification process again.



Do not declare the task complete while blocking verification failures remain.



If newly created Codex agent configuration cannot be loaded during the current

session, perform an independent fresh verification pass directly and leave the

verifier configuration ready for future sessions.



\==================================================

GIT WORKFLOW

\==================================================



Work directly on the main branch.



Before modifying files:



\- inspect the existing repository;

\- preserve useful existing work;

\- do not delete unrelated files;

\- check the current git status;

\- pull or synchronize with the latest main branch if supported.



After implementation and independent verification:



1\. Confirm there are no unexpected generated files or secrets.

2\. Confirm .gitignore includes:

   \- node\_modules;

   \- dist;

   \- local environment files;

   \- editor-specific temporary files;

   \- test artifacts that should not be committed.

3\. Review the complete diff.

4\. Run the full validation sequence one final time:

   \- npm ci

   \- npm run typecheck

   \- npm run lint

   \- npm test

   \- npm run build

5\. Commit all completed project changes directly to main.

6\. Use a clear commit message, for example:



   feat: add playable stealth tactics vertical slice



7\. Push the main branch to the connected GitHub repository.

8\. Do not force-push.

9\. Do not rewrite existing history.

10\. Do not push if any required validation command fails.

11\. After pushing, check the GitHub Actions deployment status if the current

    environment permits it.

12\. If deployment fails, inspect the logs, fix the problem, commit the fix,

    push again, and recheck.



If the environment cannot push because GitHub permissions are unavailable:



\- still create the local commit;

\- clearly report that the push could not be completed;

\- provide the exact reason;

\- do not claim that the repository was updated remotely.



Never commit:



\- tokens;

\- passwords;

\- API keys;

\- private keys;

\- session cookies;

\- personal credentials.



\==================================================

ACCEPTANCE CRITERIA

\==================================================



The task is complete only when:



\- the game is meaningfully playable;

\- the code is modular and documented;

\- npm ci succeeds;

\- npm run typecheck succeeds;

\- npm run lint succeeds;

\- npm test succeeds;

\- npm run build succeeds;

\- the verifier reports no blocking failures;

\- the production build works using a GitHub Pages-style subdirectory base;

\- the GitHub Pages workflow exists and is valid;

\- all required assets load correctly;

\- the changes are committed to main;

\- the main branch is pushed, provided repository permissions allow it.



Do not spend time on polished art, advanced audio, multiplayer, a backend,

accounts, monetization, or a large campaign.



Prioritize:



1\. reliable gameplay;

2\. clean architecture;

3\. tests;

4\. successful GitHub Pages deployment;

5\. a repository that is safe to extend in later Codex tasks.