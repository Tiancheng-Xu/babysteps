import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OnchainNotebookModule", (module) => {
	const notebook = module.contract("OnchainNotebook");

	return { notebook };
});
