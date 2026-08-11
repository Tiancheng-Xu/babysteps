import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { network } from "hardhat";
import {
	type Address,
	createPublicClient,
	formatEther,
	getAddress,
	type Hash,
	http,
	keccak256,
	parseAbi,
	stringToBytes,
} from "viem";
import { sepolia } from "viem/chains";

const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYMENT_PATH = resolve(
	"ignition/deployments/chain-11155111/deployed_addresses.json",
);
const EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-09-business-closed-loop.json",
);
const TASK_METADATA_URI =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-task.json";
const CERTIFICATE_METADATA_URI =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-certificate.json";
const READ_ACTIVITY = 2;
const VRF_TIMEOUT_MS = 15 * 60 * 1000;
const VRF_POLL_MS = 15 * 1000;
const DEMO_PAYEE = getAddress(
	`0x${keccak256(stringToBytes("BabySteps Sepolia demo payout sink")).slice(-40)}`,
);

type Evidence = {
	status: "running" | "complete";
	updatedAt: string;
	network: "Ethereum Sepolia";
	chainId: 11155111;
	operator: Address;
	demoRoleBoundary: string;
	addresses: {
		babyCoin: Address;
		growthActivities: Address;
		growthCertificate: Address;
		taskMarketplace: Address;
		demoPayee: Address;
	};
	metadata: { task: string; certificate: string };
	taskId?: string;
	requestId?: string;
	purchaseId?: string;
	certificateTokenId?: string;
	transactions: Record<string, Hash>;
	providerBalanceBeforePurchase?: string;
	verification?: Record<string, unknown>;
};

const babyCoinAbi = parseAbi([
	"function balanceOf(address account) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
	"function lifetimeEarned(address account) view returns (uint256)",
	"function growthStageOf(address account) view returns (uint8)",
]);
const growthActivitiesAbi = parseAbi([
	"function recordActivity(uint8 activity)",
]);
const taskMarketplaceAbi = parseAbi([
	"function hasRole(bytes32 role, address account) view returns (bool)",
	"function nextTaskId() view returns (uint256)",
	"function nextPurchaseId() view returns (uint256)",
	"function getTask(uint256 taskId) view returns ((address provider, address payee, uint8 activityType, string metadataUri, uint256 requestId, uint256 price, uint64 opensAt, uint64 closesAt, bool active, bool paused) task)",
	"function getPurchase(uint256 purchaseId) view returns ((address buyer, uint256 taskId, uint256 price, uint64 purchasedAt, bool completed, uint256 certificateTokenId) purchase)",
	"function hasPurchased(uint256 taskId, address buyer) view returns (bool)",
	"function createTask(address payee, uint8 activityType, string metadataUri) returns (uint256 taskId)",
	"function buy(uint256 taskId) returns (uint256 purchaseId)",
	"function confirmCompletion(uint256 purchaseId, string certificateUri)",
]);
const growthCertificateAbi = parseAbi([
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function tokenURI(uint256 tokenId) view returns (string)",
]);

const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const babyCoin = deployed["BabyStepsWeb3Module#BabyCoin"];
const growthActivities = deployed["BabyStepsWeb3Module#GrowthActivities"];
const growthCertificate = deployed["BabyStepsWeb3Module#GrowthCertificate"];
const taskMarketplace = deployed["BabyStepsWeb3Module#TaskMarketplace"];
if (!babyCoin || !growthActivities || !growthCertificate || !taskMarketplace) {
	throw new Error("One or more BabySteps deployment addresses are missing.");
}

const connection = await network.create();
const [hardhatWallet] = await connection.viem.getWalletClients();
if (!hardhatWallet)
	throw new Error("No Sepolia operator account is configured.");
const account = hardhatWallet.account;
const publicClient = createPublicClient({
	chain: sepolia,
	transport: http(PUBLIC_RPC),
});
const walletClient = hardhatWallet;

