import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ACADEMIC_ALIASES = [
	String.fromCodePoint(0x68, 0x6f, 0x6d, 0x65, 0x77, 0x6f, 0x72, 0x6b),
	String.fromCodePoint(0x79, 0x69, 0x64, 0x65, 0x6e, 0x67),
	String.fromCodePoint(0x79, 0x64),
];

function tokenPattern(aliases) {
	return new RegExp(
		`(?:^|[^a-z0-9])(${aliases.join("|")})(?=$|[^a-z0-9])`,
		"i",
	);
}

const FORBIDDEN_PROJECT_TOKEN = tokenPattern(ACADEMIC_ALIASES.slice(0, 2));
const FORBIDDEN_REF_TOKEN = tokenPattern(ACADEMIC_ALIASES);

const LEGACY_AWS_IDENTIFIER_PATHS = new Set([
	"docs/evidence/deployment/2026-08-11-aws-pausable.json",
	"docs/evidence/deployment/2026-08-11-aws-pausable.md",
]);

const LEGACY_AWS_IDENTIFIERS = [
	new RegExp(`babysteps-${ACADEMIC_ALIASES[0]}-readiness`, "gi"),
	new RegExp(`${ACADEMIC_ALIASES[0]}-readiness`, "gi"),
];

function withoutApprovedLegacyIdentifiers(path, content) {
	if (!LEGACY_AWS_IDENTIFIER_PATHS.has(path)) return content;
	return LEGACY_AWS_IDENTIFIERS.reduce(
		(result, pattern) => result.replace(pattern, ""),
		content,
	);
}

export function validateProjectNaming({ contents, paths, refs }) {
	const violations = [];
	for (const path of paths) {
		if (FORBIDDEN_PROJECT_TOKEN.test(path))
			violations.push({ path, scope: "path" });
	}
	for (const ref of refs) {
		if (FORBIDDEN_REF_TOKEN.test(ref)) violations.push({ ref, scope: "ref" });
	}
	for (const [path, content] of contents) {
		if (
			FORBIDDEN_PROJECT_TOKEN.test(
				withoutApprovedLegacyIdentifiers(path, content),
			)
		) {
			violations.push({ path, scope: "content" });
		}
	}
	return violations;
}

function nullSeparatedGitLines(args) {
	return execFileSync("git", args, { encoding: "utf8" })
		.split("\0")
		.filter(Boolean);
}

function gitLines(args) {
	return execFileSync("git", args, { encoding: "utf8" })
		.split("\n")
		.filter(Boolean);
}

export function trackedText(paths) {
	const contents = new Map();
	for (const path of paths) {
		if (!existsSync(path)) continue;
		const buffer = readFileSync(path);
		if (buffer.includes(0)) continue;
		try {
			contents.set(path, new TextDecoder("utf-8", { fatal: true }).decode(buffer));
		} catch {
			// Positively non-UTF-8 tracked files are outside this text naming gate.
		}
	}
	return contents;
}

export function validateRepositoryNaming() {
	const paths = nullSeparatedGitLines(["ls-files", "-z"]);
	const refs = gitLines([
		"for-each-ref",
		"--format=%(refname:short)",
		"refs/heads",
		"refs/remotes",
	]);
	return validateProjectNaming({ contents: trackedText(paths), paths, refs });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
	const violations = validateRepositoryNaming();
	if (violations.length > 0) {
		console.error("Project naming validation failed:");
		for (const violation of violations) {
			console.error(
				`[${violation.scope}] ${violation.path ?? violation.ref}`,
			);
		}
		process.exitCode = 1;
	} else {
		console.log("Project naming validation passed.");
	}
}
