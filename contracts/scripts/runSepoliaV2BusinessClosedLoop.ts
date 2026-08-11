import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
	"ignition/deployments/babysteps-sepolia-v2/deployed_addresses.json",
);
const EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-11-sepolia-v2-business.json",
);
const TASK_METADATA_URI =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-task.json";
const CERTIFICATE_METADATA_URI =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-certificate.json";
const TASK_METADATA_HASH = keccak256(stringToBytes(TASK_METADATA_URI));
const COMPLETION_EVIDENCE_HASH = keccak256(
	stringToBytes("BabySteps Sepolia V2 verified completion"),
);
const READ_ACTIVITY = 2;
const ACTIVE_STATUS = 3;
const PENDING_REVIEW_STATUS = 1;
const VRF_TIMEOUT_MS = 15 * 60 * 1000;
const VRF_POLL_MS = 15 * 1000;
const DEMO_PAYEE = getAddress(
	`0x${keccak256(stringToBytes("BabySteps Sepolia V2 payout sink")).slice(-40)}`,
);
const role = (name: string) => keccak256(stringToBytes(name));
const COMPLETION_RELAYER_ROLE = role("COMPLETION_RELAYER_ROLE");

type Evidence = {
	status: "running" | "complete" | "failed";
	phase: string;
	updatedAt: string;
	network: "Ethereum Sepolia";
	chainId: 11155111;
	operator: Address;
	addresses: {
		babyCoin: Address;
		growthCertificateSBT: Address;
		taskMarketplaceV2: Address;
		providerPayee: Address;
	};
	metadata: {
		task: string;
		taskHash: Hash;
		certificate: string;
		completionEvidenceHash: Hash;
	};
	taskId?: string;
	requestId?: string;
	purchaseId?: string;
	certificateTokenId?: string;
	providerBalanceBeforeWei?: string;
	temporaryCompletionRoleGranted?: boolean;
	transactions: Record<string, Hash>;
	verification?: Record<string, unknown>;
	error?: string;
};

const babyCoinAbi = parseAbi([
	"function balanceOf(address account) view returns (uint256)",
	"function allowance(address owner,address spender) view returns (uint256)",
	"function approve(address spender,uint256 amount) returns (bool)",
]);
const marketplaceAbi = parseAbi([
	"function hasRole(bytes32 role,address account) view returns (bool)",
	"function grantRole(bytes32 role,address account)",
	"function revokeRole(bytes32 role,address account)",
	"function nextTaskId() view returns (uint256)",
	"function nextPurchaseId() view returns (uint256)",
	"function getTask(uint256 taskId) view returns ((address provider,address payee,uint8 activityType,string metadataUri,bytes32 metadataHash,bytes32 rejectionReasonHash,uint256 requestId,uint256 price,uint64 opensAt,uint64 closesAt,uint8 status,bool paused) task)",
	"function getPurchase(uint256 purchaseId) view returns ((address buyer,uint256 taskId,uint256 price,uint64 purchasedAt,bool completed,bytes32 evidenceHash,uint256 certificateTokenId) purchase)",
	"function purchaseIdForBuyer(uint256 taskId,address buyer) view returns (uint256)",
	"function requestTask(address payee,uint8 activityType,string metadataUri,bytes32 metadataHash) returns (uint256 taskId)",
	"function approveTask(uint256 taskId)",
	"function buy(uint256 taskId) returns (uint256 purchaseId)",
	"function confirmCompletion(uint256 purchaseId,bytes32 evidenceHash,string certificateUri) returns (uint256 certificateTokenId)",
]);
const certificateAbi = parseAbi([
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function tokenURI(uint256 tokenId) view returns (string)",
	"function locked(uint256 tokenId) view returns (bool)",
]);

const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const babyCoin = deployed["BabyStepsWeb3V2Module#BabyCoin"];
const growthCertificateSBT =
	deployed["BabyStepsWeb3V2Module#GrowthCertificateSBT"];
const taskMarketplaceV2 = deployed["BabyStepsWeb3V2Module#TaskMarketplaceV2"];
if (!babyCoin || !growthCertificateSBT || !taskMarketplaceV2) {
	throw new Error("BabySteps V2 Sepolia deployment addresses are missing.");
}

const connection = await network.create();
const [wallet] = await connection.viem.getWalletClients();
if (!wallet) throw new Error("No Sepolia operator account is configured.");
const account = wallet.account;
const publicClient = createPublicClient({
	chain: sepolia,
	transport: http(PUBLIC_RPC),
});

let evidence: Evidence = {
	status: "running",
	phase: "initialized",
	updatedAt: new Date().toISOString(),
	network: "Ethereum Sepolia",
	chainId: 11155111,
	operator: getAddress(account.address),
	addresses: {
		babyCoin: getAddress(babyCoin),
		growthCertificateSBT: getAddress(growthCertificateSBT),
		taskMarketplaceV2: getAddress(taskMarketplaceV2),
		providerPayee: DEMO_PAYEE,
	},
	metadata: {
		task: TASK_METADATA_URI,
		taskHash: TASK_METADATA_HASH,
		certificate: CERTIFICATE_METADATA_URI,
		completionEvidenceHash: COMPLETION_EVIDENCE_HASH,
	},
	transactions: {},
};

