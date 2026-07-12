# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **template** for [Millennium](https://steambrew.app/) plugins that inject one or more buttons into Steam community profile pages. It runs inside the Steam client using the Millennium framework. Each button links to a URL built from the viewed profile's SteamID64 (e.g. `https://example.com/profile/{steamId64}`).

Plugin-level identity (name/title/description/logPrefix) plus the **default** button list live in `config/plugin.config.ts` (the `pluginConfig` object). Each button is a `ButtonConfig`: `id`, label/accent, brand colors, icon SVG, target URL template, and its own `openExternal` flag. Edit the `buttons` array to change the shipped defaults. At runtime the user manages their own button list (add/edit/delete/reorder) from the settings panel, which is persisted through the Lua backend and takes precedence over the config defaults.

## Commands

```bash
bun install           # install dependencies
bun run dev           # build for development (one-shot)
bun run watch         # rebuild on file changes (frontend / webkit / config)
bun run build         # production build
```

`dev` / `watch` / `build` each run `scripts/sync-manifest.ts` first, which pushes `pluginConfig`'s `name` / `title` / `description` into `plugin.json` and `package.json`. The config is the single source of truth for those manifest fields — do not hand-edit them in the manifests.

There are no automated tests. The build does no type checking — run `npx tsc -p frontend/tsconfig.json --noEmit` (and `webkit/tsconfig.json`) separately to catch type errors.

## Architecture

The plugin is **webkit-first by design**: the button is injected only by the webkit bundle, which runs inside the Steam community browser. The Plugin Database maintainers explicitly require this shape — an earlier revision had a CDP (Chrome DevTools Protocol) fallback injection path with a mode selector and status badge, and it was rejected for unnecessary complexity ("for a plugin like this, you'd simply need a webkit"). Do not reintroduce CDP injection, `window.MILLENNIUM_API` raw access, or custom-styled settings UI.

**`config/plugin.config.ts`** — the single source of truth for defaults. Exports `pluginConfig` (plugin identity + the default `buttons: ButtonConfig[]` list), and two pure helpers used by both bundles (no `@steambrew` imports): `effectiveButtons(parsed)` (resolves the effective button list from a parsed settings object — new `buttons` array, legacy single-`button` shape, or config defaults) and `newButton()` (a fresh default button with a unique `id`). Imported by the frontend and webkit modules.

**`frontend/index.tsx`** — Millennium plugin entrypoint. Registers the plugin via `definePlugin` from `@steambrew/client` (the definition callback is async: it awaits `initSettings()` before returning the panel) and renders the `ButtonEditor` as the settings-panel content. The gear icon is derived from the first default button.

**`frontend/components/ButtonEditor.tsx`** — the whole settings panel: a native `Dropdown` selects which button to edit, an `Add button` creates one, and the selected button is edited through native `TextField`s (label/accent/urlTemplate/brandColor/brandColorHover/iconSvg) and a per-button `ToggleField` (openExternal). `Move up` / `Move down` reorder, `Delete button` removes, `Save` persists the whole list, `Reset to defaults` clears the override. Edits are buffered in a working copy; `Save` writes the entire list at once. `ButtonPreview` is the one custom-styled element (explicitly allowed by the reviewers as a "preview window"); everything else is a Steam native component.

**`frontend/services/settings.ts`** — settings store. Wraps the backend RPCs (`GetSettings` / `SaveSettings`) via `callable` from `@steambrew/client`, keeps an in-memory `cachedSettings` (`{ buttons?: ButtonConfig[] }`), and exposes `initSettings()` (load + migrate once on startup), `getSettings()` (synchronous read), `getEffectiveButtons()` (saved list, or config defaults), and `saveSettings()` (optimistic update + persist, revert on failure).

**`webkit/index.tsx`** — the injection path. Runs inside the Steam community browser (`steamcommunity.com`): URL guard → read settings via `callable('GetSettings')` from `@steambrew/webkit` → resolve the button list with `effectiveButtons` → call `injectMain(buttons, logPrefix)`. It also registers `visibilitychange` / `window focus` listeners so an already-open profile re-reads settings and re-injects when the user returns to the tab (store-safe replacement for the removed CDP auto-reload). It tracks the last-applied serialized list and only re-injects on an actual change, guarded against concurrent runs.

**`webkit/inject.ts`** — `injectMain(buttons, logPrefix)`, vanilla DOM injection (React is not available in the community browser). Holds module-level state (the resolved SteamID and the `.steam-button-container` element) so repeat calls are cheap: it resolves the profile SteamID **once**, reuses/creates a single container, and re-renders its children from the current button list (appending one `<a>` per button; an empty list removes the container). The shared stylesheet is color-agnostic and reads `var(--sb-brand)` / `var(--sb-brand-hover)`; each anchor sets those CSS variables inline so buttons keep their own brand colors. A normal module with real imports.

