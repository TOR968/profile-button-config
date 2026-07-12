import { useState, CSSProperties } from 'react';
import { DialogBodyText, DialogButton, DialogSubHeader, Dropdown, Field, TextField, ToggleField } from '@steambrew/client';
import { pluginConfig, ButtonConfig, BUTTON_KEYS, newButton } from '../../config/plugin.config';
import { getEffectiveButtons, saveSettings } from '../services/settings';

const cloneList = (list: ButtonConfig[]): ButtonConfig[] => list.map((b) => ({ ...b }));
const serialize = (list: ButtonConfig[]): string => JSON.stringify(list.map((b) => BUTTON_KEYS.map((k) => b[k])));

const ButtonPreview = ({ button }: { button: ButtonConfig }) => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="height:22px;width:auto">${button.iconSvg}</svg>`;
	const btn: CSSProperties = {
		display: 'flex',
		gap: '.5rem',
		width: '100%',
		height: '3rem',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: '20px',
		color: '#fff',
		fontWeight: 800,
		letterSpacing: '.04em',
		textTransform: 'uppercase',
		background: '#1a1a1a',
		borderRadius: '5px',
		boxSizing: 'border-box',
	};
	return (
		<div style={{ margin: '4px 0 8px' }}>
			<div style={btn}>
				<span style={{ display: 'flex', color: button.brandColor }} dangerouslySetInnerHTML={{ __html: svg }} />
				<span>{button.label}</span>
				<span style={{ color: button.brandColor }}>{button.accent}</span>
			</div>
		</div>
	);
};

export const ButtonEditor = () => {
	const [buttons, setButtons] = useState<ButtonConfig[]>(() => cloneList(getEffectiveButtons()));
	const [savedButtons, setSavedButtons] = useState<ButtonConfig[]>(buttons);
	const [selectedId, setSelectedId] = useState<string>(() => buttons[0]?.id ?? '');

	const index = buttons.findIndex((b) => b.id === selectedId);
	const selected = index >= 0 ? buttons[index] : buttons[0];
	const dirty = serialize(buttons) !== serialize(savedButtons);
	const atDefaults = serialize(buttons) === serialize(pluginConfig.buttons);
	const urlValid = !selected || selected.urlTemplate.includes('{steamId64}');

	const patch = (key: keyof ButtonConfig, value: string | boolean) =>
		setButtons((list) => list.map((b) => (b.id === selected!.id ? { ...b, [key]: value } : b)));

	const setText = (key: keyof ButtonConfig) => (e: React.ChangeEvent<HTMLInputElement>) => patch(key, e.target.value);

	const add = () => {
		const b = newButton();
		setButtons((list) => [...list, b]);
		setSelectedId(b.id);
	};

	const del = () => {
		if (!selected) return;
		const i = buttons.findIndex((b) => b.id === selected.id);
		const next = buttons.filter((b) => b.id !== selected.id);
		setButtons(next);
		setSelectedId(next[Math.max(0, i - 1)]?.id ?? '');
	};

	const move = (dir: -1 | 1) => {
		const i = buttons.findIndex((b) => b.id === selected?.id);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= buttons.length) return;
		const next = buttons.slice();
		[next[i], next[j]] = [next[j], next[i]];
		setButtons(next);
	};

	const save = async () => {
		await saveSettings({ buttons });
		setSavedButtons(cloneList(buttons));
	};

	const resetAll = async () => {
		const defaults = cloneList(pluginConfig.buttons);
		setButtons(defaults);
		setSelectedId(defaults[0]?.id ?? '');
		await saveSettings({});
		setSavedButtons(cloneList(defaults));
	};

	const options = buttons.map((b, i) => ({ data: b.id, label: b.label || `Button ${i + 1}` }));

	return (
		<>
			<DialogSubHeader>Profile buttons</DialogSubHeader>
			<DialogBodyText>
				Add one or more buttons to inject into Steam profile pages. Press Save to apply; open profile pages update
				themselves when you switch back to them.
			</DialogBodyText>

			<Field label="Edit button" childrenLayout="inline">
				<Dropdown
					rgOptions={options}
					selectedOption={selected?.id ?? ''}
					strDefaultLabel="No buttons"
					disabled={buttons.length === 0}
					onChange={(opt) => setSelectedId(opt.data)}
				/>
			</Field>
			<DialogButton onClick={add}>Add button</DialogButton>

			{selected && (
				<>
					<ButtonPreview button={selected} />

					<TextField label="Label" value={selected.label} onChange={setText('label')} />
					<TextField label="Accent" value={selected.accent} onChange={setText('accent')} />
					<TextField
						label="URL template"
						description={urlValid ? undefined : 'URL template should contain {steamId64} — without it every profile links to the same URL.'}
						value={selected.urlTemplate}
						onChange={setText('urlTemplate')}
					/>
					<TextField label="Brand color" value={selected.brandColor} onChange={setText('brandColor')} />
					<TextField label="Brand color (hover)" value={selected.brandColorHover} onChange={setText('brandColorHover')} />
					<TextField
						label="Icon SVG"
						description="Inner markup of a 0 0 24 24 SVG; use currentColor so brand colors apply."
						value={selected.iconSvg}
						onChange={setText('iconSvg')}
					/>
					<ToggleField
						label="Open in external browser"
						checked={selected.openExternal}
						onChange={(checked: boolean) => patch('openExternal', checked)}
					/>

					<DialogButton disabled={index <= 0} onClick={() => move(-1)}>Move up</DialogButton>
					<DialogButton disabled={index < 0 || index >= buttons.length - 1} onClick={() => move(1)}>Move down</DialogButton>
					<DialogButton onClick={del}>Delete button</DialogButton>
				</>
			)}

			<DialogButton disabled={!dirty} onClick={() => void save()}>
				{dirty ? 'Save' : 'Saved'}
			</DialogButton>
			<DialogButton disabled={atDefaults} onClick={() => void resetAll()}>Reset to defaults</DialogButton>
		</>
	);
};