try {
	const previous = JSON.parse(
		await readFile(EVIDENCE_PATH, "utf8"),
	) as Evidence;
	if (
		getAddress(previous.operator) === getAddress(account.address) &&
		getAddress(previous.addresses.taskMarketplaceV2) ===
			getAddress(taskMarketplaceV2)
	) {
		evidence = previous;
		evidence.status = "running";
		delete evidence.error;
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

async function persistEvidence() {
	evidence.updatedAt = new Date().toISOString();
	await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
	await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function recordTransaction(action: string, hash: Hash) {
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error(`${action} reverted.`);
	evidence.transactions[action] = hash;
	await persistEvidence();
}

async function requestTask() {
	if (evidence.taskId) return BigInt(evidence.taskId);
	const taskId = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "nextTaskId",
	});
	const { request } = await publicClient.simulateContract({
		account,
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "requestTask",
		args: [DEMO_PAYEE, READ_ACTIVITY, TASK_METADATA_URI, TASK_METADATA_HASH],
	});
	const hash = await wallet.writeContract(request);
	await recordTransaction("requestTask", hash);
	evidence.taskId = taskId.toString();
	evidence.phase = "task-requested";
	await persistEvidence();
	return taskId;
}

async function approveAndWaitForRandomness(taskId: bigint) {
	let task = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "getTask",
		args: [taskId],
	});
	if (task.status === PENDING_REVIEW_STATUS) {
		const { request } = await publicClient.simulateContract({
			account,
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "approveTask",
			args: [taskId],
		});
		const hash = await wallet.writeContract(request);
		await recordTransaction("approveTask", hash);
		task = await publicClient.readContract({
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "getTask",
			args: [taskId],
		});
	}
	evidence.requestId = task.requestId.toString();
	evidence.phase = "waiting-for-vrf";
	await persistEvidence();

	const startedAt = Date.now();
	while (task.status !== ACTIVE_STATUS) {
		if (Date.now() - startedAt >= VRF_TIMEOUT_MS) {
			throw new Error("Chainlink VRF fulfillment timed out after 15 minutes.");
		}
		console.log("Waiting for Chainlink VRF fulfillment...");
		await new Promise((resolveDelay) => setTimeout(resolveDelay, VRF_POLL_MS));
		task = await publicClient.readContract({
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "getTask",
			args: [taskId],
		});
	}
	evidence.phase = "task-active";
	await persistEvidence();
	return task;
}

async function buyTask(taskId: bigint, price: bigint) {
	let purchaseId = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "purchaseIdForBuyer",
		args: [taskId, account.address],
	});
	if (purchaseId !== 0n) {
		evidence.purchaseId = purchaseId.toString();
		return purchaseId;
	}

	const balance = await publicClient.readContract({
		address: babyCoin,
		abi: babyCoinAbi,
		functionName: "balanceOf",
		args: [account.address],
	});
	if (balance < price) {
		throw new Error(
			`Insufficient BABY balance: need ${formatEther(price)}, have ${formatEther(balance)}.`,
		);
	}
	const allowance = await publicClient.readContract({
		address: babyCoin,
		abi: babyCoinAbi,
		functionName: "allowance",
		args: [account.address, taskMarketplaceV2],
	});
	if (allowance < price) {
		const { request } = await publicClient.simulateContract({
			account,
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "approve",
			args: [taskMarketplaceV2, price],
		});
		const hash = await wallet.writeContract(request);
		await recordTransaction("approveExactBabyCoinPrice", hash);
	}

	evidence.providerBalanceBeforeWei = (
		await publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "balanceOf",
			args: [DEMO_PAYEE],
		})
	).toString();
	await persistEvidence();

	const expectedPurchaseId = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "nextPurchaseId",
	});
	const { request } = await publicClient.simulateContract({
		account,
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "buy",
		args: [taskId],
	});
	const hash = await wallet.writeContract(request);
	await recordTransaction("buy", hash);
	purchaseId = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "purchaseIdForBuyer",
		args: [taskId, account.address],
	});
	if (purchaseId !== expectedPurchaseId) {
		throw new Error("Unexpected purchase id after buy.");
	}
	evidence.purchaseId = purchaseId.toString();
	evidence.phase = "purchased";
	await persistEvidence();
	return purchaseId;
}

async function completePurchase(purchaseId: bigint) {
	let purchase = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "getPurchase",
		args: [purchaseId],
	});
	if (purchase.completed) return purchase;

	const hasCompletionRole = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "hasRole",
		args: [COMPLETION_RELAYER_ROLE, account.address],
	});
	if (!hasCompletionRole) {
		const { request } = await publicClient.simulateContract({
			account,
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "grantRole",
			args: [COMPLETION_RELAYER_ROLE, account.address],
		});
		const hash = await wallet.writeContract(request);
		await recordTransaction("grantTemporaryCompletionRelayerRole", hash);
		evidence.temporaryCompletionRoleGranted = true;
		await persistEvidence();
	}

	const { request } = await publicClient.simulateContract({
		account,
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "confirmCompletion",
		args: [purchaseId, COMPLETION_EVIDENCE_HASH, CERTIFICATE_METADATA_URI],
	});
	const hash = await wallet.writeContract(request);
	await recordTransaction("confirmCompletion", hash);
	purchase = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "getPurchase",
		args: [purchaseId],
	});
	evidence.certificateTokenId = purchase.certificateTokenId.toString();
	evidence.phase = "completion-confirmed";
	await persistEvidence();
	return purchase;
}

