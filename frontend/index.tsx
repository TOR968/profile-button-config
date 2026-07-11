import { useState } from 'react';
import { definePlugin, ToggleField } from '@steambrew/client';
import { initSettings, getSettings, saveSettings } from './services/settings';
import { pluginConfig } from '../config/plugin.config';
import { ButtonEditor } from './components/ButtonEditor';

const PluginIcon = () => (
	<svg
		style={{ height: '1em', color: pluginConfig.brandColor }}
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		dangerouslySetInnerHTML={{ __html: pluginConfig.iconSvg }}
	/>
);

const Settings = () => {
	const [openExternal, setOpenExternal] = useState<boolean>(getSettings().openExternal);

	const onToggle = (checked: boolean) => {
		setOpenExternal(checked);
		void saveSettings({ ...getSettings(), openExternal: checked });
	};

	return (
		<>
			<ToggleField
				label="Open in external browser"
				description="Opens the link in your system browser instead of Steam's in-app browser. Useful when the target site is behind Cloudflare, which can block the in-app browser. Reopen profile pages to apply changes."
				checked={openExternal}
				onChange={onToggle}
			/>
			<ButtonEditor />
		</>
	);
};

export default definePlugin(async () => {
	await initSettings();
	return { name: pluginConfig.name, title: pluginConfig.title, icon: <PluginIcon />, content: <Settings /> };
});
