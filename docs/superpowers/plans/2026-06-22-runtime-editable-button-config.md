# Runtime-Editable Button Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the button's appearance/target fields (label, accent, brand colors, icon SVG, URL template) editable at runtime from the Millennium settings panel, layered as overrides on top of `pluginConfig` defaults.

**Architecture:** `config/plugin.config.ts` stays the source of defaults and exposes a pure `mergeButtonConfig(overrides)` merge helper. The settings store gains an optional `button` partial-override object; `getEffectiveConfig()` merges it over the defaults. Both injection paths (webkit direct, CDP serialized) read the effective config instead of `pluginConfig`. A new `ButtonEditor.tsx` component provides a buffered (explicit Save) editor with a live preview; the instant toggles (`openExternal`, `injectionMode`) are unchanged.

**Tech Stack:** TypeScript, React (via `@steambrew/client`), `@steambrew/webkit`, Millennium `millennium-ttc` build.

## Global Constraints

- **No type-checking in the build.** Verification gate for every task: `npx tsc -p frontend/tsconfig.json --noEmit` and, where webkit is touched, `npx tsc -p webkit/tsconfig.json --noEmit`. Both must report zero errors. There are no unit tests in this repo.
- **`frontend/inject.ts` must NOT import `frontend/services/settings.ts`** (which pulls in `@steambrew/client`). `inject.ts` is imported by the webkit bundle, which must stay free of `@steambrew/client`. Keep the merge helper (`mergeButtonConfig`) in `config/plugin.config.ts`, which has zero `@steambrew` imports.
- **Runtime-editable fields only:** `label`, `accent`, `brandColor`, `brandColorHover`, `iconSvg`, `urlTemplate`. Never make `name` / `title` / `description` / `logPrefix` runtime-editable — they are build-time manifest fields.
- **Do not touch** `backend/main.lua`, `plugin.json`, `package.json`, or `scripts/`. The existing `GetSettings` / `SaveSettings` RPCs and the generic `saveSettings()` (serializes the whole `PluginSettings`) already carry the new `button` field with no backend change.
- **Conventional commits** (`feat:` / `refactor:`). Commit after each task.

---

### Task 1: Config override layer + merge helper

**Files:**
- Modify: `config/plugin.config.ts`

**Interfaces:**
- Consumes: existing `PluginConfig` interface and `pluginConfig` object.
- Produces:
  - `type ButtonOverrides = Pick<PluginConfig, 'label' | 'accent' | 'brandColor' | 'brandColorHover' | 'iconSvg' | 'urlTemplate'>`
  - `const BUTTON_OVERRIDE_KEYS: (keyof ButtonOverrides)[]`
  - `function mergeButtonConfig(overrides?: Partial<ButtonOverrides>): PluginConfig`

- [ ] **Step 1: Add the override type, key list, and merge helper**

Append to `config/plugin.config.ts` (after the existing `pluginConfig` export, before or after `SELECTORS` — placement is free):

