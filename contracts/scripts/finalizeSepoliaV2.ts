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
	"ignition/deployments/chain-11155111/deployed_addresses.json",
);
const EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-10-sepolia-v2-finalize.json",
);

const accessControlAbi = parseAbi([
	"function hasRole(bytes32 role,address account) view returns (bool)",
	"function grantRole(bytes32 role,address account)",
]);
const coordinatorAbi = parseAbi([
	"function addConsumer(uint256 subId,address consumer)",
	"function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
]);
const role = (name: string) => keccak256(stringToBytes(name));

const parameters = JSON.parse(await readFile(PARAMETER_PATH, "utf8")) as {
	BabyStepsWeb3V2Module: { vrfSubscriptionId: string };
};
const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const certificate = deployed["BabyStepsWeb3V2Module#GrowthCertificateSBT"];
const marketplace = deployed["BabyStepsWeb3V2Module#TaskMarketplaceV2"];
if (!certificate || !marketplace) {
	throw new Error("BabySteps V2 Sepolia deployment addresses are missing.");
}

const connection = await network.create();
const [wallet] = await connection.viem.getWalletClients();
const publicClient = await connection.viem.getPublicClient();
if (!wallet) throw new Error("No Sepolia deployer account is configured.");
const operator = getAddress(wallet.account.address);
const transactions: Array<{ action: string; hash: Hash }> = [];

async function ensureRole(roleId: Hash, recipient: Address, action: string) {
	const configured = await publicClient.readContract({
		address: marketplace,
		abi: accessControlAbi,
		functionName: "hasRole",
		args: [roleId, recipient],
	});
	if (configured) return;
	const hash = await wallet.writeContract({
		account: wallet.account,
		address: marketplace,
		abi: accessControlAbi,
		functionName: "grantRole",
		args: [roleId, recipient],
	});
	await publicClient.waitForTransactionReceipt({ hash });
	transactions.push({ action, hash });
}

await ensureRole(
	role("PROVIDER_ROLE"),
	operator,
	"grant PROVIDER_ROLE to demo operator",
);

const subscriptionId = BigInt(
	parameters.BabyStepsWeb3V2Module.vrfSubscriptionId,
);
const subscription = await publicClient.readContract({
	address: VRF_COORDINATOR,
	abi: coordinatorAbi,
	functionName: "getSubscription",
	args: [subscriptionId],
});
if (getAddress(subscription[3]) !== operator) {
	throw new Error(
		"The selected VRF subscription is not owned by the deployer.",
	);
}
if (
	!subscription[4].some(
		(consumerAddress) =>
			getAddress(consumerAddress) === getAddress(marketplace),
	)
) {
	const hash = await wallet.writeContract({
		account: wallet.account,
		address: VRF_COORDINATOR,
		abi: coordinatorAbi,
		functionName: "addConsumer",
		args: [subscriptionId, marketplace],
	});
	await publicClient.waitForTransactionReceipt({ hash });
	transactions.push({ action: "add TaskMarketplaceV2 as VRF consumer", hash });
}

const providerConfigured = await publicClient.readContract({
	address: marketplace,
	abi: accessControlAbi,
	functionName: "hasRole",
	args: [role("PROVIDER_ROLE"), operator],
});
const completionRelayerConfigured = await publicClient.readContract({
	address: marketplace,
	abi: accessControlAbi,
	functionName: "hasRole",
	args: [role("COMPLETION_RELAYER_ROLE"), operator],
});
const evidence = {
	status: "partially-finalized",
	updatedAt: new Date().toISOString(),
	network: "Ethereum Sepolia",
	chainId: 11155111,
	operator,
	subscriptionId: subscriptionId.toString(),
	addresses: { certificate, marketplace, vrfCoordinator: VRF_COORDINATOR },
	transactions,
	verification: {
		providerConfigured,
		vrfConsumerConfigured: true,
		completionRelayerConfigured,
	},
	securityBoundary:
		"The deployer is intentionally not granted COMPLETION_RELAYER_ROLE. That role remains pending for an AWS KMS-backed non-exportable signer after explicit cost approval.",
};
await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
	JSON.stringify({ ...evidence, evidencePath: EVIDENCE_PATH }, null, 2),
);
