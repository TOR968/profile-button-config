import { PluginConfig } from '../config/plugin.config';

export interface InjectConfig {
	label: string;
	accent: string;
	brandColor: string;
	brandColorHover: string;
	iconSvg: string;
	urlTemplate: string;
	logPrefix: string;
}

const STEAMID64_BASE = BigInt('76561197960265728');

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

export function injectMain(openExternal: boolean, config: InjectConfig) {
	if (document.querySelector('.steam-button-container')) return;
	if (!/steamcommunity\.com\/(id|profiles)\//.test(location.href)) return;

	async function inject() {
		const col = document.querySelector('.profile_rightcol');
		if (!col || col.querySelector('.steam-button-container')) return;

		const div = document.createElement('div');
		div.className = 'account-row steam-button-container';
		col.insertBefore(div, col.children[1] ?? null);

		const steamId = await getSteamId();
		if (!steamId) { console.warn(config.logPrefix + ' No SteamID'); div.remove(); return; }

		if (!document.getElementById('steam-button-style')) {
			const s = document.createElement('style');
			s.id = 'steam-button-style';
			s.textContent = ".sb-btn{display:flex;gap:.5rem;width:100%;height:3rem;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:800;letter-spacing:.04em;font-family:'Motiva Sans',Arial,sans-serif;transition:all .3s cubic-bezier(.23,1,.32,1);text-transform:uppercase;background-color:#1a1a1a;border-radius:5px;cursor:pointer;text-decoration:none;border:none;outline:none;margin:10px 0}.sb-btn:hover{background-color:#2d3748;text-decoration:none!important}.sb-btn .sb-accent{color:" + config.brandColor + ";transition:color .3s cubic-bezier(.23,1,.32,1)}.sb-btn:hover .sb-accent{color:" + config.brandColorHover + "}.sb-btn svg{height:22px;width:auto;color:" + config.brandColor + ";transition:color .3s cubic-bezier(.23,1,.32,1)}.sb-btn:hover svg{color:" + config.brandColorHover + "}";
			document.head?.appendChild(s);
		}

		const targetUrl = config.urlTemplate.replace('{steamId64}', steamId);
		const a = document.createElement('a');
		a.href = openExternal ? 'steam://openurl_external/' + targetUrl : targetUrl;
		a.className = 'sb-btn';
		a.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' + config.iconSvg + '</svg>' + config.label + '<span class="sb-accent">' + config.accent + '</span>';
		div.appendChild(a);
	}

	if (document.querySelector('.profile_rightcol')) {
		inject();
	} else {
		const obs = new MutationObserver(() => {
			if (document.querySelector('.profile_rightcol')) {
				obs.disconnect();
				inject();
			}
		});
		obs.observe(document.documentElement, { childList: true, subtree: true });
		setTimeout(() => obs.disconnect(), 15000);
	}
}

export function toInjectConfig(c: PluginConfig): InjectConfig {
	return {
		label: c.label,
		accent: c.accent,
		brandColor: c.brandColor,
		brandColorHover: c.brandColorHover,
		iconSvg: c.iconSvg,
		urlTemplate: c.urlTemplate,
		logPrefix: c.logPrefix,
	};
}
