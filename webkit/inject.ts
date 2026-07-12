import { ButtonConfig } from '../config/plugin.config';

const STEAMID64_BASE = BigInt('76561197960265728');

let steamId: string | null = null;
let container: HTMLDivElement | null = null;
let logPrefix = '';

async function getSteamId() {
	const win = window as any;
	const candidates = [win.g_rgProfileData?.steamid64, win.g_rgProfileData?.steamid];
	for (const v of candidates) {
		if (typeof v === 'string' && v !== '0' && v.trim()) return v.trim();
	}
	const miniId = document.querySelector('[data-miniprofile]')?.getAttribute('data-miniprofile');
	if (miniId && miniId !== '0') {
		try { return (STEAMID64_BASE + BigInt(miniId)).toString(); } catch { }
	}
	try {
		const xmlUrl = location.href.replace(/[?#].*/, '').replace(/\/$/, '') + '/?xml=1';
		const res = await fetch(xmlUrl);
		const text = await res.text();
		const dom = new DOMParser().parseFromString(text, 'application/xml');
		const id = dom.querySelector('steamID64')?.textContent;
		if (id && id !== '0') return id;
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

function buildButton(button: ButtonConfig, id: string): HTMLAnchorElement {
	const targetUrl = button.urlTemplate.replace('{steamId64}', id);
	const a = document.createElement('a');
	a.href = button.openExternal ? 'steam://openurl_external/' + targetUrl : targetUrl;
	a.className = 'sb-btn';
	a.style.setProperty('--sb-brand', button.brandColor);
	a.style.setProperty('--sb-brand-hover', button.brandColorHover);
	a.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' + button.iconSvg + '</svg>' + button.label + '<span class="sb-accent">' + button.accent + '</span>';
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
		container.appendChild(buildButton(button, steamId));
	}
}

export async function injectMain(buttons: ButtonConfig[], prefix: string) {
	logPrefix = prefix;
	if (!/steamcommunity\.com\/(id|profiles)\//.test(location.href)) return;
	if (buttons.length && !(await ensureContainer())) return;
	render(buttons);
}
