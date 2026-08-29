import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const hexToRgb = (hex) =>
	[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));

const relativeLuminance = (hex) => {
	const [red, green, blue] = hexToRgb(hex).map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045
			? normalized / 12.92
			: ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground, background) => {
	const foregroundLuminance = relativeLuminance(foreground);
	const backgroundLuminance = relativeLuminance(background);
	return (
		(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
		(Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
	);
};

const readColorToken = (styles, token) => {
	const match = styles.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
	assert.ok(match, `missing ${token} color token`);
	return match[1];
};

test("performance dashboard keeps five readable text layers on warm light surfaces", async () => {
	const styles = await readFile("web/src/styles.css", "utf8");
	const pairs = [
		["--performance-body-text", "--performance-panel-surface"],
		["--performance-table-header-text", "--performance-table-header-surface"],
		["--performance-value-text", "--performance-row-surface"],
		["--performance-empty-text", "--performance-empty-surface"],
		["--performance-observed-text", "--performance-observed-surface"],
	];

	for (const [foregroundToken, backgroundToken] of pairs) {
		const foreground = readColorToken(styles, foregroundToken);
		const background = readColorToken(styles, backgroundToken);
		assert.ok(
			contrastRatio(foreground, background) >= 4.5,
			`${foregroundToken} on ${backgroundToken} must meet WCAG AA`,
		);
	}
});

test("performance tables scope light defaults and dark-panel overrides", async () => {
	const styles = await readFile("web/src/styles.css", "utf8");

	assert.match(
		styles,
		/\.performance-table thead th\s*\{[^}]*background:\s*var\(--performance-table-header-surface\);[^}]*color:\s*var\(--performance-table-header-text\)/su,
	);
	assert.match(
		styles,
		/\.performance-table tbody th,\s*\.performance-table tbody td\s*\{[^}]*background:\s*var\(--performance-row-surface\);[^}]*color:\s*var\(--performance-value-text\)/su,
	);
	assert.match(
		styles,
		/\.performance-table tbody th\s*\{[^}]*color:\s*var\(--performance-label-text\);[^}]*font-weight:\s*800/su,
	);
	assert.match(
		styles,
		/\.performance-table tbody td\[colspan\]\s*\{[^}]*background:\s*var\(--performance-empty-surface\);[^}]*color:\s*var\(--performance-empty-text\);[^}]*font-weight:\s*800/su,
	);
	assert.match(
		styles,
		/\.performance-panel--dark \.performance-table thead th\s*\{[^}]*background:[^}]*color:/su,
	);
	assert.match(
		styles,
		/\.performance-panel--dark \.performance-table tbody th,\s*\.performance-panel--dark \.performance-table tbody td\s*\{[^}]*background:[^}]*color:/su,
	);
});
