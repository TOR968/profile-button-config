# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **template** for [Millennium](https://steambrew.app/) plugins that inject a single button into Steam community profile pages. It runs inside the Steam client using the Millennium framework. The button links to a URL built from the viewed profile's SteamID64 (e.g. `https://example.com/profile/{steamId64}`).

Everything button-specific lives in **one file**, `config/plugin.config.ts` (the `pluginConfig` object): plugin name/title/description, button label/accent, brand colors, icon SVG, target URL template, and the default `openExternal` flag. Edit that file to create a new button; the rest of the codebase is generic machinery.

## Commands

```bash
bun install           # install dependencies
bun run dev           # build for development (one-shot)
bun run watch         # rebuild on file changes (frontend / webkit / config)
bun run build         # production build
```

`dev` / `watch` / `build` each run `scripts/sync-manifest.ts` first, which pushes `pluginConfig`'s `name` / `title` / `description` into `plugin.json` and `package.json`. The config is the single source of truth — do not hand-edit those fields in the manifests.

There are no automated tests. The build does no type checking — run `npx tsc -p frontend/tsconfig.json --noEmit` (and `webkit/tsconfig.json`) separately to catch type errors.

## Architecture

The plugin has two active execution contexts:

**`config/plugin.config.ts`** — the single source of truth. Exports `pluginConfig` (all button-specific values) and `SELECTORS` (the DOM identifiers shared between the inject function and the frontend detector). Imported by the frontend and webkit modules; its values reach the serialized inject function as a runtime argument (see below).

**`frontend/index.tsx`** — Millennium plugin entrypoint. Registers the plugin via `definePlugin` from `@steambrew/client`, renders the settings panel (gear icon), and sets up CDP (Chrome DevTools Protocol) injection as a **fallback** for the webkit path. Reads `pluginConfig` for the icon, colors, name, and title. Also reloads open profiles when a setting changes.

**`frontend/inject.ts`** — Contains `injectMain(openExternal, injector, config)`, a self-contained vanilla JS function used by **both** injection paths: webkit imports and calls it directly; CDP serializes it via `buildInjectionCode(openExternal)`. Because `injectMain` is `.toString()`-serialized for CDP, its **function body has zero imports and no references to outer-scope variables** — everything it needs is passed in as arguments (`openExternal` and the `config` object). The module-level imports (`pluginConfig`, helpers) are only used by `buildInjectionCode` / `toInjectConfig`, which run in the frontend context and are NOT serialized. `toInjectConfig` narrows `pluginConfig` to the fields the injected function needs, and `buildInjectionCode` embeds that as a JSON literal in the stringified call.

**`frontend/services/settings.ts`** — settings store. Wraps the backend RPCs (`GetSettings` / `SaveSettings`) via `callable` from `@steambrew/client`, keeps an in-memory `cachedSettings`, and exposes `initSettings()` (load once on startup), `getSettings()` (synchronous read, safe on the injection hot path), and `saveSettings()` (optimistic update + persist, revert on failure). `openExternal`'s default comes from `pluginConfig.openExternalDefault`.

**`webkit/index.tsx`** — Primary injection path. Runs inside the Steam in-app browser; on current Millennium it also runs in the community browser (`steamcommunity.com`), so it injects the button directly: URL guard → read `openExternal` via `callable('GetSettings')` from `@steambrew/webkit` → call `injectMain(openExternal, 'webkit', toInjectConfig(pluginConfig))`. A normal module (real imports, no `.toString()` serialization).

**`backend/main.lua`** — Lua backend (`backendType: "lua"`). Signals `millennium.ready()` and exposes two frontend-callable RPCs, `GetSettings` (returns the raw `settings.json` contents, or `"{}"`) and `SaveSettings(settings_json)` (writes the string verbatim, returns `"1"`/`"0"`). It does **no JSON parsing** (the frontend does that) and resolves its own directory via `debug.getinfo` — so it depends on neither `require("json")` nor `millennium.get_install_path()`, both of which are unreliable on this runtime. The two RPCs are declared as **global** functions, not `local`/return-table entries (see Key details).

## Injection: webkit primary, CDP fallback

The button is injected by **two** paths that share `injectMain` (vanilla DOM — React is not available in the community browser):

