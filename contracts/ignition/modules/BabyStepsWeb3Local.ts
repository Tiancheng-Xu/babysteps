import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EMPTY_KEY_HASH = `0x${"00".repeat(32)}`;

export default buildModule("BabyStepsWeb3LocalModule", (module) => {
	const admin = module.getAccount(0);
	const coordinator = module.contract("MockVrfCoordinator");
	const babyCoin = module.contract("BabyCoin", [admin]);
	const growthActivities = module.contract("GrowthActivities", [babyCoin]);
	const growthCertificate = module.contract("GrowthCertificate", [admin]);
	const taskMarketplace = module.contract("TaskMarketplace", [
		admin,
		babyCoin,
		growthCertificate,
		coordinator,
		1n,
		EMPTY_KEY_HASH,
		3,
		500_000,
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

	return {
		coordinator,
		babyCoin,
		growthActivities,
		growthCertificate,
		taskMarketplace,
	};
});
