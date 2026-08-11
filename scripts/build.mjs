import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FULL_BUILD_TARGETS = Object.freeze([
	"@babysteps/aws",
	"@babysteps/contracts",
	"@babysteps/web",
	"@babysteps/worker",
	"@babysteps/subgraph",
]);

export function selectBuildTargets(env = process.env) {
	return env.CF_PAGES === "1" ? ["@babysteps/web"] : [...FULL_BUILD_TARGETS];
}

export function runBuild(
	targets = selectBuildTargets(),
	execute = spawnSync,
) {
	for (const target of targets) {
		const result = execute("pnpm", ["--filter", target, "build"], {
			env: process.env,
			stdio: "inherit",
		});
		if (result.error) throw result.error;
		if (result.status !== 0) return result.status ?? 1;
	}
	return 0;
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === executedPath) {
	process.exitCode = runBuild();
}