```ts
/** Subset of pluginConfig that can be overridden at runtime from the settings panel. */
export type ButtonOverrides = Pick<
	PluginConfig,
	'label' | 'accent' | 'brandColor' | 'brandColorHover' | 'iconSvg' | 'urlTemplate'
>;

export const BUTTON_OVERRIDE_KEYS: (keyof ButtonOverrides)[] = [
	'label',
	'accent',
	'brandColor',
	'brandColorHover',
	'iconSvg',
	'urlTemplate',
];

/**
 * Merge a partial runtime override on top of the static defaults.
 * Pure (no @steambrew imports) so both the webkit and frontend bundles can use it.
 * Only string-valued override keys are applied; everything else comes from pluginConfig.
 */
export function mergeButtonConfig(overrides?: Partial<ButtonOverrides>): PluginConfig {
	const out: PluginConfig = { ...pluginConfig };
	if (overrides) {
		for (const k of BUTTON_OVERRIDE_KEYS) {
			const v = overrides[k];
			if (typeof v === 'string') out[k] = v;
		}
	}
	return out;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: zero errors.

- [ ] **Step 3: Manual check**

Confirm `mergeButtonConfig(undefined)` returns a clone of `pluginConfig` (the `if (overrides)` guard is skipped) and `mergeButtonConfig({ label: 'X' })` returns defaults with only `label` replaced. Read the function once to confirm.

- [ ] **Step 4: Commit**

```bash
git add config/plugin.config.ts
git commit -m "feat: add ButtonOverrides type and mergeButtonConfig helper"
```

---

### Task 2: Settings store — `button` override field + `getEffectiveConfig`

**Files:**
- Modify: `frontend/services/settings.ts`

**Interfaces:**
- Consumes: `ButtonOverrides`, `mergeButtonConfig` from Task 1; existing `PluginConfig`, `pluginConfig`.
- Produces:
  - `PluginSettings` gains `button?: Partial<ButtonOverrides>`
  - `function getEffectiveConfig(): PluginConfig`

- [ ] **Step 1: Extend imports and the `PluginSettings` interface**

In `frontend/services/settings.ts`, change the config import (line 2) to also pull the new symbols, and add the `button` field:

```ts
import { pluginConfig, PluginConfig, ButtonOverrides, mergeButtonConfig } from '../../config/plugin.config';
```

```ts
export interface PluginSettings {
	openExternal: boolean;
	injectionMode: InjectionMode;
	button?: Partial<ButtonOverrides>;
}
```

`DEFAULT_SETTINGS` is left unchanged (no `button` key — absent means "use defaults"). The existing `initSettings()` merge `{ ...DEFAULT_SETTINGS, ...parsed }` already carries `parsed.button` through.

- [ ] **Step 2: Add `getEffectiveConfig`**

Add below `getSettings()`:

```ts
/** Static defaults with the saved runtime overrides merged on top. */
export function getEffectiveConfig(): PluginConfig {
	return mergeButtonConfig(cachedSettings.button);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: zero errors. (`PluginConfig` is now imported and used by the return type; if it was already imported, ensure no duplicate import.)

- [ ] **Step 4: Commit**

```bash
git add frontend/services/settings.ts
git commit -m "feat: add button override field and getEffectiveConfig to settings store"
```

---

### Task 3: CDP injection reads effective config (`buildInjectionCode` signature change)

**Files:**
- Modify: `frontend/inject.ts:93-94` (the `buildInjectionCode` export) and `frontend/inject.ts:1` (imports)
- Modify: `frontend/index.tsx` (the one `buildInjectionCode(...)` call site + imports)

**Interfaces:**
- Consumes: `getEffectiveConfig` (Task 2); existing `toInjectConfig`, `InjectConfig`.
- Produces: `buildInjectionCode(openExternal: boolean, injectConfig: InjectConfig): string` (new second parameter).

- [ ] **Step 1: Change `buildInjectionCode` to take the inject config as an argument**

In `frontend/inject.ts`, replace the final export (currently lines 93-94):

```ts
export const buildInjectionCode = (openExternal: boolean, injectConfig: InjectConfig) =>
	`(${injectMain.toString()})(${openExternal === false ? 'false' : 'true'}, 'cdp', ${JSON.stringify(injectConfig)})`;
```

- [ ] **Step 2: Drop the now-unused `pluginConfig` value import in `inject.ts`**

`buildInjectionCode` no longer references `pluginConfig`. Change the top import (line 1) from a value+type import to a **type-only** import, since `toInjectConfig`'s parameter still needs the `PluginConfig` type:

```ts
import { PluginConfig } from '../config/plugin.config';
```

(If `tsc` reports `PluginConfig` is unused — it is used in `toInjectConfig(c: PluginConfig)` — so it stays. Only the `pluginConfig` *value* is removed.)

- [ ] **Step 3: Update the CDP call site in `frontend/index.tsx`**

Add `getEffectiveConfig` to the settings import and `toInjectConfig` to the inject import:

```ts
import { buildInjectionCode, toInjectConfig } from './inject';
import { initSettings, getSettings, saveSettings, getEffectiveConfig, InjectionMode } from './services/settings';
```

In `injectIntoTarget` (currently `frontend/index.tsx:52-56`), pass the effective inject config:

```ts
const injectIntoTarget = (targetId: string) => {
	const { openExternal, injectionMode } = getSettings();
	if (injectionMode === 'webkit') return Promise.resolve(undefined);
	return evalInTarget(CDP, targetId, buildInjectionCode(openExternal, toInjectConfig(getEffectiveConfig())), { awaitPromise: true });
};
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: zero errors.

- [ ] **Step 5: Manual check**

Confirm `frontend/inject.ts` no longer imports the `pluginConfig` value anywhere (grep for `pluginConfig` in that file should only match the `PluginConfig` type). This is what keeps the webkit bundle free of a `pluginConfig`-via-`inject.ts` path; more importantly it confirms `inject.ts` still imports nothing from `services/settings.ts`.

- [ ] **Step 6: Commit**

```bash
git add frontend/inject.ts frontend/index.tsx
git commit -m "refactor: pass effective inject config into buildInjectionCode (CDP path)"
```

---

### Task 4: Webkit injection reads effective config

**Files:**
- Modify: `webkit/index.tsx`

**Interfaces:**
- Consumes: `mergeButtonConfig`, `ButtonOverrides` from Task 1; existing `injectMain`, `toInjectConfig`.
- Produces: nothing new (internal wiring).

- [ ] **Step 1: Import the pure merge helper and read the override**

In `webkit/index.tsx`, extend the config import (line 3) and the `readSettings` return type, then use the override. Full updated file:

```tsx
import { callable } from '@steambrew/webkit';
import { injectMain, toInjectConfig } from '../frontend/inject';
import { pluginConfig, ButtonOverrides, mergeButtonConfig } from '../config/plugin.config';

const PROFILE_URL_PATTERN = /steamcommunity\.com\/(id|profiles)\//;

const GetSettingsRpc = callable<[], string>('GetSettings');

async function readSettings(): Promise<{ openExternal: boolean; injectionMode: string; button?: Partial<ButtonOverrides> }> {
	const defaults = { openExternal: pluginConfig.openExternalDefault, injectionMode: 'auto' };
	try {
		const raw = await GetSettingsRpc();
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object') return { ...defaults, ...parsed };
		}
	} catch (e) {
		console.error(pluginConfig.logPrefix + ' webkit settings read failed:', e);
	}
	return defaults;
}

