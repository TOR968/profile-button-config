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
