import { ButtonConfig } from '../config/plugin.config';
import { buildIconSvg, safeTargetUrl } from '../config/sanitize';

const STEAMID64_BASE = BigInt('76561197960265728');
const STEAMID64_PATTERN = /^\d{17}$/;
const PROFILE_HOST_PATTERN = /(^|\.)steamcommunity\.com$/;
const PROFILE_PATH_PATTERN = /^\/(id|profiles)\//;

let steamId: string | null = null;
let container: HTMLDivElement | null = null;
let logPrefix = '';

function asSteamId64(value: unknown): string | null {
	const id = typeof value === 'string' ? value.trim() : '';
	return STEAMID64_PATTERN.test(id) ? id : null;
}

async function getSteamId() {
	const win = window as any;
	const candidates = [win.g_rgProfileData?.steamid64, win.g_rgProfileData?.steamid];
	for (const v of candidates) {
		const id = asSteamId64(v);
		if (id) return id;
	}
	const miniId = document.querySelector('[data-miniprofile]')?.getAttribute('data-miniprofile');
	if (miniId && /^\d+$/.test(miniId) && miniId !== '0') {
		try {
			const id = asSteamId64((STEAMID64_BASE + BigInt(miniId)).toString());
			if (id) return id;
		} catch { }
	}
	try {
		const xmlUrl = location.href.replace(/[?#].*/, '').replace(/\/$/, '') + '/?xml=1';
		const res = await fetch(xmlUrl);
		const text = await res.text();
		const dom = new DOMParser().parseFromString(text, 'application/xml');
		return asSteamId64(dom.querySelector('steamID64')?.textContent);
	} catch { }
	return null;
}

function ensureStyle() {
	if (document.getElementById('steam-button-style')) return;
	const s = document.createElement('style');
	s.id = 'steam-button-style';
	s.textContent = ".sb-btn{display:flex;gap:.5rem;width:100%;height:3rem;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:800;letter-spacing:.04em;font-family:'Motiva Sans',Arial,sans-serif;transition:all .3s cubic-bezier(.23,1,.32,1);text-transform:uppercase;background-color:#1a1a1a;border-radius:5px;cursor:pointer;text-decoration:none;border:none;outline:none;margin:10px 0}.sb-btn:hover{background-color:#2d3748;text-decoration:none!important}.sb-btn .sb-accent{color:var(--sb-brand);transition:color .3s cubic-bezier(.23,1,.32,1)}.sb-btn:hover .sb-accent{color:var(--sb-brand-hover)}.sb-btn svg{height:22px;width:auto;color:var(--sb-brand);transition:color .3s cubic-bezier(.23,1,.32,1)}.sb-btn:hover svg{color:var(--sb-brand-hover)}";
	document.head?.appendChild(s);
}

function buildButton(button: ButtonConfig, id: string): HTMLAnchorElement | null {
	const targetUrl = safeTargetUrl(button.urlTemplate, id);
	if (!targetUrl) {
		console.warn(logPrefix + ' Skipped button with unsupported URL template: ' + button.urlTemplate);
		return null;
	}
	const a = document.createElement('a');
	a.href = button.openExternal ? 'steam://openurl_external/' + targetUrl : targetUrl;
	a.className = 'sb-btn';
	a.style.setProperty('--sb-brand', button.brandColor);
	a.style.setProperty('--sb-brand-hover', button.brandColorHover);
	a.appendChild(buildIconSvg(button.iconSvg));
	a.appendChild(document.createTextNode(button.label));
	const accent = document.createElement('span');
	accent.className = 'sb-accent';
	accent.textContent = button.accent;
	a.appendChild(accent);
	return a;
}

function waitForRightCol(): Promise<Element | null> {
	const existing = document.querySelector('.profile_rightcol');
	if (existing) return Promise.resolve(existing);
	return new Promise((resolve) => {
		const obs = new MutationObserver(() => {
			const col = document.querySelector('.profile_rightcol');
			if (col) { obs.disconnect(); resolve(col); }
		});
		obs.observe(document.documentElement, { childList: true, subtree: true });
		setTimeout(() => { obs.disconnect(); resolve(document.querySelector('.profile_rightcol')); }, 15000);
	});
}

async function ensureContainer(): Promise<boolean> {
	if (container && document.contains(container)) return true;
	const col = await waitForRightCol();
	if (!col) return false;
	const existing = col.querySelector('.steam-button-container');
	if (existing) {
		container = existing as HTMLDivElement;
	} else {
		const div = document.createElement('div');
		div.className = 'account-row steam-button-container';
		col.insertBefore(div, col.children[1] ?? null);
		container = div;
	}
	ensureStyle();
	if (!steamId) {
		steamId = await getSteamId();
		if (!steamId) {
			console.warn(logPrefix + ' No SteamID');
			container.remove();
			container = null;
			return false;
		}
	}
	return true;
}

function render(buttons: ButtonConfig[]) {
	if (!buttons.length) {
		if (container) { container.remove(); container = null; }
		return;
	}
	if (!container || !steamId) return;
	container.textContent = '';
	for (const button of buttons) {
		const anchor = buildButton(button, steamId);
		if (anchor) container.appendChild(anchor);
	}
}

export async function injectMain(buttons: ButtonConfig[], prefix: string) {
	logPrefix = prefix;
	if (!PROFILE_HOST_PATTERN.test(location.hostname)) return;
	if (!PROFILE_PATH_PATTERN.test(location.pathname)) return;
	if (buttons.length && !(await ensureContainer())) return;
	render(buttons);
}
