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
	const loadedEnv = loadEnv(mode, process.cwd(), "");
	const notebookAddress =
		process.env.VITE_ONCHAIN_NOTEBOOK_ADDRESS ??
		loadedEnv.VITE_ONCHAIN_NOTEBOOK_ADDRESS;
	const base = process.env.VITE_BASE_PATH ?? loadedEnv.VITE_BASE_PATH ?? "/";

	if (command === "build") {
		assertProductionNotebookAddress(notebookAddress);
	}

	return {
		// GitHub Pages hosts this repository at /course-homework/. Local and
		// other deployments keep Vite's root default unless explicitly set.
		base,
		plugins: [react()],
		test: {
			environment: "jsdom",
			setupFiles: ["./src/test/setup.ts"],
		},
	};
});
