export interface PluginConfig {
	name: string;
	title: string;
	description: string;
	logPrefix: string;

	label: string;
	accent: string;
	brandColor: string;
	brandColorHover: string;
	iconSvg: string;

	urlTemplate: string;
	openExternalDefault: boolean;
}

export const pluginConfig: PluginConfig = {
	name: 'steam-button-template',
	title: 'Steam Button Template',
	description: 'A Millennium plugin that adds a button to Steam community profile pages.',
	logPrefix: '[SteamButton]',

	label: 'EXAMPLE',
	accent: '.IO',
	brandColor: '#4f9dde',
	brandColorHover: '#7bb8e8',
	iconSvg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',

	urlTemplate: 'https://example.com/profile/{steamId64}',
	openExternalDefault: true,
};

export const SELECTORS = {
	container: 'steam-button-container',
	styleId: 'steam-button-style',
	injectorAttr: 'data-steam-button-injector',
	button: 'sb-btn',
	accent: 'sb-accent',
} as const;

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