1. **webkit (`webkit/index.tsx`)** — primary. On current Millennium the webkit bundle runs in the community browser too, so it injects directly. Cleanest path.
2. **CDP (`frontend/index.tsx`)** — fallback. For Millennium versions where webkit does *not* reach the community browser (it didn't in ~v3.2.0), the frontend reaches it via `window.MILLENNIUM_API.ChromeDevToolsProtocol` and `Runtime.evaluate` with the stringified function (`buildInjectionCode`).

**De-dup:** `injectMain`'s `inject()` reserves its `.steam-button-container` div **synchronously** before any `await`, and both the top guard and `inject()` bail if that container already exists. So whichever path runs first wins; the other no-ops — no double button even if both fire.

**Injection mode setting** (`injectionMode`, default `auto`): `auto` = both paths run, first wins (de-dup as above); `webkit` = only webkit injects (frontend CDP `injectIntoTarget` returns early); `cdp` = only CDP injects (`WebkitMain` returns early). Forcing `webkit` on a runtime where webkit doesn't reach the community browser means no button — that's the user's explicit choice (the badge then shows `none`). Both paths read the mode from the settings store; changing it reloads open profiles.

## CDP injection flow

1. `Target.setDiscoverTargets` — enables target discovery
2. Listen on `Target.targetCreated` / `Target.targetInfoChanged` — detect profile URLs matching `/steamcommunity\.com\/(id|profiles)\//`
3. 200ms debounce per `targetId` — prevents double-injection from rapid duplicate events (`targetInfoChanged` can fire twice for the same URL) while allowing re-injection on refresh/navigation
4. `Target.attachToTarget` → `Runtime.evaluate` with the injection code — injects the button into the community browser's main world

## Key details

- **Customizing the button:** edit `config/plugin.config.ts` only. `iconSvg` is the inner markup of a `0 0 24 24` SVG (use `currentColor` for stroke/fill so brand colors apply). `urlTemplate` must contain `{steamId64}`, which is replaced with the resolved id.
- SteamID resolution order (inside `injectMain`): `g_rgProfileData.steamid64` / `.steamid` → `data-miniprofile` attribute (converted via `BigInt('76561197960265728') + BigInt(accountId)`) → Steam profile XML fetch (`/?xml=1`)
- Do **not** use `g_steamID` — that is the logged-in user's ID, not the viewed profile
- Button is inserted into `.profile_rightcol` via `col.insertBefore(div, col.children[1] ?? null)`; if the column is not present yet, a `MutationObserver` waits for it (15s timeout)
- The button href defaults to `steam://openurl_external/{url}` (NOT a plain `https://` link) when `openExternal` is on. If the target site is behind Cloudflare, its challenge blocks Steam's in-app CEF browser; opening in the system browser (where the user's session already passes) avoids it. A plain link would open in-client and may hit the Cloudflare wall.
- **Active-injector badge:** each injection path tags its button with `data-steam-button-injector` (`webkit` or `cdp`). The settings panel reads that attribute from an open profile via CDP (`detectActiveInjector`) and shows a colored badge above the toggle (green = webkit, amber = CDP fallback, grey = none/unknown).
- **Shared selectors:** the container class (`steam-button-container`), style id (`steam-button-style`), injector attribute (`data-steam-button-injector`), and button/accent classes (`sb-btn` / `sb-accent`) are mirrored between `injectMain` (string literals, because it is serialized) and `frontend/index.tsx` / `config/plugin.config.ts` (`SELECTORS`). If you rename one, rename all.
- **Settings panel:** `definePlugin` returns a `content: <Settings />` JSX element, which Millennium renders under the plugin's gear icon. `Settings` holds React state seeded from `getSettings()` and a native `Toggle` (from `@steambrew/client`) laid out with the label above and a full-width description below; `onChange` calls `saveSettings(...)` then `reloadOpenProfiles()`. The toggle's ON/OFF text is localized by Steam; our label/description are hardcoded English.
- **Do NOT use `pluginConfig` / `usePluginConfig` from `@steambrew`** for persistence — they throw `type must be string, but is number` on this Millennium runtime and silently break injection. Settings go through the Lua backend RPCs instead. (Note: our own `pluginConfig` in `config/plugin.config.ts` is unrelated — it's a plain object, not the Millennium API.)
- **Lua callables must be GLOBAL functions.** This runtime resolves `callable('Name')` by global function name, not by the module's return table — `local function SaveSettings` (even if listed in the return table) fails with `Millennium Error: function not found: SaveSettings`. Lifecycle hooks (`on_load` etc.) still go in the return table.
- The `openExternal` flag is read synchronously via `getSettings()` in `injectIntoTarget` (cache loaded once by `initSettings()` at startup), then passed into `buildInjectionCode`. Reading is off the IPC path, so a settings failure can never break injection.
- **Toggling reloads open profiles automatically:** `Settings.onChange` calls `saveSettings(...)` then `reloadOpenProfiles()`, which finds open profile targets via `Target.getTargets` and runs `location.reload()` in each via CDP. The reload triggers re-injection with the new value, so the change is immediate.
- Idempotency guards: `.steam-button-container` (button) and `#steam-button-style` (styles)
- `plugin.json` / `package.json` `name` / `title` / `description` are generated from `config/plugin.config.ts` by `scripts/sync-manifest.ts`; the version is synced separately by `scripts/sync-version.ts`.
- `plugin.json` must include `"webkitApiVersion": "2.0.0"` — without it Millennium does not load the webkit bundle at all
- Build tool is `millennium-ttc` from `@steambrew/ttc`

## Releasing

Releases are driven by semantic-release (`release.config.mjs`, run by `.github/workflows/release.yml` on push to main). The version is computed from conventional commit types since the last tag — **do not hand-edit the version**. `feat:` → minor, `fix:`/`perf:` → patch, `chore:` (and everything else) → no release.
