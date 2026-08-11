import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SEPOLIA_BABY_COIN = "0x108a55217011983b93C3A95aD8D3B3343Bd5471b";
const SEPOLIA_VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const SEPOLIA_VRF_KEY_HASH =
	"0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";

export default buildModule("BabyStepsWeb3V2Module", (module) => {
	const admin = module.getAccount(0);
	const babyCoinAddress = module.getParameter(
		"babyCoinAddress",
		SEPOLIA_BABY_COIN,
	);
	const vrfCoordinator = module.getParameter(
		"vrfCoordinator",
		SEPOLIA_VRF_COORDINATOR,
	);
	const vrfSubscriptionId = module.getParameter("vrfSubscriptionId", 0n);
	const vrfKeyHash = module.getParameter("vrfKeyHash", SEPOLIA_VRF_KEY_HASH);
	const vrfRequestConfirmations = module.getParameter(
		"vrfRequestConfirmations",
		3,
	);
	const vrfCallbackGasLimit = module.getParameter(
		"vrfCallbackGasLimit",
		500_000,
	);

	const babyCoin = module.contractAt("BabyCoin", babyCoinAddress);
	const growthCertificateSBT = module.contract("GrowthCertificateSBT", [admin]);
	const taskMarketplaceV2 = module.contract("TaskMarketplaceV2", [
		admin,
		babyCoin,
		growthCertificateSBT,
		vrfCoordinator,
		vrfSubscriptionId,
		vrfKeyHash,
		vrfRequestConfirmations,
		vrfCallbackGasLimit,
	]);

	const minterRole = module.staticCall(
		growthCertificateSBT,
		"MINTER_ROLE",
		[],
		0,
		{ id: "ReadV2MinterRole" },
	);
	module.call(
		growthCertificateSBT,
		"grantRole",
		[minterRole, taskMarketplaceV2],
		{ id: "GrantV2MinterRoleToMarketplace" },
	);

	return { babyCoin, growthCertificateSBT, taskMarketplaceV2 };
});
