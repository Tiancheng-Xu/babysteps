import react from "@vitejs/plugin-react";
import { isAddress, zeroAddress } from "viem";
import { defineConfig, loadEnv } from "vite";

const testNotebookAddress = "0x0000000000000000000000000000000000000001";

function assertProductionNotebookAddress(address: string | undefined) {
	if (
		!address ||
		!isAddress(address) ||
		address.toLowerCase() === zeroAddress ||
		address.toLowerCase() === testNotebookAddress
	) {
		throw new Error(
			"VITE_ONCHAIN_NOTEBOOK_ADDRESS must be a deployed, non-zero contract address for production builds.",
		);
	}
}

export default defineConfig(({ command, mode }) => {
	if (command === "build") {
		assertProductionNotebookAddress(
			loadEnv(mode, process.cwd(), "").VITE_ONCHAIN_NOTEBOOK_ADDRESS,
		);
	}

	return {
		plugins: [react()],
		test: {
			environment: "jsdom",
			setupFiles: ["./src/test/setup.ts"],
		},
	};
});