async function revokeTemporaryCompletionRole() {
	if (!evidence.temporaryCompletionRoleGranted) return;
	const hasRole = await publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "hasRole",
		args: [COMPLETION_RELAYER_ROLE, account.address],
	});
	if (hasRole) {
		const { request } = await publicClient.simulateContract({
			account,
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "revokeRole",
			args: [COMPLETION_RELAYER_ROLE, account.address],
		});
		const hash = await wallet.writeContract(request);
		await recordTransaction("revokeTemporaryCompletionRelayerRole", hash);
	}
	evidence.temporaryCompletionRoleGranted = false;
	await persistEvidence();
}

let workflowError: Error | undefined;
try {
	await persistEvidence();
	const taskId = await requestTask();
	const task = await approveAndWaitForRandomness(taskId);
	const purchaseId = await buyTask(taskId, task.price);
	await completePurchase(purchaseId);
} catch (error) {
	workflowError = error as Error;
	evidence.status = "failed";
	evidence.error = workflowError.message;
	await persistEvidence();
} finally {
	try {
		await revokeTemporaryCompletionRole();
	} catch (error) {
		workflowError = error as Error;
		evidence.status = "failed";
		evidence.error = `Temporary role cleanup failed: ${workflowError.message}`;
		await persistEvidence();
	}
}

if (workflowError) throw workflowError;
if (!evidence.taskId || !evidence.purchaseId) {
	throw new Error("Business loop did not produce task and purchase ids.");
}

const taskId = BigInt(evidence.taskId);
const purchaseId = BigInt(evidence.purchaseId);
const [task, purchase, providerBalanceAfter, remainingAllowance] =
	await Promise.all([
		publicClient.readContract({
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "getTask",
			args: [taskId],
		}),
		publicClient.readContract({
			address: taskMarketplaceV2,
			abi: marketplaceAbi,
			functionName: "getPurchase",
			args: [purchaseId],
		}),
		publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "balanceOf",
			args: [DEMO_PAYEE],
		}),
		publicClient.readContract({
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "allowance",
			args: [account.address, taskMarketplaceV2],
		}),
	]);
const certificateTokenId = purchase.certificateTokenId;
const [
	certificateOwner,
	certificateTokenUri,
	certificateLocked,
	roleRemaining,
] = await Promise.all([
	publicClient.readContract({
		address: growthCertificateSBT,
		abi: certificateAbi,
		functionName: "ownerOf",
		args: [certificateTokenId],
	}),
	publicClient.readContract({
		address: growthCertificateSBT,
		abi: certificateAbi,
		functionName: "tokenURI",
		args: [certificateTokenId],
	}),
	publicClient.readContract({
		address: growthCertificateSBT,
		abi: certificateAbi,
		functionName: "locked",
		args: [certificateTokenId],
	}),
	publicClient.readContract({
		address: taskMarketplaceV2,
		abi: marketplaceAbi,
		functionName: "hasRole",
		args: [COMPLETION_RELAYER_ROLE, account.address],
	}),
]);
const providerBalanceBefore = BigInt(evidence.providerBalanceBeforeWei ?? "0");
if (
	!purchase.completed ||
	getAddress(purchase.buyer) !== getAddress(account.address) ||
	providerBalanceAfter - providerBalanceBefore !== task.price ||
	getAddress(certificateOwner) !== getAddress(account.address) ||
	certificateTokenUri !== CERTIFICATE_METADATA_URI ||
	!certificateLocked ||
	roleRemaining
) {
	throw new Error("Final V2 business-loop verification failed.");
}

evidence.status = "complete";
evidence.phase = "verified";
evidence.certificateTokenId = certificateTokenId.toString();
evidence.verification = {
	taskStatus: task.status,
	activityType: task.activityType,
	priceWei: task.price.toString(),
	priceBABY: formatEther(task.price),
	opensAt: task.opensAt.toString(),
	closesAt: task.closesAt.toString(),
	durationSeconds: (task.closesAt - task.opensAt).toString(),
	purchaseCompleted: purchase.completed,
	buyer: purchase.buyer,
	providerPayee: task.payee,
	providerPayoutWei: (providerBalanceAfter - providerBalanceBefore).toString(),
	remainingAllowanceWei: remainingAllowance.toString(),
	certificateOwner,
	certificateTokenUri,
	certificateLocked,
	completionRelayerRoleRevoked: !roleRemaining,
};
await persistEvidence();
console.log(
	JSON.stringify({ ...evidence, evidencePath: EVIDENCE_PATH }, null, 2),
);
