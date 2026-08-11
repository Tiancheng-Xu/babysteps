import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EMPTY_KEY_HASH = `0x${"00".repeat(32)}`;

export default buildModule("BabyStepsWeb3V2LocalModule", (module) => {
	const admin = module.getAccount(0);
	const coordinator = module.contract("MockVrfCoordinator");
	const babyCoin = module.contract("BabyCoin", [admin]);
	const growthCertificateSBT = module.contract("GrowthCertificateSBT", [admin]);
	const taskMarketplaceV2 = module.contract("TaskMarketplaceV2", [
		admin,
		babyCoin,
		growthCertificateSBT,
		coordinator,
		1n,
		EMPTY_KEY_HASH,
		3,
		500_000,
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

	return { coordinator, babyCoin, growthCertificateSBT, taskMarketplaceV2 };
});
