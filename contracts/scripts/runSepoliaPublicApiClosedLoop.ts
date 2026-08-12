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
	toBytes,
} from "viem";
import { sepolia } from "viem/chains";
import {
	buildApiEndpoint,
	readSessionCookie,
	toPublicEvidence,
} from "./lib/publicApiClosedLoop.js";

const API_URL = "https://babysteps-api.baby2b.online";
const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYMENT_PATH = resolve(
	"ignition/deployments/babysteps-sepolia-v2/deployed_addresses.json",
);
const EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-12-public-api-closed-loop.json",
);
const TASK_METADATA_URI =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-task.json";
const ACTIVE_STATUS = 3;
const VRF_TIMEOUT_MS = 15 * 60 * 1000;
const VRF_POLL_MS = 15 * 1000;
const USERNAME = "StarBuddy Parent";
const COMMENT = "A verified Sepolia purchase unlocked this growth note.";

const metadata = {
	title: "Bedtime Story Quest",
	description:
		"Read one picture book together and share a calm bedtime moment.",
	coverUrl: "https://babysteps.baby2b.online/media/starbuddy-certificate.jpg",
	videoUrl: "https://babysteps.baby2b.online/metadata/sepolia-demo-task.json",
	completionInstructions:
		"Finish the story together, then ask the provider to confirm completion.",
	activityType: "Read",
} as const;
const canonicalJson = JSON.stringify(metadata);
const metadataHash = keccak256(toBytes(canonicalJson));

const babyCoinAbi = parseAbi([
	"function balanceOf(address account) view returns (uint256)",
	"function mintTest(address account,uint256 amount)",
	"function approve(address spender,uint256 amount) returns (bool)",
]);
const marketplaceAbi = parseAbi([
	"function nextTaskId() view returns (uint256)",
	"function getTask(uint256 taskId) view returns ((address provider,address payee,uint8 activityType,string metadataUri,bytes32 metadataHash,bytes32 rejectionReasonHash,uint256 requestId,uint256 price,uint64 opensAt,uint64 closesAt,uint8 status,bool paused) task)",
	"function purchaseIdForBuyer(uint256 taskId,address buyer) view returns (uint256)",
	"function requestTask(address payee,uint8 activityType,string metadataUri,bytes32 metadataHash) returns (uint256 taskId)",
	"function approveTask(uint256 taskId)",
	"function buy(uint256 taskId) returns (uint256 purchaseId)",
]);

type Evidence = {
	status: "running" | "complete" | "failed";
	updatedAt: string;
	wallet: Address;
	apiUrl: string;
	metadataHash: Hash;
	draftId?: string;
	taskId?: string;
	taskKey?: string;
	commentId?: string;
	username?: string;
	transactions: Record<string, Hash>;
	verification?: Record<string, unknown>;
	error?: string;
};

const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const babyCoin = deployed["BabyStepsWeb3V2Module#BabyCoin"];
const marketplace = deployed["BabyStepsWeb3V2Module#TaskMarketplaceV2"];
if (!babyCoin || !marketplace) {
	throw new Error("BabySteps V2 Sepolia addresses are missing.");
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
	updatedAt: new Date().toISOString(),
	wallet: getAddress(account.address),
	apiUrl: API_URL,
	metadataHash,
	transactions: {},
};

