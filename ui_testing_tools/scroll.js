// Usage: node scroll.js '.my-selector'          -- scroll element into view
//    or: node scroll.js down [pixels]            -- scroll the page/editor down (default 300px)
//    or: node scroll.js up [pixels]              -- scroll the page/editor up (default 300px)
// down/up uses the SNC editor (_sncEditor) when present, otherwise scrolls the window.

import { connect, evaluate } from './cdp.js';

const arg1 = process.argv[2];
const arg2 = process.argv[3];

if (!arg1) {
	console.error('Usage: node scroll.js <css-selector>');
	console.error('       node scroll.js down|up [pixels]');
	process.exit(1);
}

async function main() {
	const ws = await connect();

	if (arg1 === 'down' || arg1 === 'up') {
		const px = Number(arg2) || 300;
		const delta = arg1 === 'down' ? px : -px;
		const result = await evaluate(ws, `
			(() => {
				const editor = globalThis._sncEditor;
				if (editor && typeof editor.getScrollTop === 'function') {
					const before = editor.getScrollTop();
					editor.setScrollTop(before + (${delta}));
					return { target: 'editor', before, after: editor.getScrollTop() };
				}
				// Find the real scroll container (Jupyter nb v6 scrolls #site, not window).
				const cands = [document.querySelector('#site'), document.scrollingElement, document.body].filter(Boolean);
				const scroller = cands.find(el => el.scrollHeight > el.clientHeight + 1) || document.scrollingElement || document.documentElement;
				const before = scroller.scrollTop;
				scroller.scrollTop = before + (${delta});
				const name = scroller.id ? ('#' + scroller.id) : (scroller.tagName || 'window').toLowerCase();
				return { target: name, before, after: scroller.scrollTop };
			})()
		`);
		console.log(`Scrolled ${arg1} ${px}px (${result.target} scrollTop: ${result.before} -> ${result.after})`);
	} else {
		const selector = arg1;
		const result = await evaluate(ws, `
			(() => {
				const el = document.querySelector(${JSON.stringify(selector)});
				if (!el) return 'not found';
				el.scrollIntoView({ behavior: 'instant', block: 'center' });
				const r = el.getBoundingClientRect();
				return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
			})()
		`);
		if (result === 'not found') {
			console.error(`Element not found: ${selector}`);
			process.exit(1);
		}
		console.log(`Scrolled "${selector}" into view at (${result.x}, ${result.y}) [${result.w}x${result.h}]`);
	}
	process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