**`backend/main.lua`** — Lua backend (`backendType: "lua"`). Signals `millennium.ready()` and exposes two frontend-callable RPCs, `GetSettings` (returns the raw `settings.json` contents, or `"{}"`) and `SaveSettings(settings_json)` (writes the string verbatim, returns `"1"`/`"0"`). It does **no JSON parsing** (the frontend does that). It resolves the plugin directory via Millennium's `utils` module — `require("utils").get_backend_path()` returns the absolute `backend/` directory (the reviewers require using this instead of `debug.getinfo` hacks) — and uses `utils.read_file` / `utils.write_file` for I/O. The two RPCs are declared as **global** functions, not `local` (see Key details).

## Key details

- **Customizing the default buttons:** edit the `buttons` array in `config/plugin.config.ts`. Each button's `iconSvg` is the inner markup of a `0 0 24 24` SVG (use `currentColor` for stroke/fill so its brand colors apply). `urlTemplate` must contain `{steamId64}`, which is replaced with the resolved id. Users override this list at runtime from the settings panel; the saved list (when present) fully replaces the config defaults, so later edits to the default `buttons` array only affect users who have not customized.
- SteamID resolution order (inside `webkit/inject.ts`): `g_rgProfileData.steamid64` / `.steamid` → `data-miniprofile` attribute (converted via `BigInt('76561197960265728') + BigInt(accountId)`) → Steam profile XML fetch (`/?xml=1`)
- Do **not** use `g_steamID` — that is the logged-in user's ID, not the viewed profile
- Button is inserted into `.profile_rightcol` via `col.insertBefore(div, col.children[1] ?? null)`; if the column is not present yet, a `MutationObserver` waits for it (15s timeout)
- Each button's href defaults to `steam://openurl_external/{url}` (NOT a plain `https://` link) when that button's `openExternal` is on. If the target site is behind Cloudflare, its challenge blocks Steam's in-app CEF browser; opening in the system browser (where the user's session already passes) avoids it. A plain link would open in-client and may hit the Cloudflare wall.
- **Open profile pages self-refresh (store-safe, no CDP).** After the user saves settings, an already-open profile page re-reads settings and re-injects its buttons the next time it becomes visible/focused (`visibilitychange` / `window focus` listeners in `webkit/index.tsx`). This replaces the removed CDP auto-reload: there is no frontend→webkit push channel and no store-safe browser-reload API, so the update is driven from the webkit side. `WebkitMain` tracks the last-applied serialized button list and only re-injects when it actually changed; `injectMain` reuses a cached SteamID and a single module-level container, so refreshes are cheap. Consequence: the change lands when the user returns to the profile tab, not at the exact instant of Save.
- **Store review rules (learned from PluginDatabase PR reviews):** (1) backend must use the `utils` Lua module, not `debug.getinfo`; (2) never touch `window.MILLENNIUM_API` — import everything from `@steambrew/client` / `@steambrew/webkit`; (3) settings UI must use Steam native components only (custom styles allowed only for preview-type widgets); (4) no CDP injection machinery for simple button plugins.
- **Do NOT use `pluginConfig` / `usePluginConfig` from `@steambrew`** for persistence — they throw `type must be string, but is number` on this Millennium runtime and silently break injection. Settings go through the Lua backend RPCs instead. (Note: our own `pluginConfig` in `config/plugin.config.ts` is unrelated — it's a plain object, not the Millennium API.)
- **Lua callables must be GLOBAL functions.** This runtime resolves `callable('Name')` by global function name, not by the module's return table — `local function SaveSettings` (even if listed in the return table) fails with `Millennium Error: function not found: SaveSettings`. Lifecycle hooks (`on_load` etc.) still go in the return table.
- Idempotency guards: `.steam-button-container` (the single wrapper holding all buttons) and `#steam-button-style` (the shared, color-agnostic stylesheet; per-button colors come from inline `--sb-brand` / `--sb-brand-hover` CSS variables)
- `types/*.lua` are editor-only stubs (`---@meta`) for the Lua modules Millennium preloads (`logger`, `millennium`, `utils`); keep them in sync if new module functions are used.
- `plugin.json` / `package.json` `name` / `title` / `description` are generated from `config/plugin.config.ts` by `scripts/sync-manifest.ts`; the version is synced separately by `scripts/sync-version.ts`.
- `plugin.json` must include `"webkitApiVersion": "2.0.0"` — without it Millennium does not load the webkit bundle at all
- Build tool is `millennium-ttc` from `@steambrew/ttc`

## Releasing

Releases are driven by semantic-release (`release.config.mjs`, run by `.github/workflows/release.yml` on push to main). The version is computed from conventional commit types since the last tag — **do not hand-edit the version**. `feat:` → minor, `fix:`/`perf:` → patch, `chore:` (and everything else) → no release.
