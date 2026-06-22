import { useState, CSSProperties } from 'react';
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

/** Keys whose form value differs from the static default; undefined if none differ. */
const computeOverride = (form: ButtonOverrides): Partial<ButtonOverrides> | undefined => {
	const diff: Partial<ButtonOverrides> = {};
	for (const k of BUTTON_OVERRIDE_KEYS) {
		if (form[k] !== pluginConfig[k]) diff[k] = form[k];
	}
	return Object.keys(diff).length ? diff : undefined;
};

const sameForm = (a: ButtonOverrides, b: ButtonOverrides): boolean =>
	BUTTON_OVERRIDE_KEYS.every((k) => a[k] === b[k]);

const labelStyle: CSSProperties = {
	display: 'block',
	fontSize: '11px',
	textTransform: 'uppercase',
	letterSpacing: '.05em',
	color: '#8f98a0',
	margin: '12px 0 4px',
};

const inputStyle: CSSProperties = {
	width: '100%',
	boxSizing: 'border-box',
	padding: '8px 10px',
	borderRadius: '4px',
	border: '1px solid rgba(255,255,255,0.10)',
	background: 'rgba(0,0,0,0.25)',
	color: '#dfe3e8',
	fontSize: '13px',
	fontFamily: 'inherit',
};

const TextField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
	<div>
		<label style={labelStyle}>{label}</label>
		<input style={inputStyle} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
	</div>
);

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
	<div>
		<label style={labelStyle}>{label}</label>
		<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
			<input style={{ ...inputStyle, flex: 1 }} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
			<input
				type="color"
				value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
				onChange={(e) => onChange(e.currentTarget.value)}
				style={{ width: '36px', height: '34px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
			/>
		</div>
	</div>
);

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

export const ButtonEditor = ({ onSaved }: { onSaved: () => void }) => {
	const [form, setForm] = useState<ButtonOverrides>(() => pickButton(getEffectiveConfig()));
	const [savedForm, setSavedForm] = useState<ButtonOverrides>(form);

	const set = (k: keyof ButtonOverrides) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
	const dirty = !sameForm(form, savedForm);
	const urlValid = form.urlTemplate.includes('{steamId64}');

	const save = async () => {
		await saveSettings({ ...getSettings(), button: computeOverride(form) });
		setSavedForm(form);
		onSaved();
	};

	const reset = async () => {
		const defaults = pickButton(pluginConfig);
		setForm(defaults);
		setSavedForm(defaults);
		await saveSettings({ ...getSettings(), button: undefined });
		onSaved();
	};

	const actionBtn = (primary: boolean, enabled: boolean): CSSProperties => ({
		flex: 1,
		padding: '9px 0',
		borderRadius: '4px',
		border: 'none',
		cursor: enabled ? 'pointer' : 'default',
		fontWeight: 'bold',
		fontSize: '13px',
		opacity: enabled ? 1 : 0.45,
		background: primary ? pluginConfig.brandColor : 'rgba(255,255,255,0.08)',
		color: primary ? '#1a1a1a' : '#cfd3d8',
	});

	return (
		<div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
			<div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Button appearance</div>
			<div style={{ fontSize: '12px', lineHeight: '1.4', color: '#969696', marginBottom: '10px' }}>
				Customize the injected button. Changes apply after you press Save; open profiles reload automatically.
			</div>

			<ButtonPreview form={form} />

			<TextField label="Label" value={form.label} onChange={set('label')} />
			<TextField label="Accent" value={form.accent} onChange={set('accent')} />
			<TextField label="URL template" value={form.urlTemplate} onChange={set('urlTemplate')} />
			{!urlValid && (
				<div style={{ fontSize: '12px', color: '#e0a526', marginTop: '4px' }}>
					⚠ URL template should contain {'{steamId64}'} — without it every profile links to the same URL.
				</div>
			)}
			<ColorField label="Brand color" value={form.brandColor} onChange={set('brandColor')} />
			<ColorField label="Brand color (hover)" value={form.brandColorHover} onChange={set('brandColorHover')} />

			<label style={labelStyle}>Icon SVG (inner markup, 0 0 24 24, use currentColor)</label>
			<textarea
				style={{ ...inputStyle, minHeight: '72px', resize: 'vertical', fontFamily: 'monospace' }}
				value={form.iconSvg}
				onChange={(e) => set('iconSvg')(e.currentTarget.value)}
			/>

			<div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
				<button style={actionBtn(true, dirty)} disabled={!dirty} onClick={() => void save()}>
					{dirty ? 'Save' : 'Saved'}
				</button>
				<button style={actionBtn(false, true)} onClick={() => void reset()}>
					Reset to defaults
				</button>
			</div>
		</div>
	);
};
