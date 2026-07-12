import { callable } from '@steambrew/webkit';
import { injectMain } from './inject';
import { pluginConfig, ButtonConfig, effectiveButtons } from '../config/plugin.config';

const PROFILE_URL_PATTERN = /steamcommunity\.com\/(id|profiles)\//;

const GetSettingsRpc = callable<[], string>('GetSettings');

async function readButtons(): Promise<ButtonConfig[]> {
	try {
		const raw = await GetSettingsRpc();
		if (raw) return effectiveButtons(JSON.parse(raw));
	} catch (e) {
		console.error(pluginConfig.logPrefix + ' webkit settings read failed:', e);
	}
	return effectiveButtons(null);
}

export default async function WebkitMain() {
	if (!PROFILE_URL_PATTERN.test(location.href)) return;

	let applied = '';
	let running = false;

	const apply = async () => {
		if (running) return;
		running = true;
		try {
			const buttons = await readButtons();
			const serialized = JSON.stringify(buttons);
			if (serialized === applied) return;
			await injectMain(buttons, pluginConfig.logPrefix);
			applied = serialized;
		} finally {
			running = false;
		}
	};

	await apply();

	const refresh = () => {
		if (document.visibilityState === 'visible') void apply();
	};
	document.addEventListener('visibilitychange', refresh);
	window.addEventListener('focus', refresh);
}
