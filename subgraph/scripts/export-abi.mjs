import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const artifactPath = resolve(
	repositoryRoot,
	"contracts/artifacts/contracts/TaskMarketplaceV2.sol/TaskMarketplaceV2.json",
);
const outputPath = resolve(packageRoot, "abis/TaskMarketplaceV2.json");

const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
if (!Array.isArray(artifact.abi)) {
	throw new Error("TaskMarketplaceV2 artifact does not contain an ABI array.");
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
