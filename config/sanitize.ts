const SVG_NS = 'http://www.w3.org/2000/svg';

const ALLOWED_TAGS = new Set(['g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);

const ALLOWED_ATTRIBUTES = new Set([
	'clip-rule',
	'cx',
	'cy',
	'd',
	'fill',
	'fill-opacity',
	'fill-rule',
	'height',
	'opacity',
	'points',
	'r',
	'rx',
	'ry',
	'stroke',
	'stroke-dasharray',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-opacity',
	'stroke-width',
	'transform',
	'width',
	'x',
	'x1',
	'x2',
	'y',
	'y1',
	'y2',
]);

function rebuildElement(source: Element): SVGElement | null {
	if (!ALLOWED_TAGS.has(source.tagName.toLowerCase())) return null;
	const element = document.createElementNS(SVG_NS, source.tagName.toLowerCase());
	for (const attribute of Array.from(source.attributes)) {
		if (ALLOWED_ATTRIBUTES.has(attribute.name.toLowerCase())) {
			element.setAttribute(attribute.name.toLowerCase(), attribute.value);
		}
	}
	for (const child of Array.from(source.children)) {
		const safeChild = rebuildElement(child);
		if (safeChild) element.appendChild(safeChild);
	}
	return element;
}

export function buildIconSvg(markup: string): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	let parsed: Document;
	try {
		parsed = new DOMParser().parseFromString('<svg xmlns="' + SVG_NS + '">' + markup + '</svg>', 'image/svg+xml');
	} catch {
		return svg;
	}
	if (parsed.getElementsByTagName('parsererror').length) return svg;
	for (const child of Array.from(parsed.documentElement.children)) {
		const safeChild = rebuildElement(child);
		if (safeChild) svg.appendChild(safeChild);
	}
	return svg;
}

export function safeTargetUrl(urlTemplate: string, steamId: string): string | null {
	try {
		const url = new URL(urlTemplate.replace('{steamId64}', encodeURIComponent(steamId)));
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.toString();
	} catch {
		return null;
	}
}
