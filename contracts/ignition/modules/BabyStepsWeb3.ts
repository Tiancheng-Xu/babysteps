import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SEPOLIA_VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const EMPTY_KEY_HASH = `0x${"00".repeat(32)}`;

export default buildModule("BabyStepsWeb3Module", (module) => {
	const admin = module.getAccount(0);
	const vrfCoordinator = module.getParameter(
		"vrfCoordinator",
		SEPOLIA_VRF_COORDINATOR,
	);
	const vrfSubscriptionId = module.getParameter("vrfSubscriptionId", 0n);
	const vrfKeyHash = module.getParameter("vrfKeyHash", EMPTY_KEY_HASH);
	const vrfRequestConfirmations = module.getParameter(
		"vrfRequestConfirmations",
		3,
	);
	const vrfCallbackGasLimit = module.getParameter(
		"vrfCallbackGasLimit",
		500_000,
	);

	const babyCoin = module.contract("BabyCoin", [admin]);
	const growthActivities = module.contract("GrowthActivities", [babyCoin]);
	const growthCertificate = module.contract("GrowthCertificate", [admin]);
	const taskMarketplace = module.contract("TaskMarketplace", [
		admin,
		babyCoin,
		growthCertificate,
		vrfCoordinator,
		vrfSubscriptionId,
		vrfKeyHash,
		vrfRequestConfirmations,
		vrfCallbackGasLimit,
	]);

	const rewardRole = module.staticCall(babyCoin, "REWARD_ROLE", [], 0, {
		id: "ReadRewardRole",
	});
	module.call(babyCoin, "grantRole", [rewardRole, growthActivities], {
		id: "GrantRewardRoleToGrowthActivities",
	});

	const minterRole = module.staticCall(
		growthCertificate,
		"MINTER_ROLE",
		[],
		0,
		{ id: "ReadMinterRole" },
	);
	module.call(growthCertificate, "grantRole", [minterRole, taskMarketplace], {
		id: "GrantMinterRoleToTaskMarketplace",
	});

	const providerRole = module.staticCall(
		taskMarketplace,
		"PROVIDER_ROLE",
		[],
		0,
		{ id: "ReadProviderRole" },
	);
	module.call(taskMarketplace, "grantRole", [providerRole, admin], {
		id: "GrantProviderRoleToDemoOperator",
	});

	const oracleRole = module.staticCall(taskMarketplace, "ORACLE_ROLE", [], 0, {
		id: "ReadOracleRole",
	});
	module.call(taskMarketplace, "grantRole", [oracleRole, admin], {
		id: "GrantOracleRoleToDemoOperator",
	});

	return {
		babyCoin,
		growthActivities,
		growthCertificate,
		taskMarketplace,
	};
});
