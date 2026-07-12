import { definePlugin } from '@steambrew/client';
import { initSettings } from './services/settings';
import { pluginConfig } from '../config/plugin.config';
import { ButtonEditor } from './components/ButtonEditor';

const PluginIcon = () => {
	const first = pluginConfig.buttons[0];
	return (
		<svg
			style={{ height: '1em', color: first?.brandColor }}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			dangerouslySetInnerHTML={{ __html: first?.iconSvg ?? '' }}
		/>
	);
};

export default definePlugin(async () => {
	await initSettings();
	return { name: pluginConfig.name, title: pluginConfig.title, icon: <PluginIcon />, content: <ButtonEditor /> };
});
