# Runtime-editable button config — Design

**Date:** 2026-06-22
**Status:** Approved (pending spec review)

## Goal

Move the button's appearance/target fields out of `config/plugin.config.ts` and make
them editable at runtime from the Millennium settings panel (the plugin's gear icon),
so a user can customize the button directly inside Steam without rebuilding the plugin.

`config/plugin.config.ts` (`pluginConfig`) **stays** as the source of defaults and as the
source for the manifest fields. The settings store becomes an **override layer** on top
of it.

## Scope

### Runtime-editable fields (reach `injectMain` via the config argument)

- `label`, `accent` — button text
- `brandColor`, `brandColorHover` — colors
- `iconSvg` — raw inner SVG (`0 0 24 24`, `currentColor`)
- `urlTemplate` — must contain `{steamId64}`
- `openExternal` — already editable (instant toggle, unchanged)

### NOT editable (build-time, baked into `plugin.json` via `sync-manifest.ts`)

- `name`, `title`, `description`, `logPrefix`

## Agreed decisions

1. **Save model:** explicit **Save** button for the new text/color/icon fields. Edits live
   in local React state; nothing persists and no profile reload happens until Save is
   clicked. Separate **Reset to defaults** button.
2. **Instant toggles unchanged:** `openExternal` and `injectionMode` keep saving instantly
   on change (current behavior). The panel has two zones — instant controls on top, the
   buffered button editor below.
3. **Storage = partial diff overrides** (not a full snapshot). See below.

## Architecture

### 1. Storage & merge model

`config/plugin.config.ts` (single source of truth, zero `@steambrew` imports) gains:

```ts
export type ButtonOverrides = Pick<PluginConfig,
  'label' | 'accent' | 'brandColor' | 'brandColorHover' | 'iconSvg' | 'urlTemplate'>;

export const BUTTON_OVERRIDE_KEYS: (keyof ButtonOverrides)[] =
  ['label', 'accent', 'brandColor', 'brandColorHover', 'iconSvg', 'urlTemplate'];

export function mergeButtonConfig(overrides?: Partial<ButtonOverrides>): PluginConfig {
  const out = { ...pluginConfig };
  if (overrides) {
    for (const k of BUTTON_OVERRIDE_KEYS) {
      const v = overrides[k];
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}
```

`frontend/services/settings.ts`:

```ts
import { ButtonOverrides, mergeButtonConfig } from '../../config/plugin.config';

export interface PluginSettings {
  openExternal: boolean;
  injectionMode: InjectionMode;
  button?: Partial<ButtonOverrides>;   // partial override; absent = use defaults
}

export function getEffectiveConfig(): PluginConfig {
  return mergeButtonConfig(cachedSettings.button);
}
```

`DEFAULT_SETTINGS.button` is omitted (undefined). `initSettings()` keeps its existing
`{ ...DEFAULT_SETTINGS, ...parsed }` merge — `parsed.button` flows through unchanged.
`saveSettings()` stays generic (serializes the whole `PluginSettings`).

**Why partial diff, not full snapshot:** on Save the panel diffs each editable field
against the `pluginConfig` default and stores **only** the keys that differ. A template
author who later edits, say, `brandColor` in the file still sees it propagate, because the
user never overrode that key. **Reset** sets `button = undefined`, so all defaults shine
through again. `logPrefix` / `name` / `title` / `description` are never in the override set.

### 2. Injection wiring

**Constraint:** `frontend/inject.ts` must stay importable by **both** the frontend and the
webkit bundles, so it must NOT import `settings.ts` (which pulls in `@steambrew/client`).
Webkit must not get `@steambrew/client` in its bundle.

Changes:

- `buildInjectionCode` gains a parameter:
  ```ts
  export const buildInjectionCode = (openExternal: boolean, injectConfig: InjectConfig) =>
    `(${injectMain.toString()})(${openExternal === false ? 'false' : 'true'}, 'cdp', ${JSON.stringify(injectConfig)})`;
  ```
  Its only caller, `frontend/index.tsx` (CDP path), passes
  `buildInjectionCode(openExternal, toInjectConfig(getEffectiveConfig()))`.
  `inject.ts` drops its now-unused `pluginConfig` **value** import (keeps the
  `PluginConfig` **type** import for `toInjectConfig`'s signature).

- `webkit/index.tsx` reads its override via its own `callable('GetSettings')`, then:
  ```ts
  injectMain(openExternal, 'webkit', toInjectConfig(mergeButtonConfig(button)));
  ```
  `mergeButtonConfig` is pure and comes from the config file — no client import. Its
  `readSettings()` return type extends to include `button?: Partial<ButtonOverrides>`.

### 3. Settings panel layout

Two zones inside the existing `<Settings>` content.

```
┌────────────────────────────────────┐
│ [badge: webkit]                     │  Zone 1: INSTANT (unchanged)
│ Injection mode  [Auto|WK|CDP]       │
│ Open in external browser     (•—)   │
├────────────────────────────────────┤
│ BUTTON APPEARANCE                   │  Zone 2: BUFFERED
│   ┌ live preview ────────────┐      │
│   │   ◉  EXAMPLE.IO          │      │  renders .sb-btn with current
│   └──────────────────────────┘      │  form colors + icon + text
│   Label   [EXAMPLE         ]         │
│   Accent  [.IO             ]         │
│   URL     [https://…/{id}  ]         │
│           ⚠ must contain {steamId64} │  non-blocking warning
│   Brand   [#4f9dde] ■                │  text input + <input type=color>
│   Hover   [#7bb8e8] ■                │
│   Icon    [<circle…/>      ]         │  textarea
│   [ Save ]            [ Reset ]      │  Save: persist + reload here
└────────────────────────────────────┘
```

- Zone 2 fields seed from `getEffectiveConfig()` into local React state.
- **Save:** compute `diff` (each editable field where `value !== pluginConfig[key]`), then
  `saveSettings({ ...getSettings(), button: <diff or undefined if empty> })` →
  `reloadOpenProfiles()` → re-run `detectActiveInjector()`. Save shows a **dirty** highlight
  when the form differs from the saved state.
- **Reset to defaults:** reseed form fields from `pluginConfig`, then
  `saveSettings({ ...getSettings(), button: undefined })` → `reloadOpenProfiles()`.
- **URL validation:** non-blocking warning shown when `urlTemplate` lacks `{steamId64}`.
  Save is still allowed (per decision).
- **Live preview:** a static (resting-state) `.sb-btn` render — `brandColor` applied to the
  accent span and the icon, `iconSvg` injected via `dangerouslySetInnerHTML`, showing
  `label` + accent span. Hover color is not animated in the preview (shown as a swatch).
- Color fields: a text input paired with a native `<input type="color">` swatch; editing
  either updates the field.

### 4. File organization

Extract the buffered editor into **`frontend/components/ButtonEditor.tsx`** (the form,
diff/save/reset logic, URL validation, and the live preview). `frontend/index.tsx` keeps
the injection wiring, the instant zone (badge, mode selector, openExternal toggle), and
renders `<ButtonEditor onSaved={reloadAndRedetect} />`. Keeps each file focused.

## Out of scope

- Editing `name` / `title` / `description` / `logPrefix` at runtime.
- Animated hover state in the live preview.
- Per-field reset (only a single global Reset to defaults).
- Import/export of config presets.

## Verification

No automated tests in this repo. Type-check both bundles:

```bash
npx tsc -p frontend/tsconfig.json --noEmit
npx tsc -p webkit/tsconfig.json --noEmit
```

Manual: build, open a profile, edit fields + Save → button updates after reload; Reset →
button returns to `pluginConfig` defaults; clearing `{steamId64}` shows the warning.
