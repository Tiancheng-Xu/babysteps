import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const artifactRoot = process.argv[2] ?? "web/dist";
const readableExtensions = new Set([".html", ".js", ".css", ".json", ".svg"]);
const academicAlias = String.fromCodePoint(
	0x68,
	0x6f,
	0x6d,
	0x65,
	0x77,
	0x6f,
	0x72,
	0x6b,
);
const nonProductCopy = new RegExp(
	`(?:作业|课程|老师|验收)|(?:${academicAlias})`,
	"i",
);

async function listReadableFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listReadableFiles(path)));
		else if (readableExtensions.has(extname(entry.name))) files.push(path);
	}
	return files;
}

const indexHtml = await readFile(join(artifactRoot, "index.html"), "utf8");
const entryJavaScriptLabels = new Set(
	[...indexHtml.matchAll(/<script[^>]+src=["'](?:\.\/|\/)?([^"']+\.js)["']/gi)].map(
		([, source]) => source,
	),
);

for (const file of await listReadableFiles(artifactRoot)) {
	const contents = await readFile(file, "utf8");
	const label = relative(artifactRoot, file);
	const isProductCopySurface =
		extname(file) !== ".js" || entryJavaScriptLabels.has(label);

	if (isProductCopySurface) {
		assert.doesNotMatch(
			contents,
			nonProductCopy,
			`${label} contains non-product public copy.`,
		);
	}
	assert.doesNotMatch(
		contents,
		/(?:github_pat_|gh[pousr]_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:AKIA|ASIA)[0-9A-Z]{16}|BEGIN (?:[A-Z ]+ )?PRIVATE KEY|\b(?:mnemonic|private.?key)\s*[:=]\s*["'][^"']{12,})/i,
		`${label} contains a credential-like value.`,
	);
	assert.doesNotMatch(
		contents,
		/(?:VITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|MNEMONIC|PASSWORD|CREDENTIAL)[A-Z0-9_]*|private.?key|mnemonic|seed.?phrase|wallet.?secret|api.?token|access.?token)\s*[:=]\s*["'`]?(?:0x)?[0-9a-fA-F]{64}\b/i,
		`${label} contains a 32-byte value assigned to a secret-like variable.`,
	);
}

console.log("Public Pages artifact validation passed.");
