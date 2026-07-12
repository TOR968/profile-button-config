import { callable } from '@steambrew/client';
import { pluginConfig, ButtonConfig, effectiveButtons } from '../../config/plugin.config';

export interface PluginSettings {
	buttons?: ButtonConfig[];
}

const GetSettingsRpc = callable<[], string>('GetSettings');
const SaveSettingsRpc = callable<[{ settings_json: string }], string>('SaveSettings');

let cachedSettings: PluginSettings = {};

export async function initSettings(): Promise<void> {
	try {
		const raw = await GetSettingsRpc();
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') {
			cachedSettings = { buttons: effectiveButtons(parsed) };
		}
	} catch (e) {
		console.error(pluginConfig.logPrefix + ' Failed to load settings:', e);
	}
}

export function getSettings(): PluginSettings {
	return cachedSettings;
}

export function getEffectiveButtons(): ButtonConfig[] {
	return effectiveButtons(cachedSettings);
}

export async function saveSettings(settings: PluginSettings): Promise<void> {
	const previous = cachedSettings;
	cachedSettings = settings;
	try {
		const res = await SaveSettingsRpc({ settings_json: JSON.stringify(settings) });
		if (res === '0') {
			console.error(pluginConfig.logPrefix + ' Backend failed to save settings');
			cachedSettings = previous;
		}
	} catch (e) {
		console.error(pluginConfig.logPrefix + ' Failed to save settings:', e);
		cachedSettings = previous;
	}
}
