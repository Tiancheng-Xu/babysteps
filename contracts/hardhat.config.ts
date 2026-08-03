import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
	plugins: [hardhatToolboxViem],
	solidity: {
		version: "0.8.28",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	networks: {
		sepolia: {
			type: "http",
			chainType: "l1",
			url: configVariable("SEPOLIARPCURL"),
			accounts: [configVariable("SEPOLIAPRIVATEKEY")],
		},
	},
	verify: {
		etherscan: { apiKey: configVariable("ETHERSCANAPIKEY") },
	},
});
