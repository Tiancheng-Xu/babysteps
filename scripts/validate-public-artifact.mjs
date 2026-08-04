import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const artifactRoot = "web/dist";
const readableExtensions = new Set([".html", ".js", ".css", ".json", ".svg"]);
const knownPublicTransaction =
	"0x2128ff833511d6f6c03d9c60ab6f161f62909e6f00fedd80710a8826495f674a";
const knownLibraryConstants = new Set([
	"0x608060405234801561001057600080fd5b5060405161018e38038061018e8339",
	"0x608060405234801561001057600080fd5b506040516102c03803806102c08339",
	"0x608060405234801561001057600080fd5b506115b9806100206000396000f3fe",
	"0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
	"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
	"0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
]);

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

await readFile(join(artifactRoot, "index.html"), "utf8");

for (const file of await listReadableFiles(artifactRoot)) {
	const contents = await readFile(file, "utf8");
	const label = relative(artifactRoot, file);

	assert.doesNotMatch(
		contents,
		/(?:作业|课程|老师|验收)|\b(?:homework|assignment)\b/i,
		`${label} contains non-product public copy.`,
	);
	assert.doesNotMatch(
		contents,
		/(?:github_pat_|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (?:[A-Z ]+ )?PRIVATE KEY|\b(?:mnemonic|private.?key)\s*[:=]\s*["'][^"']{12,})/i,
		`${label} contains a credential-like value.`,
	);

	for (const candidate of contents.match(/0x[0-9a-fA-F]{64}/g) ?? []) {
		assert.ok(
			candidate.toLowerCase() === knownPublicTransaction ||
				knownLibraryConstants.has(candidate.toLowerCase()),
			`${label} contains an unexpected 32-byte value: ${candidate}`,
		);
	}
}

console.log("Public Pages artifact validation passed.");
