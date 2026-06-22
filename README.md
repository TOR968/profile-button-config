# Profile Button Config (Millennium)

A template for [Millennium](https://steambrew.app/) plugins that inject a single button into
Steam community profile pages. The button links to a URL built from the viewed profile's
SteamID64 (e.g. `https://example.com/profile/{steamId64}`).

## Prerequisites

- **[Millennium](https://steambrew.app/)** installed and configured



## Example Setup

<video controls width="100%" style="max-width: 640px; border-radius: 8px;">
  <source src="https://github.com/user-attachments/assets/62aa7a83-a718-478d-8fe9-ca5d7a83f94e" type="video/mp4">
  Your browser does not support the video tag.
</video>







# 🚀 Installation Guide

## Method 1: Millennium Plugin Installer (Recommended)

1. **Copy Plugin ID**

    Copy the following Plugin ID

2. **Install via Millennium**
    - Open Steam with Millennium installed
    - Go to **Millennium** → **Plugins**
    - Click on the **Install a plugin**
    - Paste the Plugin ID into the installer
    - Click **Install**
    - Restart Steam when prompted


## Method 2: Build from Source

## Build & install

```bash
bun install      # install dependencies
bun run build    # production build  (or `bun run dev` for a one-shot dev build)
```

Then copy the plugin into the Millennium plugins directory (folder name = your `name`):

```bash
# Windows
xcopy /E /I . "C:\Program Files (x86)\Steam\millennium\plugins\profile-button-config"

# Linux
cp -r . ~/.local/share/millennium/plugins/profile-button-config

# macOS
cp -r . ~/Library/Application\ Support/millennium/plugins/profile-button-config
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
de-dup against each other, so only one button ever appears.

## Links

- [Millennium Framework](https://github.com/SteamClientHomebrew/Millennium)
- [Steam Client](https://store.steampowered.com/about/)
