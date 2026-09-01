import { readFile } from "node:fs/promises";
import process from "node:process";

const REQUIRED_TOKENS = [
	"color-text-primary",
	"color-text-secondary",
	"color-text-muted",
	"color-surface-canvas",
	"color-surface-raised",
	"color-surface-subtle",
	"color-surface-accent",
	"color-action-primary",
	"color-action-primary-text",
	"color-border-subtle",
	"color-border-strong",
	"color-state-success-text",
	"color-state-success-surface",
	"color-state-warning-text",
	"color-state-warning-surface",
	"color-state-danger-text",
	"color-state-danger-surface",
	"color-state-info-text",
	"color-state-info-surface",
	"font-family-body",
	"font-family-display",
	"radius-card",
	"radius-control",
	"shadow-elevated",
	"shadow-soft",
	"space-section",
];

const CONTRAST_PAIRS = [
	["color-text-primary", "color-surface-raised"],
	["color-text-secondary", "color-surface-raised"],
	["color-text-muted", "color-surface-raised"],
	["color-action-primary-text", "color-action-primary"],
	["color-state-success-text", "color-state-success-surface"],
	["color-state-warning-text", "color-state-warning-surface"],
	["color-state-danger-text", "color-state-danger-surface"],
	["color-state-info-text", "color-state-info-surface"],
];

function parseTokens(styles) {
	return new Map(
		[...styles.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/giu)].map(
			([, name, value]) => [name, value.trim()],
		),
	);
}

function relativeLuminance(hex) {
	const channels = [1, 3, 5].map((offset) =>
		Number.parseInt(hex.slice(offset, offset + 2), 16),
	);
	const [red, green, blue] = channels.map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045
			? normalized / 12.92
			: ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
	const foregroundLuminance = relativeLuminance(foreground);
	const backgroundLuminance = relativeLuminance(background);
	return (
		(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
		(Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
	);
}

export function validateDesignSystem(styles) {
	const errors = [];
	const tokens = parseTokens(styles);

	for (const token of REQUIRED_TOKENS) {
		if (!tokens.has(token)) errors.push(`missing semantic token --${token}`);
	}

	const references = new Set(
		[...styles.matchAll(/var\(--([a-z0-9-]+)/giu)].map(([, name]) => name),
	);
	const componentRuntimeTokens = new Set(["bar-size"]);
	for (const token of references) {
		if (!tokens.has(token) && !componentRuntimeTokens.has(token)) {
			errors.push(`undefined custom property --${token}`);
		}
	}

	for (const [foregroundToken, backgroundToken] of CONTRAST_PAIRS) {
		const foreground = tokens.get(foregroundToken);
		const background = tokens.get(backgroundToken);
		if (!/^#[0-9a-f]{6}$/iu.test(foreground ?? "")) continue;
		if (!/^#[0-9a-f]{6}$/iu.test(background ?? "")) continue;
		const ratio = contrastRatio(foreground, background);
		if (ratio < 4.5) {
			errors.push(
				`--${foregroundToken} on --${backgroundToken} has ${ratio.toFixed(2)}:1 contrast`,
			);
		}
	}

	const requiredPatterns = [
		[
			/button,\s*input,\s*select,\s*textarea\s*\{/su,
			"select must inherit the control font",
		],
		[
			/select:focus-visible/su,
			"select must have a visible keyboard focus state",
		],
		[
			/touch-action:\s*manipulation/su,
			"tap controls must opt into manipulation touch behavior",
		],
		[/text-wrap:\s*balance/su, "display headings must use balanced wrapping"],
		[
			/font-variant-numeric:\s*tabular-nums/su,
			"numeric comparisons must use tabular figures",
		],
		[
			/@media\s*\(prefers-reduced-motion:\s*reduce\)/su,
			"reduced-motion handling is required",
		],
	];
	for (const [pattern, message] of requiredPatterns) {
		if (!pattern.test(styles)) errors.push(message);
	}

	const primaryControl = styles.match(/\.button\s*\{([^}]*)\}/su)?.[1] ?? "";
	const minimumTouchTarget = Number(
		primaryControl.match(/min-height:\s*([0-9.]+)px/u)?.[1] ?? 0,
	);
	if (minimumTouchTarget < 44) {
		errors.push("primary controls must keep a 44px minimum touch target");
	}

	if (/transition:\s*all(?:\s|;)/iu.test(styles)) {
		errors.push("transition: all is forbidden");
	}

	return errors;
}

async function main() {
	const path = process.argv[2] ?? "web/src/styles.css";
	const styles = await readFile(path, "utf8");
	const errors = validateDesignSystem(styles);
	if (errors.length > 0) {
		for (const error of errors) console.error(`DESIGN_SYSTEM_FAIL ${error}`);
		process.exitCode = 1;
		return;
	}
	console.log(`DESIGN_SYSTEM_PASS ${path}`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
	await main();
}
