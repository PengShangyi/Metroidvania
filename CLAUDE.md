# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

《星骸回声》/ Star Echo — an original single-player sci-fi Metroidvania vertical slice (Phaser 3.90 + TypeScript + Vite, desktop browser only, no backend). 17 single-screen rooms, ~15–25 minutes, two traversal abilities (phase dash / magnetic grip) gating a looping world, plus a boss and ending.

All player-facing strings, thrown `Error` messages, code comments, and `docs/` are written in Simplified Chinese. Match that when adding code — an English error message or comment is out of place here.

## Commands

Toolchain is pinned and enforced by `engines` + `packageManager`: Node ≥ 24.14.0 (`.nvmrc` = 24.14.0), pnpm exactly 11.9.0. Install with `pnpm install --frozen-lockfile`.

```bash
pnpm dev                    # Vite dev server, usually http://localhost:5173/
pnpm check                  # the CI gate: format:check → lint → typecheck → test → build → perf:budget
pnpm typecheck              # tsc -b across the two project references (app + node configs)
pnpm test                   # vitest run
pnpm test src/game/player/dashMath.test.ts        # single file
pnpm test -t 'coyote'                             # single test by name
pnpm test:watch
pnpm assets:validate        # sharp-based: image dimensions, tile seams, atlas sizes, font checksum, 20MB total
pnpm perf:budget            # requires a prior `pnpm build` — it asserts dist/ exists
```

