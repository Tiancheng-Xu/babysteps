import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function json(file: string) {
	return JSON.parse(
		await readFile(path.join(import.meta.dirname, "..", file), "utf8"),
	) as {
		dependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
}

describe("Lambda production manifest", () => {
	it("pins the runtime dependencies used by the workspace package", async () => {
		const workspace = await json("package.json");
		const lambda = await json("lambda-package/package.json");
		for (const [name, version] of Object.entries(
			workspace.dependencies ?? {},
		)) {
			expect(lambda.dependencies?.[name], name).toBe(version);
		}
		expect(JSON.stringify(lambda)).not.toContain("catalog:");
		expect(lambda.dependencies?.esbuild).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("routes SAM through the npm-compatible production manifest", async () => {
		const workspace = await json("package.json");
		expect(workspace.scripts?.build).toContain(
			"--manifest lambda-package/package.json",
		);
	});
});
