import { network } from "hardhat";
import { formatEther } from "viem";

const VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const LINK_TOKEN = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

const connection = await network.create();
const [wallet] = await connection.viem.getWalletClients();
const publicClient = await connection.viem.getPublicClient();

const [balance, coordinatorCode, linkCode] = await Promise.all([
	publicClient.getBalance({ address: wallet.account.address }),
	publicClient.getCode({ address: VRF_COORDINATOR }),
	publicClient.getCode({ address: LINK_TOKEN }),
]);

console.log(
	JSON.stringify(
		{
			chainId: await publicClient.getChainId(),
			deployer: wallet.account.address,
			sepoliaEth: formatEther(balance),
			vrfCoordinatorHasCode: Boolean(
				coordinatorCode && coordinatorCode !== "0x",
			),
			linkTokenHasCode: Boolean(linkCode && linkCode !== "0x"),
		},
		null,
		2,
	),
);