export default async function WebkitMain() {
	if (!PROFILE_URL_PATTERN.test(location.href)) return;
	const { openExternal, injectionMode, button } = await readSettings();
	if (injectionMode === 'cdp') return;
	injectMain(openExternal, 'webkit', toInjectConfig(mergeButtonConfig(button)));
}
```

- [ ] **Step 2: Type-check both projects**

Run: `npx tsc -p webkit/tsconfig.json --noEmit`
Expected: zero errors.
Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: zero errors (unchanged, sanity).

- [ ] **Step 3: Commit**

```bash
git add webkit/index.tsx
git commit -m "feat: webkit injection reads runtime button overrides"
```

---

### Task 5: `ButtonEditor` component (buffered editor + live preview)

**Files:**
- Create: `frontend/components/ButtonEditor.tsx`

**Interfaces:**
- Consumes: `pluginConfig`, `ButtonOverrides`, `BUTTON_OVERRIDE_KEYS` (Task 1); `getSettings`, `saveSettings`, `getEffectiveConfig` (Task 2).
- Produces: `export const ButtonEditor: (props: { onSaved: () => void }) => JSX.Element`

- [ ] **Step 1: Create the component file**

Create `frontend/components/ButtonEditor.tsx` with the full content below:

```tsx
import { useState, CSSProperties } from 'react';
import { pluginConfig, ButtonOverrides, BUTTON_OVERRIDE_KEYS } from '../../config/plugin.config';
import { getSettings, saveSettings, getEffectiveConfig } from '../services/settings';