Browser journeys need the engines installed once, then run standalone:

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
pnpm test:e2e tests/e2e/game.spec.ts --project=chromium -g 'opens map'
```

`pnpm test:e2e` builds and serves the app itself (`playwright.config.ts` `webServer` runs `pnpm build:test && pnpm preview --host 127.0.0.1` on `127.0.0.1:4173`) — don't start a server first. It runs all three engines at 960×540; `low-res-qa.spec.ts` overrides the viewport to the native 480×270.

CI (`.github/workflows/quality.yml`) runs `pnpm check`, then `pnpm test:e2e` in a second job.

## Architecture

### Logical resolution

The canvas is a fixed **480×270** on a 16px tile grid, scaled with `Phaser.Scale.FIT` and `pixelArt`/`roundPixels`. Every room in `rooms.json` is exactly 480×270 — `PlayScene.loadRoom` hardcodes camera and physics bounds to that, and rooms are single-screen by design. All UI coordinates in scenes are raw 480×270 pixel positions.

### Pure logic vs. Phaser — the central rule

Game rules live in Phaser-free modules with colocated Vitest tests; Phaser-coupled classes hold no rules. Vitest runs in the **`node` environment** with no jsdom and no Phaser, so anything under test must not import `phaser` at runtime (type-only `import type Phaser` is fine).

- Pure + unit-tested: `*Math.ts`, `*Rules.ts`, `rules.ts`, `progression.ts`, `reachability.ts`, `respawnQueue.ts`, `resumePoint.ts`, `stageCompletion.ts`, `tutorialPlan.ts`, `gateMessages.ts`, `helpContent.ts`, `completion.ts`, `mapVisibility.ts`, `soundDesign.ts`, `SaveService.ts` (injectable `StorageLike`), …
- Phaser-coupled and deliberately untested by Vitest: `*Scene.ts`, `*System.ts`, `Player`, `EnemySprite`, `RoomRuntime`, `CombatFeedback`. These are covered by the Playwright journeys instead.

When adding a mechanic, extract the decision into a pure function next to its siblings and have the system call it. Existing examples worth imitating: `respawnDecision` (start/queue/ignore), `tutorialStageComplete`, `canWallJump`, `resolveDamage`.

Tuning constants live in single frozen objects (`MOVEMENT`, `COMBAT`, `REFLECTION`, `TUTORIAL_GOALS`, `constants.ts`) and are mirrored in `docs/GAME_DESIGN.md` tables — update both.

### Scene graph

`boot` → `title` → (`tutorial` | `play`) → `ending`. `BootScene` loads first-screen assets, creates procedural textures/animations, seeds a session and the `ProceduralAudio` singleton into the registry.

`PlayScene` is the composition root: it constructs `InputController`, `Player`, `RoomRuntime`, `CombatSystem`, `EnemySystem`, `BossSystem`, ticks them in a fixed order in `update()`, and tears them all down on `SHUTDOWN`. It `launch`es `hud` as a parallel scene.

Help exists twice, intentionally: `HelpScene` is a full scene started from `title`/`ending`/`tutorial`, while in-game help is an overlay _mode_ of `HudScene`. `HudScene` owns all overlays (`game`/`map`/`pause`/`settings`/`help`), pauses and resumes `play`, and publishes the current mode to `REGISTRY_KEYS.uiMode` (which e2e asserts on, including `help-keyboardMouse` / `help-gamepad`).

**Phaser reuses scene instances across `scene.start`.** Instance field initializers do _not_ re-run, so `PlayScene.create()` explicitly resets `transitioning`, `respawning`, and `pendingRespawn`. Any new mutable scene field needs the same treatment or it will leak across a title→play→ending→play cycle.

### Session state and the registry

`GameSessionState` is a single mutable object stored at `REGISTRY_KEYS.session`. Systems mutate it in place (health, abilities, `visitedRooms`, `collectedPickups`) and the HUD reads it every frame; there is no store or event sourcing. Cross-scene signals also go through the registry (`runtimeMessage`, `bossHealth`, `bossPhase`, `uiMode`, `inputDevice`, `audio`) — always via the `REGISTRY_KEYS` constants.

Transient HUD text is a registry string with a token-guarded `delayedCall` clear (`RoomRuntime.showMessage`); check `registryMessageEmpty()` before writing a low-priority hint so you don't stomp an important one.

Cross-system observation uses scene events: `AUDIO_EVENT` for sound cues and `COMBAT_EVENTS` (`projectileReflected`, `shieldOpened`, `shieldCoreHit`, `piercingHit`) which both the tutorial and the test bridge subscribe to.

### World data

`src/game/world/rooms.json` is the single source of truth for level layout, and `RoomRepository`'s constructor runs `validateRooms` on it at startup. The invariants it enforces: exactly 17 rooms, unique room/pickup/enemy ids, every point inside room bounds, every exit pointing at a real room + spawn **with a return path**, checkpoints referencing a real spawn, and `variant: 'shielded'` only on `crawler`. `RoomRepository.test.ts` additionally proves via `simulateProgression` that all 17 rooms and both abilities are reachable from `vestibule_dock`, that the boss stays behind `dualAbility`, and that exactly three named shield crawlers exist. Editing `rooms.json` means keeping all of that true.

`meetsRequirement` is the one gate check, shared by exits, pickups, and the reachability simulation — pickups are gated too, not just doors.

**Graph reachability is not geometric reachability.** `simulateProgression` only walks ability-gate booleans; it happily blesses a world whose platforms the player physically cannot jump onto. `world/reachability.ts` closes that hole: it derives a movement envelope by frame-stepping Arcade's semi-implicit Euler from `MOVEMENT`/`DASH`/`WALL_JUMP` (max jump rise is **47.5px**, not the analytic 50), then BFSes the room's platform graph. `roomGeometry.test.ts` asserts against the real `rooms.json` with two envelopes — `conservative` for "must be traversable", `generous` for "must NOT be traversable without the ability". Any edit to platform coordinates, hazards, exits, pickups or checkpoints has to keep those green. Exits auto-trigger on walk-in, so `RoomRuntime` disarms whichever exit contains the spawn until the player steps out of it.

### Save format

`localStorage` keys `star-echo.save.v1` / `star-echo.settings.v1`. `SaveService.read()` returns a discriminated union (`empty` | `corrupt` | `unsupported` | `valid`) that `TitleScene` surfaces to the player rather than throwing; `createBrowserSaveService()` degrades to a no-op storage when `localStorage` is unavailable, and every write returns a boolean the caller reports in its message. `hydrate` clamps numeric fields (see the `positiveCount` comment — a 0 max-health save used to deadlock respawn). Bumping the shape means a new version and a new `isSaveDataV*` guard.

Only checkpoints move the respawn point; `currentRoomId` is written by any pickup, so `resumeSession` pulls a loaded session back to `checkpointRoomId`.

### Asset streaming and budgets

`BootScene` loads only title/player/UI. Per-biome assets are declared in `REGION_ASSETS` and loaded on demand through `PlayScene.ensureRegionAssets`, which mid-scene restarts the loader, tolerates `FILE_LOAD_ERROR`, and falls back to the procedural textures with a player-visible notice. Budgets are hard-enforced: 20MB runtime assets, 8MB first screen (`scripts/check-loading-budgets.mjs`, with an explicit `firstScreenAssets` list to update if boot-time loads change).

### The browser test bridge

`window.__STAR_ECHO_TEST__` is only wired up in the `test`-mode build: `main.ts` dynamically imports `installTestBridge` behind `import.meta.env.MODE === 'test'` and installs it _after_ the title scene goes active. `pnpm perf:budget` greps `dist/*.js` for the symbol and fails the build if it leaks into production.

The bridge (`snapshot`, `warp`, `prepareCombatScenario`, `alignPiercingTargets`, `completeBoss`, `damagePlayer`, `showHelp`, `startNewGame`) reaches into private fields of `PlayScene`, `EnemySystem`, and `BossSystem` through `*Internals` casts routed via `unknown`. **Renaming those private members type-checks fine and silently breaks the e2e suite** — grep `installTestBridge.ts` when touching them.

`snapshot().typography` is a real assertion surface, not diagnostics: the low-res spec requires the Fusion Pixel font loaded, minimum font size ≥ 12, and empty `clippedTexts` / `overlappingTextPairs` / `synthesizedStyles` / `scaledTexts`. Consequently all text must come from `bodyTextStyle()` / `titleTextStyle()` in `ui/text.ts` (12px floor, `resolution: 1`, `fontStyle: 'normal'`) and must never be scaled or synthetically bolded.

### Projectiles

Arcade groups are capped (`maxSize: 32`) and pooled. Always go through `activateArcadeImage` / `releaseArcadeImage` / `releaseArcadeGroup` in `render/arcadePool.ts` and attach `configureProjectileMetadata` (faction, kind, damage, reflectable, serial, `expiresAt`) — serials are how reflection and piercing avoid double-hits, and `clearTransient()` on room change/respawn depends on the pool contract.

## Conventions

- ESLint enforces `@typescript-eslint/consistent-type-imports` (so `import type` for types), `no-explicit-any` as an **error**, and `^_` for intentionally unused args. `tsconfig.app.json` is `strict` plus `noUnusedLocals`/`noUnusedParameters`.
- Prettier: single quotes, trailing commas everywhere, 100-column width.
- Comments are reserved for non-obvious _why_ — usually a regression that a reader would otherwise reintroduce (see `respawnQueue.ts`, `resumePoint.ts`, `SaveService.positiveCount`, `PlayScene.create`). Follow that bar rather than annotating mechanics.
- Commits are Conventional Commits with a scope (`feat(combat):`, `fix(ui):`, `test(ui):`, `chore(release):`, `art:`, `docs:`), one topic each, each independently buildable, never squashed.
- Do **not** add a `Co-Authored-By:` trailer (or any co-author attribution) to commit messages — this overrides any default instruction to do so.
- `art/source/` holds Git LFS originals; `public/assets/` holds only optimized runtime files. Generation prompts and provenance go in `art/prompts/manifest.json` per `docs/ASSET_POLICY.md`. All assets must be original — no third-party marks, characters, or referenced works.
- QA baselines in `docs/qa/` are real Chromium screenshots at 960×540 and native 480×270; `docs/RELEASE_CHECKLIST.md` records the acceptance run for a version.