let evidence: Evidence = {
	status: "running",
	updatedAt: new Date().toISOString(),
	network: "Ethereum Sepolia",
	chainId: 11155111,
	operator: account.address,
	demoRoleBoundary:
		"Minimal delivery demo: one operator wallet acts as Provider, parent buyer, and Oracle; payout uses a deterministic test-only address.",
	addresses: {
		babyCoin,
		growthActivities,
		growthCertificate,
		taskMarketplace,
		demoPayee: DEMO_PAYEE,
	},
	metadata: {
		task: TASK_METADATA_URI,
		certificate: CERTIFICATE_METADATA_URI,
	},
	transactions: {},
};

try {
	const previous = JSON.parse(
		await readFile(EVIDENCE_PATH, "utf8"),
	) as Evidence;
	if (
		getAddress(previous.operator) === getAddress(account.address) &&
		getAddress(previous.addresses.taskMarketplace) ===
			getAddress(taskMarketplace)
	) {
		evidence = previous;
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

async function persistEvidence() {
	evidence.updatedAt = new Date().toISOString();
	await writeFile(
		EVIDENCE_PATH,
		`${JSON.stringify(evidence, null, 2)}\n`,
		"utf8",
	);
}

async function waitForReceipt(hash: Hash, action: string) {
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error(`${action} reverted.`);
	evidence.transactions[action] = hash;
	await persistEvidence();
	return receipt;
}

async function findExistingTask() {
	const nextTaskId = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "nextTaskId",
	});
	const minimum = nextTaskId > 20n ? nextTaskId - 20n : 1n;
	for (let taskId = nextTaskId - 1n; taskId >= minimum; taskId -= 1n) {
		const task = await publicClient.readContract({
			address: taskMarketplace,
			abi: taskMarketplaceAbi,
			functionName: "getTask",
			args: [taskId],
		});
		if (
			getAddress(task.provider) === getAddress(account.address) &&
			task.metadataUri === TASK_METADATA_URI
		) {
			return taskId;
		}
	}
	return undefined;
}

async function createTask() {
	if (evidence.taskId) return BigInt(evidence.taskId);
	const existing = await findExistingTask();
	if (existing !== undefined) {
		evidence.taskId = existing.toString();
		await persistEvidence();
		return existing;
	}

	const taskId = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "nextTaskId",
	});
	const { request } = await publicClient.simulateContract({
		account,
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "createTask",
		args: [DEMO_PAYEE, READ_ACTIVITY, TASK_METADATA_URI],
	});
	const hash = await walletClient.writeContract(request);
	await waitForReceipt(hash, "createTask");
	evidence.taskId = taskId.toString();
	const task = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "getTask",
		args: [taskId],
	});
	evidence.requestId = task.requestId.toString();
	await persistEvidence();
	return taskId;
}

async function waitForTaskActivation(taskId: bigint) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < VRF_TIMEOUT_MS) {
		try {
			const task = await publicClient.readContract({
				address: taskMarketplace,
				abi: taskMarketplaceAbi,
				functionName: "getTask",
				args: [taskId],
			});
			evidence.requestId = task.requestId.toString();
			await persistEvidence();
			if (task.active) return task;
		} catch (error) {
			console.warn(`VRF status read will retry: ${(error as Error).message}`);
		}
		console.log("Waiting for Chainlink VRF fulfillment...");
		await new Promise((resolveDelay) => setTimeout(resolveDelay, VRF_POLL_MS));
	}
	throw new Error(
		"Chainlink VRF fulfillment did not arrive within 15 minutes.",
	);
}

async function recordActivity(requiredBalance: bigint) {
	const [balance, lifetimeEarned] = await Promise.all([
		publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "balanceOf",
			args: [account.address],
		}),
		publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "lifetimeEarned",
			args: [account.address],
		}),
	]);
	if (balance >= requiredBalance && lifetimeEarned > 0n) return;
	const { request } = await publicClient.simulateContract({
		account,
		address: growthActivities,
		abi: growthActivitiesAbi,
		functionName: "recordActivity",
		args: [READ_ACTIVITY],
	});
	const hash = await walletClient.writeContract(request);
	await waitForReceipt(hash, "recordActivity");
}

