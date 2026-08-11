import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { JsonRpcProvider } from "ethers";
import {
	buildProviderTargets,
	compareRpcObservations,
	normalizeRpcObservation,
	readRpcObservation,
	redactRpcUrl,
} from "./lib/rpcComparison.js";

const DEFAULT_PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_TRANSACTION =
	"0xba0d13402507da21b4c680dbe1dd3413c7fd0eb2c97b93a30c8f86a0f0622cfd";
const DEFAULT_ACCOUNT = "0x4d9df519abcbe51c0098649bcd0e17ac1548fa88";

const transactionHash =
	process.env.EVIDENCE_TRANSACTION_HASH?.trim() || DEFAULT_TRANSACTION;
const account = process.env.EVIDENCE_ACCOUNT?.trim() || DEFAULT_ACCOUNT;
const targets = buildProviderTargets({
	PUBLIC_SEPOLIA_RPC_URL:
		process.env.PUBLIC_SEPOLIA_RPC_URL?.trim() || DEFAULT_PUBLIC_RPC,
	INFURA_SEPOLIA_RPC_URL: process.env.INFURA_SEPOLIA_RPC_URL,
	ALCHEMY_SEPOLIA_RPC_URL: process.env.ALCHEMY_SEPOLIA_RPC_URL,
});

const observations = [];
const sources = [];
for (const target of targets) {
	if (target.status === "not-configured") {
		sources.push({ provider: target.name, status: target.status });
		continue;
	}

	try {
		const provider = new JsonRpcProvider(target.url, 11155111, {
			staticNetwork: true,
		});
		const observation = normalizeRpcObservation(
			await readRpcObservation(target.name, provider, transactionHash, account),
		);
		observations.push(observation);
		sources.push({
			provider: target.name,
			status: "success",
			endpoint: redactRpcUrl(target.url),
			latencyMs: observation.latencyMs,
		});
	} catch (error) {
		sources.push({
			provider: target.name,
			status: "error",
			endpoint: redactRpcUrl(target.url),
			error: error instanceof Error ? error.name : "UnknownError",
		});
	}
}

const comparison = compareRpcObservations(observations);
const result = {
	generatedAt: new Date().toISOString(),
	chain: "ethereum-sepolia",
	chainId: 11155111,
	account,
	transactionHash,
	sources,
	observations,
	comparison,
	complete:
		observations.length === 3 &&
		comparison.consistent &&
		targets.every((target) => target.status === "configured"),
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
const outputPath = process.env.RPC_EVIDENCE_OUTPUT?.trim();
if (outputPath) {
	const absolutePath = resolve(outputPath);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, serialized, { mode: 0o600 });
}
process.stdout.write(serialized);

if (process.env.REQUIRE_ALL_RPC === "1" && !result.complete) {
	process.exitCode = 1;
}
