#!/usr/bin/env tsx

/// <reference types="node" />

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pluginConfig } from '../config/plugin.config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function syncManifest(): void {
	const pluginPath = join(rootDir, 'plugin.json');
	const pluginJson = JSON.parse(readFileSync(pluginPath, 'utf8'));
	pluginJson.name = pluginConfig.name;
	pluginJson.common_name = pluginConfig.title;
	pluginJson.description = pluginConfig.description;
	writeFileSync(pluginPath, JSON.stringify(pluginJson, null, '\t') + '\n');
	console.log(`✓ Synced plugin.json from config (${pluginConfig.name})`);

	const packagePath = join(rootDir, 'package.json');
	const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
	packageJson.name = pluginConfig.name;
	packageJson.description = pluginConfig.description;
	writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
	console.log(`✓ Synced package.json from config (${pluginConfig.name})`);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
	syncManifest();
}
