import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { network } from "hardhat";
import {
	type Address,
	getAddress,
	type Hash,
	keccak256,
	parseAbi,
	stringToBytes,
} from "viem";

const VRF_COORDINATOR = getAddress(
	"0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
);
const PARAMETER_PATH = resolve(
	"ignition/parameters/babysteps-web3-v2.sepolia.json",
);
const DEPLOYMENT_PATH = resolve(
	"ignition/deployments/babysteps-starbuddy-sepolia/deployed_addresses.json",
);
const EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-14-starbuddy-sepolia-closed-loop.json",
);
const VRF_TIMEOUT_MS = 15 * 60 * 1000;
const VRF_POLL_MS = 15 * 1000;

const coordinatorAbi = parseAbi([
	"function addConsumer(uint256 subId,address consumer)",
	"function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
]);
const notebookAbi = parseAbi([
	"function admin() view returns (address)",
	"function growthStarConsumers(address consumer) view returns (bool)",
	"function getGrowthPoints(address account) view returns (uint256)",
	"function getTransferableBalance(address account) view returns (uint256)",
	"function getActivityAvailability(address account,uint8 activity) view returns (bool available,bool dailyLimitReached)",
	"function recordActivity(uint8 activity)",
]);
const keepsakesAbi = parseAbi([
	"function DRAW_COST() view returns (uint256)",
	"function latestRequestIdByOwner(address owner) view returns (uint256)",
	"function requestDraw() returns (uint256 requestId)",
	"function getRequest(uint256 requestId) view returns (address owner,uint8 kind,uint8 status,uint64 requestedAt,uint256[3] tokenIds,uint256 resultTokenId,uint256 burnedTokenId)",
]);
const tokenAbi = parseAbi([
	"function MINTER_ROLE() view returns (bytes32)",
	"function BURNER_ROLE() view returns (bytes32)",
	"function hasRole(bytes32 role,address account) view returns (bool)",
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function getKeepsake(uint256 tokenId) view returns (uint8 series,uint8 rarity)",
	"function locked(uint256 tokenId) view returns (bool)",
	"function tokenURI(uint256 tokenId) view returns (string)",
]);

type RequestView = readonly [
	Address,
	number,
	number,
	bigint,
	readonly [bigint, bigint, bigint],
	bigint,
	bigint,
];
type TransactionEvidence = { action: string; hash: Hash };
type PreviousEvidence = {
	requestId?: string;
	transactions?: TransactionEvidence[];
	verification?: {
		initialTransferableBalance?: string;
		transferableBalanceBefore?: string;
		transferableBalanceBeforeDraw?: string;
		transferableBalanceAfter?: string;
	};
};

