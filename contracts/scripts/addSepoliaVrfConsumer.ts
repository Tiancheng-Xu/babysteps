import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { network } from "hardhat";
import { type Address, getAddress } from "viem";

const VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const PARAMETER_PATH = resolve(
	"ignition/parameters/babysteps-web3.sepolia.json",
);
const DEPLOYMENT_PATH = resolve(
	"ignition/deployments/chain-11155111/deployed_addresses.json",
);

const coordinatorAbi = [
	{
		type: "function",
		name: "addConsumer",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "subId", type: "uint256" },
			{ name: "consumer", type: "address" },
		],
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

const parameters = JSON.parse(await readFile(PARAMETER_PATH, "utf8")) as {
	BabyStepsWeb3Module: { vrfSubscriptionId: string };
};
const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const subscriptionId = BigInt(parameters.BabyStepsWeb3Module.vrfSubscriptionId);
const consumer = deployed["BabyStepsWeb3Module#TaskMarketplace"];
if (!consumer)
	throw new Error("TaskMarketplace deployment address is missing.");

const connection = await network.create();
const [wallet] = await connection.viem.getWalletClients();
const publicClient = await connection.viem.getPublicClient();
const subscription = await publicClient.readContract({
	address: VRF_COORDINATOR,
	abi: coordinatorAbi,
	functionName: "getSubscription",
	args: [subscriptionId],
});
if (getAddress(subscription[3]) !== getAddress(wallet.account.address)) {
	throw new Error("The VRF subscription is not owned by the deployer.");
}

const alreadyAdded = subscription[4].some(
	(existing) => getAddress(existing) === getAddress(consumer),
);
let transactionHash: `0x${string}` | undefined;
if (!alreadyAdded) {
	transactionHash = await wallet.writeContract({
		account: wallet.account,
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "addConsumer",
		args: [subscriptionId, consumer],
	});
	await publicClient.waitForTransactionReceipt({ hash: transactionHash });
}

console.log(
	JSON.stringify(
		{
			subscriptionId: subscriptionId.toString(),
			consumer,
			alreadyAdded,
			transactionHash,
		},
		null,
		2,
	),
);
