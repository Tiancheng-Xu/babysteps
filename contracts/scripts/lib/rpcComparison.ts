export type ProviderName = "public" | "infura" | "alchemy";

export type RawRpcObservation = {
	provider: ProviderName;
	latencyMs: number;
	chainId: bigint;
	latestBlock: number;
	balance: bigint;
	transaction: {
		hash: string;
		blockNumber: number | null;
		from: string;
		to: string | null;
		value: bigint;
	};
	receipt: {
		status: number | null;
		blockNumber: number;
		gasUsed: bigint;
		logs: Array<{ address: string; topics: readonly string[]; data: string }>;
	};
};

export type NormalizedRpcObservation = {
	provider: ProviderName;
	latencyMs: number;
	chainId: string;
	latestBlock: number;
	balanceWei: string;
	transaction: {
		hash: string;
		blockNumber: number | null;
		from: string;
		to: string | null;
		valueWei: string;
	};
	receipt: {
		status: number | null;
		blockNumber: number;
		gasUsed: string;
		logs: Array<{ address: string; topics: string[]; data: string }>;
	};
};

export function normalizeRpcObservation(
	observation: RawRpcObservation,
): NormalizedRpcObservation {
	return {
		provider: observation.provider,
		latencyMs: observation.latencyMs,
		chainId: observation.chainId.toString(),
		latestBlock: observation.latestBlock,
		balanceWei: observation.balance.toString(),
		transaction: {
			hash: observation.transaction.hash.toLowerCase(),
			blockNumber: observation.transaction.blockNumber,
			from: observation.transaction.from.toLowerCase(),
			to: observation.transaction.to?.toLowerCase() ?? null,
			valueWei: observation.transaction.value.toString(),
		},
		receipt: {
			status: observation.receipt.status,
			blockNumber: observation.receipt.blockNumber,
			gasUsed: observation.receipt.gasUsed.toString(),
			logs: observation.receipt.logs.map((log) => ({
				address: log.address.toLowerCase(),
				topics: [...log.topics].map((topic) => topic.toLowerCase()),
				data: log.data.toLowerCase(),
			})),
		},
	};
}

function comparableFacts(observation: NormalizedRpcObservation) {
	return {
		chainId: observation.chainId,
		balanceWei: observation.balanceWei,
		transaction: observation.transaction,
		receipt: observation.receipt,
	};
}

export function compareRpcObservations(
	observations: NormalizedRpcObservation[],
): { consistent: boolean; mismatches: string[] } {
	if (observations.length < 2) return { consistent: true, mismatches: [] };
	const reference = JSON.stringify(comparableFacts(observations[0]));
	const mismatches = observations
		.slice(1)
		.filter(
			(observation) =>
				JSON.stringify(comparableFacts(observation)) !== reference,
		)
		.map((observation) => observation.provider);
	return { consistent: mismatches.length === 0, mismatches };
}

type ProviderEnvironment = Partial<
	Record<
		| "PUBLIC_SEPOLIA_RPC_URL"
		| "INFURA_SEPOLIA_RPC_URL"
		| "ALCHEMY_SEPOLIA_RPC_URL",
		string
	>
>;

export type ProviderTarget =
	| { name: ProviderName; status: "configured"; url: string }
	| { name: ProviderName; status: "not-configured" };

export function buildProviderTargets(
	env: ProviderEnvironment,
): ProviderTarget[] {
	const candidates = [
		["public", env.PUBLIC_SEPOLIA_RPC_URL],
		["infura", env.INFURA_SEPOLIA_RPC_URL],
		["alchemy", env.ALCHEMY_SEPOLIA_RPC_URL],
	] as const;
	return candidates.map(([name, rawUrl]) => {
		const url = rawUrl?.trim();
		return url
			? { name, status: "configured" as const, url }
			: { name, status: "not-configured" as const };
	});
}

export function redactRpcUrl(rawUrl: string): string {
	const url = new URL(rawUrl);
	url.search = "";
	url.hash = "";
	const segments = url.pathname.split("/");
	if (segments.length > 1 && segments.at(-1)) {
		segments[segments.length - 1] = "[redacted]";
		url.pathname = segments.join("/");
	}
	return url.toString().replace(/\/$/u, "");
}

export type RpcProviderBoundary = {
	getNetwork(): Promise<{ chainId: bigint }>;
	getBlockNumber(): Promise<number>;
	getBalance(address: string): Promise<bigint>;
	getTransaction(hash: string): Promise<{
		hash: string;
		blockNumber: number | null;
		from: string;
		to: string | null;
		value: bigint;
	} | null>;
	getTransactionReceipt(hash: string): Promise<{
		status: number | null;
		blockNumber: number;
		gasUsed: bigint;
		logs: readonly {
			address: string;
			topics: readonly string[];
			data: string;
		}[];
	} | null>;
};

export async function readRpcObservation(
	providerName: ProviderName,
	provider: RpcProviderBoundary,
	transactionHash: string,
	account: string,
	now: () => number = Date.now,
): Promise<RawRpcObservation> {
	const startedAt = now();
	const [network, latestBlock, balance, transaction, receipt] =
		await Promise.all([
			provider.getNetwork(),
			provider.getBlockNumber(),
			provider.getBalance(account),
			provider.getTransaction(transactionHash),
			provider.getTransactionReceipt(transactionHash),
		]);
	if (!transaction)
		throw new Error(`${providerName} did not return transaction`);
	if (!receipt) throw new Error(`${providerName} did not return receipt`);

	return {
		provider: providerName,
		latencyMs: Math.max(0, now() - startedAt),
		chainId: network.chainId,
		latestBlock,
		balance,
		transaction,
		receipt: {
			...receipt,
			logs: receipt.logs.map((log) => ({
				address: log.address,
				topics: log.topics,
				data: log.data,
			})),
		},
	};
}
