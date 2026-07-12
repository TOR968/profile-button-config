export interface ButtonConfig {
	id: string;
	label: string;
	accent: string;
	brandColor: string;
	brandColorHover: string;
	iconSvg: string;
	urlTemplate: string;
	openExternal: boolean;
}

export interface PluginConfig {
	name: string;
	title: string;
	description: string;
	logPrefix: string;

	buttons: ButtonConfig[];
}

export const pluginConfig: PluginConfig = {
	name: 'profile-button-config',
	title: 'Profile Button Config',
	description: 'A Millennium plugin that adds buttons to Steam community profile pages.',
	logPrefix: '[ProfileButton]',

	buttons: [
		{
			id: 'example',
			label: 'EXAMPLE',
			accent: '.IO',
			brandColor: '#4f9dde',
			brandColorHover: '#7bb8e8',
			iconSvg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
			urlTemplate: 'https://example.com/profile/{steamId64}',
			openExternal: true,
		},
	],
};

const BUTTON_KEYS: (keyof ButtonConfig)[] = [
	'id',
	'label',
	'accent',
	'brandColor',
	'brandColorHover',
	'iconSvg',
	'urlTemplate',
	'openExternal',
];

function isButton(v: any): v is ButtonConfig {
	if (!v || typeof v !== 'object') return false;
	return (
		typeof v.label === 'string' &&
		typeof v.accent === 'string' &&
		typeof v.brandColor === 'string' &&
		typeof v.brandColorHover === 'string' &&
		typeof v.iconSvg === 'string' &&
		typeof v.urlTemplate === 'string'
	);
}

function normalizeButton(v: any, index: number): ButtonConfig {
	const base = pluginConfig.buttons[0];
	return {
		id: typeof v.id === 'string' && v.id ? v.id : 'button-' + index,
		label: v.label,
		accent: v.accent,
		brandColor: v.brandColor,
		brandColorHover: v.brandColorHover,
		iconSvg: v.iconSvg,
		urlTemplate: v.urlTemplate,
		openExternal: typeof v.openExternal === 'boolean' ? v.openExternal : base.openExternal,
	};
}

export function effectiveButtons(parsed: any): ButtonConfig[] {
	if (parsed && typeof parsed === 'object') {
		if (Array.isArray(parsed.buttons)) {
			return parsed.buttons.filter(isButton).map(normalizeButton);
		} else if ('button' in parsed || 'openExternal' in parsed) {
			const base = pluginConfig.buttons[0];
			const override = parsed.button && typeof parsed.button === 'object' ? parsed.button : {};
			const legacy = {
				...base,
				...override,
				id: base.id,
				openExternal: typeof parsed.openExternal === 'boolean' ? parsed.openExternal : base.openExternal,
			};
			return [normalizeButton(legacy, 0)];
		}
	}
	return pluginConfig.buttons.map((b) => ({ ...b }));
}

export function newButton(): ButtonConfig {
	const base = pluginConfig.buttons[0];
	return {
		...base,
		id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'button-' + Date.now(),
		label: 'NEW',
	};
}

export { BUTTON_KEYS };