const pickButton = (c: ButtonOverrides): ButtonOverrides => ({
	label: c.label,
	accent: c.accent,
	brandColor: c.brandColor,
	brandColorHover: c.brandColorHover,
	iconSvg: c.iconSvg,
	urlTemplate: c.urlTemplate,
});

/** Keys whose form value differs from the static default; undefined if none differ. */
const computeOverride = (form: ButtonOverrides): Partial<ButtonOverrides> | undefined => {
	const diff: Partial<ButtonOverrides> = {};
	for (const k of BUTTON_OVERRIDE_KEYS) {
		if (form[k] !== pluginConfig[k]) diff[k] = form[k];
	}
	return Object.keys(diff).length ? diff : undefined;
};

const sameForm = (a: ButtonOverrides, b: ButtonOverrides): boolean =>
	BUTTON_OVERRIDE_KEYS.every((k) => a[k] === b[k]);

const labelStyle: CSSProperties = {
	display: 'block',
	fontSize: '11px',
	textTransform: 'uppercase',
	letterSpacing: '.05em',
	color: '#8f98a0',
	margin: '12px 0 4px',
};

const inputStyle: CSSProperties = {
	width: '100%',
	boxSizing: 'border-box',
	padding: '8px 10px',
	borderRadius: '4px',
	border: '1px solid rgba(255,255,255,0.10)',
	background: 'rgba(0,0,0,0.25)',
	color: '#dfe3e8',
	fontSize: '13px',
	fontFamily: 'inherit',
};