async function approve(price: bigint) {
	const allowance = await publicClient.readContract({
		address: babyCoin,
		abi: babyCoinAbi,
		functionName: "allowance",
		args: [account.address, taskMarketplace],
	});
	if (allowance >= price) return;
	const { request } = await publicClient.simulateContract({
		account,
		address: babyCoin,
		abi: babyCoinAbi,
		functionName: "approve",
		args: [taskMarketplace, price],
	});
	const hash = await walletClient.writeContract(request);
	await waitForReceipt(hash, "approve");
}

async function findExistingPurchase(taskId: bigint) {
	const nextPurchaseId = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "nextPurchaseId",
	});
	const minimum = nextPurchaseId > 20n ? nextPurchaseId - 20n : 1n;
	for (
		let purchaseId = nextPurchaseId - 1n;
		purchaseId >= minimum;
		purchaseId -= 1n
	) {
		const purchase = await publicClient.readContract({
			address: taskMarketplace,
			abi: taskMarketplaceAbi,
			functionName: "getPurchase",
			args: [purchaseId],
		});
		if (
			purchase.taskId === taskId &&
			getAddress(purchase.buyer) === getAddress(account.address)
		) {
			return purchaseId;
		}
	}
	return undefined;
}

async function buy(taskId: bigint) {
	if (evidence.purchaseId) return BigInt(evidence.purchaseId);
	const alreadyPurchased = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "hasPurchased",
		args: [taskId, account.address],
	});
	if (alreadyPurchased) {
		const existing = await findExistingPurchase(taskId);
		if (existing === undefined)
			throw new Error("Purchase exists but its ID could not be recovered.");
		evidence.purchaseId = existing.toString();
		await persistEvidence();
		return existing;
	}

	if (evidence.providerBalanceBeforePurchase === undefined) {
		const providerBalance = await publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "balanceOf",
			args: [DEMO_PAYEE],
		});
		evidence.providerBalanceBeforePurchase = providerBalance.toString();
		await persistEvidence();
	}
	const purchaseId = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "nextPurchaseId",
	});
	const { request } = await publicClient.simulateContract({
		account,
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "buy",
		args: [taskId],
	});
	const hash = await walletClient.writeContract(request);
	await waitForReceipt(hash, "buy");
	evidence.purchaseId = purchaseId.toString();
	await persistEvidence();
	return purchaseId;
}

async function confirmCompletion(purchaseId: bigint) {
	const purchase = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "getPurchase",
		args: [purchaseId],
	});
	if (purchase.completed) return purchase.certificateTokenId;
	const { request } = await publicClient.simulateContract({
		account,
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "confirmCompletion",
		args: [purchaseId, CERTIFICATE_METADATA_URI],
	});
	const hash = await walletClient.writeContract(request);
	await waitForReceipt(hash, "confirmCompletion");
	const completed = await publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "getPurchase",
		args: [purchaseId],
	});
	return completed.certificateTokenId;
}