try {
	const previous = JSON.parse(
		await readFile(EVIDENCE_PATH, "utf8"),
	) as Evidence;
	if (
		previous.wallet.toLowerCase() === account.address.toLowerCase() &&
		previous.metadataHash === metadataHash
	) {
		evidence = { ...previous, status: "running" };
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

async function api(path: string, init: RequestInit = {}, cookie?: string) {
	const headers = new Headers(init.headers);
	if (init.body) headers.set("content-type", "application/json");
	if (cookie) headers.set("cookie", cookie);
	return fetch(buildApiEndpoint(API_URL, path), { ...init, headers });
}

async function readApi<T>(response: Response, expected: number): Promise<T> {
	if (response.status !== expected) {
		throw new Error(
			`Worker API ${response.status}: ${(await response.text()).slice(0, 240)}`,
		);
	}
	return response.json() as Promise<T>;
}

async function login() {
	const challenge = await readApi<{
		challengeId: string;
		message: string;
	}>(
		await api("/api/auth/challenges", {
			method: "POST",
			body: JSON.stringify({ address: account.address, action: "login" }),
		}),
		201,
	);
	const signature = await wallet.signMessage({
		account,
		message: challenge.message,
	});
	const session = await api("/api/auth/sessions", {
		method: "POST",
		body: JSON.stringify({
			challengeId: challenge.challengeId,
			message: challenge.message,
			signature,
		}),
	});
	await readApi(session.clone(), 201);
	return readSessionCookie(session.headers.get("set-cookie"));
}

async function recordTransaction(action: string, hash: Hash) {
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error(`${action} reverted.`);
	evidence.transactions[action] = hash;
	await persistEvidence();
}

async function createDraft(cookie: string) {
	if (evidence.draftId) return evidence.draftId;
	const draft = await readApi<{ draftId: string; metadataHash: Hash }>(
		await api(
			"/api/task-drafts",
			{ method: "POST", body: canonicalJson },
			cookie,
		),
		201,
	);
	if (draft.metadataHash !== metadataHash) {
		throw new Error(
			"Worker canonical metadata hash does not match local hash.",
		);
	}
	evidence.draftId = draft.draftId;
	await persistEvidence();
	return draft.draftId;
}

async function requestAndActivateTask() {
	let taskId = evidence.taskId ? BigInt(evidence.taskId) : undefined;
	if (!taskId) {
		taskId = await publicClient.readContract({
			address: marketplace,
			abi: marketplaceAbi,
			functionName: "nextTaskId",
		});
		const { request } = await publicClient.simulateContract({
			account,
			address: marketplace,
			abi: marketplaceAbi,
			functionName: "requestTask",
			args: [account.address, 2, TASK_METADATA_URI, metadataHash],
		});
		await recordTransaction("requestTask", await wallet.writeContract(request));
		evidence.taskId = taskId.toString();
		await persistEvidence();
	}

	let task = await publicClient.readContract({
		address: marketplace,
		abi: marketplaceAbi,
		functionName: "getTask",
		args: [taskId],
	});
	if (task.status === 1) {
		const { request } = await publicClient.simulateContract({
			account,
			address: marketplace,
			abi: marketplaceAbi,
			functionName: "approveTask",
			args: [taskId],
		});
		await recordTransaction("approveTask", await wallet.writeContract(request));
	}
	const startedAt = Date.now();
	while (task.status !== ACTIVE_STATUS) {
		if (Date.now() - startedAt > VRF_TIMEOUT_MS) {
			throw new Error("Chainlink VRF fulfillment timed out.");
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, VRF_POLL_MS));
		task = await publicClient.readContract({
			address: marketplace,
			abi: marketplaceAbi,
			functionName: "getTask",
			args: [taskId],
		});
	}
	return { taskId, task };
}

async function buyTask(taskId: bigint, price: bigint) {
	let purchaseId = await publicClient.readContract({
		address: marketplace,
		abi: marketplaceAbi,
		functionName: "purchaseIdForBuyer",
		args: [taskId, account.address],
	});
	if (purchaseId !== 0n) return purchaseId;
	const balance = await publicClient.readContract({
		address: babyCoin,
		abi: babyCoinAbi,
		functionName: "balanceOf",
		args: [account.address],
	});
	if (balance < price) {
		const { request } = await publicClient.simulateContract({
			account,
			address: babyCoin,
			abi: babyCoinAbi,
			functionName: "mintTest",
			args: [account.address, price - balance],
		});
		await recordTransaction("mintTest", await wallet.writeContract(request));
	}
	const approval = await publicClient.simulateContract({
		account,
		address: babyCoin,
		abi: babyCoinAbi,
		functionName: "approve",
		args: [marketplace, price],
	});
	await recordTransaction(
		"approve",
		await wallet.writeContract(approval.request),
	);
	const purchase = await publicClient.simulateContract({
		account,
		address: marketplace,
		abi: marketplaceAbi,
		functionName: "buy",
		args: [taskId],
	});
	await recordTransaction("buy", await wallet.writeContract(purchase.request));
	purchaseId = await publicClient.readContract({
		address: marketplace,
		abi: marketplaceAbi,
		functionName: "purchaseIdForBuyer",
		args: [taskId, account.address],
	});
	return purchaseId;
}

try {
	await persistEvidence();
	const cookie = await login();
	const draftId = await createDraft(cookie);
	const { taskId, task } = await requestAndActivateTask();
	const purchaseId = await buyTask(taskId, task.price);
	const taskKey = `11155111:${getAddress(marketplace).toLowerCase()}:${taskId}`;

	const bound = await readApi<{ taskKey: string; created: boolean }>(
		await api(
			`/api/task-drafts/${draftId}/bind`,
			{
				method: "POST",
				body: JSON.stringify({
					chainId: 11155111,
					marketplaceAddress: marketplace,
					taskId: taskId.toString(),
					transactionHash: evidence.transactions.requestTask,
				}),
			},
			cookie,
		),
		evidence.taskKey ? 200 : 201,
	);
	if (bound.taskKey !== taskKey) throw new Error("Bound task key mismatch.");
	evidence.taskKey = taskKey;

	const profile = await readApi<{ username: string | null }>(
		await api(
			"/api/profile",
			{ method: "PUT", body: JSON.stringify({ username: USERNAME }) },
			cookie,
		),
		200,
	);
	evidence.username = profile.username ?? undefined;

	if (!evidence.commentId) {
		const comment = await readApi<{ id: string; content: string }>(
			await api(
				`/api/tasks/${encodeURIComponent(taskKey)}/comments`,
				{ method: "POST", body: JSON.stringify({ content: COMMENT }) },
				cookie,
			),
			201,
		);
		evidence.commentId = comment.id;
	}
	const detail = await readApi<{
		taskKey: string;
		offchain: { title: string; videoUrl: string };
		onchain: { metadataHash: Hash; status: string };
	}>(await api(`/api/tasks/${encodeURIComponent(taskKey)}`), 200);
	const comments = await readApi<{
		comments: Array<{ id: string; username: string | null; content: string }>;
	}>(await api(`/api/tasks/${encodeURIComponent(taskKey)}/comments`), 200);
	const listedComment = comments.comments.find(
		(comment) => comment.id === evidence.commentId,
	);
	if (!listedComment || detail.onchain.metadataHash !== metadataHash) {
		throw new Error("Public task or comment readback did not match.");
	}

	evidence.verification = {
		...toPublicEvidence({
			wallet: account.address,
			taskKey,
			draftId,
			commentId: evidence.commentId,
			username: profile.username ?? "",
			transactionHash: evidence.transactions.requestTask,
			metadataHash,
		}),
		chainStatus: detail.onchain.status,
		priceBABY: formatEther(task.price),
		purchaseId: purchaseId.toString(),
		publicTaskRead: detail.taskKey === taskKey,
		publicCommentRead: listedComment.content === COMMENT,
	};
	evidence.status = "complete";
	await persistEvidence();
	process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} catch (error) {
	evidence.status = "failed";
	evidence.error = error instanceof Error ? error.message : "UnknownError";
	await persistEvidence();
	throw error;
}