const TextField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
	<div>
		<label style={labelStyle}>{label}</label>
		<input style={inputStyle} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
	</div>
);

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
	<div>
		<label style={labelStyle}>{label}</label>
		<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
			<input style={{ ...inputStyle, flex: 1 }} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
			<input
				type="color"
				value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
				onChange={(e) => onChange(e.currentTarget.value)}
				style={{ width: '36px', height: '34px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
			/>
		</div>
	</div>
);

const ButtonPreview = ({ form }: { form: ButtonOverrides }) => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="height:22px;width:auto">${form.iconSvg}</svg>`;
	const btn: CSSProperties = {
		display: 'flex',
		gap: '.5rem',
		width: '100%',
		height: '3rem',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: '20px',
		color: '#fff',
		fontWeight: 800,
		letterSpacing: '.04em',
		textTransform: 'uppercase',
		background: '#1a1a1a',
		borderRadius: '5px',
		boxSizing: 'border-box',
	};
	return (
		<div style={{ margin: '4px 0 8px' }}>
			<div style={btn}>
				<span style={{ display: 'flex', color: form.brandColor }} dangerouslySetInnerHTML={{ __html: svg }} />
				<span>{form.label}</span>
				<span style={{ color: form.brandColor }}>{form.accent}</span>
			</div>
		</div>
	);
};

export const ButtonEditor = ({ onSaved }: { onSaved: () => void }) => {
	const [form, setForm] = useState<ButtonOverrides>(() => pickButton(getEffectiveConfig()));
	const [savedForm, setSavedForm] = useState<ButtonOverrides>(form);

	const set = (k: keyof ButtonOverrides) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
	const dirty = !sameForm(form, savedForm);
	const urlValid = form.urlTemplate.includes('{steamId64}');

	const save = async () => {
		await saveSettings({ ...getSettings(), button: computeOverride(form) });
		setSavedForm(form);
		onSaved();
	};

	const reset = async () => {
		const defaults = pickButton(pluginConfig);
		setForm(defaults);
		setSavedForm(defaults);
		await saveSettings({ ...getSettings(), button: undefined });
		onSaved();
	};

	const actionBtn = (primary: boolean, enabled: boolean): CSSProperties => ({
		flex: 1,
		padding: '9px 0',
		borderRadius: '4px',
		border: 'none',
		cursor: enabled ? 'pointer' : 'default',
		fontWeight: 'bold',
		fontSize: '13px',
		opacity: enabled ? 1 : 0.45,
		background: primary ? pluginConfig.brandColor : 'rgba(255,255,255,0.08)',
		color: primary ? '#1a1a1a' : '#cfd3d8',
	});

	return (
		<div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
			<div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Button appearance</div>
			<div style={{ fontSize: '12px', lineHeight: '1.4', color: '#969696', marginBottom: '10px' }}>
				Customize the injected button. Changes apply after you press Save; open profiles reload automatically.
			</div>

			<ButtonPreview form={form} />

			<TextField label="Label" value={form.label} onChange={set('label')} />
			<TextField label="Accent" value={form.accent} onChange={set('accent')} />
			<TextField label="URL template" value={form.urlTemplate} onChange={set('urlTemplate')} />
			{!urlValid && (
				<div style={{ fontSize: '12px', color: '#e0a526', marginTop: '4px' }}>
					⚠ URL template should contain {'{steamId64}'} — without it every profile links to the same URL.
				</div>
			)}
			<ColorField label="Brand color" value={form.brandColor} onChange={set('brandColor')} />
			<ColorField label="Brand color (hover)" value={form.brandColorHover} onChange={set('brandColorHover')} />

			<label style={labelStyle}>Icon SVG (inner markup, 0 0 24 24, use currentColor)</label>
			<textarea
				style={{ ...inputStyle, minHeight: '72px', resize: 'vertical', fontFamily: 'monospace' }}
				value={form.iconSvg}
				onChange={(e) => set('iconSvg')(e.currentTarget.value)}
			/>

			<div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
				<button style={actionBtn(true, dirty)} disabled={!dirty} onClick={() => void save()}>
					{dirty ? 'Save' : 'Saved'}
				</button>
				<button style={actionBtn(false, true)} onClick={() => void reset()}>
					Reset to defaults
				</button>
			</div>
		</div>
	);
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: zero errors. (Note: `getEffectiveConfig()` returns `PluginConfig`, which is structurally assignable to the `ButtonOverrides` parameter of `pickButton` because it has all six keys.)

- [ ] **Step 3: Manual check**

Read through the component and confirm: (a) `computeOverride` returns `undefined` when the form equals defaults; (b) `save`/`reset` both call `onSaved()` after `saveSettings`; (c) the preview applies `form.brandColor` to both the icon span and the accent span. The file imports only from `config/plugin.config` and `services/settings` — no direct `@steambrew` import (it inherits React types via the frontend tsconfig like `index.tsx` does).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ButtonEditor.tsx
git commit -m "feat: add ButtonEditor component with live preview and save/reset"
```

---

### Task 6: Mount `ButtonEditor` in the settings panel

**Files:**
- Modify: `frontend/index.tsx` (the `Settings` component + import)

**Interfaces:**
- Consumes: `ButtonEditor` (Task 5); existing `reloadOpenProfiles`, `detectActiveInjector`, `setInjector`.
- Produces: nothing new.

- [ ] **Step 1: Import the component**

Add to the imports at the top of `frontend/index.tsx`:

```ts
import { ButtonEditor } from './components/ButtonEditor';
```

- [ ] **Step 2: Render `<ButtonEditor>` at the bottom of `Settings`**

In the `Settings` component, after the closing `</div>` of the "Open in external browser" description block and before the component's outer closing `</div>` (currently around `frontend/index.tsx:174-175`), insert:

```tsx
				<ButtonEditor
					onSaved={() => {
						void reloadOpenProfiles().then(() => detectActiveInjector().then(setInjector));
					}}
				/>
```

So the tail of `Settings`'s returned JSX reads:

```tsx
				<div style={{ fontSize: '12px', lineHeight: '1.4', color: '#969696' }}>
					Opens the link in your system browser instead of Steam's in-app browser. Useful when the target site is behind Cloudflare, which can block the in-app browser. Any open profile pages reload automatically when you change this.
				</div>

				<ButtonEditor
					onSaved={() => {
						void reloadOpenProfiles().then(() => detectActiveInjector().then(setInjector));
					}}
				/>
			</div>
		);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manual check**

Confirm `reloadOpenProfiles` and `setInjector` are in scope where `ButtonEditor` is rendered. `reloadOpenProfiles` is the module-level `let` (assigned in `setupCommunityInjection`); `setInjector` is the `Settings` component's own state setter — both reachable from the `Settings` JSX. The `onSaved` callback persists is already done inside `ButtonEditor`; this only reloads profiles and re-detects the badge.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.tsx
git commit -m "feat: mount ButtonEditor in the settings panel"
```

---

### Task 7: Full build + end-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check both bundles**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Run: `npx tsc -p webkit/tsconfig.json --noEmit`
Expected: zero errors from both.

- [ ] **Step 2: Production build**

Run: `bun run build`
Expected: build completes without error (this also runs `scripts/sync-manifest.ts`; manifest fields are unaffected because only override fields changed).

- [ ] **Step 3: Manual smoke (in Steam, if available)**

Open a community profile with the plugin loaded:
- Edit Label / Accent / colors / icon / URL → press **Save** → profile reloads → button reflects the new values.
- Press **Reset to defaults** → button returns to `pluginConfig` values; `settings.json` no longer has a `button` key (or it is absent/empty).
- Clear `{steamId64}` from the URL template → the amber warning appears; Save still works.
- Confirm the instant `openExternal` toggle and the injection-mode selector still save immediately (unchanged behavior).

- [ ] **Step 4: Commit (only if Step 2 produced tracked changes)**

If the build modified tracked files, commit them; otherwise skip. Do not commit `dist/` or other build artifacts if they are git-ignored.

```bash
git status   # inspect; commit only intended source changes
```

---

## Self-Review

**Spec coverage:**
- Editable fields (label, accent, brandColor, brandColorHover, iconSvg, urlTemplate) → Task 5 form; reach injection via Tasks 3 (CDP) & 4 (webkit). ✓
- `openExternal` stays instant → untouched; Task 6 adds editor below it. ✓
- Decision 1 (pluginConfig = defaults, store = override, `getEffectiveConfig`) → Tasks 1–2. ✓
- Decision 2 (injection reads store not static pluginConfig) → Tasks 3 (CDP) & 4 (webkit). ✓
- Decision 3 (panel inputs + color pickers + textarea + live preview) → Task 5. ✓
- Decision 4 (Reset to defaults) → Task 5 `reset()`. ✓
- Decision 5 (urlTemplate warning when no `{steamId64}`) → Task 5 `urlValid` warning, non-blocking. ✓
- Two-zone layout, explicit Save, instant toggles → Tasks 5–6. ✓
- Build-time fields untouched → Global Constraints + no manifest edits. ✓

**Placeholder scan:** No TBD/TODO; all code blocks are complete; the ButtonEditor is given in full.

**Type consistency:** `ButtonOverrides`, `BUTTON_OVERRIDE_KEYS`, `mergeButtonConfig` (Task 1) used verbatim in Tasks 2/4/5. `getEffectiveConfig(): PluginConfig` (Task 2) consumed in Tasks 3 & 5. `buildInjectionCode(openExternal, injectConfig)` (Task 3) — single call site updated in the same task. `ButtonEditor({ onSaved })` (Task 5) mounted with matching prop in Task 6. `pickButton`, `computeOverride`, `sameForm` are internal to Task 5 and self-consistent.
