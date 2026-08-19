CURRENT PHASE OVERRIDE (2026-08-19)

The active product direction replaces the courier mission below with free exploration in both locations. The runtime must load exactly one user-controlled character and must not load or update guards, civilians, couriers, recipients, patrol AI, detection, observation, mission objectives, or interactions. Keep dormant reusable resources and systems available for later work, but do not expose them in the public experience.

Use the high-level composition of a classic 2001 tactical command console while retaining original Gone panels, icons, fonts, characters, maps, and artwork. Environments should richly render data-driven buildings, streets, static vehicles, trees, street furniture, atmosphere, and occlusion in all five canonical projections. The explicit prohibition on copying Commandos or other commercial UI/art/assets remains absolute.

The original brief below is retained as architectural and historical context where it does not conflict with this override.

---

You are implementing the first production-quality proof of concept for an
original browser-based stealth tactics game.

Repository:

https\://github.com/motorina0/gone

Public deployment target:

[https://motorina0.github.io/gone/](https://motorina0.github.io/gone/)

The repository currently contains only a Hello World implementation. Replace
the Hello World with the playable proof of concept described below.

Do not ask for clarification unless a required repository permission is
missing. Make reasonable technical decisions, document them, and complete the
task end to end.

\======================================================================

1. PRODUCT GOAL
   \======================================================================

Build a mobile-compatible 2.5D stealth tactics proof of concept inspired by
the high-level gameplay structure of classic tactical games such as Commandos.

Do not copy any copyrighted characters, missions, dialogue, user interfaces,
music, sounds, artwork, maps, names, logos, or assets from Commandos or any
other commercial game.

The project must be architected so this proof of concept can grow into a full
game with:

- multiple real-world-inspired locations;
- multiple missions per location;
- more agents and guards;
- inventories and abilities;
- interiors and multiple elevations;
- desktop and mobile support;
- replaceable high-quality pre-rendered artwork.

The proof of concept must be meaningfully playable, not merely a scaffold or
technical demo.

Working title:

Gone — The Courier

Use:

- the latest stable Phaser 4 release available at implementation time;
- TypeScript in strict mode;
- Vite;
- HTML and CSS;
- Vitest for unit tests;
- Playwright for browser and mobile smoke tests;
- ESLint;
- GitHub Actions;
- GitHub Pages.

Use npm and commit package-lock.json.

Use the current active Node.js LTS release supported by GitHub Actions. Record
the chosen version in .nvmrc and package.json engines.

Do not use:

- Babylon.js;
- React;
- Vue;
- Angular;
- a backend;
- a database;
- runtime CDN dependencies;
- remote APIs required to play;
- Google Maps tiles, screenshots, satellite imagery, logos, textures, or
  extracted Google 3D data;
- inline base64 assets;
- large game-data constants embedded in TypeScript.

The entire application must run as a static GitHub Pages website.

Use a Commandos-style 2.5D approach:

- the environment is represented by pre-rendered 2D background files;
- gameplay exists in one canonical top-down world coordinate system;
- characters and gameplay markers are rendered over the background;
- foreground overlays hide characters behind buildings, trees, monuments,
  and other structures;
- no real-time 3D environment is required.

Create original placeholder artwork as separate SVG files.

The artwork should be:

- consistent across all five views;
- clearly recognizable as an approximation of Piața Unirii, Cluj-Napoca;
- clean and readable on mobile;
- styled with a restrained cinematic espionage palette;
- slightly desaturated;
- high contrast enough for tactical readability;
- original and schematic rather than photorealistic.

It must include recognizable approximations of:

- St. Michael’s Church;
- the church tower;
- the Matthias Corvinus monument;
- the open square;
- the surrounding roads;
- representative perimeter buildings;
- trees, benches, parked cars, and street furniture.

Do not claim that the placeholder artwork is geographically or architecturally
exact.

Create one canonical environment-description JSON resource and a tool that can
generate the initial SVG placeholder views from it. Commit both the canonical
resource and the generated SVG files.

The generated SVG files must remain independently replaceable later by human
artists or image-generation tools without requiring code changes.

Implement five fully interactive views of the same world:

1. 0° isometric view;
2. 90° isometric view;
3. 180° isometric view;
4. 270° isometric view;
5. top-down “Satellite” view.

The four isometric views should use an orthographic isometric-style projection
with approximately:

- 35.264° elevation above the ground plane;
- relative azimuth rotations separated by exactly 90°.

The Satellite view must be a vertical orthographic projection.

It must be an original stylized top-down rendering, not actual satellite
imagery.

All five views must use the same canonical gameplay world.

Switching views must preserve:

- every entity’s exact world position;
- patrol progress;
- mission state;
- detection progress;
- package state;
- current objective;
- camera focus;
- pause state.

All five views must be playable. The Satellite view is not merely a minimap.

Implement explicit forward and inverse projection functions:

- worldToScreen;
- screenToWorld.

Projection parameters must be stored in separate JSON resources, not
hard-coded in rendering modules.

Use one projection file for each view.

When changing view:

- keep the same world-space camera focus;
- project that focus into the new view;
- preserve a sensible normalized zoom level;
- do not reset entities or navigation;
- do not restart the mission.

Add visible view buttons:

- 0°;
- 90°;
- 180°;
- 270°;
- SAT.

Desktop keyboard shortcuts may use keys 1–5.

Use one canonical top-down coordinate system.

Represent positions as:

- x;
- y;
- elevation.

Use world units consistently. Treat one world unit as approximately one meter.

The canonical world must contain:

- world bounds;
- walkable areas;
- movement blockers;
- vision blockers;
- entity spawn points;
- patrol routes;
- observation locations;
- the exchange location;
- package location;
- extraction zone;
- landmark geometry used for placeholder artwork;
- occlusion geometry.

Rendering and gameplay must never use separate manually maintained coordinates
for each camera view.

All entity movement, AI, detection, mission logic, distances, and interactions
must operate in canonical world coordinates.

Only the projection layer converts world coordinates into screen coordinates.

The game must support multiple locations and missions in the future.

Do not put Piața Unirii-specific behavior inside generic engine systems.

Create a location registry and load the current location by ID.

Use a structure close to the following. Adjust names only when there is a
clear architectural reason.

public/
content/
index.json

```
schemas/
  content-index.schema.json
  location-manifest.schema.json
  world.schema.json
  environment.schema.json
  mission.schema.json
  entity.schema.json
  patrol.schema.json
  navigation.schema.json
  interaction.schema.json
  projection.schema.json

i18n/
  en.json

locations/
  piata-unirii/
    manifest.json
    world.json
    environment.json
    mission.json

    navigation/
      walkable.json
      blockers.json
      vision-blockers.json

    entities/
      player.json
      courier.json
      recipient.json
      guard-01.json
      guard-02.json
      guard-03.json
      civilians.json

    patrols/
      courier.json
      recipient.json
      guard-01.json
      guard-02.json
      guard-03.json
      civilians.json

    interactions/
      exchange.json
      package.json
      extraction.json
      observation-zones.json

    projections/
      view-0.json
      view-90.json
      view-180.json
      view-270.json
      view-top.json

    views/
      view-0.svg
      view-90.svg
      view-180.svg
      view-270.svg
      view-top.svg

    occlusion/
      view-0.svg
      view-90.svg
      view-180.svg
      view-270.svg
      view-top.svg

    sprites/
      agent-isometric.svg
      agent-top.svg
      guard-isometric.svg
      guard-top.svg
      courier-isometric.svg
      courier-top.svg
      recipient-isometric.svg
      recipient-top.svg
      civilian-isometric.svg
      civilian-top.svg
      package.svg
```

tools/
generate-placeholder-views.ts
validate-content.ts

Keep each independently editable resource in its own file where practical.

Do not inline SVG artwork in TypeScript or HTML.

Do not inline location JSON in TypeScript.

All content resources must include:

- a stable ID;
- a schema version;
- human-readable names where appropriate.

The location manifest must reference resources through relative paths.

Create JSON Schemas and validate all content during development, tests, and CI.

Add:

npm run validate\:content

Content-loading errors must produce a clear visible error screen rather than a
blank canvas.

Use small, focused TypeScript modules.

Aim to keep files below approximately 300 lines. Split files that become
monolithic.

Keep these responsibilities separate:

- application bootstrap;
- Phaser scene lifecycle;
- content loading;
- content validation;
- canonical world state;
- fixed-step simulation;
- projection;
- view switching;
- camera management;
- desktop input;
- touch input;
- entity rendering;
- movement;
- navigation;
- guard AI;
- vision;
- exposure-based detection;
- observation;
- interactions;
- mission objectives;
- mission state;
- occlusion;
- UI;
- settings persistence;
- testing utilities.

A suitable structure is:

src/
main.ts

app/
GameApp.ts
AppConfig.ts

scenes/
BootScene.ts
GameScene.ts

content/
ContentLoader.ts
ContentTypes.ts
ContentValidation.ts

world/
WorldState.ts
WorldTypes.ts
GameClock.ts
SeededRandom.ts

projection/
Projection.ts
ProjectionService.ts
ProjectionTypes.ts

views/
ViewManager.ts
ViewTypes.ts

camera/
TacticalCamera.ts

navigation/
NavigationService.ts
Pathfinding.ts
NavigationTypes.ts

entities/
Entity.ts
EntityTypes.ts
EntityFactory.ts

systems/
MovementSystem.ts
PatrolSystem.ts
VisionSystem.ts
DetectionSystem.ts
ObservationSystem.ts
InteractionSystem.ts
MissionSystem.ts
OcclusionSystem.ts

ai/
GuardStateMachine.ts
GuardStates.ts

input/
PointerInputController.ts
DesktopInputController.ts
TouchInputController.ts
GestureRecognizer.ts

rendering/
EnvironmentRenderer.ts
EntityRenderer.ts
VisionConeRenderer.ts
MarkerRenderer.ts

ui/
HudController.ts
MobileControls.ts
MissionOverlay.ts
ErrorOverlay.ts

persistence/
SettingsStore.ts

styles/
app.css
hud.css
mobile.css

Do not implement a heavyweight ECS unless it provides a clear benefit.

Gameplay state must be separate from Phaser display objects so logic can be
unit tested without rendering a browser scene.

Use a deterministic fixed-step gameplay update, approximately 30 simulation
steps per second, with rendering independent from simulation timing.

Use a seeded random generator for any ambient variation so tests remain
repeatable.

Pause simulation when:

- the player pauses;
- the browser tab becomes hidden;
- a blocking error overlay is visible.

Implement simple but maintainable click-to-move navigation.

For this proof of concept, a hidden walkability grid or a lightweight
navigation graph is acceptable.

Requirements:

- navigation data is stored in resource files;
- navigation is independent from screen projection;
- paths operate in canonical world coordinates;
- movement routes around static blockers;
- unreachable clicks fail safely;
- characters do not walk through the church, monument, buildings, or blocked
  street furniture;
- movement stops accurately at the destination;
- movement speed is based on world units per second;
- paths are smoothed enough not to look excessively grid-based.

Expose navigation through a NavigationService interface so a polygon navmesh
can replace the initial implementation later without rewriting gameplay
systems.

Implement one controllable agent.

The player must be able to:

- select the agent;
- see a clear selection indicator;
- tap or click a walkable destination;
- move to that destination;
- observe the courier exchange;
- collect the package;
- enter the extraction zone.

Selection and movement must work in all five views.

The player must not move when the user is panning the camera.

Use context-sensitive action buttons:

- Observe;
- Interact.

The action buttons must clearly indicate when an action is unavailable.

Use a generous interaction radius suitable for touch screens.

No combat, shooting, takedowns, inventory management, or multiple controllable
agents are required in this proof of concept.

Architect the systems so those mechanics can be added later.

Implement:

- one courier;
- one recipient;
- three guards;
- at least four ambient civilians.

Courier and recipient behavior:

- follow data-driven routes;
- meet at the exchange point;
- perform a visible exchange event;
- continue along separate routes afterward.

Ambient civilians:

- follow simple deterministic loops;
- do not detect the player;
- make the location feel occupied;
- must not block the mission permanently.

Guards:

- use separate patrol-resource files;
- follow individual patrol routes;
- have visible vision cones;
- perform world-space line-of-sight checks;
- respect vision blockers;
- use distance, angle, and exposure duration;
- do not detect instantly;
- reduce exposure gradually when the player leaves sight.

Implement a small reusable guard state machine with at least:

- patrol;
- suspicious;
- investigate;
- alert;
- return-to-patrol.

For the proof of concept:

- a fully alerted guard causes mission failure;
- guards do not need weapon or combat behavior.

Vision cones must be calculated in canonical world space and then projected for
the current view.

Add a settings toggle to show or hide vision cones.

Implement a sequential, data-driven mission.

Mission title:

The Courier

Mission description:

Follow a courier through Piața Unirii, observe the exchange near the church,
collect the package, and escape through a side street without being detected.

Objective sequence:

1. Locate the courier.
2. Observe the exchange.
3. Collect the package.
4. Reach extraction before lockdown.

Detailed behavior:

- The mission begins only after the player presses a Start Mission button.
- The courier enters the square and follows a route toward the meeting point.
- The recipient approaches from another direction.
- The exchange happens near the monument or church perimeter.
- The player must observe the exchange from within an observation radius.
- Observation requires:
  - both relevant NPCs to be within line of sight;
  - the player to be within the configured observation distance;
  - the Observe action to be held continuously for approximately two seconds;
  - the player not to be fully detected.
- Observation progress must be visible.
- If line of sight or range is lost, progress should pause or decay.
- Once observation completes, update the objective.
- The package becomes collectible at the exchange location after the exchange.
- The player collects it by moving close and pressing Interact.
- Package state must persist across camera-view changes.
- After collection, begin a visible 60-second lockdown countdown.
- The extraction zone is located in a side street.
- Entering the extraction zone with the package completes the mission.
- Full guard detection or expiration of the countdown causes mission failure.

Provide:

- win overlay;
- loss overlay;
- restart action;
- pause and resume;
- clear objective text;
- mission event messages;
- visible countdown after package collection.

Mission logic must be generic and data-driven.

Do not write a hard-coded sequence inside GameScene that only works for this
mission.

Implement basic view-specific foreground occlusion.

For each view:

- load a background SVG below characters;
- load a transparent occlusion/foreground SVG above characters;
- render characters between those layers;
- ensure overlays do not intercept pointer input.

Characters should visibly disappear behind at least:

- part of St. Michael’s Church;
- the monument;
- selected perimeter-building edges;
- selected trees.

Do not rely only on screen-Y sorting.

The proof of concept does not require pixel-perfect depth maps.

Design the OcclusionSystem so future per-pixel depth maps or object-ID maps can
replace the initial overlay approach.

Implement a tactical camera supporting desktop and touch devices.

Desktop controls:

- mouse wheel: zoom;
- middle-button drag or right-button drag: pan;
- optional WASD or arrow-key panning;
- keys 1–5: switch views;
- Space: pause;
- Escape: close overlays or pause.

Mobile controls:

- tap agent: select;
- tap walkable ground: move;
- drag empty map: pan;
- pinch: zoom;
- on-screen buttons: change view;
- on-screen button: Observe;
- on-screen button: Interact;
- on-screen button: Pause;
- on-screen button: Restart.

Distinguish a tap from a drag using a movement threshold.

Do not issue movement orders at the end of a camera-pan gesture.

Camera requirements:

- constrained to map bounds;
- configurable minimum and maximum zoom;
- preserve world-space focus when switching views;
- preserve state across resize and orientation changes;
- cap rendering resolution to a sensible maximum device-pixel ratio, such as
  2, to protect mobile performance.

The game must work on current mobile browsers.

Optimize primarily for landscape, but remain usable in portrait.

In portrait mode:

- show a small non-blocking suggestion that landscape offers a better
  experience;
- do not prevent play;
- keep all essential controls accessible.

Use:

- responsive layout;
- viewport-fit=cover;
- safe-area insets;
- 100dvh where appropriate;
- Phaser scale mode FIT;
- automatic centering;
- pointer events;
- touch-action: none on the interactive game surface.

Prevent:

- page scrolling while interacting with the game;
- text selection during gestures;
- browser context menus over the game;
- controls hidden behind notches or browser bars.

Requirements:

- minimum touch target size of approximately 44 CSS pixels;
- no hover-only interactions;
- readable text on small screens;
- no UI overlap at common mobile sizes;
- responsive HUD that does not cover the playable center unnecessarily;
- orientation changes must not reset the mission;
- tab switching must not advance simulation unexpectedly;
- game must maintain at least a reasonable 30 FPS target on a mid-range phone
  using the placeholder assets.

Use normal HTML buttons for major HUD actions where possible, with:

- accessible labels;
- keyboard focus;
- visible focus styling;
- ARIA labels.

Test at least:

- 390 × 844 portrait;
- 844 × 390 landscape;
- 1280 × 720 desktop.

Store settings in localStorage.

Include at least:

- currently preferred view;
- vision-cone visibility;
- camera zoom preference;
- camera-pan sensitivity;
- reduced-motion preference.

Do not store mission saves for the initial proof of concept.

Handle missing or corrupt settings gracefully.

Version the settings format so it can evolve later.

The public deployment URL is:

[https://motorina0.github.io/gone/](https://motorina0.github.io/gone/)

Configure the Vite production base path correctly for:

/gone/

Local development must remain convenient.

All dynamically loaded assets must resolve correctly under the GitHub Pages
subdirectory.

Use:

- import.meta.env.BASE\_URL;
- manifest-relative URL resolution;
- imported URLs where appropriate.

Never assume the site is hosted at domain root.

Do not use asset paths such as:

/content/...
/assets/...

unless they are correctly prefixed with the production base URL.

Verify that all of these load correctly after production build:

- JavaScript;
- CSS;
- SVG backgrounds;
- SVG occlusion overlays;
- entity sprites;
- JSON files;
- schemas;
- mission resources.

Display a small build identifier in an unobtrusive part of the UI.

Use a Git commit SHA when available and “dev” locally.

Create:

.github/workflows/deploy-pages.yml

Use the current official GitHub Pages Actions approach.

The workflow must:

- trigger on every push to main;
- support workflow\_dispatch;
- use npm ci;
- validate content;
- run type checking;
- run linting;
- run unit tests;
- run the production build;
- install the required Playwright browser;
- run Playwright smoke tests against the production build;
- upload dist as the Pages artifact;
- deploy only if all validation succeeds;
- use the required Pages and OIDC permissions;
- prevent conflicting concurrent deployments.

Use appropriate permissions such as:

- contents: read;
- pages: write;
- id-token: write.

Use a Pages deployment concurrency group.

The workflow must fail instead of deploying broken code.

If GitHub Pages has not yet been configured to use GitHub Actions, document the
single manual repository setting required in README.md.

Provide working scripts for:

npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run test
npm run test\:e2e
npm run validate\:content
npm run generate\:views
npm run verify

npm run verify must perform the complete local validation sequence.

The exact sequence should include:

1. content validation;
2. type checking;
3. linting;
4. unit tests;
5. production build;
6. Playwright smoke tests against the production build.

All required scripts must finish successfully before committing or pushing.

Add Vitest tests for at least:

- worldToScreen for all five projections;
- screenToWorld for all five projections;
- projection round-trip accuracy;
- world-position preservation when switching views;
- camera-focus preservation when switching views;
- navigation around blockers;
- unreachable destination handling;
- vision angle calculations;
- vision distance calculations;
- line-of-sight blocking;
- exposure accumulation;
- exposure decay;
- guard-state transitions;
- observation range;
- observation line of sight;
- observation completion;
- package collection eligibility;
- mission-objective transitions;
- extraction success;
- countdown failure;
- detection failure;
- settings serialization;
- corrupt settings recovery;
- content-schema validation.

Gameplay logic tests must not require a WebGL context.

Add Playwright tests using Chromium.

Tests must:

- launch the production build;
- load the game from the /gone/ base path;
- fail on unexpected browser-console errors;
- fail on page errors;
- detect failed required-resource requests;
- start the mission;
- select the agent;
- issue a movement command;
- verify that the agent changes world position;
- switch through all five views;
- verify that the entity remains at the same canonical world position;
- pause and resume;
- restart;
- verify view buttons;
- verify that the HUD is visible;
- verify no important UI is outside the viewport;
- test desktop viewport;
- test portrait-mobile viewport;
- test landscape-mobile viewport.

Add a deterministic test mode available only during automated tests.

The test mode may expose a small read-only diagnostic object such as:

window.**GONE\_TEST**

It may provide:

- canonical entity positions;
- active view;
- mission state;
- detection state;
- loaded-resource status.

Do not expose dangerous mutation hooks in production.

Create README.md containing:

- game concept;
- current proof-of-concept scope;
- technology stack;
- setup instructions;
- development commands;
- desktop controls;
- mobile controls;
- architecture overview;
- canonical-world explanation;
- five-view projection explanation;
- content directory structure;
- instructions for adding another location;
- instructions for adding another mission;
- instructions for replacing one background image;
- instructions for replacing one occlusion overlay;
- instructions for regenerating placeholder SVG views;
- JSON Schema validation instructions;
- testing instructions;
- GitHub Pages deployment details;
- expected public URL;
- required GitHub Pages repository setting;
- troubleshooting for blank pages;
- troubleshooting for asset 404 errors;
- mobile limitations;
- current non-goals;
- roadmap.

Create:

docs/architecture.md
docs/content-format.md
docs/projection-system.md
docs/mobile-controls.md
docs/roadmap.md

Create AGENTS.md containing durable instructions for future Codex work:

- preserve the canonical world model;
- do not hard-code location content in generic systems;
- keep independently editable resources in separate files;
- do not inline game data or artwork;
- validate content before committing;
- preserve GitHub Pages compatibility;
- preserve mobile support;
- add tests for changed behavior;
- run npm run verify before every push;
- never push broken code;
- never add secrets;
- never force-push;
- work directly on main unless the user later changes this instruction;
- invoke an independent verifier before completing future tasks.

Create a reusable read-only verifier agent for future tasks.

Add:

.codex/agents/verifier.toml
.codex/config.toml

Use the current supported Codex agent-configuration schema available in the
environment.

Do not invent unsupported configuration keys.

The verifier must be:

- read-only;
- independent from implementation;
- focused on correctness rather than style preferences.

The verifier must check:

- requirement compliance;
- regressions;
- architecture boundaries;
- mobile behavior;
- projection consistency;
- resource loading;
- missing tests;
- browser-console errors;
- GitHub Pages paths;
- accessibility of core controls;
- unnecessary dependencies;
- secrets or unexpected generated files.

After implementation, invoke a separate verifier that did not write the code.

The verifier must:

1. Read this complete task specification.
2. Inspect the repository and complete diff.
3. Validate every acceptance criterion.
4. Run npm ci.
5. Run npm run verify.
6. Perform an additional browser smoke test.
7. Inspect the browser console.
8. Inspect failed network requests.
9. Inspect the GitHub Pages workflow.
10. Verify mobile portrait and landscape behavior.
11. Produce a concise verification report containing:
    - checks performed;
    - failures found;
    - fixes required;
    - final command results;
    - remaining non-blocking limitations.

If the verifier finds a blocking issue:

- return to implementation;
- fix the issue;
- rerun the full verification;
- repeat until no blocking failures remain.

If a newly created verifier-agent configuration cannot be loaded in the
current Codex session, perform a fresh independent verification pass manually
and leave the verifier configuration ready for future sessions.

Do not commit or push until verification passes.

Work directly on the main branch.

Do not create a pull request for this task.

Before changing files:

1. Inspect the repository.
2. Confirm the current branch.
3. Check git status.
4. Synchronize with the latest main branch if supported.
5. Preserve useful repository metadata and existing history.
6. Replace the Hello World implementation cleanly.
7. Do not delete unrelated files.

Before committing:

1. Run npm ci.
2. Run npm run verify.
3. Review the complete git diff.
4. Confirm there are no secrets.
5. Confirm there are no accidental temporary files.
6. Confirm .gitignore includes:
   - node\_modules;
   - dist;
   - Playwright output;
   - coverage;
   - local environment files;
   - editor temporary files;
   - OS temporary files.
7. Confirm package-lock.json is committed.
8. Confirm generated placeholder view assets are committed.

After all checks and independent verification pass:

- commit directly to main;

- use a clear commit message such as:

  feat: build mobile five-view stealth tactics PoC

- push main to the connected GitHub repository;

- do not force-push;

- do not rewrite history.

After pushing:

- inspect the GitHub Actions result if the environment permits;
- verify the Pages deployment if possible;
- verify the expected URL:

  [https://motorina0.github.io/gone/](https://motorina0.github.io/gone/)

If the workflow fails:

- inspect the failure;
- fix the problem;
- rerun all checks;
- commit the fix;
- push again;
- recheck deployment.

If repository permissions do not allow pushing:

- still create the local commit;
- report the exact permission problem;
- do not claim that the remote repository was updated.

Never commit:

- passwords;
- GitHub tokens;
- API keys;
- private keys;
- cookies;
- credentials;
- personal data.

The placeholder resources should remain lightweight.

Requirements:

- preload the small proof-of-concept assets;
- avoid loading large unused resources;
- cap device-pixel ratio;
- avoid allocations inside per-frame loops where practical;
- do not rebuild pathfinding data every frame;
- do not recreate graphics objects unnecessarily;
- clean up Phaser events and DOM listeners;
- pause simulation while hidden;
- avoid memory leaks when restarting the mission;
- ensure repeated view switching does not duplicate objects;
- ensure repeated restart does not duplicate listeners or NPCs.

Use browser dev tools or diagnostics to verify:

- no repeated resource loads after initial preload;
- no increasing entity count after restart;
- no console warnings from leaked listeners;
- no missing assets.

Do not implement:

- photorealistic final artwork;
- Google Maps-derived assets;
- real-time 3D environments;
- multiplayer;
- a backend;
- user accounts;
- cloud saves;
- combat;
- weapons;
- takedowns;
- vehicles;
- multiple playable agents;
- inventory systems;
- interiors;
- multiple floors;
- advanced sound propagation;
- voice acting;
- final music;
- monetization;
- a full campaign;
- an in-game level editor.

Keep future expansion possible, but do not overbuild these features now.

The task is complete only when all of the following are true:

- the Hello World has been replaced;
- the game loads in a desktop browser;
- the game loads in a mobile browser layout;
- the Start Mission button works;
- the agent can be selected;
- click-to-move works;
- touch-to-move works;
- camera panning works;
- pinch or touch zoom works;
- desktop zoom works;
- all five views work;
- all five views are fully interactive;
- entity world positions remain unchanged across view switches;
- camera focus remains logically stable across view switches;
- the courier and recipient perform an exchange;
- the exchange can be observed;
- observation progress is visible;
- the package can be collected;
- the lockdown countdown begins;
- the extraction zone can be reached;
- the mission can be won;
- the mission can be lost by detection;
- the mission can be lost by countdown expiration;
- pause works;
- restart works without duplicating entities or listeners;
- three guards patrol;
- guards have visible vision cones;
- guard detection uses exposure time;
- blockers affect line of sight;
- ambient civilians move;
- basic foreground occlusion works;
- settings persist;
- all content is stored in independently editable files where practical;
- content schemas exist;
- content validation passes;
- no Google imagery or copyrighted game assets are included;
- npm ci succeeds;
- npm run validate\:content succeeds;
- npm run typecheck succeeds;
- npm run lint succeeds;
- npm run test succeeds;
- npm run build succeeds;
- npm run test\:e2e succeeds;
- npm run verify succeeds;
- the production build works from /gone/;
- no required asset returns 404;
- no unexpected browser-console error occurs;
- mobile portrait and landscape smoke tests pass;
- the GitHub Pages workflow exists;
- the independent verifier reports no blocking issue;
- the implementation is documented;
- the work is committed directly to main;
- main is pushed if repository permissions allow;
- the deployment is verified if the environment permits.

Prioritize, in this order:

1. canonical-world correctness;
2. five-view synchronization;
3. mobile usability;
4. playable mission flow;
5. clean data-driven architecture;
6. automated verification;
7. GitHub Pages deployment;
8. placeholder visual polish.You are implementing the first production-quality proof of concept for an

   original browser-based stealth tactics game.



   Repository:



   [https://github.com/motorina0/gone](https://github.com/motorina0/gone)



   Public deployment target:



   [https://motorina0.github.io/gone/](https://motorina0.github.io/gone/)



   The repository currently contains only a Hello World implementation. Replace

   the Hello World with the playable proof of concept described below.



   Do not ask for clarification unless a required repository permission is

   missing. Make reasonable technical decisions, document them, and complete the

   task end to end.



   \======================================================================

   1\. PRODUCT GOAL

   \======================================================================



   Build a mobile-compatible 2.5D stealth tactics proof of concept inspired by

   the high-level gameplay structure of classic tactical games such as Commandos.



   Do not copy any copyrighted characters, missions, dialogue, user interfaces,

   music, sounds, artwork, maps, names, logos, or assets from Commandos or any

   other commercial game.



   The project must be architected so this proof of concept can grow into a full

   game with:



   \- multiple real-world-inspired locations;

   \- multiple missions per location;

   \- more agents and guards;

   \- inventories and abilities;

   \- interiors and multiple elevations;

   \- desktop and mobile support;

   \- replaceable high-quality pre-rendered artwork.



   The proof of concept must be meaningfully playable, not merely a scaffold or

   technical demo.



   Working title:



   Gone — The Courier



   \======================================================================

   2\. TECHNOLOGY

   \======================================================================



   Use:



   \- the latest stable Phaser 4 release available at implementation time;

   \- TypeScript in strict mode;

   \- Vite;

   \- HTML and CSS;

   \- Vitest for unit tests;

   \- Playwright for browser and mobile smoke tests;

   \- ESLint;

   \- GitHub Actions;

   \- GitHub Pages.



   Use npm and commit package-lock.json.



   Use the current active Node.js LTS release supported by GitHub Actions. Record

   the chosen version in .nvmrc and package.json engines.



   Do not use:



   \- Babylon.js;

   \- React;

   \- Vue;

   \- Angular;

   \- a backend;

   \- a database;

   \- runtime CDN dependencies;

   \- remote APIs required to play;

   \- Google Maps tiles, screenshots, satellite imagery, logos, textures, or

     extracted Google 3D data;

   \- inline base64 assets;

   \- large game-data constants embedded in TypeScript.



   The entire application must run as a static GitHub Pages website.



   \======================================================================

   3\. CORE VISUAL APPROACH

   \======================================================================



   Use a Commandos-style 2.5D approach:



   \- the environment is represented by pre-rendered 2D background files;

   \- gameplay exists in one canonical top-down world coordinate system;

   \- characters and gameplay markers are rendered over the background;

   \- foreground overlays hide characters behind buildings, trees, monuments,

     and other structures;

   \- no real-time 3D environment is required.



   Create original placeholder artwork as separate SVG files.



   The artwork should be:



   \- consistent across all five views;

   \- clearly recognizable as an approximation of Piața Unirii, Cluj-Napoca;

   \- clean and readable on mobile;

   \- styled with a restrained cinematic espionage palette;

   \- slightly desaturated;

   \- high contrast enough for tactical readability;

   \- original and schematic rather than photorealistic.



   It must include recognizable approximations of:



   \- St. Michael’s Church;

   \- the church tower;

   \- the Matthias Corvinus monument;

   \- the open square;

   \- the surrounding roads;

   \- representative perimeter buildings;

   \- trees, benches, parked cars, and street furniture.



   Do not claim that the placeholder artwork is geographically or architecturally

   exact.



   Create one canonical environment-description JSON resource and a tool that can

   generate the initial SVG placeholder views from it. Commit both the canonical

   resource and the generated SVG files.



   The generated SVG files must remain independently replaceable later by human

   artists or image-generation tools without requiring code changes.



   \======================================================================

   4\. FIVE SYNCHRONIZED VIEWS

   \======================================================================



   Implement five fully interactive views of the same world:



   1\. 0° isometric view;

   2\. 90° isometric view;

   3\. 180° isometric view;

   4\. 270° isometric view;

   5\. top-down “Satellite” view.



   The four isometric views should use an orthographic isometric-style projection

   with approximately:



   \- 35.264° elevation above the ground plane;

   \- relative azimuth rotations separated by exactly 90°.



   The Satellite view must be a vertical orthographic projection.



   It must be an original stylized top-down rendering, not actual satellite

   imagery.



   All five views must use the same canonical gameplay world.



   Switching views must preserve:



   \- every entity’s exact world position;

   \- patrol progress;

   \- mission state;

   \- detection progress;

   \- package state;

   \- current objective;

   \- camera focus;

   \- pause state.



   All five views must be playable. The Satellite view is not merely a minimap.



   Implement explicit forward and inverse projection functions:



   \- worldToScreen;

   \- screenToWorld.



   Projection parameters must be stored in separate JSON resources, not

   hard-coded in rendering modules.



   Use one projection file for each view.



   When changing view:



   \- keep the same world-space camera focus;

   \- project that focus into the new view;

   \- preserve a sensible normalized zoom level;

   \- do not reset entities or navigation;

   \- do not restart the mission.



   Add visible view buttons:



   \- 0°;

   \- 90°;

   \- 180°;

   \- 270°;

   \- SAT.



   Desktop keyboard shortcuts may use keys 1–5.



   \======================================================================

   5\. CANONICAL WORLD MODEL

   \======================================================================



   Use one canonical top-down coordinate system.



   Represent positions as:



   \- x;

   \- y;

   \- elevation.



   Use world units consistently. Treat one world unit as approximately one meter.



   The canonical world must contain:



   \- world bounds;

   \- walkable areas;

   \- movement blockers;

   \- vision blockers;

   \- entity spawn points;

   \- patrol routes;

   \- observation locations;

   \- the exchange location;

   \- package location;

   \- extraction zone;

   \- landmark geometry used for placeholder artwork;

   \- occlusion geometry.



   Rendering and gameplay must never use separate manually maintained coordinates

   for each camera view.



   All entity movement, AI, detection, mission logic, distances, and interactions

   must operate in canonical world coordinates.



   Only the projection layer converts world coordinates into screen coordinates.



   \======================================================================

   6\. LOCATION AND CONTENT ARCHITECTURE

   \======================================================================



   The game must support multiple locations and missions in the future.



   Do not put Piața Unirii-specific behavior inside generic engine systems.



   Create a location registry and load the current location by ID.



   Use a structure close to the following. Adjust names only when there is a

   clear architectural reason.



   public/

     content/

       index.json



       schemas/

         content-index.schema.json

         location-manifest.schema.json

         world.schema.json

         environment.schema.json

         mission.schema.json

         entity.schema.json

         patrol.schema.json

         navigation.schema.json

         interaction.schema.json

         projection.schema.json



       i18n/

         en.json



       locations/

         piata-unirii/

           manifest.json

           world.json

           environment.json

           mission.json



           navigation/

             walkable.json

             blockers.json

             vision-blockers.json



           entities/

             player.json

             courier.json

             recipient.json

             guard-01.json

             guard-02.json

             guard-03.json

             civilians.json



           patrols/

             courier.json

             recipient.json

             guard-01.json

             guard-02.json

             guard-03.json

             civilians.json



           interactions/

             exchange.json

             package.json

             extraction.json

             observation-zones.json



           projections/

             view-0.json

             view-90.json

             view-180.json

             view-270.json

             view-top.json



           views/

             view-0.svg

             view-90.svg

             view-180.svg

             view-270.svg

             view-top.svg



           occlusion/

             view-0.svg

             view-90.svg

             view-180.svg

             view-270.svg

             view-top.svg



           sprites/

             agent-isometric.svg

             agent-top.svg

             guard-isometric.svg

             guard-top.svg

             courier-isometric.svg

             courier-top.svg

             recipient-isometric.svg

             recipient-top.svg

             civilian-isometric.svg

             civilian-top.svg

             package.svg



   tools/

     generate-placeholder-views.ts

     validate-content.ts



   Keep each independently editable resource in its own file where practical.



   Do not inline SVG artwork in TypeScript or HTML.



   Do not inline location JSON in TypeScript.



   All content resources must include:



   \- a stable ID;

   \- a schema version;

   \- human-readable names where appropriate.



   The location manifest must reference resources through relative paths.



   Create JSON Schemas and validate all content during development, tests, and CI.



   Add:



   npm run validate\:content



   Content-loading errors must produce a clear visible error screen rather than a

   blank canvas.



   \======================================================================

   7\. SOFTWARE ARCHITECTURE

   \======================================================================



   Use small, focused TypeScript modules.



   Aim to keep files below approximately 300 lines. Split files that become

   monolithic.



   Keep these responsibilities separate:



   \- application bootstrap;

   \- Phaser scene lifecycle;

   \- content loading;

   \- content validation;

   \- canonical world state;

   \- fixed-step simulation;

   \- projection;

   \- view switching;

   \- camera management;

   \- desktop input;

   \- touch input;

   \- entity rendering;

   \- movement;

   \- navigation;

   \- guard AI;

   \- vision;

   \- exposure-based detection;

   \- observation;

   \- interactions;

   \- mission objectives;

   \- mission state;

   \- occlusion;

   \- UI;

   \- settings persistence;

   \- testing utilities.



   A suitable structure is:



   src/

     main.ts



     app/

       GameApp.ts

       AppConfig.ts



     scenes/

       BootScene.ts

       GameScene.ts



     content/

       ContentLoader.ts

       ContentTypes.ts

       ContentValidation.ts



     world/

       WorldState.ts

       WorldTypes.ts

       GameClock.ts

       SeededRandom.ts



     projection/

       Projection.ts

       ProjectionService.ts

       ProjectionTypes.ts



     views/

       ViewManager.ts

       ViewTypes.ts



     camera/

       TacticalCamera.ts



     navigation/

       NavigationService.ts

       Pathfinding.ts

       NavigationTypes.ts



     entities/

       Entity.ts

       EntityTypes.ts

       EntityFactory.ts



     systems/

       MovementSystem.ts

       PatrolSystem.ts

       VisionSystem.ts

       DetectionSystem.ts

       ObservationSystem.ts

       InteractionSystem.ts

       MissionSystem.ts

       OcclusionSystem.ts



     ai/

       GuardStateMachine.ts

       GuardStates.ts



     input/

       PointerInputController.ts

       DesktopInputController.ts

       TouchInputController.ts

       GestureRecognizer.ts



     rendering/

       EnvironmentRenderer.ts

       EntityRenderer.ts

       VisionConeRenderer.ts

       MarkerRenderer.ts



     ui/

       HudController.ts

       MobileControls.ts

       MissionOverlay.ts

       ErrorOverlay.ts



     persistence/

       SettingsStore.ts



     styles/

       app.css

       hud.css

       mobile.css



   Do not implement a heavyweight ECS unless it provides a clear benefit.



   Gameplay state must be separate from Phaser display objects so logic can be

   unit tested without rendering a browser scene.



   Use a deterministic fixed-step gameplay update, approximately 30 simulation

   steps per second, with rendering independent from simulation timing.



   Use a seeded random generator for any ambient variation so tests remain

   repeatable.



   Pause simulation when:



   \- the player pauses;

   \- the browser tab becomes hidden;

   \- a blocking error overlay is visible.



   \======================================================================

   8\. NAVIGATION

   \======================================================================



   Implement simple but maintainable click-to-move navigation.



   For this proof of concept, a hidden walkability grid or a lightweight

   navigation graph is acceptable.



   Requirements:



   \- navigation data is stored in resource files;

   \- navigation is independent from screen projection;

   \- paths operate in canonical world coordinates;

   \- movement routes around static blockers;

   \- unreachable clicks fail safely;

   \- characters do not walk through the church, monument, buildings, or blocked

     street furniture;

   \- movement stops accurately at the destination;

   \- movement speed is based on world units per second;

   \- paths are smoothed enough not to look excessively grid-based.



   Expose navigation through a NavigationService interface so a polygon navmesh

   can replace the initial implementation later without rewriting gameplay

   systems.



   \======================================================================

   9\. PLAYER CHARACTER

   \======================================================================



   Implement one controllable agent.



   The player must be able to:



   \- select the agent;

   \- see a clear selection indicator;

   \- tap or click a walkable destination;

   \- move to that destination;

   \- observe the courier exchange;

   \- collect the package;

   \- enter the extraction zone.



   Selection and movement must work in all five views.



   The player must not move when the user is panning the camera.



   Use context-sensitive action buttons:



   \- Observe;

   \- Interact.



   The action buttons must clearly indicate when an action is unavailable.



   Use a generous interaction radius suitable for touch screens.



   No combat, shooting, takedowns, inventory management, or multiple controllable

   agents are required in this proof of concept.



   Architect the systems so those mechanics can be added later.



   \======================================================================

   10\. NPCS AND GUARDS

   \======================================================================



   Implement:



   \- one courier;

   \- one recipient;

   \- three guards;

   \- at least four ambient civilians.



   Courier and recipient behavior:



   \- follow data-driven routes;

   \- meet at the exchange point;

   \- perform a visible exchange event;

   \- continue along separate routes afterward.



   Ambient civilians:



   \- follow simple deterministic loops;

   \- do not detect the player;

   \- make the location feel occupied;

   \- must not block the mission permanently.



   Guards:



   \- use separate patrol-resource files;

   \- follow individual patrol routes;

   \- have visible vision cones;

   \- perform world-space line-of-sight checks;

   \- respect vision blockers;

   \- use distance, angle, and exposure duration;

   \- do not detect instantly;

   \- reduce exposure gradually when the player leaves sight.



   Implement a small reusable guard state machine with at least:



   \- patrol;

   \- suspicious;

   \- investigate;

   \- alert;

   \- return-to-patrol.



   For the proof of concept:



   \- a fully alerted guard causes mission failure;

   \- guards do not need weapon or combat behavior.



   Vision cones must be calculated in canonical world space and then projected for

   the current view.



   Add a settings toggle to show or hide vision cones.



   \======================================================================

   11\. MISSION: “THE COURIER”

   \======================================================================



   Implement a sequential, data-driven mission.



   Mission title:



   The Courier



   Mission description:



   Follow a courier through Piața Unirii, observe the exchange near the church,

   collect the package, and escape through a side street without being detected.



   Objective sequence:



   1\. Locate the courier.

   2\. Observe the exchange.

   3\. Collect the package.

   4\. Reach extraction before lockdown.



   Detailed behavior:



   \- The mission begins only after the player presses a Start Mission button.

   \- The courier enters the square and follows a route toward the meeting point.

   \- The recipient approaches from another direction.

   \- The exchange happens near the monument or church perimeter.

   \- The player must observe the exchange from within an observation radius.

   \- Observation requires:

     \- both relevant NPCs to be within line of sight;

     \- the player to be within the configured observation distance;

     \- the Observe action to be held continuously for approximately two seconds;

     \- the player not to be fully detected.

   \- Observation progress must be visible.

   \- If line of sight or range is lost, progress should pause or decay.

   \- Once observation completes, update the objective.

   \- The package becomes collectible at the exchange location after the exchange.

   \- The player collects it by moving close and pressing Interact.

   \- Package state must persist across camera-view changes.

   \- After collection, begin a visible 60-second lockdown countdown.

   \- The extraction zone is located in a side street.

   \- Entering the extraction zone with the package completes the mission.

   \- Full guard detection or expiration of the countdown causes mission failure.



   Provide:



   \- win overlay;

   \- loss overlay;

   \- restart action;

   \- pause and resume;

   \- clear objective text;

   \- mission event messages;

   \- visible countdown after package collection.



   Mission logic must be generic and data-driven.



   Do not write a hard-coded sequence inside GameScene that only works for this

   mission.



   \======================================================================

   12\. OCCLUSION AND DEPTH

   \======================================================================



   Implement basic view-specific foreground occlusion.



   For each view:



   \- load a background SVG below characters;

   \- load a transparent occlusion/foreground SVG above characters;

   \- render characters between those layers;

   \- ensure overlays do not intercept pointer input.



   Characters should visibly disappear behind at least:



   \- part of St. Michael’s Church;

   \- the monument;

   \- selected perimeter-building edges;

   \- selected trees.



   Do not rely only on screen-Y sorting.



   The proof of concept does not require pixel-perfect depth maps.



   Design the OcclusionSystem so future per-pixel depth maps or object-ID maps can

   replace the initial overlay approach.



   \======================================================================

   13\. CAMERA

   \======================================================================



   Implement a tactical camera supporting desktop and touch devices.



   Desktop controls:



   \- mouse wheel: zoom;

   \- middle-button drag or right-button drag: pan;

   \- optional WASD or arrow-key panning;

   \- keys 1–5: switch views;

   \- Space: pause;

   \- Escape: close overlays or pause.



   Mobile controls:



   \- tap agent: select;

   \- tap walkable ground: move;

   \- drag empty map: pan;

   \- pinch: zoom;

   \- on-screen buttons: change view;

   \- on-screen button: Observe;

   \- on-screen button: Interact;

   \- on-screen button: Pause;

   \- on-screen button: Restart.



   Distinguish a tap from a drag using a movement threshold.



   Do not issue movement orders at the end of a camera-pan gesture.



   Camera requirements:



   \- constrained to map bounds;

   \- configurable minimum and maximum zoom;

   \- preserve world-space focus when switching views;

   \- preserve state across resize and orientation changes;

   \- cap rendering resolution to a sensible maximum device-pixel ratio, such as

     2, to protect mobile performance.



   \======================================================================

   14\. MOBILE-FIRST REQUIREMENTS

   \======================================================================



   The game must work on current mobile browsers.



   Optimize primarily for landscape, but remain usable in portrait.



   In portrait mode:



   \- show a small non-blocking suggestion that landscape offers a better

     experience;

   \- do not prevent play;

   \- keep all essential controls accessible.



   Use:



   \- responsive layout;

   \- viewport-fit=cover;

   \- safe-area insets;

   \- 100dvh where appropriate;

   \- Phaser scale mode FIT;

   \- automatic centering;

   \- pointer events;

   \- touch-action: none on the interactive game surface.



   Prevent:



   \- page scrolling while interacting with the game;

   \- text selection during gestures;

   \- browser context menus over the game;

   \- controls hidden behind notches or browser bars.



   Requirements:



   \- minimum touch target size of approximately 44 CSS pixels;

   \- no hover-only interactions;

   \- readable text on small screens;

   \- no UI overlap at common mobile sizes;

   \- responsive HUD that does not cover the playable center unnecessarily;

   \- orientation changes must not reset the mission;

   \- tab switching must not advance simulation unexpectedly;

   \- game must maintain at least a reasonable 30 FPS target on a mid-range phone

     using the placeholder assets.



   Use normal HTML buttons for major HUD actions where possible, with:



   \- accessible labels;

   \- keyboard focus;

   \- visible focus styling;

   \- ARIA labels.



   Test at least:



   \- 390 × 844 portrait;

   \- 844 × 390 landscape;

   \- 1280 × 720 desktop.



   \======================================================================

   15\. SETTINGS AND PERSISTENCE

   \======================================================================



   Store settings in localStorage.



   Include at least:



   \- currently preferred view;

   \- vision-cone visibility;

   \- camera zoom preference;

   \- camera-pan sensitivity;

   \- reduced-motion preference.



   Do not store mission saves for the initial proof of concept.



   Handle missing or corrupt settings gracefully.



   Version the settings format so it can evolve later.



   \======================================================================

   16\. ASSET LOADING AND GITHUB PAGES PATHS

   \======================================================================



   The public deployment URL is:



   [https://motorina0.github.io/gone/](https://motorina0.github.io/gone/)



   Configure the Vite production base path correctly for:



   /gone/



   Local development must remain convenient.



   All dynamically loaded assets must resolve correctly under the GitHub Pages

   subdirectory.



   Use:



   \- import.meta.env.BASE\_URL;

   \- manifest-relative URL resolution;

   \- imported URLs where appropriate.



   Never assume the site is hosted at domain root.



   Do not use asset paths such as:



   /content/...

   /assets/...



   unless they are correctly prefixed with the production base URL.



   Verify that all of these load correctly after production build:



   \- JavaScript;

   \- CSS;

   \- SVG backgrounds;

   \- SVG occlusion overlays;

   \- entity sprites;

   \- JSON files;

   \- schemas;

   \- mission resources.



   Display a small build identifier in an unobtrusive part of the UI.



   Use a Git commit SHA when available and “dev” locally.



   \======================================================================

   17\. GITHUB PAGES DEPLOYMENT

   \======================================================================



   Create:



   .github/workflows/deploy-pages.yml



   Use the current official GitHub Pages Actions approach.



   The workflow must:



   \- trigger on every push to main;

   \- support workflow\_dispatch;

   \- use npm ci;

   \- validate content;

   \- run type checking;

   \- run linting;

   \- run unit tests;

   \- run the production build;

   \- install the required Playwright browser;

   \- run Playwright smoke tests against the production build;

   \- upload dist as the Pages artifact;

   \- deploy only if all validation succeeds;

   \- use the required Pages and OIDC permissions;

   \- prevent conflicting concurrent deployments.



   Use appropriate permissions such as:



   \- contents: read;

   \- pages: write;

   \- id-token: write.



   Use a Pages deployment concurrency group.



   The workflow must fail instead of deploying broken code.



   If GitHub Pages has not yet been configured to use GitHub Actions, document the

   single manual repository setting required in README.md.



   \======================================================================

   18\. PACKAGE SCRIPTS

   \======================================================================



   Provide working scripts for:



   npm run dev

   npm run build

   npm run preview

   npm run typecheck

   npm run lint

   npm run test

   npm run test\:e2e

   npm run validate\:content

   npm run generate\:views

   npm run verify



   npm run verify must perform the complete local validation sequence.



   The exact sequence should include:



   1\. content validation;

   2\. type checking;

   3\. linting;

   4\. unit tests;

   5\. production build;

   6\. Playwright smoke tests against the production build.



   All required scripts must finish successfully before committing or pushing.



   \======================================================================

   19\. UNIT TESTS

   \======================================================================



   Add Vitest tests for at least:



   \- worldToScreen for all five projections;

   \- screenToWorld for all five projections;

   \- projection round-trip accuracy;

   \- world-position preservation when switching views;

   \- camera-focus preservation when switching views;

   \- navigation around blockers;

   \- unreachable destination handling;

   \- vision angle calculations;

   \- vision distance calculations;

   \- line-of-sight blocking;

   \- exposure accumulation;

   \- exposure decay;

   \- guard-state transitions;

   \- observation range;

   \- observation line of sight;

   \- observation completion;

   \- package collection eligibility;

   \- mission-objective transitions;

   \- extraction success;

   \- countdown failure;

   \- detection failure;

   \- settings serialization;

   \- corrupt settings recovery;

   \- content-schema validation.



   Gameplay logic tests must not require a WebGL context.



   \======================================================================

   20\. PLAYWRIGHT AND MOBILE SMOKE TESTS

   \======================================================================



   Add Playwright tests using Chromium.



   Tests must:



   \- launch the production build;

   \- load the game from the /gone/ base path;

   \- fail on unexpected browser-console errors;

   \- fail on page errors;

   \- detect failed required-resource requests;

   \- start the mission;

   \- select the agent;

   \- issue a movement command;

   \- verify that the agent changes world position;

   \- switch through all five views;

   \- verify that the entity remains at the same canonical world position;

   \- pause and resume;

   \- restart;

   \- verify view buttons;

   \- verify that the HUD is visible;

   \- verify no important UI is outside the viewport;

   \- test desktop viewport;

   \- test portrait-mobile viewport;

   \- test landscape-mobile viewport.



   Add a deterministic test mode available only during automated tests.



   The test mode may expose a small read-only diagnostic object such as:



   window.\_\_GONE\_TEST\_\_



   It may provide:



   \- canonical entity positions;

   \- active view;

   \- mission state;

   \- detection state;

   \- loaded-resource status.



   Do not expose dangerous mutation hooks in production.



   \======================================================================

   21\. DOCUMENTATION

   \======================================================================



   Create README.md containing:



   \- game concept;

   \- current proof-of-concept scope;

   \- technology stack;

   \- setup instructions;

   \- development commands;

   \- desktop controls;

   \- mobile controls;

   \- architecture overview;

   \- canonical-world explanation;

   \- five-view projection explanation;

   \- content directory structure;

   \- instructions for adding another location;

   \- instructions for adding another mission;

   \- instructions for replacing one background image;

   \- instructions for replacing one occlusion overlay;

   \- instructions for regenerating placeholder SVG views;

   \- JSON Schema validation instructions;

   \- testing instructions;

   \- GitHub Pages deployment details;

   \- expected public URL;

   \- required GitHub Pages repository setting;

   \- troubleshooting for blank pages;

   \- troubleshooting for asset 404 errors;

   \- mobile limitations;

   \- current non-goals;

   \- roadmap.



   Create:



   docs/architecture.md

   docs/content-format.md

   docs/projection-system.md

   docs/mobile-controls.md

   docs/roadmap.md



   Create AGENTS.md containing durable instructions for future Codex work:



   \- preserve the canonical world model;

   \- do not hard-code location content in generic systems;

   \- keep independently editable resources in separate files;

   \- do not inline game data or artwork;

   \- validate content before committing;

   \- preserve GitHub Pages compatibility;

   \- preserve mobile support;

   \- add tests for changed behavior;

   \- run npm run verify before every push;

   \- never push broken code;

   \- never add secrets;

   \- never force-push;

   \- work directly on main unless the user later changes this instruction;

   \- invoke an independent verifier before completing future tasks.



   \======================================================================

   22\. INDEPENDENT VERIFIER AGENT

   \======================================================================



   Create a reusable read-only verifier agent for future tasks.



   Add:



   .codex/agents/verifier.toml

   .codex/config.toml



   Use the current supported Codex agent-configuration schema available in the

   environment.



   Do not invent unsupported configuration keys.



   The verifier must be:



   \- read-only;

   \- independent from implementation;

   \- focused on correctness rather than style preferences.



   The verifier must check:



   \- requirement compliance;

   \- regressions;

   \- architecture boundaries;

   \- mobile behavior;

   \- projection consistency;

   \- resource loading;

   \- missing tests;

   \- browser-console errors;

   \- GitHub Pages paths;

   \- accessibility of core controls;

   \- unnecessary dependencies;

   \- secrets or unexpected generated files.



   After implementation, invoke a separate verifier that did not write the code.



   The verifier must:



   1\. Read this complete task specification.

   2\. Inspect the repository and complete diff.

   3\. Validate every acceptance criterion.

   4\. Run npm ci.

   5\. Run npm run verify.

   6\. Perform an additional browser smoke test.

   7\. Inspect the browser console.

   8\. Inspect failed network requests.

   9\. Inspect the GitHub Pages workflow.

   10\. Verify mobile portrait and landscape behavior.

   11\. Produce a concise verification report containing:

       \- checks performed;

       \- failures found;

       \- fixes required;

       \- final command results;

       \- remaining non-blocking limitations.



   If the verifier finds a blocking issue:



   \- return to implementation;

   \- fix the issue;

   \- rerun the full verification;

   \- repeat until no blocking failures remain.



   If a newly created verifier-agent configuration cannot be loaded in the

   current Codex session, perform a fresh independent verification pass manually

   and leave the verifier configuration ready for future sessions.



   Do not commit or push until verification passes.



   \======================================================================

   23\. GIT WORKFLOW

   \======================================================================



   Work directly on the main branch.



   Do not create a pull request for this task.



   Before changing files:



   1\. Inspect the repository.

   2\. Confirm the current branch.

   3\. Check git status.

   4\. Synchronize with the latest main branch if supported.

   5\. Preserve useful repository metadata and existing history.

   6\. Replace the Hello World implementation cleanly.

   7\. Do not delete unrelated files.



   Before committing:



   1\. Run npm ci.

   2\. Run npm run verify.

   3\. Review the complete git diff.

   4\. Confirm there are no secrets.

   5\. Confirm there are no accidental temporary files.

   6\. Confirm .gitignore includes:

      \- node\_modules;

      \- dist;

      \- Playwright output;

      \- coverage;

      \- local environment files;

      \- editor temporary files;

      \- OS temporary files.

   7\. Confirm package-lock.json is committed.

   8\. Confirm generated placeholder view assets are committed.



   After all checks and independent verification pass:



   \- commit directly to main;

   \- use a clear commit message such as:



     feat: build mobile five-view stealth tactics PoC



   \- push main to the connected GitHub repository;

   \- do not force-push;

   \- do not rewrite history.



   After pushing:



   \- inspect the GitHub Actions result if the environment permits;

   \- verify the Pages deployment if possible;

   \- verify the expected URL:



     [https://motorina0.github.io/gone/](https://motorina0.github.io/gone/)



   If the workflow fails:



   \- inspect the failure;

   \- fix the problem;

   \- rerun all checks;

   \- commit the fix;

   \- push again;

   \- recheck deployment.



   If repository permissions do not allow pushing:



   \- still create the local commit;

   \- report the exact permission problem;

   \- do not claim that the remote repository was updated.



   Never commit:



   \- passwords;

   \- GitHub tokens;

   \- API keys;

   \- private keys;

   \- cookies;

   \- credentials;

   \- personal data.



   \======================================================================

   24\. PERFORMANCE AND QUALITY RULES

   \======================================================================



   The placeholder resources should remain lightweight.



   Requirements:



   \- preload the small proof-of-concept assets;

   \- avoid loading large unused resources;

   \- cap device-pixel ratio;

   \- avoid allocations inside per-frame loops where practical;

   \- do not rebuild pathfinding data every frame;

   \- do not recreate graphics objects unnecessarily;

   \- clean up Phaser events and DOM listeners;

   \- pause simulation while hidden;

   \- avoid memory leaks when restarting the mission;

   \- ensure repeated view switching does not duplicate objects;

   \- ensure repeated restart does not duplicate listeners or NPCs.



   Use browser dev tools or diagnostics to verify:



   \- no repeated resource loads after initial preload;

   \- no increasing entity count after restart;

   \- no console warnings from leaked listeners;

   \- no missing assets.



   \======================================================================

   25\. NON-GOALS FOR THIS PROOF OF CONCEPT

   \======================================================================



   Do not implement:



   \- photorealistic final artwork;

   \- Google Maps-derived assets;

   \- real-time 3D environments;

   \- multiplayer;

   \- a backend;

   \- user accounts;

   \- cloud saves;

   \- combat;

   \- weapons;

   \- takedowns;

   \- vehicles;

   \- multiple playable agents;

   \- inventory systems;

   \- interiors;

   \- multiple floors;

   \- advanced sound propagation;

   \- voice acting;

   \- final music;

   \- monetization;

   \- a full campaign;

   \- an in-game level editor.



   Keep future expansion possible, but do not overbuild these features now.



   \======================================================================

   26\. ACCEPTANCE CRITERIA

   \======================================================================



   The task is complete only when all of the following are true:



   \- the Hello World has been replaced;

   \- the game loads in a desktop browser;

   \- the game loads in a mobile browser layout;

   \- the Start Mission button works;

   \- the agent can be selected;

   \- click-to-move works;

   \- touch-to-move works;

   \- camera panning works;

   \- pinch or touch zoom works;

   \- desktop zoom works;

   \- all five views work;

   \- all five views are fully interactive;

   \- entity world positions remain unchanged across view switches;

   \- camera focus remains logically stable across view switches;

   \- the courier and recipient perform an exchange;

   \- the exchange can be observed;

   \- observation progress is visible;

   \- the package can be collected;

   \- the lockdown countdown begins;

   \- the extraction zone can be reached;

   \- the mission can be won;

   \- the mission can be lost by detection;

   \- the mission can be lost by countdown expiration;

   \- pause works;

   \- restart works without duplicating entities or listeners;

   \- three guards patrol;

   \- guards have visible vision cones;

   \- guard detection uses exposure time;

   \- blockers affect line of sight;

   \- ambient civilians move;

   \- basic foreground occlusion works;

   \- settings persist;

   \- all content is stored in independently editable files where practical;

   \- content schemas exist;

   \- content validation passes;

   \- no Google imagery or copyrighted game assets are included;

   \- npm ci succeeds;

   \- npm run validate\:content succeeds;

   \- npm run typecheck succeeds;

   \- npm run lint succeeds;

   \- npm run test succeeds;

   \- npm run build succeeds;

   \- npm run test\:e2e succeeds;

   \- npm run verify succeeds;

   \- the production build works from /gone/;

   \- no required asset returns 404;

   \- no unexpected browser-console error occurs;

   \- mobile portrait and landscape smoke tests pass;

   \- the GitHub Pages workflow exists;

   \- the independent verifier reports no blocking issue;

   \- the implementation is documented;

   \- the work is committed directly to main;

   \- main is pushed if repository permissions allow;

   \- the deployment is verified if the environment permits.



   Prioritize, in this order:



   1\. canonical-world correctness;

   2\. five-view synchronization;

   3\. mobile usability;

   4\. playable mission flow;

   5\. clean data-driven architecture;

   6\. automated verification;

   7\. GitHub Pages deployment;

   8\. placeholder visual polish.