async function verifyClosedLoop(taskId: bigint, purchaseId: bigint) {
	const [task, purchase, balance, lifetimeEarned, growthStage, allowance] =
		await Promise.all([
			publicClient.readContract({
				address: taskMarketplace,
				abi: taskMarketplaceAbi,
				functionName: "getTask",
				args: [taskId],
			}),
			publicClient.readContract({
				address: taskMarketplace,
				abi: taskMarketplaceAbi,
				functionName: "getPurchase",
				args: [purchaseId],
			}),
			publicClient.readContract({
				address: babyCoin,
				abi: babyCoinAbi,
				functionName: "balanceOf",
				args: [account.address],
			}),
			publicClient.readContract({
				address: babyCoin,
				abi: babyCoinAbi,
				functionName: "lifetimeEarned",
				args: [account.address],
			}),
			publicClient.readContract({
				address: babyCoin,
				abi: babyCoinAbi,
				functionName: "growthStageOf",
				args: [account.address],
			}),
			publicClient.readContract({
				address: babyCoin,
				abi: babyCoinAbi,
				functionName: "allowance",
				args: [account.address, taskMarketplace],
			}),
		]);
	const [providerBalance, owner, tokenUri] = await Promise.all([
		publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "balanceOf",
			args: [DEMO_PAYEE],
		}),
		publicClient.readContract({
			address: growthCertificate,
			abi: growthCertificateAbi,
			functionName: "ownerOf",
			args: [purchase.certificateTokenId],
		}),
		publicClient.readContract({
			address: growthCertificate,
			abi: growthCertificateAbi,
			functionName: "tokenURI",
			args: [purchase.certificateTokenId],
		}),
	]);
	const providerBalanceBefore = BigInt(
		evidence.providerBalanceBeforePurchase ?? "0",
	);
	if (!task.active || task.paused) throw new Error("Task is not active.");
	if (task.price < 2n * 10n ** 18n || task.price > 4n * 10n ** 18n) {
		throw new Error("VRF price is outside the expected 2-4 BABY range.");
	}
	const duration = task.closesAt - task.opensAt;
	if (duration < 4n * 3600n || duration > 6n * 3600n) {
		throw new Error("VRF duration is outside the Read activity range.");
	}
	if (!purchase.completed || purchase.taskId !== taskId) {
		throw new Error("Purchase completion was not persisted.");
	}
	if (getAddress(owner) !== getAddress(account.address)) {
		throw new Error("Certificate owner does not match the buyer.");
	}
	if (tokenUri !== CERTIFICATE_METADATA_URI) {
		throw new Error("Certificate metadata URI does not match.");
	}
	if (providerBalance !== providerBalanceBefore + task.price) {
		throw new Error("Provider payout does not equal the locked task price.");
	}

	evidence.status = "complete";
	evidence.certificateTokenId = purchase.certificateTokenId.toString();
	evidence.verification = {
		taskActive: task.active,
		taskPaused: task.paused,
		activityType: Number(task.activityType),
		priceWei: task.price.toString(),
		priceBABY: formatEther(task.price),
		opensAt: task.opensAt.toString(),
		closesAt: task.closesAt.toString(),
		durationSeconds: duration.toString(),
		purchaseCompleted: purchase.completed,
		buyer: purchase.buyer,
		providerPayee: task.payee,
		providerPayoutWei: (providerBalance - providerBalanceBefore).toString(),
		buyerBalanceBABY: formatEther(balance),
		lifetimeEarnedBABY: formatEther(lifetimeEarned),
		growthStage: Number(growthStage),
		remainingAllowanceWei: allowance.toString(),
		certificateOwner: owner,
		certificateTokenUri: tokenUri,
	};
	await persistEvidence();
	return evidence.verification;
}

const providerRole = keccak256(stringToBytes("PROVIDER_ROLE"));
const oracleRole = keccak256(stringToBytes("ORACLE_ROLE"));
const [isProvider, isOracle] = await Promise.all([
	publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "hasRole",
		args: [providerRole, account.address],
	}),
	publicClient.readContract({
		address: taskMarketplace,
		abi: taskMarketplaceAbi,
		functionName: "hasRole",
		args: [oracleRole, account.address],
	}),
]);
if (!isProvider || !isOracle) {
	throw new Error("Operator must have PROVIDER_ROLE and ORACLE_ROLE.");
}

await persistEvidence();
const taskId = await createTask();
const task = await waitForTaskActivation(taskId);
await recordActivity(task.price);
await approve(task.price);
const purchaseId = await buy(taskId);
const certificateTokenId = await confirmCompletion(purchaseId);
evidence.certificateTokenId = certificateTokenId.toString();
const verification = await verifyClosedLoop(taskId, purchaseId);

console.log(
	JSON.stringify(
		{
			status: evidence.status,
			taskId: taskId.toString(),
			requestId: evidence.requestId,
			purchaseId: purchaseId.toString(),
			certificateTokenId: certificateTokenId.toString(),
			transactions: evidence.transactions,
			verification,
			evidencePath: EVIDENCE_PATH,
		},
		null,
		2,
	),
);
