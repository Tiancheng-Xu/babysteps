import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const roleChecks = [
	["parent-a", "ROLE_PARENT_A_UNAVAILABLE"],
	["recipient-b", "ROLE_RECIPIENT_B_UNAVAILABLE"],
	["provider-c", "ROLE_PROVIDER_C_UNAVAILABLE"],
	["owner-relayer-d", "ROLE_OWNER_RELAYER_D_UNAVAILABLE"],
];

const booleanChecks = [
	["contractsConfigured", "CONTRACTS_NOT_CONFIGURED"],
	["balances.gasReady", "SEPOLIA_GAS_UNAVAILABLE"],
	["balances.babyReady", "BABY_BALANCE_UNAVAILABLE"],
	["balances.growthReady", "GROWTH_BALANCE_UNAVAILABLE"],
	["marketplace.allowanceReady", "ALLOWANCE_PREFLIGHT_UNAVAILABLE"],
	["keepsakes.vrfReady", "VRF_UNAVAILABLE"],
	["identity.privyReady", "PRIVY_UNAVAILABLE"],
	["identity.workerOriginReady", "WORKER_ORIGIN_UNAVAILABLE"],
	["awsRuntime.budgetGuardPassed", "AWS_BUDGET_GUARD_NOT_PASSED"],
];

const forbiddenKey =
	/(?:private.?key|mnemonic|secret|password|cookie|token|email|address|signature)/iu;
const forbiddenValue = /(?:0x[0-9a-fA-F]{40}|\/Users\/|\/home\/)/u;

function valueAt(source, path) {
	return path.split(".").reduce((value, key) => value?.[key], source);
}

function assertSafeSnapshot(value, path = "snapshot") {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			assertSafeSnapshot(entry, `${path}.${index}`);
		});
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, entry] of Object.entries(value)) {
			if (forbiddenKey.test(key)) throw new Error("PREFLIGHT_PRIVATE_FIELD");
			assertSafeSnapshot(entry, `${path}.${key}`);
		}
		return;
	}
	if (typeof value === "string" && forbiddenValue.test(value)) {
		throw new Error("PREFLIGHT_PRIVATE_VALUE");
	}
}

export function evaluateImplementedFeaturePreflight(snapshot) {
	assertSafeSnapshot(snapshot);
	const blockers = [];
	if (snapshot?.chainId !== 11155111) blockers.push("CHAIN_ID_NOT_SEPOLIA");
	for (const [path, code] of booleanChecks) {
		if (valueAt(snapshot, path) !== true) blockers.push(code);
	}
	for (const [alias, code] of roleChecks) {
		if (snapshot?.roles?.[alias] !== true) blockers.push(code);
	}
	if (!(snapshot?.marketplace?.activeTaskCount >= 1)) {
		blockers.push("ACTIVE_TASK_UNAVAILABLE");
	}
	if (!(snapshot?.keepsakes?.fusionSetCount >= 1)) {
		blockers.push("FUSION_SET_UNAVAILABLE");
	}
	if (!(snapshot?.keepsakes?.recoverableRequestCount >= 1)) {
		blockers.push("RECOVERABLE_REQUEST_UNAVAILABLE");
	}
	if (snapshot?.awsRuntime?.state !== "ready") {
		blockers.push("AWS_RUNTIME_NOT_READY");
	}

	return {
		schemaVersion: 1,
		ready: blockers.length === 0,
		chain: snapshot?.chainId === 11155111 ? "sepolia" : "unavailable",
		roleAliases: Object.fromEntries(
			roleChecks.map(([alias]) => [alias, snapshot?.roles?.[alias] === true]),
		),
		checks: {
			contracts: snapshot?.contractsConfigured === true,
			balances:
				snapshot?.balances?.gasReady === true &&
				snapshot?.balances?.babyReady === true &&
				snapshot?.balances?.growthReady === true,
			marketplace:
				snapshot?.marketplace?.activeTaskCount >= 1 &&
				snapshot?.marketplace?.allowanceReady === true,
			keepsakes:
				snapshot?.keepsakes?.vrfReady === true &&
				snapshot?.keepsakes?.fusionSetCount >= 1 &&
				snapshot?.keepsakes?.recoverableRequestCount >= 1,
			identity:
				snapshot?.identity?.privyReady === true &&
				snapshot?.identity?.workerOriginReady === true,
			awsRuntime:
				snapshot?.awsRuntime?.state === "ready" &&
				snapshot?.awsRuntime?.budgetGuardPassed === true,
		},
		blockers,
	};
}

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
	const mode = option("--mode");
	if (mode === "local-contract") {
		process.stdout.write(
			`${JSON.stringify({ schemaVersion: 1, mode, manifestValid: true, readiness: "not-evaluated" })}\n`,
		);
		return;
	}
	const snapshotPath = option("--snapshot");
	const outputPath = option("--output");
	if (!snapshotPath) throw new Error("PREFLIGHT_SNAPSHOT_REQUIRED");
	const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
	const result = evaluateImplementedFeaturePreflight(snapshot);
	if (outputPath) {
		await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
			mode: 0o600,
		});
	}
	process.stdout.write(`${JSON.stringify(result)}\n`);
	if (!result.ready) process.exitCode = 1;
}

const isEntrypoint = process.argv[1]
	? fileURLToPath(import.meta.url) === process.argv[1]
	: false;
if (isEntrypoint) {
	await main().catch((error) => {
		const code =
			error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
				? error.message
				: "PREFLIGHT_FAILED";
		process.stderr.write(`${code}\n`);
		process.exitCode = 1;
	});
}
