import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { network } from "hardhat";
import { type Address, getAddress, parseEther, parseEventLogs } from "viem";

const VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const VRF_KEY_HASH =
	"0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";
// Sepolia uses the 500 gwei gas lane. A 500k callback plus verification gas
// requires roughly 0.434 ETH of maximum native-payment reserve, so keep margin.
const TARGET_NATIVE_BALANCE = parseEther("0.5");
const PARAMETER_PATH = resolve(
	"ignition/parameters/babysteps-web3.sepolia.json",
);

const coordinatorAbi = [
	{
		type: "event",
		name: "SubscriptionCreated",
		inputs: [
			{ indexed: true, name: "subId", type: "uint256" },
			{ indexed: false, name: "owner", type: "address" },
		],
	},
	{
		type: "function",
		name: "createSubscription",
		stateMutability: "nonpayable",
		inputs: [],
		outputs: [{ name: "subId", type: "uint256" }],
	},
	{
		type: "function",
		name: "fundSubscriptionWithNative",
		stateMutability: "payable",
		inputs: [{ name: "subId", type: "uint256" }],
		outputs: [],
	},
	{
		type: "function",
		name: "getSubscription",
		stateMutability: "view",
		inputs: [{ name: "subId", type: "uint256" }],
		outputs: [
			{ name: "balance", type: "uint96" },
			{ name: "nativeBalance", type: "uint96" },
			{ name: "reqCount", type: "uint64" },
			{ name: "owner", type: "address" },
			{ name: "consumers", type: "address[]" },
		],
	},
] as const;

const connection = await network.create();
const [wallet] = await connection.viem.getWalletClients();
const publicClient = await connection.viem.getPublicClient();
let subscriptionId: bigint;
let creationHash: `0x${string}` | undefined;

let requestedSubscription = process.env.VRF_SUBSCRIPTION_ID?.trim();
if (!requestedSubscription) {
	try {
		const existingParameters = JSON.parse(
			await readFile(PARAMETER_PATH, "utf8"),
		) as { BabyStepsWeb3Module?: { vrfSubscriptionId?: string } };
		requestedSubscription =
			existingParameters.BabyStepsWeb3Module?.vrfSubscriptionId?.trim();
	} catch (error) {
		if (
			typeof error !== "object" ||
			error === null ||
			!("code" in error) ||
			error.code !== "ENOENT"
		) {
			throw error;
		}
	}
}
if (requestedSubscription) {
	subscriptionId = BigInt(requestedSubscription);
} else {
	creationHash = await wallet.writeContract({
		account: wallet.account,
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "createSubscription",
	});
	const receipt = await publicClient.waitForTransactionReceipt({
		hash: creationHash,
	});
	const [created] = parseEventLogs({
		abi: coordinatorAbi,
		eventName: "SubscriptionCreated",
		logs: receipt.logs,
	});
	if (!created) throw new Error("VRF SubscriptionCreated event was not found.");
	subscriptionId = created.args.subId;
}

let subscription = await publicClient.readContract({
	address: VRF_COORDINATOR,
	abi: coordinatorAbi,
	functionName: "getSubscription",
	args: [subscriptionId],
});
const owner = getAddress(subscription[3] as Address);
if (owner !== getAddress(wallet.account.address)) {
	throw new Error(
		"The selected VRF subscription is not owned by the deployer.",
	);
}

let fundingHash: `0x${string}` | undefined;
const nativeBalance = subscription[1];
if (nativeBalance < TARGET_NATIVE_BALANCE) {
	fundingHash = await wallet.writeContract({
		account: wallet.account,
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "fundSubscriptionWithNative",
		args: [subscriptionId],
		value: TARGET_NATIVE_BALANCE - nativeBalance,
	});
	await publicClient.waitForTransactionReceipt({ hash: fundingHash });
	subscription = await publicClient.readContract({
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "getSubscription",
		args: [subscriptionId],
	});
}

await mkdir(dirname(PARAMETER_PATH), { recursive: true });
await writeFile(
	PARAMETER_PATH,
	`${JSON.stringify(
		{
			BabyStepsWeb3Module: {
				vrfCoordinator: VRF_COORDINATOR,
				vrfSubscriptionId: subscriptionId.toString(),
				vrfKeyHash: VRF_KEY_HASH,
				vrfRequestConfirmations: 3,
				vrfCallbackGasLimit: 500_000,
			},
		},
		null,
		2,
	)}\n`,
);

console.log(
	JSON.stringify(
		{
			deployer: wallet.account.address,
			subscriptionId: subscriptionId.toString(),
			nativeBalanceWei: subscription[1].toString(),
			creationHash,
			fundingHash,
			parameterFile: PARAMETER_PATH,
		},
		null,
		2,
	),
);
