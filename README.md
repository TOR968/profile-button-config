# Profile Button Config (Millennium)

A [Millennium](https://steambrew.app/) plugin that injects one or more **customizable** buttons into
Steam community profile pages. Each button links to a URL built from the viewed profile's
SteamID64 (e.g. `https://example.com/profile/{steamId64}`). Add, edit, reorder, and remove buttons
at runtime from the plugin's settings panel.

## Prerequisites

- **[Millennium](https://steambrew.app/)** installed and configured



## Example Setup

https://github.com/user-attachments/assets/72b1b1e6-4e08-4d17-aab5-2b9f87d2b99a

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

## Links

- [Millennium Framework](https://github.com/SteamClientHomebrew/Millennium)
- [Steam Client](https://store.steampowered.com/about/)

### Sponsor this project

- [Patreon](https://www.patreon.com/cw/TOR968)
