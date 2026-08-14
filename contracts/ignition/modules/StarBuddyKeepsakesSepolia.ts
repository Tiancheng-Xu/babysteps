import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SEPOLIA_VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
const SEPOLIA_VRF_KEY_HASH =
	"0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";

export default buildModule("StarBuddyKeepsakesSepoliaModule", (module) => {
	const admin = module.getAccount(0);
	const metadataBaseUri = module.getParameter(
		"metadataBaseUri",
		"https://babysteps.baby2b.online/metadata/keepsakes/",
	);
	const vrfCoordinatorAddress = module.getParameter(
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

	const notebook = module.contract("OnchainNotebook");
	const keepsakeToken = module.contract("StarBuddyKeepsakeSBT", [
		admin,
		metadataBaseUri,
	]);
	const keepsakes = module.contract("StarBuddyKeepsakes", [
		notebook,
		keepsakeToken,
		vrfCoordinatorAddress,
		vrfSubscriptionId,
		vrfKeyHash,
		vrfRequestConfirmations,
		vrfCallbackGasLimit,
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

	return { notebook, keepsakeToken, keepsakes };
});