async function readPreviousEvidence(): Promise<PreviousEvidence | undefined> {
	try {
		return JSON.parse(
			await readFile(EVIDENCE_PATH, "utf8"),
		) as PreviousEvidence;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

const parameters = JSON.parse(await readFile(PARAMETER_PATH, "utf8")) as {
	StarBuddyKeepsakesSepoliaModule: { vrfSubscriptionId: string };
};
const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const notebook = deployed["StarBuddyKeepsakesSepoliaModule#OnchainNotebook"];
const token = deployed["StarBuddyKeepsakesSepoliaModule#StarBuddyKeepsakeSBT"];
const keepsakes =
	deployed["StarBuddyKeepsakesSepoliaModule#StarBuddyKeepsakes"];
if (!notebook || !token || !keepsakes) {
	throw new Error("StarBuddy Sepolia deployment addresses are incomplete.");
}

const connection = await network.create();
const [wallet] = await connection.viem.getWalletClients();
const publicClient = await connection.viem.getPublicClient();
if (!wallet) throw new Error("No Sepolia operator account is configured.");
const operator = getAddress(wallet.account.address);
const subscriptionId = BigInt(
	parameters.StarBuddyKeepsakesSepoliaModule.vrfSubscriptionId,
);
const transactions: TransactionEvidence[] = [];
const previousEvidence = await readPreviousEvidence();

const notebookAdmin = await publicClient.readContract({
	address: notebook,
	abi: notebookAbi,
	functionName: "admin",
});
if (getAddress(notebookAdmin) !== operator) {
	throw new Error("The configured wallet is not the deployed notebook admin.");
}

let subscription = await publicClient.readContract({
	address: VRF_COORDINATOR,
	abi: coordinatorAbi,
	functionName: "getSubscription",
	args: [subscriptionId],
});
if (getAddress(subscription[3]) !== operator) {
	throw new Error(
		"The selected VRF subscription is not owned by the operator.",
	);
}
const nativeBalanceBeforeWei = subscription[1];
if (
	!subscription[4].some(
		(consumer) => getAddress(consumer) === getAddress(keepsakes),
	)
) {
	const hash = await wallet.writeContract({
		account: wallet.account,
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "addConsumer",
		args: [subscriptionId, keepsakes],
	});
	await publicClient.waitForTransactionReceipt({ hash });
	transactions.push({ action: "add StarBuddyKeepsakes as VRF consumer", hash });
	subscription = await publicClient.readContract({
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "getSubscription",
		args: [subscriptionId],
	});
}

const authorizedStarConsumer = await publicClient.readContract({
	address: notebook,
	abi: notebookAbi,
	functionName: "growthStarConsumers",
	args: [keepsakes],
});
const [minterRole, burnerRole] = await Promise.all([
	publicClient.readContract({
		address: token,
		abi: tokenAbi,
		functionName: "MINTER_ROLE",
	}),
	publicClient.readContract({
		address: token,
		abi: tokenAbi,
		functionName: "BURNER_ROLE",
	}),
]);
const [minterConfigured, burnerConfigured] = await Promise.all([
	publicClient.readContract({
		address: token,
		abi: tokenAbi,
		functionName: "hasRole",
		args: [minterRole, keepsakes],
	}),
	publicClient.readContract({
		address: token,
		abi: tokenAbi,
		functionName: "hasRole",
		args: [burnerRole, keepsakes],
	}),
]);
if (!authorizedStarConsumer || !minterConfigured || !burnerConfigured) {
	throw new Error("Ignition role or growth-star authorization is incomplete.");
}

const drawCost = await publicClient.readContract({
	address: keepsakes,
	abi: keepsakesAbi,
	functionName: "DRAW_COST",
});
const balanceBefore = await publicClient.readContract({
	address: notebook,
	abi: notebookAbi,
	functionName: "getTransferableBalance",
	args: [operator],
});
let availableBalance = balanceBefore;

let requestId = await publicClient.readContract({
	address: keepsakes,
	abi: keepsakesAbi,
	functionName: "latestRequestIdByOwner",
	args: [operator],
});
let request: RequestView | undefined;
if (requestId !== 0n) {
	request = (await publicClient.readContract({
		address: keepsakes,
		abi: keepsakesAbi,
		functionName: "getRequest",
		args: [requestId],
	})) as RequestView;
}

if (!request || request[2] === 4) {
	for (const activity of [0, 1, 2] as const) {
		if (availableBalance >= drawCost) break;
		const [available] = await publicClient.readContract({
			address: notebook,
			abi: notebookAbi,
			functionName: "getActivityAvailability",
			args: [operator, activity],
		});
		if (!available) continue;
		const hash = await wallet.writeContract({
			account: wallet.account,
			address: notebook,
			abi: notebookAbi,
			functionName: "recordActivity",
			args: [activity],
		});
		await publicClient.waitForTransactionReceipt({ hash });
		transactions.push({ action: `record activity ${activity}`, hash });
		availableBalance = await publicClient.readContract({
			address: notebook,
			abi: notebookAbi,
			functionName: "getTransferableBalance",
			args: [operator],
		});
	}
	if (availableBalance < drawCost) {
		throw new Error(
			`Only ${availableBalance} transferable stars are available; ${drawCost} are required.`,
		);
	}
	const hash = await wallet.writeContract({
		account: wallet.account,
		address: keepsakes,
		abi: keepsakesAbi,
		functionName: "requestDraw",
	});
	await publicClient.waitForTransactionReceipt({ hash });
	transactions.push({ action: "request one StarBuddy keepsake draw", hash });
	requestId = await publicClient.readContract({
		address: keepsakes,
		abi: keepsakesAbi,
		functionName: "latestRequestIdByOwner",
		args: [operator],
	});
	request = (await publicClient.readContract({
		address: keepsakes,
		abi: keepsakesAbi,
		functionName: "getRequest",
		args: [requestId],
	})) as RequestView;
}

const startedAt = Date.now();
while (request[2] === 1) {
	if (Date.now() - startedAt >= VRF_TIMEOUT_MS) {
		throw new Error("Chainlink VRF fulfillment timed out after 15 minutes.");
	}
	console.log("Waiting for StarBuddy Chainlink VRF fulfillment...");
	await new Promise((resolveDelay) => setTimeout(resolveDelay, VRF_POLL_MS));
	request = (await publicClient.readContract({
		address: keepsakes,
		abi: keepsakesAbi,
		functionName: "getRequest",
		args: [requestId],
	})) as RequestView;
}
if (request[1] !== 1 || request[2] !== 2 || request[5] === 0n) {
	throw new Error("The StarBuddy draw did not settle successfully.");
}

const resultTokenId = request[5];
const [tokenOwner, traits, locked, tokenUri, balanceAfter, lifetimeGrowth] =
	await Promise.all([
		publicClient.readContract({
			address: token,
			abi: tokenAbi,
			functionName: "ownerOf",
			args: [resultTokenId],
		}),
		publicClient.readContract({
			address: token,
			abi: tokenAbi,
			functionName: "getKeepsake",
			args: [resultTokenId],
		}),
		publicClient.readContract({
			address: token,
			abi: tokenAbi,
			functionName: "locked",
			args: [resultTokenId],
		}),
		publicClient.readContract({
			address: token,
			abi: tokenAbi,
			functionName: "tokenURI",
			args: [resultTokenId],
		}),
		publicClient.readContract({
			address: notebook,
			abi: notebookAbi,
			functionName: "getTransferableBalance",
			args: [operator],
		}),
		publicClient.readContract({
			address: notebook,
			abi: notebookAbi,
			functionName: "getGrowthPoints",
			args: [operator],
		}),
	]);
if (getAddress(tokenOwner) !== operator || !locked) {
	throw new Error("The settled keepsake ownership or SBT lock is invalid.");
}

const reusingPreviousRequest =
	previousEvidence?.requestId === requestId.toString();
const initialTransferableBalance = reusingPreviousRequest
	? (previousEvidence.verification?.initialTransferableBalance ??
		previousEvidence.verification?.transferableBalanceBefore ??
		balanceBefore.toString())
	: balanceBefore.toString();
const previousBalanceAfter =
	previousEvidence?.verification?.transferableBalanceAfter;
const transferableBalanceBeforeDraw = reusingPreviousRequest
	? (previousEvidence.verification?.transferableBalanceBeforeDraw ??
		(previousBalanceAfter
			? (BigInt(previousBalanceAfter) + drawCost).toString()
			: availableBalance.toString()))
	: availableBalance.toString();
const allTransactions = [
	...(reusingPreviousRequest ? (previousEvidence.transactions ?? []) : []),
	...transactions,
].filter(
	(transaction, index, collection) =>
		collection.findIndex((item) => item.hash === transaction.hash) === index,
);

const evidence = {
	status: "complete",
	phase: "verified",
	updatedAt: new Date().toISOString(),
	network: "Ethereum Sepolia",
	chainId: 11155111,
	operator,
	addresses: {
		onchainNotebook: notebook,
		starBuddyKeepsakeSbt: token,
		starBuddyKeepsakes: keepsakes,
		vrfCoordinator: VRF_COORDINATOR,
	},
	transactions: allTransactions,
	requestId: requestId.toString(),
	resultTokenId: resultTokenId.toString(),
	verification: {
		vrfSubscriptionId: subscriptionId.toString(),
		vrfConsumerConfigured: subscription[4].some(
			(consumer) => getAddress(consumer) === getAddress(keepsakes),
		),
		vrfNativeBalanceBeforeWei: nativeBalanceBeforeWei.toString(),
		vrfNativeBalanceAfterWei: subscription[1].toString(),
		growthStarConsumerConfigured: authorizedStarConsumer,
		minterRoleConfigured: minterConfigured,
		burnerRoleConfigured: burnerConfigured,
		drawCost: drawCost.toString(),
		initialTransferableBalance,
		transferableBalanceBeforeDraw,
		transferableBalanceAfter: balanceAfter.toString(),
		lifetimeGrowth: lifetimeGrowth.toString(),
		requestKind: request[1],
		requestStatus: request[2],
		series: traits[0],
		rarity: traits[1],
		tokenOwner,
		tokenLocked: locked,
		tokenUri,
	},
	fusionBoundary:
		"Fusion is deployed and locally verified. A live fusion transaction requires three naturally acquired cards with the same series and rarity; no admin mint or synthetic inventory is used.",
	contractRoleIds: {
		minter: keccak256(stringToBytes("MINTER_ROLE")),
		burner: keccak256(stringToBytes("BURNER_ROLE")),
	},
};

await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
	JSON.stringify({ ...evidence, evidencePath: EVIDENCE_PATH }, null, 2),
);
