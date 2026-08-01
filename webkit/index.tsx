import { callable } from '@steambrew/webkit';
import { injectMain } from './inject';
import { pluginConfig, ButtonConfig, effectiveButtons } from '../config/plugin.config';

const PROFILE_HOST_PATTERN = /(^|\.)steamcommunity\.com$/;
const PROFILE_PATH_PATTERN = /^\/(id|profiles)\//;

const REFRESH_HANDLER_KEY = '__profileButtonConfigRefresh';

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
	if (!PROFILE_HOST_PATTERN.test(location.hostname)) return;
	if (!PROFILE_PATH_PATTERN.test(location.pathname)) return;

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

	const scope = window as any;
	if (scope[REFRESH_HANDLER_KEY]) {
		document.removeEventListener('visibilitychange', scope[REFRESH_HANDLER_KEY]);
		window.removeEventListener('focus', scope[REFRESH_HANDLER_KEY]);
	}
	scope[REFRESH_HANDLER_KEY] = refresh;
	document.addEventListener('visibilitychange', refresh);
	window.addEventListener('focus', refresh);
}
