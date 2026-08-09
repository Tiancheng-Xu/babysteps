import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { network } from "hardhat";
import {
	type Address,
	createPublicClient,
	getAddress,
	type Hash,
	http,
	keccak256,
	parseAbi,
	stringToBytes,
} from "viem";
import { sepolia } from "viem/chains";

const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const PARAMETER_PATH = resolve(
	"ignition/parameters/babysteps-web3.sepolia.json",
);
const DEPLOYMENT_PATH = resolve(
	"ignition/deployments/chain-11155111/deployed_addresses.json",
);

const accessControlAbi = parseAbi([
	"function hasRole(bytes32 role, address account) view returns (bool)",
	"function grantRole(bytes32 role, address account)",
]);
const coordinatorAbi = parseAbi([
	"function addConsumer(uint256 subId, address consumer)",
	"function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)",
]);
const role = (name: string) => keccak256(stringToBytes(name));

const parameters = JSON.parse(await readFile(PARAMETER_PATH, "utf8")) as {
	BabyStepsWeb3Module: { vrfSubscriptionId: string };
};
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
	throw new Error("No Sepolia deployer account is configured.");
const account = hardhatWallet.account;
const publicClient = createPublicClient({
	chain: sepolia,
	transport: http(PUBLIC_RPC),
});
const walletClient = hardhatWallet;
const transactions: Array<{ action: string; hash: Hash }> = [];

async function ensureRole(
	contract: Address,
	roleId: Hash,
	recipient: Address,
	action: string,
) {
	const configured = await publicClient.readContract({
		address: contract,
		abi: accessControlAbi,
		functionName: "hasRole",
		args: [roleId, recipient],
	});
	if (configured) return;
	const { request } = await publicClient.simulateContract({
		account,
		address: contract,
		abi: accessControlAbi,
		functionName: "grantRole",
		args: [roleId, recipient],
	});
	const hash = await walletClient.writeContract(request);
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error(`${action} reverted.`);
	transactions.push({ action, hash });
}

await ensureRole(
	babyCoin,
	role("REWARD_ROLE"),
	growthActivities,
	"grant REWARD_ROLE to GrowthActivities",
);
await ensureRole(
	growthCertificate,
	role("MINTER_ROLE"),
	taskMarketplace,
	"grant MINTER_ROLE to TaskMarketplace",
);
await ensureRole(
	taskMarketplace,
	role("PROVIDER_ROLE"),
	account.address,
	"grant PROVIDER_ROLE to demo operator",
);
await ensureRole(
	taskMarketplace,
	role("ORACLE_ROLE"),
	account.address,
	"grant ORACLE_ROLE to demo operator",
);

const subscriptionId = BigInt(parameters.BabyStepsWeb3Module.vrfSubscriptionId);
const subscription = await publicClient.readContract({
	address: VRF_COORDINATOR,
	abi: coordinatorAbi,
	functionName: "getSubscription",
	args: [subscriptionId],
});
if (getAddress(subscription[3]) !== getAddress(account.address)) {
	throw new Error("The VRF subscription is not owned by the deployer.");
}
const consumerConfigured = subscription[4].some(
	(consumer) => getAddress(consumer) === getAddress(taskMarketplace),
);
if (!consumerConfigured) {
	const { request } = await publicClient.simulateContract({
		account,
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "addConsumer",
		args: [subscriptionId, taskMarketplace],
	});
	const hash = await walletClient.writeContract(request);
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success")
		throw new Error("add VRF consumer reverted.");
	transactions.push({ action: "add TaskMarketplace as VRF consumer", hash });
}

console.log(
	JSON.stringify(
		{
			deployer: account.address,
			subscriptionId: subscriptionId.toString(),
			taskMarketplace,
			transactions,
		},
		null,
		2,
	),
);
