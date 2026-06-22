# Steam Button Template (Millennium)

A template for [Millennium](https://steambrew.app/) plugins that inject a single button into
Steam community profile pages. The button links to a URL built from the viewed profile's
SteamID64 (e.g. `https://example.com/profile/{steamId64}`).

Everything that makes a button unique — its text, color, icon, target URL, and the plugin's
name — lives in **one file**: [config/plugin.config.ts](config/plugin.config.ts). Edit that file,
build, and you have a new plugin.

## Make your own button

Open [config/plugin.config.ts](config/plugin.config.ts) and edit:

```ts
export const pluginConfig: PluginConfig = {
	name: 'steam-button-template',        // plugin id (folder-safe, lowercase-dashes)
	title: 'Steam Button Template',       // display name in the plugin manager
	description: '...',                   // plugin manager description
	logPrefix: '[SteamButton]',           // console log prefix

	label: 'EXAMPLE',                     // main button text
	accent: '.IO',                        // colored suffix (optional, can be '')
	brandColor: '#4f9dde',                // accent + icon color
	brandColorHover: '#7bb8e8',           // accent + icon color on hover
	iconSvg: '<circle .../>...',          // inner SVG markup, drawn in a 0 0 24 24 viewBox

	urlTemplate: 'https://example.com/profile/{steamId64}',  // {steamId64} is replaced
	openExternalDefault: true,            // open in system browser by default
};
```

`name`, `title`, and `description` are pushed into `plugin.json` and `package.json`
automatically by `scripts/sync-manifest.ts`, which runs before every build. The config is the
single source of truth.

## Prerequisites

- **[Millennium](https://steambrew.app/)** installed and configured

## Build & install

```bash
bun install      # install dependencies
bun run build    # production build  (or `bun run dev` for a one-shot dev build)
```

Then copy the plugin into the Millennium plugins directory (folder name = your `name`):

```bash
# Windows
xcopy /E /I . "C:\Program Files (x86)\Steam\millennium\plugins\steam-button-template"

# Linux
cp -r . ~/.local/share/millennium/plugins/steam-button-template

# macOS
cp -r . ~/Library/Application\ Support/millennium/plugins/steam-button-template
```

Restart Steam, enable the plugin under **Millennium → Plugins**, and restart once more.

## Development

```bash
bun run dev      # one-shot dev build
bun run watch    # rebuild on changes to frontend / webkit / config
bun run build    # production build
```

There are no automated tests. The build does no type checking — run these separately:

```bash
npx tsc -p frontend/tsconfig.json --noEmit
npx tsc -p webkit/tsconfig.json --noEmit
```

## How it works

The button is injected by two paths that share the same vanilla-DOM function
(`injectMain` in [frontend/inject.ts](frontend/inject.ts)):

- **webkit** (primary) — the webkit bundle runs inside the community browser and injects directly.
- **CDP** (fallback) — the frontend reaches the community browser over the Chrome DevTools
  Protocol and evaluates the stringified function, for Millennium versions where webkit doesn't
  reach it.

Both paths read settings from a small Lua backend ([backend/main.lua](backend/main.lua)) and
de-dup against each other, so only one button ever appears. See
[CLAUDE.md](CLAUDE.md) for the full architecture.

## Links

- [Millennium Framework](https://github.com/SteamClientHomebrew/Millennium)
- [Steam Client](https://store.steampowered.com/about/)
