import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EMPTY_KEY_HASH = `0x${"00".repeat(32)}`;

export default buildModule("StarBuddyKeepsakesLocalModule", (module) => {
	const admin = module.getAccount(0);
	const metadataBaseUri = module.getParameter(
		"metadataBaseUri",
		"https://babysteps.baby2b.online/metadata/keepsakes/",
	);
	const notebook = module.contract("OnchainNotebook");
	const keepsakeToken = module.contract("StarBuddyKeepsakeSBT", [
		admin,
		metadataBaseUri,
	]);
	const vrfCoordinator = module.contract("MockVrfCoordinator");
	const keepsakes = module.contract("StarBuddyKeepsakes", [
		notebook,
		keepsakeToken,
		vrfCoordinator,
		1n,
		EMPTY_KEY_HASH,
		3,
		500_000,
	]);

	const minterRole = module.staticCall(keepsakeToken, "MINTER_ROLE", [], 0, {
		id: "ReadKeepsakeMinterRole",
	});
	const burnerRole = module.staticCall(keepsakeToken, "BURNER_ROLE", [], 0, {
		id: "ReadKeepsakeBurnerRole",
	});
	module.call(keepsakeToken, "grantRole", [minterRole, keepsakes], {
		id: "GrantKeepsakeMinterRole",
	});
	module.call(keepsakeToken, "grantRole", [burnerRole, keepsakes], {
		id: "GrantKeepsakeBurnerRole",
	});
	module.call(notebook, "setGrowthStarConsumer", [keepsakes, true], {
		id: "AuthorizeKeepsakeStarConsumer",
	});

	return { notebook, keepsakeToken, vrfCoordinator, keepsakes };
});
