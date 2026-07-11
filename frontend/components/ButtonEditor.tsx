import { useState, CSSProperties } from 'react';
import { DialogBodyText, DialogButton, DialogSubHeader, TextField } from '@steambrew/client';
import { pluginConfig, ButtonOverrides, BUTTON_OVERRIDE_KEYS } from '../../config/plugin.config';
import { getSettings, saveSettings, getEffectiveConfig } from '../services/settings';

const pickButton = (c: ButtonOverrides): ButtonOverrides => ({
	label: c.label,
	accent: c.accent,
	brandColor: c.brandColor,
	brandColorHover: c.brandColorHover,
	iconSvg: c.iconSvg,
	urlTemplate: c.urlTemplate,
});

const computeOverride = (form: ButtonOverrides): Partial<ButtonOverrides> | undefined => {
	const diff: Partial<ButtonOverrides> = {};
	for (const k of BUTTON_OVERRIDE_KEYS) {
		if (form[k] !== pluginConfig[k]) diff[k] = form[k];
	}
	return Object.keys(diff).length ? diff : undefined;
};

const sameForm = (a: ButtonOverrides, b: ButtonOverrides): boolean =>
	BUTTON_OVERRIDE_KEYS.every((k) => a[k] === b[k]);

const ButtonPreview = ({ form }: { form: ButtonOverrides }) => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="height:22px;width:auto">${form.iconSvg}</svg>`;
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
				<span style={{ display: 'flex', color: form.brandColor }} dangerouslySetInnerHTML={{ __html: svg }} />
				<span>{form.label}</span>
				<span style={{ color: form.brandColor }}>{form.accent}</span>
			</div>
		</div>
	);
};

export const ButtonEditor = () => {
	const [form, setForm] = useState<ButtonOverrides>(() => pickButton(getEffectiveConfig()));
	const [savedForm, setSavedForm] = useState<ButtonOverrides>(form);

	const set = (k: keyof ButtonOverrides) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm((f) => ({ ...f, [k]: e.target.value }));
	const dirty = !sameForm(form, savedForm);
	const urlValid = form.urlTemplate.includes('{steamId64}');

	const save = async () => {
		await saveSettings({ ...getSettings(), button: computeOverride(form) });
		setSavedForm(form);
	};

	const reset = async () => {
		const defaults = pickButton(pluginConfig);
		setForm(defaults);
		await saveSettings({ ...getSettings(), button: undefined });
		setSavedForm(defaults);
	};

	return (
		<>
			<DialogSubHeader>Button appearance</DialogSubHeader>
			<DialogBodyText>
				Customize the injected button. Changes apply after you press Save; reopen profile pages to see them.
			</DialogBodyText>

			<ButtonPreview form={form} />

			<TextField label="Label" value={form.label} onChange={set('label')} />
			<TextField label="Accent" value={form.accent} onChange={set('accent')} />
			<TextField
				label="URL template"
				description={urlValid ? undefined : 'URL template should contain {steamId64} — without it every profile links to the same URL.'}
				value={form.urlTemplate}
				onChange={set('urlTemplate')}
			/>
			<TextField label="Brand color" value={form.brandColor} onChange={set('brandColor')} />
			<TextField label="Brand color (hover)" value={form.brandColorHover} onChange={set('brandColorHover')} />
			<TextField
				label="Icon SVG"
				description="Inner markup of a 0 0 24 24 SVG; use currentColor so brand colors apply."
				value={form.iconSvg}
				onChange={set('iconSvg')}
			/>

			<DialogButton disabled={!dirty} onClick={() => void save()}>
				{dirty ? 'Save' : 'Saved'}
			</DialogButton>
			<DialogButton onClick={() => void reset()}>Reset to defaults</DialogButton>
		</>
	);
};
